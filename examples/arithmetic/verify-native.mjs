#!/usr/bin/env node
// Finite C quotient expressions agree with wrapped integer divisions.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTranslator } from '../../js/src/index.js';
const source = readFileSync(new URL('./division.c', import.meta.url), 'utf8');
const expected = readFileSync(
  new URL('./division.txt', import.meta.url),
  'utf8'
);
const folder = mkdtempSync(join(tmpdir(), 'universal-division-'));
const options = { encoding: 'utf8', maxBuffer: 64 * 1024 };
try {
  const input = join(folder, 'division.c'),
    binary = join(folder, 'division');
  writeFileSync(input, source);
  execFileSync(
    'cc',
    ['-std=c99', '-O0', '-Wall', '-Wextra', '-Werror', input, '-o', binary],
    options
  );
  assert.equal(execFileSync(binary, [], options), expected);
  const translator = createTranslator();
  for (const [language, command, args] of [
    ['javascript', 'node', ['-e']],
    ['javascript@es5', 'node', ['-e']],
    ['typescript', 'node', ['--input-type=module', '-e']],
    ['perl', 'perl', ['-we']],
    ['php@5', 'php', []],
  ]) {
    const written = translator.translate(source, 'c', language);
    assert.equal(
      execFileSync(
        command,
        [...args, ...(command === 'php' ? [] : [written])],
        { ...options, input: command === 'php' ? written : undefined }
      ),
      expected,
      language
    );
  }
  console.log(
    'PASS 10 C integer quotients agree with Node/ES5/TypeScript, Perl and PHP integer wrappers'
  );
} finally {
  rmSync(folder, { recursive: true, force: true });
}
