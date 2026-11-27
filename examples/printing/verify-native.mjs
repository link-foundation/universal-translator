#!/usr/bin/env node
// Finite output example: exact bytes and successful exit, including end="".
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createTranslator } from '../../js/src/index.js';

const source = readFileSync(
  new URL('./arithmetic.py', import.meta.url),
  'utf8'
);
const translator = createTranslator();
const options = { encoding: 'utf8', maxBuffer: 64 * 1024 };
const expected = '3\n20\n8\n11\n-2\nsum = 3\n3!\n';
const python = execFileSync('python3', ['-c', source], options);
assert.equal(python, expected);
const generated = translator.translate(source, 'python', 'perl');
const perl = execFileSync('perl', ['-we', generated], options);
assert.equal(perl, expected);
const restored = translator.translate(generated, 'perl', 'python');
assert.equal(execFileSync('python3', ['-c', restored], options), expected);
console.log(
  'PASS exact Python, generated Perl and restored Python output bytes (8 prints)'
);
