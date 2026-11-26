import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import {
  checkEquivalence,
  createTranslator,
  translate,
  versionsOf,
} from '../src/index.js';

const SOURCE = [
  'const n = 7;',
  'const half = Math.trunc(n / 2);',
  'console.log(`n is ${n}, half ${half}`);',
  'const items = new Array(3).fill(0);',
  'const list = [1, 2, 3];',
  'console.log(list.length);',
  '',
].join('\n');

const tasks = readdirSync('examples/programs')
  .filter((file) => file.endsWith('.js'))
  .map((file) => file.slice(0, -3));
const read = (task) => readFileSync(`examples/programs/${task}.js`, 'utf8');
const to = (target) => translate(SOURCE, 'javascript', target);

describe('versions of popular languages', () => {
  it('lists the newer version first as the default', () => {
    for (const [id, versions] of [
      ['javascript', ['es6', 'es5']],
      ['php', ['7', '5']],
      ['csharp', ['6', '5']],
      ['scala', ['2.10', '2.9']],
    ]) {
      expect(versionsOf(id).map(({ version }) => version)).toEqual(versions);
      expect(versionsOf(id)[0].default).toBe(true);
    }
  });

  it('writes ECMAScript 5 with var, +, ~~ and a fill loop', () => {
    const es5 = to('javascript@es5');
    expect(es5).not.toMatch(/\b(let|const)\b/);
    expect(es5).toContain('var n = 7;');
    expect(es5).toContain(
      'console.log("n is " + String(n) + ", half " + String(half));'
    );
    expect(es5).toContain('var half = ~~(n / 2);');
    expect(es5).toContain('var items = new Array(3);');
    expect(es5).toContain('for (var index = 0; index < 3; index++) {');
    expect(es5).not.toContain('.fill(');
    expect(es5).not.toContain('`');
  });

  it('keeps the default JavaScript for the newer version', () => {
    const es6 = to('javascript');
    expect(es6).toContain('const n = 7;');
    expect(es6).toContain('`n is ${n}, half ${half}`');
    expect(es6).toContain('Math.trunc(n / 2)');
    expect(to('javascript@es6')).toBe(es6);
  });

  it('writes PHP 5 with (int) and array(...), PHP 7 with intdiv and []', () => {
    const php5 = to('php@5');
    expect(php5).toContain('$half = (int) ($n / 2);');
    expect(php5).toContain('array(1, 2, 3)');
    expect(php5).not.toContain('intdiv');
    expect(php5).not.toContain('[1, 2, 3]');
    const php7 = to('php');
    expect(php7).toContain('$half = intdiv($n, 2);');
    expect(php7).toContain('[1, 2, 3]');
    expect(to('php@7')).toBe(php7);
  });

  it('writes C# 5 without string interpolation', () => {
    const csharp5 = to('csharp@5');
    expect(csharp5).toContain(
      '"n is " + System.Convert.ToString(n) + ", half " + System.Convert.ToString(half)'
    );
    expect(csharp5).not.toContain('$"');
    expect(to('csharp')).toContain('$"n is {n}, half {half}"');
  });

  it('refuses a version a language does not have', () => {
    expect(() => to('javascript@es3')).toThrow(
      'javascript has no version "es3"'
    );
    expect(() => to('php@4')).toThrow('php has no version "4"');
    expect(() => to('csharp@1')).toThrow('csharp has no version "1"');
  });

  it('reads every version back as the same program', () => {
    const source = 'const list = [1, 2, 3];\nconsole.log(Math.trunc(7 / 2));\n';
    const python = translate(source, 'javascript', 'python');
    for (const [target, language] of [
      ['javascript@es5', 'javascript'],
      ['php@5', 'php'],
      ['csharp@5', 'csharp'],
    ]) {
      const written = translate(source, 'javascript', target);
      expect(translate(written, language, 'python')).toBe(python);
    }
  });

  for (const target of ['javascript@es5', 'php@5', 'csharp@5']) {
    describe(`the example programs in ${target}`, () => {
      for (const task of tasks) {
        it(`translates ${task} without errors`, () => {
          const written = translate(read(task), 'javascript', target);
          expect(written.length).toBeGreaterThan(0);
        });
      }
    });
  }

  it('writes no let, const, fill or for...of in any ECMAScript 5 example', () => {
    for (const task of tasks) {
      const es5 = translate(read(task), 'javascript', 'javascript@es5');
      expect(es5).not.toMatch(/^\s*(let|const) /m);
      expect(es5).not.toMatch(/^\s*for \(\w+ \w+ of /m);
      expect(es5).not.toContain('.fill(');
    }
  });

  it('counts over the indexes of an array where ECMAScript 5 has no for...of', () => {
    const source =
      'const list = [1, 2, 3];\nfor (const item of list) {\n  console.log(item);\n}\n';
    const es5 = translate(source, 'javascript', 'javascript@es5');
    expect(es5).toContain(
      'for (var index = 0; index < list.length; index++) {'
    );
    expect(es5).toContain('var item = list[index];');
    const check = { source, from: 'javascript', to: 'javascript@es5' };
    expect(checkEquivalence(createTranslator(), check).equivalent).toBe(true);
  });
});

describe('versions of Java, Swift and Python 3', () => {
  const loop =
    'const list = [1, 2, 3];\nfor (const item of list) {\n  console.log(item);\n}\n';
  const prints = 'process.stdout.write("a");\nconsole.log("b");\n';

  it('counts over the indexes of an array where Java 1.4 has no for-each', () => {
    const java = translate(loop, 'javascript', 'java@1.4');
    expect(java).toContain(
      'for (int index = 0; index < list.length; index++) {'
    );
    expect(java).toContain('int item = list[index];');
    expect(translate(loop, 'javascript', 'java')).toContain(
      'for (int item : list) {'
    );
    expect(translate(java, 'java@1.4', 'javascript')).toContain(
      'console.log(item);'
    );
  });

  it('writes and reads println and print in Swift 1', () => {
    expect(translate(prints, 'javascript', 'swift@1')).toBe(
      'print("a")\nprintln("b")\n'
    );
    expect(
      translate('print("a")\nprintln("b")\n', 'swift@1', 'javascript')
    ).toBe(prints);
  });

  it('reads the empty terminator of Swift 2 and later as no line end', () => {
    const swift = translate(prints, 'javascript', 'swift');
    expect(swift).toBe('print("a", terminator: "")\nprint("b")\n');
    expect(translate(swift, 'swift', 'javascript')).toBe(prints);
  });

  it('prints any other terminator and separator after the values', () => {
    expect(
      translate(
        'print("a", terminator: "!")\nprint("a", "b", separator: "-")\n',
        'swift',
        'javascript'
      )
    ).toBe('process.stdout.write("a!");\nconsole.log(`a-b`);\n');
    expect(
      translate(
        'print("a", end="!")\nprint("a", "b", sep=", ", end=".\\n")\n',
        'python',
        'javascript'
      )
    ).toBe('process.stdout.write("a!");\nconsole.log("a, b.");\n');
  });

  it('joins text with + and str() in Python 3.5, before f-strings', () => {
    const source = 'const n = 7;\nconsole.log(`n is ${n}`);\n';
    expect(translate(source, 'javascript', 'python@3.5')).toBe(
      'n = 7\nprint("n is " + str(n))\n'
    );
    expect(translate(source, 'javascript', 'python')).toBe(
      'n = 7\nprint(f"n is {n}")\n'
    );
  });

  it('reads text joined from conversions as text, not as a sum', () => {
    expect(
      translate(
        'n = 7\nprint str(n) + str(n) + " items"\nprint str(n) + str(n)\nprint n + n\n',
        'python',
        'javascript'
      )
    ).toBe(
      'const n = 7;\nconsole.log(`${n}${n} items`);\nconsole.log(`${n}${n}`);\nconsole.log(n + n);\n'
    );
    const source =
      'const n = 7;\nconsole.log(`${n}${n} items`);\nconsole.log(`n is ${n}, half ${n}!`);\n';
    for (const version of ['python@2', 'python@3.5', 'csharp@5', 'scala@2.9']) {
      const written = translate(source, 'javascript', version);
      expect(translate(written, version, 'javascript')).toBe(source);
    }
  });

  it('joins text with + and String.valueOf in Scala 2.9, before s"..."', () => {
    const source = 'const n = 7;\nconsole.log(`n is ${n}`);\n';
    expect(translate(source, 'javascript', 'scala@2.9')).toContain(
      'println("n is " + String.valueOf(n))'
    );
    expect(translate(source, 'javascript', 'scala')).toContain(
      'println(s"n is ${n}")'
    );
    expect(
      translate(
        translate(source, 'javascript', 'scala@2.9'),
        'scala@2.9',
        'javascript'
      )
    ).toBe(source);
  });
});
