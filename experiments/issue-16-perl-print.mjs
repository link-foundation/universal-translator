// Reproduce argument truncation with a finite, eight-print native program.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
import { meaningDifference } from '../js/src/meta/tree.js';

const before = process.argv.includes('--before');
let emit;
if (before) {
  const source = execFileSync(
    'git',
    ['show', '951c620:js/src/formal/emitter.js'],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    }
  ).replace(
    /from '([.][^']+)'/g,
    (_, relative) =>
      `from ${JSON.stringify(new URL(relative, new URL('../js/src/formal/emitter.js', import.meta.url)).href)}`
  );
  ({ emitProgram: emit } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  ));
}
const translator = createTranslator(emit ? { emit } : {});
const source = readFileSync(
  new URL('../examples/printing/arithmetic.py', import.meta.url),
  'utf8'
);
const output = translator.translate(source, 'python', 'perl');
const expected = '3\n20\n8\n11\n-2\nsum = 3\n3!\n';
const native = spawnSync('perl', ['-we', output], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024,
});
const difference = meaningDifference(
  translator.toMeta(source, 'python'),
  translator.toMeta(output, 'perl')
);
const result = {
  emitter: before ? '951c620' : 'current',
  output,
  expected,
  status: native.status,
  stdout: native.stdout,
  stderr: native.stderr,
  roundTripDifference: difference ?? null,
};
console.log(JSON.stringify(result, null, 2));
process.exitCode = Number(
  Boolean(native.error) ||
    native.status !== 0 ||
    native.stdout !== expected ||
    Boolean(difference)
);
