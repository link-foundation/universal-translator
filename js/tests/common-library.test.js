import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import {
  commonLibraryAccess,
  createTranslator,
  translate,
} from '../../js/src/index.js';
import { runCli } from '../../bin/universal-translator.js';

const programs = [
  'hello-world',
  'factorial',
  'fizz-buzz',
  'greatest-common-divisor',
  'sum-of-squares',
];
const read = (name) => readFileSync(`examples/programs/${name}.js`, 'utf8');

describe('common library route', () => {
  it('replaces prints with library calls and imports the library', () => {
    const python = translate(read('sum-of-squares'), 'javascript', 'python', {
      commonLibrary: true,
    });
    expect(python).toContain(
      'from common_library import write_text, write_integer, end_line'
    );
    expect(python).toContain('write_integer(limit)');
    const csharp = translate(read('hello-world'), 'javascript', 'csharp', {
      commonLibrary: true,
    });
    expect(csharp).toContain('CommonLibrary.PrintLine("Hello World!");');
  });

  it('keeps the Zig standard library for arrays without prints', () => {
    const zig = translate(read('sieve-of-eratosthenes'), 'javascript', 'zig', {
      commonLibrary: true,
    });
    expect(zig).toContain('const std = @import("std");');
    expect(zig).toContain('std.heap.page_allocator');
    expect(zig).not.toContain('var out: *std.Io.Writer');
  });

  it('reads library calls back as the same program in every language', () => {
    for (const name of programs) {
      for (const language of Object.keys(commonLibraryAccess)) {
        const plain = translate(read(name), 'javascript', language);
        const viaLibrary = translate(read(name), 'javascript', language, {
          commonLibrary: true,
        });
        expect(translate(viaLibrary, language, 'javascript')).toBe(
          translate(plain, language, 'javascript')
        );
      }
    }
  });

  it('has an implementation for every language', () => {
    expect(Object.keys(commonLibraryAccess)).toEqual(
      createTranslator()
        .languages()
        .filter(({ id }) => !['nasm', 'cil', 'jvm'].includes(id))
        .map(({ id }) => id)
    );
  });

  it('is rejected for machine targets', () => {
    expect(() =>
      translate(read('hello-world'), 'javascript', 'nasm', {
        commonLibrary: true,
      })
    ).toThrow('Machine targets have no common library');
  });

  it('is available from the command line', () => {
    let output = '';
    const code = runCli(
      ['translate', 'javascript', 'ruby', '-', '--common-library'],
      { read: () => 'console.log("Hi");\n', write: (text) => (output += text) }
    );
    expect(code).toBe(0);
    expect(output).toContain('require_relative "common_library"');
    expect(output).toContain('print_line("Hi")');
  });
});
