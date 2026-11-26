import { describe, expect, it } from 'test-anywhere';
import { readFileSync } from 'node:fs';

import { layoutCases } from '../../examples/layout/write-layout.mjs';
import { languageSyntax } from '../src/formal/languages.js';
import {
  alignTokens,
  layoutSyntax,
  layoutTokens,
  transferLayout,
} from '../src/translation/layout.js';
import { translatePartial } from '../src/index.js';

const syntax = (id) => languageSyntax(id);
const keys = (text, id) =>
  layoutTokens([...text], layoutSyntax(syntax(id))).map(({ key }) => key);

describe('layout of the source (issue 14)', () => {
  it('keeps the blank lines and the spaces of the issue example', () => {
    const source = '\nconsole.log( "Hello World!");\n\nconsole.log(1+ 2);\n';
    const result = translatePartial(source, 'javascript', 'python', {
      fragment: true,
    });
    expect(result.text).toBe('\nprint( "Hello World!")\n\nprint(1+ 2)\n');
    expect(result.lineMap).toEqual([
      [1, 1],
      [3, 3],
    ]);
  });

  it('keeps the blank line after a leading comment of a fragment', () => {
    const source = '// Привет мир\n\nconsole.log("Hello World!");\n';
    const { text } = translatePartial(source, 'javascript', 'python', {
      fragment: true,
    });
    expect(text).toBe('# Привет мир\n\nprint("Hello World!")\n');
  });

  it('writes the layout of the target on request', () => {
    const source = '\nconsole.log( "Hello World!");\n';
    const { text, lineMap } = translatePartial(source, 'javascript', 'python', {
      fragment: true,
      layout: 'target',
    });
    expect(text).toBe('print("Hello World!")\n');
    expect(lineMap).toEqual([[1, 0]]);
    expect(() =>
      translatePartial(source, 'javascript', 'python', { layout: 'x' })
    ).toThrow('Unsupported layout "x"');
  });

  it('matches every example under examples/layout', () => {
    const cases = layoutCases();
    expect(cases.length).toBeGreaterThan(10);
    for (const item of cases) {
      const { text } = translatePartial(item.source, item.from, item.to, {
        fragment: true,
      });
      expect(`${item.path}\n${text}`).toBe(
        `${item.path}\n${readFileSync(item.path, 'utf8')}`
      );
    }
  });

  it('cuts operators, strings, comments and names into tokens', () => {
    expect(keys('total_count += "a b" // note', 'javascript')).toEqual([
      'wtotalcount',
      'p+=',
      'sa b',
      'cnote',
    ]);
    expect(keys("x := 'it''s' { c }", 'pascal')).toEqual([
      'wx',
      'p:',
      'p=',
      'sit',
      'ss',
      'cc',
    ]);
    expect(keys('f(a, b);', 'c')).toEqual([
      'wf',
      'p(',
      'wa',
      'p,',
      'wb',
      'p)',
      'p;',
    ]);
  });

  it('aligns unique tokens first and the rest between them', () => {
    const tokens = (text) => layoutTokens([...text], layoutSyntax(syntax('c')));
    const pairs = alignTokens(
      tokens('a ( b ) c ( d )'),
      tokens('( b ) x ( d ) a')
    );
    expect(pairs).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
      [5, 4],
      [6, 5],
      [7, 6],
    ]);
  });

  it('never joins a name and a string or a name and its call', () => {
    const c = syntax('c');
    const run = (source, target) =>
      transferLayout(source, target, c, c, { language: 'c' }).text;
    expect(run('a  =  -1;\n', 'a = - 1;\n')).toBe('a  =  -1;\n');
    expect(run('u"x";\n', 'u "x";\n')).toBe('u "x";\n');
    expect(run('return(x);\n', 'return (x);\n')).toBe('return (x);\n');
    expect(run('f (x);\n', 'f(x);\n')).toBe('f(x);\n');
    expect(run('a+b;\n', 'a + b;\n')).toBe('a+b;\n');
    expect(run('a.b;\n', 'a . b;\n')).toBe('a . b;\n');
  });

  it('leaves strings that span lines and space sensitive targets alone', () => {
    const js = syntax('javascript');
    const multiline = transferLayout(
      'x = `a\n\n  b`;\n',
      'x = `a\n\n    b`;\n',
      js,
      js,
      { language: 'javascript' }
    );
    expect(multiline.text).toBe('x = `a\n\n    b`;\n');
    const bash = syntax('bash');
    expect(
      transferLayout('x = 1\n', 'x=1\n', bash, bash, { language: 'bash' }).text
    ).toBe('x=1\n');
  });

  it('keeps Windows line ends and the blank lines at the end', () => {
    const c = syntax('c');
    const { text } = transferLayout('\r\nf(1);\r\n\r\n', 'f(1);\n', c, c, {
      language: 'c',
    });
    expect(text).toBe('\r\nf(1);\r\n\r\n');
    const between = transferLayout(
      'f(1);\r\n\r\nf(2);\r\n',
      'f(1);\nf(2);\n',
      c,
      c,
      {
        language: 'c',
      }
    );
    expect(between.text).toBe('f(1);\r\n\r\nf(2);\r\n');
  });

  it('indents in the steps of the source', () => {
    const js = syntax('javascript');
    const python = syntax('python');
    const { text } = transferLayout(
      'if (a) {\n\tb();\n}\n',
      'if a:\n    b()\n',
      js,
      python,
      { language: 'python' }
    );
    expect(text).toBe('if a:\n\tb()\n');
  });

  it('maps lines only when the source has no code', () => {
    const c = syntax('c');
    expect(transferLayout('  \n', 'f();\n', c, c).text).toBe('f();\n');
  });
});

describe('lines of the layout', () => {
  it('maps each closing brace to the brace that closes its own block', () => {
    const source = 'function f(a) {\n  if (a) {\n    g();\n  }\n}\n';
    const c = syntax('csharp');
    const target = [
      'class Program {',
      '    static void F(bool a) {',
      '        if (a) {',
      '            G();',
      '        }',
      '    }',
      '',
      '    static void Main() {',
      '    }',
      '}',
      '',
    ].join('\n');
    const { lines } = transferLayout(source, target, syntax('javascript'), c, {
      respace: false,
    });
    expect(lines).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ]);
  });
});
