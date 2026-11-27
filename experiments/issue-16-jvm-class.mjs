import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWat } from '../examples/programs/run-wasm.mjs';

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const source = path('../examples/programs/binary/StackArithmetic.java');
const fixture = path('../examples/programs/binary/StackArithmetic.class');
const cli = path('../bin/universal-translator.js');
const expected = 'Café 😀 39740\n-7\n-1\n0\n-1\n';
const translators = [['JavaScript', process.execPath, [cli]]];
if (process.env.JVM_RUST_TRANSLATOR) {
  translators.push(['Rust', process.env.JVM_RUST_TRANSLATOR, []]);
}

const targets = ['javascript', 'python', 'c', 'wat'];
const execute = (binary, args, input) =>
  execFileSync(binary, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 256 * 1024,
  });
const java = (directory) =>
  execute('java', [
    '-Dfile.encoding=UTF-8',
    '-cp',
    directory,
    'StackArithmetic',
  ]);

function runTranslated(target, translated, directory) {
  if (target === 'javascript') {
    return execute(process.execPath, ['--input-type=module'], translated);
  }
  if (target === 'python') {
    return execute(process.env.PYTHON || 'python3', ['-'], translated);
  }
  if (target === 'c') {
    const executable = join(directory, 'translated');
    execute(
      process.env.CC || 'cc',
      ['-std=c11', '-x', 'c', '-o', executable, '-'],
      translated
    );
    return execute(executable, []);
  }
  const file = join(directory, 'translated.wat');
  writeFileSync(file, translated);
  return runWat(file);
}

const temp = mkdtempSync(join(tmpdir(), 'universal-translator-jvm-'));
try {
  const releases =
    process.argv.length > 2 ? process.argv.slice(2) : ['8', '17'];
  const classFiles = [['committed Java 8', fixture, java(dirname(fixture))]];
  for (const release of releases) {
    assert.match(release, /^(?:[89]|1[0-9]|2[01])$/u);
    const directory = join(temp, `jdk-${release}`);
    mkdirSync(directory);
    execute('javac', [
      '--release',
      release,
      '-Xlint:-options',
      '-encoding',
      'UTF-8',
      '-g',
      '-d',
      directory,
      source,
    ]);
    classFiles.push([
      `Java ${release}`,
      join(directory, 'StackArithmetic.class'),
      java(directory),
    ]);
  }
  for (const [edition, classFile, reference] of classFiles) {
    assert.equal(reference, expected);
    const bytes = readFileSync(classFile);
    for (const [engine, translator, prefix] of translators) {
      for (const target of targets) {
        const args = [
          ...prefix,
          'translate',
          'jvm-class',
          target,
          '--all-or-nothing',
        ];
        const translated = execute(translator, [...args, classFile]);
        assert.equal(execute(translator, [...args, '-'], bytes), translated);
        assert.equal(await runTranslated(target, translated, temp), reference);
        console.log(
          `PASS ${edition} class ${bytes.readUInt16BE(6)}.0 → ${target} using ${engine}`
        );
      }
    }
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
