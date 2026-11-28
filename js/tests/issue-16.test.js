import { describe, expect, it } from 'test-anywhere';
import { createTranslator } from '../src/index.js';

const translator = createTranslator();

describe('issue 16 regression cases', () => {
  it('reads an isolated natural-language name and ranks English first on a tie', () => {
    const candidates = translator.detectLanguage('c');
    expect(candidates[0].id).toBe('english');
    expect(candidates[0].reads).toBe(true);
    expect(translator.translateFragment('c', 'english', 'python')).toBe('c\n');
  });
  it('keeps the complete exponentiation inside an interpolation', () => {
    expect(
      translator.translateFragment(
        'console.log(`${2 ** 10}`);',
        'javascript',
        'python'
      )
    ).toBe('print(f"{2 ** 10}")\n');
  });

  it('associates powers right and preserves a grouped left operand', () => {
    expect(
      translator.translateFragment(
        'print(2 ** 3 ** 2)\nprint((2 ** 3) ** 2)\n',
        'python',
        'javascript'
      )
    ).toBe('console.log(2 ** 3 ** 2);\nconsole.log((2 ** 3) ** 2);\n');
    expect(
      translator.translateFragment('print(-2 ** 2)\n', 'python', 'javascript')
    ).toBe('console.log(-(2 ** 2));\n');
    expect(
      translator.translateFragment('print(2 ** -2)\n', 'python', 'rust')
    ).toContain('(2 as f64).powf(-2 as f64)');
  });

  it('requires every interpolation token to be read', () => {
    expect(() =>
      translator.toMeta('console.log(`${2 & 10}`);', 'javascript')
    ).toThrow('in interpolation');
  });

  it('keeps the blank line after a comment whose language changes', () => {
    const result = translator.translatePartial(
      '// Привет\n\nconsole.log( "Hello World!");\n',
      'javascript',
      'python',
      { fragment: true, commentLanguage: 'english' }
    );
    expect(result.text).toBe('# Hello\n\nprint( "Hello World!")\n');
    expect(result.lineMap).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it('declares an array mutable in Rust when its JavaScript binding is const', () => {
    const source =
      'const values = [1, 2];\nvalues.push(3);\nconsole.log(values.length);\n';
    expect(
      translator.translateFragment(source, 'javascript', 'rust')
    ).toContain('let mut values: Vec<i64>');
    expect(
      translator.translateFragment(source, 'javascript', 'javascript')
    ).toContain('const values');
  });
});
