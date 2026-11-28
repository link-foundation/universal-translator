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
const scopedLibrary = readFileSync(
  new URL(
    '../examples/programs/library/cpp-scoped-library.cpp',
    import.meta.url
  ),
  'utf8'
);
const stringInitialization = readFileSync(
  new URL(
    '../examples/programs/library/cpp-string-initialization.cpp',
    import.meta.url
  ),
  'utf8'
);
const directInitialization = readFileSync(
  new URL(
    '../examples/programs/library/cpp-direct-initialization.cpp',
    import.meta.url
  ),
  'utf8'
);
const boundInitialization = readFileSync(
  new URL(
    '../examples/programs/library/cpp-bound-initializer.cpp',
    import.meta.url
  ),
  'utf8'
);
const streamExtraction = readFileSync(
  new URL(
    '../examples/programs/library/cpp-stream-extraction.cpp',
    import.meta.url
  ),
  'utf8'
);
const fixedArray = readFileSync(
  new URL('../examples/programs/library/cpp-fixed-array.cpp', import.meta.url),
  'utf8'
);
const stringLength = readFileSync(
  new URL(
    '../examples/programs/library/cpp-string-length.cpp',
    import.meta.url
  ),
  'utf8'
);
const characters = readFileSync(
  new URL('../examples/programs/library/cpp-characters.cpp', import.meta.url),
  'utf8'
);
const directory = mkdtempSync(join(tmpdir(), 'cpp-member-calls-'));
const options = { encoding: 'utf8', maxBuffer: 32 * 1024 };

try {
  const file = join(directory, 'program.cpp');
  const binary = join(directory, 'program');
  const run = (program, input) => {
    writeFileSync(file, program);
    execFileSync(
      process.env.CXX ?? 'c++',
      ['-std=c++17', '-Wall', '-Wextra', '-Werror', file, '-o', binary],
      options
    );
    return execFileSync(binary, [], { ...options, input });
  };
  for (const [name, program, expected, input] of [
    ['member calls and vector initialization', source, '2\n0 3 4\n'],
    ['explicit type and index template calls', template, '1\n7\n'],
    ['template object initialization', container, '0\n7\n'],
    ['file-scope initialization and mutation', fileScope, '10\n11\n'],
    ['scoped library declarations and const parameters', scopedLibrary, '1\n'],
    ['direct string initialization', stringInitialization, 'Hello, world!\n'],
    ['parenthesized object initialization', directInitialization, 'eady)a 2\n'],
    [
      'parenthesized bound values and member calls',
      boundInitialization,
      'layout 3\n',
    ],
    ['stream extraction', streamExtraction, 'widgets 3\n', 'widgets 3\n'],
    [
      'exception after extraction',
      streamExtraction,
      'missing\n',
      'missing 0\n',
    ],
    [
      'fixed array extents and brace initialization',
      fixedArray,
      '3 apple[] 2 3 0\n',
    ],
    [
      'native string lengths and unevaluated sizeof',
      stringLength,
      '4 4 4 1 0\n',
    ],
    [
      'character literals, casts, shifts and string addition',
      characters,
      "97\na\nA\\'\n65\n1 1\nabc!\n5 8\n",
    ],
  ]) {
    const original = run(program, input);
    assert.equal(original, expected);
    const emitted = translator.translate(program, 'cpp', 'cpp');
    const translated = run(emitted, input);
    console.log(JSON.stringify({ name, original, translated }));
    assert.equal(translated, original, name);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
