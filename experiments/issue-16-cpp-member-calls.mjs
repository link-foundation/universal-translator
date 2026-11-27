import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const source = `#include <iostream>
#include <vector>

int main() {
    std::vector<int> values(1, 0);
    values.push_back(7);
    values.pop_back();
    values.push_back(11);
    std::cout << values.size() << std::endl;
    std::vector<int> empty;
    std::vector<int> list{3, 4};
    std::cout << empty.size() << " " << list[0] << " " << list[1] << std::endl;
    return 0;
}
`;

const alternateTranslator = process.argv[2];
const { createTranslator } = await import(
  alternateTranslator
    ? pathToFileURL(alternateTranslator)
    : new URL('../js/src/index.js', import.meta.url)
);
const translator = createTranslator();
const template = readFileSync(
  new URL('../examples/programs/library/cpp-template.cpp', import.meta.url),
  'utf8'
);
const container = readFileSync(
  new URL(
    '../examples/programs/library/cpp-container-initialization.cpp',
    import.meta.url
  ),
  'utf8'
);
const fileScope = readFileSync(
  new URL('../examples/programs/library/cpp-file-scope.cpp', import.meta.url),
  'utf8'
);
const directory = mkdtempSync(join(tmpdir(), 'cpp-member-calls-'));
const options = { encoding: 'utf8', maxBuffer: 32 * 1024 };

try {
  const file = join(directory, 'program.cpp');
  const binary = join(directory, 'program');
  const run = (program) => {
    writeFileSync(file, program);
    execFileSync(
      process.env.CXX ?? 'c++',
      ['-std=c++17', '-Wall', '-Wextra', '-Werror', file, '-o', binary],
      options
    );
    return execFileSync(binary, [], options);
  };
  for (const [name, program, expected] of [
    ['member calls and vector initialization', source, '2\n0 3 4\n'],
    ['explicit template call', template, '1\n'],
    ['template object initialization', container, '0\n7\n'],
    ['file-scope initialization and mutation', fileScope, '10\n11\n'],
  ]) {
    const original = run(program);
    assert.equal(original, expected);
    const emitted = translator.translate(program, 'cpp', 'cpp');
    const translated = run(emitted);
    console.log(JSON.stringify({ name, original, translated }));
    assert.equal(translated, original, name);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
