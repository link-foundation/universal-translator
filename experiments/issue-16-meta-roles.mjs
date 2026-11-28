// Reproduce lost block metadata and cross-runtime child-order differences.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { formatMeta } from '../js/src/meta/notation.js';

const oldSource = execFileSync(
  'git',
  ['show', 'a3cee36:js/src/meta/notation.js'],
  {
    encoding: 'utf8',
    maxBuffer: 64 * 1024,
  }
).replace(
  "'./library.js'",
  JSON.stringify(new URL('../js/src/meta/library.js', import.meta.url).href)
);
const before = await import(
  `data:text/javascript;base64,${Buffer.from(oldSource).toString('base64')}`
);
for (const name of ['annotated-block', 'queries-library']) {
  const fixture = new URL(
    `../examples/translation/meta-roles/${name}.json`,
    import.meta.url
  );
  const input = JSON.parse(readFileSync(fixture, 'utf8'));
  const expected = readFileSync(new URL(`${name}.lino`, fixture), 'utf8');
  assert.notEqual(before.formatMeta(input), expected);
  assert.equal(formatMeta(input), expected);
  console.log(
    `PASS ${name}: a3cee36 differs; current view preserves every named role`
  );
}
