import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [moduleFile, rustTranslator, installedCli] = process.argv.slice(2);
assert.ok(
  moduleFile && rustTranslator,
  'Pass --default or a Meta Language module, the Rust CLI and optional packaged JavaScript CLI'
);
const cli = installedCli
  ? resolve(installedCli)
  : fileURLToPath(new URL('../bin/universal-translator.js', import.meta.url));
const jsEnvironment = { ...process.env };
if (installedCli || moduleFile === '--default') {
  delete jsEnvironment.UNIVERSAL_TRANSLATOR_META_LANGUAGE;
} else {
  jsEnvironment.UNIVERSAL_TRANSLATOR_META_LANGUAGE = resolve(moduleFile);
}
const options = { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 };
const jsPrefix = [process.execPath, [cli]];
const rustPrefix = [resolve(rustTranslator), []];
const engines = [
  {
    name: 'JavaScript',
    prefix: jsPrefix,
    env: jsEnvironment,
  },
  { name: 'Rust', prefix: rustPrefix, env: process.env },
];
const cases = [
  {
    from: 'JavaScript',
    to: 'Rust',
    source:
      '// Résultat\r\nfunction main() { console.log(21 * 2); }\r\nmain();\r\n',
  },
  {
    from: 'Rust',
    to: 'JavaScript',
    source: '// Résultat\r\nfn main() { println!("{}", 21 * 2); }\r\n',
  },
];
const invoke = ({ prefix: [command, args], env }, params, input) =>
  execFileSync(command, [...args, ...params], { ...options, env, input });

const directory = mkdtempSync(join(tmpdir(), 'portable-translation-'));
try {
  const run = (source, language) => {
    const file = join(directory, language === 'Rust' ? 'main.rs' : 'main.mjs');
    writeFileSync(file, source);
    if (language === 'JavaScript') {
      return execFileSync(process.execPath, [file], options);
    }
    const binary = join(directory, 'main');
    execFileSync('rustc', [file, '-o', binary], options);
    return execFileSync(binary, [], options);
  };
  for (const { from, to, source } of cases) {
    const original = run(source, from);
    assert.equal(original, '42\n');
    for (const [index, issuer] of engines.entries()) {
      const receiver = engines[1 - index];
      const encoded = invoke(issuer, ['encode-cst', from, '-'], source);
      assert.equal(invoke(receiver, ['decode-cst', '-'], encoded), source);
      for (const [inputKind, input] of [
        [from, source],
        ['cst', encoded],
      ]) {
        const engine = inputKind === 'cst' ? receiver : issuer;
        const emitted = invoke(
          engine,
          ['translate-program', inputKind, to, '-'],
          input
        );
        assert.equal(run(emitted, to), original);
        console.log(
          JSON.stringify({
            engine: engine.name,
            inputKind,
            from,
            to,
            stdout: original,
          })
        );
      }
    }
  }
  for (const engine of engines) {
    const [command, args] = engine.prefix;
    for (const [source, error] of [
      ['function main( {\n', /CST contains syntax errors/u],
      ['class Example {}\n', /Unsupported JavaScript program/u],
    ]) {
      const result = spawnSync(
        command,
        [...args, 'translate-program', 'javascript', 'rust', '-'],
        { ...options, env: engine.env, input: source }
      );
      assert.equal(result.status, 1, engine.name);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, error);
    }
    console.log(
      JSON.stringify({
        engine: engine.name,
        rejected: ['syntax error', 'unsupported class'],
      })
    );
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
