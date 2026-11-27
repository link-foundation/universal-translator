#!/usr/bin/env node
// Original POC program versus finite generated native runs, including set order.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator } from '../../js/src/index.js';
import { sameMeaning } from '../../js/src/meta/tree.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const run = (program, args, options = {}) =>
  execFileSync(program, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    ...options,
  });
const prefix = run('bash', [join(root, 'experiments/build-objpak.sh')]).trim();
const env = { ...process.env, PATH: `${prefix}/bin:${process.env.PATH}` };
const folder = mkdtempSync(join(tmpdir(), 'universal-objpak-'));
const translator = createTranslator();
const native = (program, args) =>
  run(
    'bash',
    [
      '-c',
      'ulimit -c 0; ulimit -v 1048576; ulimit -s 16384; exec "$@"',
      'bounded-objpak',
      program,
      ...args,
    ],
    { env, cwd: folder }
  );
const compile = (source, binary) =>
  native('objc', [
    '-q',
    '-U_FORTIFY_SOURCE',
    '-D_FORTIFY_SOURCE=0',
    '-O0',
    source,
    '-o',
    binary,
  ]);
const compileGNU = (source, binary) => {
  const compiler = process.env.OBJC_CC === 'clang' ? 'clang' : 'gcc';
  const flags =
    compiler === 'clang'
      ? [
          '-fobjc-runtime=gcc',
          '-I',
          run('gcc', ['-print-file-name=include']).trim(),
        ]
      : [];
  native(compiler, [...flags, '-O0', source, '-lobjc', '-o', binary]);
};
const original = readFileSync(new URL('./hello.m', import.meta.url), 'utf8');
const variants = [
  ['original', original],
  [
    'aliases',
    'int main(void) { id first = [Set new]; id second = first; id third = [second add:[String str:"Alice"]]; [third add:[String str:"Bob"]]; [first do:{ :person | printf("hello, %s!\\n", [person str]); }]; return 0; }',
  ],
  [
    'live-iteration',
    'int main(void) { id names = [Set new]; [names add:[String str:"Alice"]]; [names do:{ :person | printf("hello, %s!\\n", [person str]); [names add:[String str:"Bob"]]; }]; return 0; }',
  ],
  [
    'updates',
    'int main(void) { int previous = 3; printf("%d\\n", previous++); printf("%d\\n", --previous); printf("%d\\n", previous--); printf("%d\\n", ++previous); return 0; }',
  ],
  [
    'conditions',
    readFileSync(new URL('./conditions.m', import.meta.url), 'utf8'),
  ],
];
const argumentSets = [
  [],
  ['Alice'],
  ['Alice', 'Bob', 'Alice', 'Carol', 'David', 'Eve'],
  ['é', '猫', '😀', 'é', ''],
  Array.from({ length: 40 }, (_, i) => `person-${i}`),
  [...Array.from({ length: 9 }, (_, i) => `slot-${i}`), 'slot-0'],
];
try {
  for (const [variant, source] of variants) {
    const originalPath = join(folder, `${variant}-original.m`);
    const originalBinary = join(folder, `${variant}-original`);
    writeFileSync(
      originalPath,
      variant === 'original'
        ? source
        : `#include <stdio.h>\n#include <objpak.h>\n${source}\n`
    );
    compile(originalPath, originalBinary);
    const meta = translator.toMeta(source, 'objc');
    const commands = [];
    for (const [language, extension, program] of [
      ['python', 'py', 'python3'],
      ['javascript', 'mjs', 'node'],
      ['rust', 'rs', null],
      ['objc', 'm', null],
    ]) {
      const written = translator.translate(source, 'objc', language);
      assert.ok(
        sameMeaning(meta, translator.toMeta(written, language)),
        `${variant}: ${language} semantic round-trip`
      );
      const path = join(folder, `${variant}.${extension}`);
      writeFileSync(path, written);
      if (program) {
        commands.push([language, program, [path]]);
      } else {
        const binary = join(folder, `${variant}-${language}`);
        if (language === 'rust') {
          run('rustc', ['-C', 'debuginfo=0', path, '-o', binary]);
        } else {
          compile(path, binary);
        }
        commands.push([language, binary, []]);
      }
      if (language === 'objc' && variant === 'conditions') {
        const gnuBinary = join(folder, `${variant}-gnu-objc`);
        compileGNU(path, gnuBinary);
        commands.push(['GNU Objective-C', gnuBinary, []]);
      }
    }
    const cases = variant === 'original' ? argumentSets : [[]];
    for (const args of cases) {
      const expected = native(originalBinary, args);
      for (const [language, program, before] of commands) {
        assert.equal(
          language === 'javascript'
            ? run(program, ['--max-old-space-size=96', ...before, ...args])
            : native(program, [...before, ...args]),
          expected,
          `${variant}: ${language}: ${JSON.stringify(args)}`
        );
      }
    }
    console.log(
      `PASS ${variant}: original POC equals Python, JavaScript, Rust and generated POC${variant === 'conditions' ? ' and GNU Objective-C' : ''} (${cases.length} argument sets), with semantic round-trips`
    );
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}
