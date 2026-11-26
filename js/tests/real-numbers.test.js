import { describe, expect, it } from 'test-anywhere';

import { createTranslator, formatMeta, translate } from '../src/index.js';

const translator = createTranslator();
const halves = 'let x = 7 / 2;\nlet y = 1.5 * 2;\nconsole.log(x + y);\n';
const python = 'x = 7 / 2\nprint(x)\n';

describe('real numbers', () => {
  it('reads literals with a point or an exponent as reals', () => {
    const meta = formatMeta(
      translator.toMeta(
        'let a = 1.5;\nlet b = 1e3;\nlet c = 2;\n',
        'javascript'
      )
    );
    expect(meta).toContain('number 1.5 (type real)');
    expect(meta).toContain('number 1000 (type real)');
    expect(meta).toContain('number 2 (type integer)');
  });

  it('reads `/` of JavaScript and Python 3 as true division', () => {
    const meta = formatMeta(translator.toMeta(python, 'python'));
    expect(meta).toContain('binary realDivide (type real)');
    expect(translate(python, 'python', 'javascript')).toBe(
      'const x = 7 / 2;\nconsole.log(x);\n'
    );
  });

  it('writes a true division with real operands where `/` divides integers', () => {
    expect(translate(halves, 'javascript', 'python')).toBe(
      'x = 7 / 2\ny = 1.5 * 2\nprint(x + y)\n'
    );
    expect(translate(halves, 'javascript', 'rust')).toBe(
      'fn main() {\n    let x: f64 = 7.0 / 2.0;\n    let y: f64 = 1.5 * 2.0;\n    println!("{}", x + y);\n}\n'
    );
    expect(translate(halves, 'javascript', 'c')).toBe(
      '#include <stdio.h>\n\nint main(void) {\n    double x = 7.0 / 2;\n    double y = 1.5 * 2;\n    printf("%g\\n", x + y);\n}\n'
    );
    expect(translate(halves, 'javascript', 'java')).toContain(
      '        double x = 7.0 / 2;\n        double y = 1.5 * 2;\n'
    );
    expect(translate(halves, 'javascript', 'go')).toContain('x := 7.0 / 2.0');
  });

  it('converts integer variables that meet a real', () => {
    const source =
      'function average(total, count) {\n  return total / count;\n}\nconsole.log(average(7, 2));\n';
    expect(translate(source, 'javascript', 'c')).toContain(
      'double average(int total, int count) {\n    return (double) total / count;'
    );
    expect(translate(source, 'javascript', 'rust')).toContain(
      'total as f64 / count as f64'
    );
    expect(translate(source, 'javascript', 'go')).toContain(
      'float64(total) / float64(count)'
    );
  });

  it('keeps integer division apart from true division', () => {
    const source = 'a = 17\nb = 5\nprint(a // b)\nprint(a / b)\n';
    const javascript = translate(source, 'python', 'javascript');
    expect(javascript).toContain('console.log(Math.trunc(a / b));');
    expect(javascript).toContain('console.log(a / b);');
    const c = 'int main(void) {\n    int a = 7 / 2;\n    return 0;\n}\n';
    expect(translate(c, 'c', 'javascript')).toContain(
      'const a = Math.trunc(7 / 2);'
    );
    expect(translate(c, 'c', 'python')).toContain('a = 7 // 2');
  });

  it('reads real declarations and %g placeholders of C', () => {
    const source =
      '#include <stdio.h>\n\nint main(void) {\n    double y = 3;\n    printf("%g\\n", y / 2);\n    return 0;\n}\n';
    expect(translate(source, 'c', 'rust')).toContain(
      'let y: f64 = 3.0;\n    println!("{}", y / 2.0);'
    );
    expect(translate(source, 'c', 'python')).toContain('y = 3.0\nprint(y / 2)');
  });

  it('turns `/=` into the division of the source language', () => {
    const source = 'y = 10\ny /= 4\nprint(y)\n';
    expect(translate(source, 'python', 'rust')).toContain(
      'let mut y: f64 = 10.0;\n    y /= 4.0;'
    );
  });
});
