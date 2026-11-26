// The equivalence check: a translation does what its source does when both
// read into the same meta program, comments, imports, blank lines, types
// and mutability left out.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'test-anywhere';
import { checkEquivalence, createTranslator, effectOf } from '../src/index.js';
import { runCli } from '../../bin/universal-translator.js';

const translator = createTranslator();
const SUM = `let total = 0;
for (let i = 1; i <= 3; i++) {
  total = total + i;
}
console.log(total);
`;
const check = (translation, to = 'python') =>
  checkEquivalence(translator, {
    source: SUM,
    from: 'javascript',
    to,
    ...(translation === undefined ? {} : { translation }),
  });

describe('Equivalence of a translation', () => {
  it('holds for what the translator writes', () => {
    const result = check();
    expect(result.equivalent).toBe(true);
    expect(result.differences).toEqual([]);
    expect(result.translation).toContain('range(1, 4)');
  });

  it('leaves out comments, blank lines and the spelling of an update', () => {
    const python =
      '# sum\ntotal = 0\n\nfor i in range(1, 4):\n    total += i  # add\nprint(total)\n';
    expect(check(python).equivalent).toBe(true);
  });

  it('leaves out types and mutability', () => {
    const rust = `fn main() {
    let mut total: i64 = 0;
    for i in 1..=3 {
        total += i;
    }
    println!("{}", total);
}
`;
    expect(check(rust, 'rust').equivalent).toBe(true);
  });

  it('finds a bound that is one off', () => {
    const result = check(
      'total = 0\nfor i in range(1, 3):\n    total += i\nprint(total)\n'
    );
    expect(result.equivalent).toBe(false);
    expect(result.differences).toEqual([
      { line: 6, source: 'number 4', target: 'number 3' },
    ]);
  });

  it('finds another operator', () => {
    const result = check(
      'total = 0\nfor i in range(1, 4):\n    total = total * i\nprint(total)\n'
    );
    expect(result.differences.map((it) => [it.source, it.target])).toEqual([
      ['binary add', 'binary multiply'],
    ]);
  });

  it('keeps what a program does in the meta program', () => {
    const program = translator.toMeta(
      '// note\nlet x: number = 1;\n\nconsole.log(x);\n',
      'typescript'
    );
    const effect = JSON.stringify(effectOf(program));
    for (const left of [
      'note',
      '"type"',
      '"mutable"',
      '"Blank"',
      '"comments"',
    ]) {
      expect(effect.includes(left)).toBe(false);
    }
    expect(effect).toContain('"Declaration"');
  });
});

describe('Equivalence of the example programs', () => {
  const directory = new URL('../../examples/programs/', import.meta.url);
  const programs = readdirSync(directory).filter((file) =>
    file.endsWith('.js')
  );
  for (const to of [
    'python',
    'rust',
    'c',
    'java',
    'go',
    'ruby',
    'haskell',
    'nasm',
    'wat',
  ].filter((id) =>
    translator.languages().some((language) => language.id === id)
  )) {
    it(`holds from JavaScript to ${to}`, () => {
      for (const file of programs) {
        const source = readFileSync(new URL(file, directory), 'utf8');
        const result = checkEquivalence(translator, {
          source,
          from: 'javascript',
          to,
        });
        expect([file, result.differences]).toEqual([file, []]);
      }
    });
  }
});

describe('check-equivalence command', () => {
  const run = (args, files) => {
    const out = [];
    const errors = [];
    const code = runCli(['check-equivalence', ...args], {
      read: (file) => files[file],
      write: (text) => out.push(text),
      stderr: (text) => errors.push(text),
    });
    return { code, out: out.join(''), errors };
  };

  it('reports an equivalent translation', () => {
    const { code, out } = run(['javascript', 'python', 'sum.js'], {
      'sum.js': SUM,
    });
    expect(code).toBe(0);
    expect(out).toBe('equivalent: true\nmetaLines: 12\n');
  });

  it('fails on a translation that differs', () => {
    const { code, out, errors } = run(
      ['javascript', 'python', 'sum.js', 'sum.py'],
      {
        'sum.js': SUM,
        'sum.py':
          'total = 0\nfor i in range(1, 3):\n    total += i\nprint(total)\n',
      }
    );
    expect(code).toBe(1);
    expect(out).toBe(
      "equivalent: false\nmetaLines: 12\ndifferences:\n  (line 6) (source 'number 4') (target 'number 3')\n"
    );
    expect(errors).toEqual([
      'The python translation does not do what the javascript source does',
    ]);
  });
});
