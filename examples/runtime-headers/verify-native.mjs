#!/usr/bin/env node
// Compile finite Rocq programs sequentially and compare original/restored output.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslator } from '../../js/src/index.js';
import { rocqLayouts } from './rocq-layout.mjs';
import { phpOutputCases } from './php-output.mjs';

const translator = createTranslator();
const python = 'n = 2\nprint(n)\n';
const nativeOptions = { encoding: 'utf8', maxBuffer: 64 * 1024 };
const expected = execFileSync('python3', ['-c', python], nativeOptions);
const canonical = translator.translate(python, 'python', 'rocq');
const directory = mkdtempSync(join(tmpdir(), 'translator-runtime-headers-'));
try {
  let count = 0;
  for (const source of rocqLayouts(canonical)) {
    const file = join(directory, `case${count}.v`);
    writeFileSync(file, source);
    const printed = execFileSync('rocq', ['compile', file], nativeOptions);
    const start = printed.indexOf('= "');
    const end = printed.lastIndexOf('"\n');
    assert.ok(start >= 0 && end > start, printed);
    assert.equal(printed.slice(start + 3, end).replaceAll('""', '"'), expected);
    const restored = translator.translate(source, 'rocq', 'python');
    assert.equal(
      execFileSync('python3', ['-c', restored], nativeOptions),
      expected
    );
    count += 1;
  }
  console.log(
    `PASS ${count} Rocq runtime layouts and restored Python output bytes`
  );
  for (const [index, [source, expectedOutput]] of phpOutputCases.entries()) {
    const file = join(directory, `php${index}.php`);
    writeFileSync(file, source);
    assert.equal(execFileSync('php', [file], nativeOptions), expectedOutput);
    const python = translator.translate(source, 'php', 'python');
    assert.equal(
      execFileSync('python3', ['-c', python], nativeOptions),
      expectedOutput
    );
    const restored = translator.translate(python, 'python', 'php');
    writeFileSync(file, restored);
    assert.equal(execFileSync('php', [file], nativeOptions), expectedOutput);
    writeFileSync(file, translator.translate(source, 'php', 'php'));
    assert.equal(execFileSync('php', [file], nativeOptions), expectedOutput);
  }
  console.log(
    `PASS ${phpOutputCases.length} PHP outside-whitespace output and Python/PHP round trips`
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
