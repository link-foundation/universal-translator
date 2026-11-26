import { describe, expect, it } from 'test-anywhere';

import { createTranslator } from '../src/index.js';

const translator = createTranslator();

const sign = [
  'function sign(a) {',
  '  if (a > 0) {',
  '    return 1;',
  '  } else {',
  '    return 0;',
  '  }',
  '}',
  '',
].join('\n');

describe('brace placement and indent width', () => {
  it('puts each opening brace of C# on a line of its own', () => {
    const { text, lineMap } = translator.translatePartial(
      sign,
      'javascript',
      'csharp',
      { braces: 'next-line' }
    );
    expect(text).toContain(
      [
        '    static int Sign(int a)',
        '    {',
        '        if (a > 0)',
        '        {',
        '            return 1;',
        '        }',
        '        else',
        '        {',
        '            return 0;',
        '        }',
        '    }',
      ].join('\n')
    );
    const lines = text.split('\n');
    const sources = sign.split('\n');
    expect(
      lineMap.map(([source, target]) => [sources[source], lines[target]])
    ).toEqual([
      ['function sign(a) {', '    static int Sign(int a)'],
      ['  if (a > 0) {', '        if (a > 0)'],
      ['    return 1;', '            return 1;'],
      ['  } else {', '        }'],
      ['    return 0;', '            return 0;'],
      ['  }', '        }'],
      ['}', '    }'],
    ]);
  });

  it('indents JavaScript by two spaces and Rust by a tab', () => {
    const wide = sign.replaceAll('  ', '    ');
    expect(
      translator.translatePartial(wide, 'javascript', 'javascript', {
        indent: 2,
      }).text
    ).toBe(sign);
    expect(
      translator.translate(sign, 'javascript', 'rust', { indent: 'tab' })
    ).toBe(
      [
        'fn sign(a: i64) -> i64 {',
        '\tif a > 0 {',
        '\t\treturn 1;',
        '\t} else {',
        '\t\treturn 0;',
        '\t}',
        '}',
        '',
        'fn main() {',
        '}',
        '',
      ].join('\n')
    );
  });

  it('indents blocks without braces and leaves their lines alone', () => {
    expect(
      translator.translatePartial(sign, 'javascript', 'python', {
        braces: 'next-line',
        indent: 3,
      }).text
    ).toBe(
      [
        'def sign(a):',
        '   if a > 0:',
        '      return 1',
        '   else:',
        '      return 0',
        '',
      ].join('\n')
    );
  });

  it('rejects styles a language cannot be written in', () => {
    expect(() =>
      translator.translatePartial(sign, 'javascript', 'go', {
        braces: 'next-line',
      })
    ).toThrow('Go needs the opening brace on the line of its statement');
    expect(() =>
      translator.translatePartial(sign, 'javascript', 'c', {
        braces: 'below',
      })
    ).toThrow('Unsupported brace style "below": same-line or next-line');
    expect(() =>
      translator.translate(sign, 'javascript', 'c', { indent: 0 })
    ).toThrow(
      'Unsupported indent "0": a number of spaces from 1 to 16 or "tab"'
    );
  });
});
