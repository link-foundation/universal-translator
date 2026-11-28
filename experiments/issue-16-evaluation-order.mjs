// Compare observable effects across Python and native C-family toolchains.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTranslator } from '../js/src/index.js';

const sourceFile = new URL(
  '../examples/arithmetic/evaluation.py',
  import.meta.url
);
const source = readFileSync(sourceFile, 'utf8');
const expected = readFileSync(new URL('evaluation.txt', sourceFile), 'utf8');
const toolchains = [
  {
    target: 'c',
    compiler: process.env.CC ?? 'cc',
    extension: 'c',
    standard: 'c99',
  },
  {
    target: 'cpp',
    compiler: process.env.CXX ?? 'c++',
    extension: 'cpp',
    standard: 'c++17',
  },
  {
    target: 'objc',
    compiler: process.env.OBJC ?? 'clang',
    extension: 'm',
    standard: 'c99',
    flags: ['-Wno-strict-prototypes'],
  },
];
const options = { encoding: 'utf8', maxBuffer: 64 * 1024 };
const comparison = process.argv.includes('--without-source-order');
const translator = createTranslator();
const folder = mkdtempSync(join(tmpdir(), 'evaluation-order-'));

try {
  const python = execFileSync(
    process.env.PYTHON ?? 'python3',
    ['-c', source],
    options
  );
  assert.equal(python, expected);
  for (const {
    target,
    compiler,
    extension,
    standard,
    flags = [],
  } of toolchains) {
    const file = join(folder, `program.${extension}`);
    const binary = join(folder, 'program');
    const translation = comparison
      ? translator.fromMeta(translator.toMeta(source, 'python'), target)
      : translator.translate(source, 'python', target);
    const programs = [[target, translation]];
    if (target === 'cpp' && !comparison) {
      const c = translator.translate(source, 'python', 'c');
      programs.push(['c to cpp', translator.translate(c, 'c', 'cpp')]);
    }
    for (const [language, program] of programs) {
      writeFileSync(file, program);
      for (const optimization of ['-O0', '-O2']) {
        const label = `${language} ${optimization}`;
        execFileSync(
          compiler,
          [
            `-std=${standard}`,
            '-pedantic-errors',
            optimization,
            '-Wall',
            '-Wextra',
            '-Werror',
            ...flags,
            file,
            '-o',
            binary,
          ],
          options
        );
        const actual = execFileSync(binary, [], options);
        if (comparison) {
          console.log(
            JSON.stringify({
              label,
              expected,
              actual,
              matches: actual === expected,
            })
          );
        } else {
          assert.equal(actual, expected, label);
          console.log(`${label} matches CPython output`);
        }
      }
    }
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}
