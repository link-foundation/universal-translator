// Reads rules written as Links Notation, writes them back and checks that
// reading the written text gives the same rules.
// Usage: node experiments/issue-12-rules-roundtrip.mjs [file]
import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { formatRules, readRules } from '../js/src/translation/rules-notation.js';

const text = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : `source:
  (find colour) (replace color) (language english)
  (find '\\bvar\\b') (replace let) (regex true)
  (find x)
  (find 'say ''hi''') (replace '')
templates:
  english:
    print: 'Say {value}.' 'Tell {value}.'
    print-line: 'Write {value}.'
names:
  (find x) (replace count)
output:
  (find 'console.log(') (replace 'print(')
  (find 'a
b') (replace "it's")
`;
const rules = readRules(text);
console.log(JSON.stringify(rules, null, 2));
const written = formatRules(rules);
console.log(written);
deepStrictEqual(readRules(written), rules);
console.log('round trip ok');
