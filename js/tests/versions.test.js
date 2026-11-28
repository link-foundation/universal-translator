import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { sameMeaning } from '../src/meta/tree.js';
import {
  baseNaturalLanguageIds,
  createTranslator,
  naturalLanguageVersions,
  preferredNaturalVersion,
  primesVersion,
  splitVersion,
  translate,
  translateFragment,
  versionsOf,
} from '../src/index.js';

const translator = createTranslator();
const tasks = readdirSync('examples/programs')
  .filter((file) => file.endsWith('.js'))
  .map((file) => file.slice(0, -3));
const read = (task) => readFileSync(`examples/programs/${task}.js`, 'utf8');

describe('programming language versions', () => {
  it('lists one Python with its versions, Python 3 first', () => {
    const pythons = translator
      .languages()
      .filter(({ id }) => id.startsWith('python'));
    expect(pythons.map(({ id }) => id)).toEqual(['python']);
    expect(pythons[0].versions.map(({ version }) => version)).toEqual([
      '3',
      '3.13',
      '3.12',
      '3.5',
      '2',
    ]);
    expect(versionsOf('python')[0].default).toBe(true);
    expect(versionsOf('ruby')).toEqual([]);
    expect(splitVersion('python@2')).toEqual({ id: 'python', version: '2' });
  });

  it('writes Python 2 without f-strings and with the print statement', () => {
    const source = 'const x = 2;\nconsole.log(`a${x}`);\nconsole.log();\n';
    const python2 = translate(source, 'javascript', 'python@2');
    expect(python2).toContain('print "a" + str(x)');
    expect(python2).toMatch(/^print$/m);
    expect(translate(source, 'javascript', 'python')).toContain(
      'print(f"a{x}")'
    );
    expect(
      translate('process.stdout.write("b");\n', 'javascript', 'python@2')
    ).toContain('sys.stdout.write("b")');
    expect(() => translate(source, 'javascript', 'python@1')).toThrow(
      'python has no version "1"'
    );
  });

  it('reads both versions as one Python', () => {
    expect(translateFragment('print "hi"', 'python', 'javascript')).toBe(
      'console.log("hi");\n'
    );
    expect(
      translateFragment('print("a" + str(1))', 'python', 'javascript')
    ).toBe(translateFragment('print("a" + 1)', 'python', 'javascript'));
  });

  it('keeps the meaning of every task written in Python 2', () => {
    for (const task of tasks) {
      const meta = translator.toMeta(read(task), 'javascript');
      const python2 = translator.fromMeta(meta, 'python@2');
      const back = translator.toMeta(python2, 'python');
      expect([task, sameMeaning(meta, back)]).toEqual([task, true]);
    }
  });

  it('writes the common library route in Python 2', () => {
    expect(
      translate(read('hello-world'), 'javascript', 'python@2', {
        commonLibrary: true,
      })
    ).toContain('from common_library import');
  });
});

describe('older versions of Lua, PHP and C#', () => {
  const source =
    'function half(n) {\n  return Math.trunc(n / 2);\n}\n' +
    'console.log(`${half(4)}${half(2)} items`);\n';

  it('lists the current version first', () => {
    const listed = (id) => versionsOf(id).map(({ version }) => version);
    expect([listed('lua'), listed('php'), listed('csharp')]).toEqual([
      ['5.3', '5.1'],
      ['7', '5'],
      ['6', '5'],
    ]);
  });

  it('divides integers in Lua 5.1 and PHP 5 without // and intdiv', () => {
    expect(translate(source, 'javascript', 'lua')).toContain(
      'return ut_integer_divide(n, 2)'
    );
    expect(translate(source, 'javascript', 'lua@5.1')).toContain(
      'return ut_integer_divide(n, 2)'
    );
    expect(translate(source, 'javascript', 'php@5')).toContain(
      'return (int) ($n / 2);'
    );
  });

  it('joins text with + in C# 5', () => {
    expect(translate(source, 'javascript', 'csharp@5')).toContain(
      'System.Console.WriteLine(System.Convert.ToString(Half(4)) + ' +
        'System.Convert.ToString(Half(2)) + " items");'
    );
    expect(translate(source, 'javascript', 'csharp')).toContain(
      'System.Console.WriteLine($"{Half(4)}{Half(2)} items");'
    );
  });

  it('keeps the meaning of every task written in every older version', () => {
    for (const target of ['python@2', 'lua@5.1', 'php@5', 'csharp@5']) {
      for (const task of tasks) {
        const meta = translator.toMeta(read(task), 'javascript');
        const written = translator.fromMeta(meta, target);
        const back = translator.toMeta(written, splitVersion(target).id);
        expect([target, task, sameMeaning(meta, back)]).toEqual([
          target,
          task,
          true,
        ]);
      }
    }
  });

  it("reads Lua's .. as joined text, looser than + and -", () => {
    const lua =
      'print(half(4) .. half(2) .. " items")\nlocal s = "a" .. 1 + 2\n';
    expect(translate(lua, 'lua', 'javascript')).toBe(
      'console.log(`${half(4)}${half(2)} items`);\nconst s = `a${1 + 2}`;\n'
    );
  });
});

describe('natural language versions', () => {
  it('lists each natural language once', () => {
    const ids = baseNaturalLanguageIds();
    expect(ids.length).toBe(30);
    expect(ids).toContain('english');
    expect(ids).not.toContain('english-british');
    expect(ids).not.toContain('minimal-english');
  });

  it('orders versions from the full vocabulary down to the standards', () => {
    const versions = naturalLanguageVersions('english');
    const { id, kind } = versions[0];
    expect([id, kind, versions[0].default]).toEqual(['english', 'full', true]);
    expect(versions[1].id).toBe('english-british');
    const sizes = versions
      .filter(({ kind }) => kind === 'vocabulary')
      .map(({ words }) => words);
    expect(sizes).toEqual([...sizes].sort((left, right) => right - left));
    expect(sizes.at(-1)).toBe(65);
    expect(versions.at(-1).kind).toBe('standard');
    expect(naturalLanguageVersions('minimal-english')[0].id).toBe('english');
  });

  it('picks American or British English from the browser languages', () => {
    expect(preferredNaturalVersion('english', ['en-GB', 'en-US'])).toBe(
      'english-british'
    );
    expect(preferredNaturalVersion('english', ['en-US', 'en-GB'])).toBe(
      'english'
    );
    expect(preferredNaturalVersion('english', ['ru-RU', 'en-AU'])).toBe(
      'english-british'
    );
    expect(preferredNaturalVersion('english', [])).toBe('english');
    expect(preferredNaturalVersion('russian', ['en-GB'])).toBe('russian');
  });

  it('spells British English with British spellings', () => {
    const text = translate(
      'const color = 1;\nconsole.log("x");\n',
      'javascript',
      'english-british'
    );
    expect(text).toContain('colour');
    expect(text).toContain('‘x’');
    expect(primesVersion('english')).toBe('minimal-english');
  });
});
