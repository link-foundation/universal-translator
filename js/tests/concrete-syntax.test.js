import { describe, expect, it } from 'test-anywhere';
import { createTranslator, reconstructConcrete } from '../src/index.js';
import { languageSyntax } from '../src/formal/languages.js';
import { parseProgram } from '../src/formal/parser.js';

describe('concrete syntax as the default source record', () => {
  it('partitions every byte, including quotes, directives and trivia', () => {
    const cases = [
      ['javascript', '\t// Привет 😀\r\n\r\nconst x = `a\n b`; // fin\r\n'],
      ['python', '# note\n\ndef f(x):\n\treturn "é"  # tail\n\n'],
      ['cpp', '#include <string>\nint main() { /* x\ny */ return 0; }\n'],
      ['php', '<?php\n\n$x = "é";\n?>\n'],
    ];
    for (const [language, source] of cases) {
      const { syntax } = parseProgram(source, languageSyntax(language));
      expect(reconstructConcrete(syntax)).toBe(source);
      expect(syntax.unit).toBe('utf8');
      let end = 0;
      for (const child of syntax.children) {
        expect(child.start).toBe(end);
        end += new globalThis.TextEncoder().encode(child.text).length;
        expect(child.end).toBe(end);
      }
      expect(syntax.end).toBe(end);
      expect(syntax.productions.length).toBeGreaterThan(0);
      for (const production of syntax.productions) {
        expect(production.start >= 0 && production.end <= end).toBe(true);
      }
    }
  });

  it('exposes source syntax to decorators before semantic rewriting', () => {
    const source = 'const x = 1 + 2;\nconsole.log(x);\n';
    let concrete;
    const translator = createTranslator({
      trace(stage, tree) {
        if (stage === 'parsed') {
          concrete = tree.syntax;
        }
      },
    });
    expect(translator.translate(source, 'javascript', 'python')).toBe(
      'x = 1 + 2\nprint(x)\n'
    );
    expect(reconstructConcrete(concrete)).toBe(source);
    expect(
      concrete.productions.some(({ concept }) => concept === 'Declaration')
    ).toBe(true);
    expect(concrete.children.some(({ kind }) => kind === 'Trivia')).toBe(true);
  });
});
