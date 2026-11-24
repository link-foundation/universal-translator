import { describe, expect, it } from 'test-anywhere';

import {
  fixture,
  referentInput,
} from '../../examples/translation/fixtures.mjs';
import { runCli } from '../../bin/universal-translator.js';
import { translateComments } from '../../examples/translation/comment-glossary.mjs';
import {
  commonLibrary,
  createTranslator,
  grammarLanguageIds,
  rankInterpretations,
  translate,
} from '../src/index.js';

const cSource = fixture('hello.c').replaceAll('\r\n', '\n');

function cli(argv, input = '') {
  const output = [];
  const errors = [];
  const status = runCli(argv, {
    read: () => input,
    write: (text) => output.push(text),
    stdout: (text) => output.push(text),
    stderr: (text) => errors.push(text),
  });
  return { status, output: output.join(''), errors: errors.join('\n') };
}

describe('public translation API', () => {
  it('exports the grammar translator and its languages', () => {
    expect(grammarLanguageIds.length).toBe(26);
    expect(
      createTranslator()
        .languages()
        .map(({ id }) => id)
    ).toEqual(grammarLanguageIds);
    expect(Object.keys(commonLibrary)).toEqual([
      'endLine',
      'printLine',
      'writeInteger',
      'writeText',
    ]);
  });

  it('translates the issue C source in all three modes', () => {
    expect(translate(cSource, 'c', 'csharp')).toContain(
      '/* Print a line by method call. */'
    );
    expect(translate(cSource, 'c', 'csharp', { mode: 'literal' })).toContain(
      '/* Hello World in C */'
    );
    expect(
      translate(cSource, 'c', 'csharp', { mode: 'same-effect' })
    ).not.toContain('/*');
  });
});

describe('same-language layers', () => {
  it('translates Russian comments to English and keeps the code', () => {
    const output = translateComments(fixture('hello-ru.cs'));
    expect(output).toContain('/* Hello World in C# */');
    expect(output).toContain('/* Print a line by method call */');
    expect(output).toContain('System.Console.WriteLine("Hello, World!");');
    expect(/[а-яё]/i.test(output)).toBe(false);
  });
});

describe('command line', () => {
  it('translates standard input and lists languages', () => {
    const result = cli(
      ['translate', 'python', 'javascript', '-'],
      'print("Hello, World!")\n'
    );
    expect(result.status).toBe(0);
    expect(result.output).toBe('console.log("Hello, World!");\n');
    expect(cli(['languages']).output).toContain('csharp\tC#\n');
    expect(
      cli(['translate', 'c', 'csharp', '-', '--mode', 'literal'], cSource)
        .output
    ).toContain('in C */');
  });

  it('prints the meta program and reports errors with a failure status', () => {
    const meta = JSON.parse(cli(['meta', 'python', '-'], 'print(1)\n').output);
    expect(meta.kind).toBe('Program');
    const failed = cli(['translate', 'python', 'cobol', '-'], 'print(1)\n');
    expect(failed.status).toBe(1);
    expect(failed.errors).toContain('cobol');
    expect(cli(['translate', 'c', 'go', '-', '--mode'], '').status).toBe(1);
  });

  it('traces every pipeline stage with --trace', () => {
    const result = cli(
      ['translate', 'python', 'ruby', '-', '--trace'],
      'print(1)\n'
    );
    expect(result.output).toBe('puts 1\n');
    const stages = result.errors
      .split('\n')
      .map((line) => line.match(/^\[(\w+)\] \{/)?.[1]);
    expect(stages).toEqual([
      'parsed',
      'understood',
      'typed',
      'transformed',
      'adapted',
    ]);
  });
});

describe('dependent referents', () => {
  const { source, candidates } = referentInput();

  it('prefers round-trip evidence and retains unresolved readings', () => {
    const ranked = rankInterpretations(source, candidates);
    expect(ranked.preferred.map(({ id }) => id)).toEqual(['white-skin']);
    expect(ranked.candidates.map(({ confidence }) => confidence)).toEqual([
      [0.65, 0.65],
      [0.91, 0.91],
      [0, 0.29],
    ]);
    const narrowed = rankInterpretations(source, candidates, [
      'person',
      'white',
      'painted white',
    ]);
    expect(narrowed.preferred[0].id).toBe('painted-white');
    expect(
      rankInterpretations(source, candidates, ['plant']).candidates
    ).toEqual([]);
    const multiple = rankInterpretations(source, [
      candidates[0],
      { ...candidates[0], id: 'another-reading' },
    ]);
    expect(multiple.preferred.map(({ id }) => id)).toEqual([
      'another-reading',
      'white-skin',
    ]);
  });
});
