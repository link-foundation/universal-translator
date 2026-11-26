import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { translate, versionsOf } from '../src/index.js';

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

  it('writes no let, const or fill in any ECMAScript 5 example', () => {
    for (const task of tasks) {
      const es5 = translate(read(task), 'javascript', 'javascript@es5');
      expect(es5).not.toMatch(/^\s*(let|const) /m);
      expect(es5).not.toContain('.fill(');
    }
  });
});
