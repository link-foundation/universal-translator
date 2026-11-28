#!/usr/bin/env node
// Finite signed operands, exact output, compound updates and single evaluation.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTranslator } from '../../js/src/index.js';

const options = { encoding: 'utf8', maxBuffer: 64 * 1024 };
const folder = mkdtempSync(join(tmpdir(), 'universal-rounding-'));
const requireAll = process.argv.includes('--require-all');
const translator = createTranslator();
const available = (command) =>
  !spawnSync(command, ['--version'], options).error;
const targets = [
  ['javascript', 'node', ['-e']],
  ['javascript@es5', 'node', ['-e']],
  ['typescript', 'node', ['--input-type=module', '-e']],
  ['python', 'python3', ['-c']],
  ['ruby', 'ruby', ['-e']],
  ['perl', 'perl', ['-we']],
  ['php', 'php', []],
  ['php@5', 'php', []],
  ['lua', process.env.LUA || 'lua5.4', ['-']],
  ['r', 'Rscript', ['--vanilla', '-e']],
  ['c', 'cc', ['-std=c99', '-O0', '-Wall', '-Wextra', '-Werror']],
  ['cpp', 'c++', ['-std=c++17', '-O0', '-Wall', '-Wextra', '-Werror']],
  ['rust', 'rustc', ['-C', 'debuginfo=0']],
  ['llvm', 'clang', ['-O0', '-Wno-override-module']],
];
function run(language, command, args, written) {
  if (language === 'typescript') {
    const file = join(folder, 'program.ts');
    writeFileSync(file, written);
    return execFileSync('node', [file], options);
  }
  if (['c', 'cpp', 'rust', 'llvm'].includes(language)) {
    const suffix = { c: 'c', cpp: 'cpp', rust: 'rs', llvm: 'll' }[language];
    const file = join(folder, `program.${suffix}`),
      binary = join(folder, 'program');
    writeFileSync(file, written);
    execFileSync(command, [...args, file, '-o', binary], options);
    return execFileSync(binary, [], options);
  }
  // Lua's -e consumes a separate argument unless the code starts with '-'.
  // Read through stdin so a leading Lua comment is executable as well.
  const input = command === 'php' || language === 'lua' ? written : undefined;
  return execFileSync(
    command,
    input === undefined ? [...args, written] : args,
    {
      ...options,
      input,
    }
  );
}
try {
  for (const [stem, from] of [
    ['floor', 'python'],
    ['trunc', 'c'],
  ]) {
    const source = readFileSync(
      new URL(`./${stem}.${from === 'c' ? 'c' : 'py'}`, import.meta.url),
      'utf8'
    );
    const expected = readFileSync(
      new URL(`./${stem}.txt`, import.meta.url),
      'utf8'
    );
    assert.equal(
      from === 'c'
        ? run('c', 'cc', targets.find((t) => t[0] === 'c')[2], source)
        : execFileSync('python3', ['-c', source], options),
      expected,
      `original ${from}`
    );
    for (const [to, command, args] of targets) {
      if (!available(command)) {
        assert.ok(!requireAll, `${command} is required for ${to}`);
        console.log(`SKIP unavailable ${to}: ${command}`);
        continue;
      }
      const written = translator.translate(source, from, to);
      assert.equal(
        run(to, command, args, written),
        expected,
        `${from} -> ${to}`
      );
      console.log(`PASS ${from} -> ${to}: 32 exact output lines`);
    }
  }
  const realZero = `#include <stdio.h>
int main(void) { printf("%f\\n", -0.0 / 3.0); return 0; }
`;
  assert.equal(
    run('c', 'cc', targets.find((t) => t[0] === 'c')[2], realZero),
    '-0.000000\n'
  );
  for (const [to, command, args] of targets.slice(0, 3)) {
    const written = translator.translate(realZero, 'c', to);
    assert.equal(run(to, command, args, written), '-0\n', `real zero in ${to}`);
    console.log(`PASS c -> ${to}: real negative zero`);
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}
