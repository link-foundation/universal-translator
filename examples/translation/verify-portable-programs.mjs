#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(
  new URL('../../bin/universal-translator.js', import.meta.url)
);
const samples = {
  JavaScript: 'console.log("42");\n',
  Rust: 'fn main() { println!("{}", 42); }\n',
  Lean: 'def main : IO Unit := do\n  IO.println (6 * 7 : Nat)\n',
  Rocq: [
    'From Stdlib Require Import String List.',
    'Open Scope string_scope.',
    'Definition main : list string := "42" :: nil.',
    'Eval vm_compute in main.',
    '',
  ].join('\n'),
};
const leanWithTheorems = readFileSync(
  new URL('portable-emission.lean', import.meta.url),
  'utf8'
);

function run(program, args, input, cwd) {
  return execFileSync(program, args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

function runTarget(directory, language, source) {
  switch (language) {
    case 'JavaScript':
      return run('node', ['--input-type=module'], source);
    case 'Rust':
      run(
        'rustc',
        ['--edition=2024', '--crate-name', 'portable', '-o', 'portable', '-'],
        source,
        directory
      );
      return run(join(directory, 'portable'), []);
    case 'Lean':
      writeFileSync(join(directory, 'Program.lean'), source);
      return run('lean', ['--run', 'Program.lean'], undefined, directory);
    case 'Rocq': {
      // Compare the computed output value inside Rocq to avoid relying on its
      // pretty-printer's layout, scopes and notation for lists.
      const assertion = [
        'Example portable_output : main = ("42"%string :: nil)%list.',
        'Proof. vm_compute. reflexivity. Qed.',
        '',
      ].join('\n');
      writeFileSync(join(directory, 'Program.v'), `${source}\n${assertion}`);
      run('rocq', ['compile', 'Program.v'], undefined, directory);
      return '42\n';
    }
    default:
      throw new Error(`Missing native runner for ${language}`);
  }
}

const [rustExecutable, option] = process.argv
  .slice(2)
  .filter((argument) => argument !== '--native-logic');
assert.equal(option, undefined, 'Expected at most a Rust translator path');
const nativeLogic = process.argv.includes('--native-logic');
const js = (args, input) => run('node', [cli, ...args], input);
const translators = [['JavaScript', js]];
if (rustExecutable) {
  const binary = resolve(rustExecutable);
  translators.push(['Rust', (args, input) => run(binary, args, input)]);
}

const nativeTarget = (language) =>
  nativeLogic || language === 'JavaScript' || language === 'Rust';
const directory = mkdtempSync(join(tmpdir(), 'portable-translations-'));
try {
  for (const [from, source] of Object.entries(samples)) {
    if (nativeTarget(from)) {
      assert.equal(runTarget(directory, from, source), '42\n', from);
    }
    const notations = translators.map(([, translate]) =>
      translate(['encode-cst', from], source)
    );
    for (const [name, translate] of translators) {
      for (const notation of notations) {
        assert.equal(
          translate(['decode-cst'], notation),
          source,
          `${name} ${from} round trip`
        );
      }
      for (const to of Object.keys(samples).filter(
        (language) => language !== from
      )) {
        const target = to === 'Rocq' ? 'coq' : to.toLowerCase();
        const result = translate(
          ['translate-program', from.toLowerCase(), target],
          source
        );
        for (const notation of notations) {
          assert.equal(
            translate(['translate-program', 'cst', to], notation),
            result,
            `${name} ${from} → ${to} exchange`
          );
        }
        if (nativeTarget(to)) {
          assert.equal(
            runTarget(directory, to, result),
            '42\n',
            `${name} ${from} → ${to}`
          );
        }
        console.log(
          `PASS ${name} ${from} → ${to}${nativeTarget(to) ? ' (native)' : ''}`
        );
      }
    }
  }
  for (const [name, translate] of translators) {
    const translated = translate(
      ['translate-program', 'lean', 'javascript'],
      leanWithTheorems
    );
    assert.equal(
      runTarget(directory, 'JavaScript', translated),
      "0\n42\nC:\\draft's\n",
      name
    );
    assert.equal(
      run(
        'node',
        ['--input-type=module', '-', '--ml-check-theorems'],
        translated
      ),
      "theorem answer': holds on the bounded domain\ntheorem allPackets: holds on the bounded domain\n",
      name
    );
    console.log(
      `PASS ${name} Lean data, clamped casts and theorem checks → JavaScript (native)`
    );
  }
} finally {
  rmSync(directory, { force: true, recursive: true });
}
