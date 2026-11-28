#!/usr/bin/env node
// Compile finite Rocq programs sequentially and compare original/restored output.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslator } from '../../js/src/index.js';
import { rocqLayouts } from './rocq-layout.mjs';
import { phpOutputCases } from './php-output.mjs';
import { phpModeCases } from './php-modes.mjs';

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
  const phpCases = [...phpOutputCases, ...phpModeCases];
  for (const [index, [source, expectedOutput]] of phpCases.entries()) {
    const file = join(directory, `php${index}.php`);
    writeFileSync(file, source);
    assert.equal(
      execFileSync(
        'php',
        ['-d', 'short_open_tag=0', '-d', 'memory_limit=32M', file],
        nativeOptions
      ),
      expectedOutput
    );
    const python = translator.translate(source, 'php', 'python');
    assert.equal(
      execFileSync('python3', ['-c', python], nativeOptions),
      expectedOutput
    );
    const restored = translator.translate(python, 'python', 'php');
    writeFileSync(file, restored);
    assert.equal(
      execFileSync(
        'php',
        ['-d', 'short_open_tag=0', '-d', 'memory_limit=32M', file],
        nativeOptions
      ),
      expectedOutput
    );
    writeFileSync(file, translator.translate(source, 'php', 'php'));
    assert.equal(
      execFileSync(
        'php',
        ['-d', 'short_open_tag=0', '-d', 'memory_limit=32M', file],
        nativeOptions
      ),
      expectedOutput
    );
  }
  console.log(
    `PASS ${phpCases.length} PHP output/markup/mode-switch cases and Python/PHP round trips`
  );
  const commentPython = readFileSync(
    new URL('./comment-tags.py', import.meta.url),
    'utf8'
  );
  const commentExpected = execFileSync(
    'python3',
    ['-c', commentPython],
    nativeOptions
  );
  const commentPhp = translator.translate(commentPython, 'python', 'php');
  const commentFile = join(directory, 'comment-tags.php');
  writeFileSync(commentFile, commentPhp);
  assert.equal(
    execFileSync('php', ['-d', 'memory_limit=32M', commentFile], nativeOptions),
    commentExpected
  );
  const commentRestored = translator.translate(commentPhp, 'php', 'python');
  assert.equal(
    execFileSync('python3', ['-c', commentRestored], nativeOptions),
    commentExpected
  );
  console.log(
    'PASS PHP comment closing tags retain code mode and native output'
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
