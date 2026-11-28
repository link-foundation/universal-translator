import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { runCli } from '../../bin/universal-translator.js';
import {
  createTranslator,
  fragmentKinds,
  grammarLanguageIds,
  machineTargetIds,
  parseFragment,
  translateFragment,
} from '../src/index.js';

const translator = createTranslator();
const { expectedFragments, fragmentSources } =
  await import('../../examples/programs/fragments/write-fragments.mjs');
const sources = Object.fromEntries(
  fragmentSources().map(({ name, source }) => [name, source])
);
const expected = expectedFragments();

describe('fragment kinds', () => {
  it('reads a whole program, functions or statements', () => {
    expect(fragmentKinds).toEqual([
      'program',
      'functions',
      'definitions',
      'statements',
    ]);
    const kinds = Object.fromEntries(
      Object.entries(sources).map(([name, source]) => [
        name,
        parseFragment(source, 'javascript').kind,
      ])
    );
    expect(kinds).toEqual({
      block: 'statements',
      declaration: 'statements',
      function: 'functions',
      functions: 'functions',
      print: 'statements',
      program: 'program',
      statement: 'statements',
    });
  });

  it('keeps a whole program with its main function', () => {
    const rust = 'fn main() {\n    println!("hi");\n}\n';
    expect(parseFragment(rust, 'rust').kind).toBe('program');
    expect(translateFragment(rust, 'rust', 'python')).toBe('print("hi")\n');
  });

  it('writes statements and functions without a main or a class', () => {
    expect(translateFragment('x = x + 1;', 'javascript', 'java')).toBe(
      'x += 1;\n'
    );
    expect(
      translateFragment(sources.function, 'javascript', 'java')
    ).not.toContain('class');
    expect(translateFragment(sources.print, 'javascript', 'c')).not.toContain(
      'main'
    );
  });

  it('is a method of the translator as well', () => {
    expect(translator.translateFragment('x = 2', 'python', 'ruby')).toBe(
      translateFragment('x = 2', 'python', 'ruby')
    );
    expect(translator.parseFragment('x = 2', 'python').kind).toBe('statements');
  });
});

describe('fragments in every language', () => {
  it('match the shared goldens under examples/programs/fragments', () => {
    for (const { path, text } of expected) {
      expect(readFileSync(path, 'utf8')).toBe(text);
    }
  });

  it('read every golden back into the same JavaScript fragment', () => {
    for (const { name, target, text } of expected) {
      const back = translateFragment(text, target, 'javascript');
      const again = translateFragment(
        sources[name],
        'javascript',
        'javascript'
      );
      expect(`${name} ${target}\n${back}`).toBe(`${name} ${target}\n${again}`);
    }
  });

  it('cover every grammar language', () => {
    const targets = new Set(expected.map(({ target }) => target));
    expect([...targets].sort()).toEqual([...grammarLanguageIds].sort());
  });

  it('end every Rocq function group with its period', () => {
    const functions = translator.translateFragment(
      sources.functions,
      'javascript',
      'rocq'
    );
    expect(functions.trimEnd().endsWith('.')).toBe(true);
    expect(functions).not.toContain('fragmentEnd');
  });
});

describe('incomplete fragments', () => {
  const failures = [
    [
      'javascript',
      'function square(value) {\n  return value * value;\n',
      'The fragment is not complete: it ends before its closing (line 2)',
    ],
    [
      'javascript',
      'if (x > 0) {\n  x = 0;\n',
      'The fragment is not complete: it ends before its closing (line 2)',
    ],
    [
      'javascript',
      'let y = (1 + 2;',
      'The fragment is not complete: Expected ")" but found ";" (line 1)',
    ],
    [
      'python',
      'def square(value):\n',
      'The fragment is not complete: it ends before its closing (line 1)',
    ],
    [
      'pascal',
      'function Square(Value: Int64): Int64;\nbegin\n  Exit(Value * Value);\n',
      'The fragment is not complete: it ends before its closing (line 3)',
    ],
    ['javascript', '  \n', 'The fragment is empty'],
  ];

  it('fail with the reason and the line', () => {
    for (const [from, source, message] of failures) {
      expect(() => parseFragment(source, from)).toThrow(message);
    }
  });
});

describe('fragments in natural languages and machine code', () => {
  it('reads and writes a sentence as a statement', () => {
    expect(
      translateFragment('Change x to x plus 1.', 'english', 'javascript')
    ).toBe('x += 1;\n');
    expect(translateFragment('x = x + 1;', 'javascript', 'english')).toContain(
      'x'
    );
  });

  it('rejects statements and functions for machine targets', () => {
    for (const target of machineTargetIds) {
      expect(() =>
        translateFragment('x = x + 1;', 'javascript', target)
      ).toThrow(
        `Machine targets hold whole programs only, not statements on their own (${target})`
      );
    }
  });
});

describe('fragments on the command line', () => {
  it('translates a statement with --fragment', () => {
    const output = [];
    const status = runCli(['translate', 'javascript', 'pascal', '--fragment'], {
      read: () => 'x = x + 1;',
      write: (text) => output.push(text),
      stdout: (text) => output.push(text),
      stderr: (text) => output.push(text),
    });
    expect(status).toBe(0);
    expect(output.join('')).toBe('x := x + 1;\n');
  });
});

describe('fragments that use an array they do not declare', () => {
  const loop =
    'for (let index = 0; index < numbers.length; index++) {\n    total += numbers[index];\n}\n';

  it('reads the length of an indexed array in every language', () => {
    expect(translateFragment(loop, 'javascript', 'python')).toBe(
      'for index in range(len(numbers)):\n    total += numbers[index]\n'
    );
    for (const to of ['english', 'arabic', 'fortran', 'minimal-english']) {
      const written = translateFragment(loop, 'javascript', to);
      expect(translateFragment(written, to, 'javascript')).toBe(loop);
    }
  });
});
