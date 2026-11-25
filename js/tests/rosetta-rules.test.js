import { describe, expect, it } from 'test-anywhere';
import { createGrammarTranslator } from '../src/translator.js';

// Rules that the Rosetta Code tasks in examples/programs rely on.
const translator = createGrammarTranslator();
const to = (code, target) => translator.translate(code, 'javascript', target);

describe('Rosetta Code translation rules', () => {
  it('renames identifiers that are reserved in the target language', () => {
    const r = to('let next = 1;\nconsole.log(next);\n', 'r');
    expect(r).toContain('next_ <- 1L');
    expect(r).not.toMatch(/\bnext <-/);
  });

  it('includes stdbool.h when C code uses bool', () => {
    const c = to(
      'function isEven(n) {\n  return n % 2 === 0;\n}\nconsole.log(isEven(4));\n',
      'c'
    );
    expect(c).toContain('#include <stdbool.h>');
  });

  it('parenthesizes and inside or', () => {
    const c = to(
      'function leap(y) {\n  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;\n}\nconsole.log(leap(2000));\n',
      'c'
    );
    expect(c).toContain('(y % 4 == 0 && y % 100 != 0) ||');
  });

  it('writes integer division without a compound /=', () => {
    const code = 'let x = 123;\nx = Math.trunc(x / 10);\nconsole.log(x);\n';
    expect(to(code, 'php')).not.toContain('/=');
    expect(to(code, 'python')).toContain('//');
  });

  it('leaves an R function without a value by return(invisible())', () => {
    const code =
      'function f(n) {\n  if (n === 0) {\n    return;\n  }\n  console.log(n);\n}\nf(1);\n';
    const r = to(code, 'r');
    expect(r).toContain('return(invisible())');
    expect(translator.translate(r, 'r', 'javascript')).toContain('return;');
  });

  it('raises R while loops back to counting loops', () => {
    const code = 'for (let i = 1; i <= 3; i++) {\n  console.log(i);\n}\n';
    const r = to(code, 'r');
    expect(translator.translate(r, 'r', 'javascript')).toContain('for (');
  });

  it('lowers other C-style loops into a while loop', () => {
    const code = 'for (let n = 3; n > 0; n--) {\n  console.log(n);\n}\n';
    const python = to(code, 'python');
    expect(python).toContain('n = 3\nwhile n > 0:');
    expect(python).toContain('n -= 1');
  });

  it('reads 0 and 1 returned by Perl conditions as booleans', () => {
    const code =
      'function odd(n) {\n  if (n % 2 === 0) {\n    return false;\n  }\n  return true;\n}\nif (odd(3)) {\n  console.log(3);\n}\n';
    const perl = to(code, 'perl');
    expect(perl).toContain('return 0;');
    expect(translator.translate(perl, 'perl', 'python')).toContain(
      'return False'
    );
    const nasm = to(code, 'nasm');
    expect(translator.translate(nasm, 'nasm', 'python')).toContain(
      'if odd(3):'
    );
  });
});
