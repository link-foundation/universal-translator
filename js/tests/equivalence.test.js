import { describe, expect, it } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  checkEquivalence,
  compareMeta,
  createTranslator,
} from '../../js/src/index.js';
import { runCli } from '../../bin/universal-translator.js';
import { extensions } from '../../examples/programs/verify-native.mjs';

const translator = createTranslator();
const programs = join(import.meta.dirname, '../../examples/programs');
const read = (path) => readFileSync(join(programs, path), 'utf8');

const sum = 'const total = 2 + 3;\nconsole.log(total);\n';
const commented = '# the sum\n\ntotal = 2 + 3\nprint(total)\n';
const changed = 'total = 2 + 4\nprint(total)\n';

const cli = (argv, files) => {
  const output = [];
  const errors = [];
  const status = runCli(argv, {
    read: (file) => files[file],
    write: (text) => output.push(text),
    stderr: (text) => errors.push(text),
  });
  return { status, output: output.join(''), errors: errors.join('\n') };
};

describe('equivalence of two programs', () => {
  for (const task of ['factorial', 'greatest-common-divisor']) {
    it(`finds every committed translation of ${task} equivalent to its source`, () => {
      const source = read(`${task}.js`);
      for (const [to, extension] of Object.entries(extensions)) {
        const target = read(`translated/${task}/${task}${extension}`);
        const checked = checkEquivalence(translator, {
          source,
          from: 'javascript',
          to,
          target,
        });
        expect([to, checked.difference]).toEqual([to, undefined]);
      }
    });
  }

  it('leaves comments, blank lines and the translation layout out', () => {
    expect(
      checkEquivalence(translator, {
        source: sum,
        from: 'javascript',
        to: 'python',
        target: commented,
      })
    ).toEqual({ equivalent: true, target: commented });
  });

  it('translates the source when no target is given', () => {
    const checked = checkEquivalence(translator, {
      source: sum,
      from: 'javascript',
      to: 'rust',
    });
    expect(checked.equivalent).toBe(true);
    expect(checked.target).toBe(
      translator.translate(sum, 'javascript', 'rust')
    );
  });

  it('reports the first difference in meaning with its path', () => {
    expect(
      checkEquivalence(translator, {
        source: sum,
        from: 'javascript',
        to: 'python',
        target: changed,
      })
    ).toEqual({
      equivalent: false,
      difference: '/main/statements/0/value/right/value: 3 != 4',
      target: changed,
    });
  });

  it('compares two meta programs read from different languages', () => {
    const javascript = translator.toMeta(sum, 'javascript');
    expect(
      compareMeta(javascript, translator.toMeta(commented, 'python'))
    ).toBe(undefined);
    expect(compareMeta(javascript, translator.toMeta(changed, 'python'))).toBe(
      '/main/statements/0/value/right/value: 3 != 4'
    );
  });
});

describe('the check-equivalence command', () => {
  const files = { 'sum.js': sum, 'sum.py': commented, 'changed.py': changed };

  it('reports equivalent programs', () => {
    expect(
      cli(
        ['check-equivalence', 'javascript', 'python', 'sum.js', 'sum.py'],
        files
      )
    ).toEqual({
      status: 0,
      output: 'The javascript and python programs are equivalent\n',
      errors: '',
    });
  });

  it('checks the translation when no target is given', () => {
    expect(
      cli(['check-equivalence', 'javascript', 'go', 'sum.js'], files).status
    ).toBe(0);
  });

  it('fails with the first difference', () => {
    expect(
      cli(
        ['check-equivalence', 'javascript', 'python', 'sum.js', 'changed.py'],
        files
      )
    ).toEqual({
      status: 1,
      output: '',
      errors:
        'The javascript and python programs are not equivalent: /main/statements/0/value/right/value: 3 != 4',
    });
  });

  it('needs the two languages and a source', () => {
    expect(
      cli(['check-equivalence', 'javascript', 'python'], files).status
    ).toBe(1);
  });
});
