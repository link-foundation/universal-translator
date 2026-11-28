// Execute the issue's C++ example and its translations against real runtimes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator } from '../../js/src/index.js';

const temporary = mkdtempSync(join(tmpdir(), 'translator-exceptions-'));
const rustCli = process.argv[2] && resolve(process.argv[2]);
const translator = createTranslator();

function build(compiler, args, input) {
  const result = spawnSync(compiler, args, { input, encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
}

function execute(command, args = []) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return [result.status, result.stdout, result.stderr];
}

try {
  for (const [example, expectedExit] of [
    ['exceptions.cpp', 8],
    ['exceptions-control.cpp', 42],
  ]) {
    const file = fileURLToPath(new URL(example, import.meta.url));
    const source = readFileSync(file, 'utf8');
    const original = join(temporary, 'original');
    const translated = join(temporary, 'translated');
    build('c++', [file, '-o', original]);
    const native = execute(original);
    assert.deepEqual(native, [expectedExit, '', ''], example);

    const implementations = [
      ['JavaScript', () => translator.translate(source, 'cpp', 'c')],
    ];
    if (rustCli) {
      implementations.push([
        'Rust',
        () => {
          const [status, code, stderr] = execute(rustCli, [
            'translate',
            'cpp',
            'c',
            file,
            '--all-or-nothing',
          ]);
          assert.equal(status, 0, stderr);
          return code;
        },
      ]);
    }
    for (const [implementation, translate] of implementations) {
      const code = translate();
      build(
        'cc',
        ['-std=c99', '-pedantic-errors', '-x', 'c', '-o', translated, '-'],
        code
      );
      assert.deepEqual(
        execute(translated),
        native,
        `${implementation}\n${code}`
      );
      console.log(
        `${example}, ${implementation} → C: exit ${expectedExit}, matching native C++`
      );
    }

    if (example === 'exceptions.cpp') {
      for (const [target, runtime, flag] of [
        ['python', 'python3', '-c'],
        ['javascript', 'node', '-e'],
      ]) {
        const code = translator.translate(source, 'cpp', target);
        assert.deepEqual(
          execute(runtime, [flag, code]),
          native,
          `${target}\n${code}`
        );
        console.log(
          `${example} → ${target}: exit ${expectedExit}, matching native C++`
        );
      }
    }
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
