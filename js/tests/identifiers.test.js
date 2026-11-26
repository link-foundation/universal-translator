// Identifier languages: the names a program declares are
// translated to another natural language, through the meta program or, when
// the programming language stays, in place. The Rust twin is
// rust/tests/identifiers.rs.
import { describe, expect, it } from 'test-anywhere';

import { runCli } from '../../bin/universal-translator.js';
import { translate, translatePartial } from '../src/index.js';
import { asciiName, nameWords } from '../src/formal/names.js';

const source = `// Sum of squares
function sumOfSquares(numbers) {
  let total = 0;
  for (let index = 0; index < numbers.length; index++) {
    total += numbers[index] * numbers[index];
  }
  return total;
}
console.log(sumOfSquares([1, 2, 3]));
`;

// A fixed dictionary, so the tests do not depend on the vocabulary.
const words = {
  sum: 'сумма',
  of: '',
  squares: 'квадратов',
  numbers: 'числа',
  total: 'итог',
  index: 'индекс',
};
const translateComment = (text) =>
  text
    .split(' ')
    .map((word) => words[word.toLowerCase()] ?? word)
    .join(' ');
const russian = { identifierLanguage: 'russian', translateComment };

describe('identifier language', () => {
  it('renames the declared names in place, keeping every other character', () => {
    expect(translate(source, 'javascript', 'javascript', russian)).toBe(
      source
        .replaceAll('sumOfSquares', 'суммаКвадратов')
        .replaceAll('numbers', 'числа')
        .replaceAll('total', 'итог')
        .replaceAll('index', 'индекс')
    );
  });

  it('keeps the names of library procedures', () => {
    const output = translate(source, 'javascript', 'javascript', russian);
    expect(output).toContain('console.log(суммаКвадратов');
    expect(output).toContain('.length');
  });

  it('spells translated names in the convention of the target', () => {
    const output = translate(source, 'javascript', 'python', russian);
    expect(output).toContain('def сумма_квадратов(числа):');
    expect(output).toContain('print(сумма_квадратов([1, 2, 3]))');
  });

  it('transliterates names for languages with ASCII names only', () => {
    const output = translate(source, 'javascript', 'c', russian);
    expect(output).toContain('summa_kvadratov(');
    expect(output).toContain('int itog = 0;');
    expect(/[^ -~\n\t]/.test(output.replace(/\/\*.*\*\//, ''))).toBe(false);
  });

  it('translates the comments and the names together', () => {
    const output = translate(source, 'javascript', 'javascript', {
      ...russian,
      commentLanguage: 'russian',
    });
    expect(output.split('\n')[0]).toBe('// сумма  квадратов');
    expect(output).toContain('function суммаКвадратов(числа) {');
  });

  // The names are taken in sorted order: "sum" gets the translation first.
  it('never makes two names one', () => {
    const twins = 'let total = 1;\nlet sum = 2;\nconsole.log(total + sum);\n';
    const output = translate(twins, 'javascript', 'javascript', {
      identifierLanguage: 'russian',
      translateComment: () => 'итог',
    });
    expect(output).toBe(
      'let total = 1;\nlet итог = 2;\nconsole.log(total + итог);\n'
    );
  });

  it('renames names inside interpolated texts through the meta program', () => {
    const quoted = 'let total = 1;\nconsole.log(`${total}`);\n';
    const output = translate(quoted, 'javascript', 'javascript', russian);
    expect(output).toContain('итог');
    expect(output).not.toContain('total');
  });

  it('reads names written in other scripts', () => {
    const cyrillic = 'let итог = 1;\nconsole.log(итог);\n';
    expect(translate(cyrillic, 'javascript', 'python')).toBe(
      'итог = 1\nprint(итог)\n'
    );
    expect(nameWords('суммаКвадратов')).toEqual(['сумма', 'квадратов']);
    expect(asciiName('größeÉtat', 'c')).toBe('grosseEtat');
    expect(asciiName('世', 'c')).toBe('u4e16');
    expect(asciiName('итог', 'python')).toBe('итог');
  });

  it('refuses identifier languages that do not exist', () => {
    expect(() =>
      translatePartial(source, 'javascript', 'python', {
        identifierLanguage: 'klingon',
      })
    ).toThrow();
  });

  it('is an option of the command line', () => {
    let output = '';
    const code = runCli(
      [
        'translate',
        'javascript',
        'python',
        '-',
        '--identifier-language',
        'russian',
        '--identifier-from',
        'english',
      ],
      {
        read: () => 'let total = 1;\nconsole.log(total);\n',
        write: (text) => (output += text),
      }
    );
    expect(code).toBe(0);
    expect(output).not.toContain('total');
  });
});
