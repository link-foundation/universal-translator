import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createTranslator } from '../js/src/index.js';
import { meaningDifference } from '../js/src/meta/tree.js';

const translator = createTranslator();
const source = readFileSync(
  new URL('../examples/programs/leap-year.js', import.meta.url),
  'utf8'
);
const meta = translator.toMeta(source, 'javascript');
const previousModule = execFileSync(
  'git',
  ['show', 'a3cee36:js/src/formal/objpak.js'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 }
).replaceAll(
  /from '([^']+)'/gu,
  (_, relative) =>
    `from '${new URL(relative, new URL('../js/src/formal/objpak.js', import.meta.url)).href}'`
);
const previous = await import(
  `data:text/javascript;base64,${Buffer.from(previousModule).toString('base64')}`
);
const input = {
  kind: 'Source',
  items: [...meta.functions, ...meta.main.statements],
};
const before = previous.recognizeObjpak(input, { from: 'objc' });
const beforeDifference = meaningDifference(input, before);
assert.ok(beforeDifference?.includes('"Call" != "Binary"'));
console.log(`BEFORE a3cee36: ${beforeDifference}`);
const output = translator.fromMeta(meta, 'objc', { from: 'javascript' });
assert.equal(
  meaningDifference(meta, translator.toMeta(output, 'objc')),
  undefined
);
console.log('AFTER: boolean call conditions retain the same meaning');
console.log(output);
