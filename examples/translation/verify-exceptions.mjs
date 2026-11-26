// Execute the issue's C++ example and its translations against real runtimes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator } from '../../js/src/index.js';

const file = fileURLToPath(new URL('exceptions.cpp', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'translator-exceptions-'));
const binary = join(temporary, 'exceptions');
try {
  const compiled = spawnSync('c++', [file, '-o', binary], {
    encoding: 'utf8',
  });
  assert.equal(compiled.status, 0, compiled.error?.message ?? compiled.stderr);
  const native = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(native.status, 8);
  const translator = createTranslator();
  const source = readFileSync(file, 'utf8');
  for (const [target, runtime, flag] of [
    ['python', 'python3', '-c'],
    ['javascript', 'node', '-e'],
  ]) {
    const code = translator.translate(source, 'cpp', target);
    const result = spawnSync(runtime, [flag, code], { encoding: 'utf8' });
    assert.equal(result.stderr, '', `${target}\n${code}`);
    assert.equal(result.status, native.status, `${target}\n${code}`);
    console.log(`${target}: exit ${result.status}, matching native C++`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
