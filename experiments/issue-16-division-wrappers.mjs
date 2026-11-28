// Finite integer-division grouping audit. --before substitutes the old writer.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
let emit;
if (process.argv.includes('--before')) {
  const old = execFileSync(
    'git',
    ['show', 'e1d4cfb:js/src/formal/emitter.js'],
    { encoding: 'utf8', maxBuffer: 128 * 1024 }
  ).replace(
    /from '([.][^']+)'/g,
    (_, relative) =>
      `from ${JSON.stringify(new URL(relative, new URL('../js/src/formal/emitter.js', import.meta.url)).href)}`
  );
  emit = (
    await import(
      `data:text/javascript;base64,${Buffer.from(old).toString('base64')}`
    )
  ).emitProgram;
}
const translator = createTranslator(emit ? { emit } : {});
const source = readFileSync(
  new URL('../examples/arithmetic/division.c', import.meta.url),
  'utf8'
);
const expected = readFileSync(
  new URL('../examples/arithmetic/division.txt', import.meta.url),
  'utf8'
);
const results = [];
for (const [language, command, args] of [
  ['javascript', 'node', ['-e']],
  ['javascript@es5', 'node', ['-e']],
  ['typescript', 'node', ['--input-type=module', '-e']],
  ['perl', 'perl', ['-we']],
  ['php@5', 'php', []],
]) {
  const written = translator.translate(source, 'c', language);
  const output = execFileSync(
    command,
    [...args, ...(command === 'php' ? [] : [written])],
    {
      encoding: 'utf8',
      input: command === 'php' ? written : undefined,
      maxBuffer: 64 * 1024,
    }
  );
  let passed = true;
  try {
    assert.equal(output, expected);
  } catch {
    passed = false;
  }
  results.push({ language, written, output, expected, passed });
}
console.log(
  JSON.stringify(
    { results, failures: results.filter((r) => !r.passed).length },
    null,
    2
  )
);
process.exitCode = Number(results.some((r) => !r.passed));
