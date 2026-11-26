// JavaScript and TypeScript functions without the `function` keyword:
// arrow functions assigned to a constant and the static methods of a class.
// The Rust twin is rust/tests/arrow_functions.rs.
import { describe, expect, it } from 'test-anywhere';

import { createTranslator } from '../../js/src/index.js';

const translator = createTranslator();

describe('arrow functions', () => {
  it('reads expression and block bodies, with or without parentheses', () => {
    const source =
      'const add = (a, b) => a + b;\nconst twice = n => {\n  return n * 2;\n};\nconsole.log(add(2, twice(3)));\n';
    expect(translator.translate(source, 'javascript', 'python')).toBe(
      'def add(a, b):\n    return a + b\ndef twice(n):\n    return n * 2\nprint(add(2, twice(3)))\n'
    );
  });

  it('keeps the TypeScript parameter and return types', () => {
    const source =
      'const add = (a: number, b: number): number => a + b;\nconsole.log(add(2, 3));\n';
    expect(translator.translate(source, 'typescript', 'rust')).toBe(
      'fn add(a: i64, b: i64) -> i64 {\n    return a + b;\n}\n\nfn main() {\n    println!("{}", add(2, 3));\n}\n'
    );
  });

  it('leaves a constant that holds a value a variable', () => {
    expect(
      translator.translate('const total = (2 + 3);\n', 'javascript', 'python')
    ).toBe('total = 2 + 3\n');
  });
});

describe('static methods', () => {
  it('reads a JavaScript class of static methods as functions', () => {
    const source =
      'class Program {\n  static square(n) {\n    return n * n;\n  }\n}\nconsole.log(Program.square(3));\n';
    expect(translator.translate(source, 'javascript', 'python')).toBe(
      'def square(n):\n    return n * n\nprint(square(3))\n'
    );
  });

  it('calls a function of the program by its own name', () => {
    const source =
      'public class Program {\n    static int square(int n) {\n        return n * n;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(Program.square(3));\n    }\n}\n';
    expect(translator.translate(source, 'java', 'csharp')).toContain(
      'System.Console.WriteLine(Square(3));'
    );
  });
});
