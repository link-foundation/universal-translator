// Two more surface forms of familiar concepts: a JavaScript arrow function
// bound to a name reads as the Function a `function` declaration reads as,
// and Python type hints give the meta types of parameters, results and
// assignments. The Rust twin is rust/tests/arrow_and_hints.rs.
import { describe, expect, it } from 'test-anywhere';

import { checkEquivalence } from '../src/index.js';
import { createGrammarTranslator } from '../src/translator.js';
import { meaningDifference } from '../src/meta/tree.js';

const translator = createGrammarTranslator();

const FUNCTION =
  'function square(n) { return n * n; }\nconsole.log(square(3));\n';

const arrows = {
  parenthesized: 'const square = (n) => n * n;\nconsole.log(square(3));\n',
  bare: 'const square = n => n * n;\nconsole.log(square(3));\n',
  block:
    'const square = (n) => {\n  return n * n;\n};\nconsole.log(square(3));\n',
  typed:
    'const square = (n: number): number => n * n;\nconsole.log(square(3));\n',
};

const HINTED = `def square(n: int) -> int:
    return n * n

total: int = 0
print(square(3) + total)
`;

const UNHINTED = `def square(n):
    return n * n

total = 0
print(square(3) + total)
`;

describe('arrow functions', () => {
  it('read as the Function a function declaration reads as', () => {
    const declared = translator.toMeta(FUNCTION, 'javascript');
    for (const [form, source] of Object.entries(arrows)) {
      const language = form === 'typed' ? 'typescript' : 'javascript';
      const meta = translator.toMeta(source, language);
      expect(meta.functions.map(({ name }) => name)).toEqual(['square']);
      if (form !== 'typed') {
        expect(meaningDifference(meta, declared)).toBe(undefined);
      }
    }
  });

  it('read with two parameters and statements before the result', () => {
    const arrow =
      'const add = (a, b) => {\n  const sum = a + b;\n  return sum;\n};\nconsole.log(add(1, 2));\n';
    const declared =
      'function add(a, b) {\n  const sum = a + b;\n  return sum;\n}\nconsole.log(add(1, 2));\n';
    expect(
      meaningDifference(
        translator.toMeta(arrow, 'javascript'),
        translator.toMeta(declared, 'javascript')
      )
    ).toBe(undefined);
  });

  it('translate to Python as the function declaration does', () => {
    const python = translator.translate(FUNCTION, 'javascript', 'python');
    expect(python).toContain('def square(n):');
    for (const form of ['parenthesized', 'bare']) {
      expect(translator.translate(arrows[form], 'javascript', 'python')).toBe(
        python
      );
    }
  });

  it('are written back as function declarations', () => {
    expect(
      translator.translate(arrows.parenthesized, 'javascript', 'javascript')
    ).toContain('function square(n) {');
  });

  it('leave other arrows and declarations to the expression reader', () => {
    const meta = translator.toMeta(
      'const size = (3);\nconsole.log(size);\n',
      'javascript'
    );
    expect(meta.functions).toEqual([]);
  });

  it('do what the function declaration does', () => {
    const result = checkEquivalence(translator, {
      source: arrows.parenthesized,
      from: 'javascript',
      to: 'javascript',
      translation: FUNCTION,
    });
    expect(result.equivalent).toBe(true);
    expect(
      checkEquivalence(translator, {
        source: arrows.block,
        from: 'javascript',
        to: 'python',
      }).equivalent
    ).toBe(true);
  });
});

describe('Python type hints', () => {
  it('give the meta types of parameters, results and assignments', () => {
    const meta = translator.toMeta(HINTED, 'python');
    const [square] = meta.functions;
    expect(square.parameters).toEqual([{ name: 'n', type: 'integer' }]);
    expect(square.returnType).toBe('integer');
    const [total] = meta.main.statements;
    expect(total.kind).toBe('Declaration');
    expect(total.type).toBe('integer');
  });

  it('map built-ins and retain application and generic types', () => {
    const types = (source) =>
      translator
        .toMeta(source, 'python')
        .functions[0].parameters.map(({ type }) => type);
    const hinted = types(
      'def show(name: str, shown: bool, sizes: list[int], ratio: float, table: dict[str, int]) -> None:\n    print(name)\n'
    );
    expect(hinted.slice(0, 3)).toEqual(['text', 'boolean', 'array']);
    expect(hinted.slice(3)).toEqual(['real', 'source:dict[str,int]']);
  });

  it('read a hint without a value as nothing to do', () => {
    const meta = translator.toMeta('total: int\ntotal = 1\n', 'python');
    expect(meta.main.statements.map(({ kind }) => kind)).toEqual([
      'Declaration',
    ]);
  });

  it('translate as the unhinted program does', () => {
    for (const language of ['javascript', 'python', 'ruby', 'rust', 'go']) {
      expect(translator.translate(HINTED, 'python', language)).toBe(
        translator.translate(UNHINTED, 'python', language)
      );
    }
  });

  it('leave what the program does unchanged', () => {
    const result = checkEquivalence(translator, {
      source: HINTED,
      from: 'python',
      to: 'python',
      translation: UNHINTED,
    });
    expect(result.equivalent).toBe(true);
    expect(
      checkEquivalence(translator, {
        source: HINTED,
        from: 'python',
        to: 'javascript',
      }).equivalent
    ).toBe(true);
  });
});
