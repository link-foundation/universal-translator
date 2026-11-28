import { describe, expect, it } from 'test-anywhere';
import {
  createTranslator,
  machineTargetIds,
  reconstructConcrete,
} from '../src/index.js';
import { languageSyntax } from '../src/formal/languages.js';
import { parseProgram } from '../src/formal/parser.js';

describe('concrete syntax as the default source record', () => {
  it('partitions every byte, including quotes, directives and trivia', () => {
    const cases = [
      ['javascript', '\t// Привет 😀\r\n\r\nconst x = `a\n b`; // fin\r\n'],
      ['python', '# note\n\ndef f(x):\n\treturn "é"  # tail\n\n'],
      ['cpp', '#include <string>\nint main() { /* x\ny */ return 0; }\n'],
      ['php', '<?php\n\n$x = "é";\n?>\n'],
      [
        'rust',
        'fn main() {\r\n  /* 😀 outer /* inner */ tail */\r\n  println!("ok");\r\n}\r\n',
      ],
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
      if (language === 'rust') {
        expect(
          syntax.children
            .filter((child) => child.type === 'comment')
            .map((child) => child.text)
        ).toEqual(['/* 😀 outer /* inner */ tail */']);
      }
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

  it('retains source syntax when reading words and every machine format', () => {
    const standard = createTranslator();
    for (const language of ['english', 'russian', ...machineTargetIds]) {
      const source = standard.translate(
        'const value = 5;\nconsole.log(value + 2);\n',
        'javascript',
        language
      );
      let syntax;
      const reader = createTranslator({
        trace(stage, tree) {
          if (stage === 'parsed') {
            syntax = tree.syntax;
          }
        },
      });
      expect(reader.translate(source, language, 'python')).toBe(
        'value = 5\nprint(value + 2)\n'
      );
      expect(reconstructConcrete(syntax)).toBe(source);
      expect(syntax.language).toBe(language);
      expect(
        syntax.productions.some(({ concept }) => concept === 'Print')
      ).toBe(true);
      expect(syntax.errors).toEqual([]);
    }
  });

  it('keeps accepted regions and explicit errors in incomplete source', () => {
    const source =
      'const value = 5;\r\nconsole.log(value);\r\nconst text = "unfinished 😀\r\n\r\n';
    const reading = createTranslator().parsePartial(source, 'javascript');
    expect(reading.complete).toBe(false);
    expect(reconstructConcrete(reading.syntax)).toBe(source);
    const bytes = new globalThis.TextEncoder().encode(source);
    expect(reading.syntax.end).toBe(bytes.length);
    expect(reading.syntax.productions.length).toBeGreaterThan(0);
    expect(reading.syntax.errors.length).toBe(1);
    const [error] = reading.syntax.errors;
    expect(error.kind).toBe('Error');
    expect(
      new globalThis.TextDecoder().decode(bytes.slice(error.start, error.end))
    ).toContain('"unfinished 😀');
    expect(error.message).toContain('Unterminated');
    expect(
      reading.syntax.productions.every(({ end }) => end <= error.start)
    ).toBe(true);
  });

  it('keeps a lossless record for empty and whitespace-only input', () => {
    for (const source of ['', '\r\n\t \r\n']) {
      const reading = createTranslator().parsePartial(source, 'javascript');
      expect(reading.complete).toBe(true);
      expect(reconstructConcrete(reading.syntax)).toBe(source);
      expect(reading.syntax.errors).toEqual([]);
      expect(reading.syntax.productions).toEqual([]);
    }
  });
});
