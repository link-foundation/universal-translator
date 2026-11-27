import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
const emitted = translator.translate(source, 'cpp', 'cpp');
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
  const original = run(source);
  const translated = run(emitted);
  assert.equal(original, '2\n');
  console.log(JSON.stringify({ original, translated }));
  assert.equal(translated, original);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
