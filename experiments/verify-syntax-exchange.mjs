import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import {
  createSourceSyntaxCodec,
  createTranslator,
  writeSourceDocument,
} from '../js/src/index.js';
import { verifyPortableOutput } from '../examples/translation/portable-programs.mjs';

const [modulePath, executable = 'target/debug/universal-translator'] =
  process.argv.slice(2);
assert.ok(modulePath, 'Pass the Meta Language 1.0 JavaScript module path');
const grammarEngine = await import(pathToFileURL(resolve(modulePath)));
const { LinkNetwork, LinkType } = grammarEngine;
const codec = createSourceSyntaxCodec(LinkNetwork);

function run(program, arguments_, options) {
  const result = spawnSync(program, arguments_, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    ...options,
  });
  assert.ifError(result.error);
  return result;
}

function success(result) {
  assert.equal(result.status, 0, result.stderr || result.signal);
  return result.stdout;
}

const rustCli = (arguments_, input) =>
  run(resolve(executable), arguments_, { input });
const rust = (arguments_, input) => success(rustCli(arguments_, input));
const jsCli = (arguments_, input) =>
  run(process.execPath, ['bin/universal-translator.js', ...arguments_], {
    input,
    env: {
      ...process.env,
      UNIVERSAL_TRANSLATOR_META_LANGUAGE: resolve(modulePath),
    },
  });

const hello = (ext) =>
  readFileSync(
    new URL(`../examples/translation/hello.${ext}`, import.meta.url),
    'utf8'
  );
const samples = [
  [
    'JavaScript',
    '\ufeff// 🐍\r\nconst greeting = "Hello";',
    'lexical_declaration',
  ],
  ['Rust', '  fn main() { /* 🦀 */ }\n\r\n', 'function_item'],
  ['Python', 'def greet():\r\n    return "Hello"\r\n', 'function_definition'],
  ['C', hello('c'), 'function_definition'],
  ['C#', hello('cs'), 'class_declaration'],
  ['sql-sqlite', '  SELECT 1; -- comment\n', 'statement'],
  ['rust', '', 'source_file'],
];
for (const [language, source, term] of samples) {
  const javascriptNotation = codec.write(language, source);
  const rustNotation = rust(['encode-cst', language], source);
  for (const notation of [javascriptNotation, rustNotation]) {
    const network = LinkNetwork.fromLino(notation);
    assert.ok(
      network.links().some((link) => {
        const metadata = link.metadata();
        return metadata.linkType === LinkType.Syntax && metadata.term === term;
      }),
      `${language} CST lacks ${term}`
    );
    assert.deepEqual(codec.read(notation), { language, source });
    assert.equal(rust(['decode-cst'], notation), source);
  }
}
assert.throws(() => codec.write('Nonexistent grammar', 'text'), /provenance/);
assert.throws(() => codec.read(writeSourceDocument('Rust', 'fn main() {}')));
console.log(
  `Both implementations encoded and restored ${samples.length} grammar CST specimens`
);

const translator = createTranslator({ grammarEngine });
const document = translator.parse(hello('c'), 'c');
assert.deepEqual(document.interpretation.requires, ['stdio.h']);
const realizes = document.network
  .links()
  .find((link) => link.metadata().term === 'realizes');
const operation = document.network.link(realizes.references()[0]);
const root = document.network.link(operation.references()[0]);
assert.equal(root.metadata().term, 'translation_unit');
assert.equal(translator.restore(document), hello('c'));

const programs = [
  {
    from: 'javascript',
    to: 'rust',
    source: 'const answer = 6 * 7;\nconsole.log(answer);\n',
    stdout: '42\n',
  },
  {
    from: 'rust',
    to: 'javascript',
    source: 'fn main() { let answer: i32 = 7 * 6; println!("{}", answer); }\n',
    stdout: '42\n',
  },
];

for (const { from, to, source, stdout } of programs) {
  const fromRust = rust(['encode-cst', from], source);
  const fromJs = success(jsCli(['encode-cst', from], source));
  assert.equal(success(jsCli(['decode-cst'], fromRust)), source);
  assert.equal(rust(['decode-cst'], fromJs), source);
  const targets = new Set();
  for (const [cli, notation] of [
    [jsCli, fromRust],
    [rustCli, fromJs],
  ]) {
    const translated = success(cli(['translate-program', 'cst', to], notation));
    assert.equal(
      success(cli(['translate', from, to, '--mode', 'same-effect'], source)),
      translated
    );
    targets.add(translated);
  }
  verifyPortableOutput(
    [
      { language: from, source },
      ...[...targets].map((source) => ({ language: to, source })),
    ],
    stdout,
    `CST exchange from ${from} to ${to}`
  );
}
for (const cli of [jsCli, rustCli]) {
  for (const [source, diagnostic] of [
    ['const = ;', /syntax errors/],
    ['class Example {}', /Unsupported JavaScript program:/],
  ]) {
    const result = cli(['translate-program', 'javascript', 'rust'], source);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, diagnostic);
  }
}
console.log(
  'Both implementations compiled and ran checked JavaScript and Rust translations from exchanged CSTs'
);
