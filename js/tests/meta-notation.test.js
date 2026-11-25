import { describe, expect, it } from 'test-anywhere';

import { createTranslator, formatMeta } from '../src/index.js';
import { parseLinks } from '../src/meta/links.js';

// The same text as the Rust test "shows_the_meta_program_as_links_notation".
const expected = [
  'program (comments hi)',
  '  declaration x (mutable false) (type text)',
  "    text 'a b' (type text)",
  '  print (newline true)',
  '    binary multiply (type integer)',
  '      name x (type text)',
  '      number 3 (type integer)',
  '',
].join('\n');

describe('meta view', () => {
  const translator = createTranslator();

  it('shows the meta program as Links Notation', () => {
    const meta = translator.toMeta(
      "# hi\n\nx = 'a b'\nprint(x * 3)\n",
      'python'
    );
    const text = formatMeta(meta);
    expect(text).toBe(expected);
    expect(parseLinks(text).length > 0).toBe(true);
  });

  it('shows the same meta program for every language that says the same', () => {
    const meta = translator.toMeta("x = 'a b'\nprint(x * 3)\n", 'python');
    const javascript = translator.translate(
      "x = 'a b'\nprint(x * 3)\n",
      'python',
      'javascript'
    );
    expect(formatMeta(translator.toMeta(javascript, 'javascript'))).toBe(
      formatMeta(meta)
    );
  });

  it('shows fragments and skips empty fields', () => {
    expect(formatMeta({ kind: 'Block', statements: [] })).toBe('block\n');
    expect(
      formatMeta({
        kind: 'Call',
        callee: 'f',
        arguments: [{ kind: 'Number', value: 1 }],
      })
    ).toBe('call f\n  number 1\n');
  });

  it('nests parameters and statements, and names a field after a block', () => {
    const source = [
      'def twice(n):',
      '    if n > 1:',
      '        return n * 2',
      '    else:',
      '        return 0',
      '',
      'print(twice(3))',
      '',
    ].join('\n');
    expect(formatMeta(translator.toMeta(source, 'python'))).toBe(
      [
        'program',
        '  function twice (blank-after true) (return-type integer)',
        '    parameter n (type integer)',
        '    if',
        '      binary greater (type boolean)',
        '        name n (type integer)',
        '        number 1 (type integer)',
        '      return',
        '        binary multiply (type integer)',
        '          name n (type integer)',
        '          number 2 (type integer)',
        '      otherwise',
        '        return',
        '          number 0 (type integer)',
        '  print (newline true)',
        '    call twice (type integer)',
        '      number 3 (type integer)',
        '',
      ].join('\n')
    );
  });

  it('never writes a block marker or a field label', () => {
    const text = formatMeta(
      translator.toMeta('for i in range(3):\n    print(i)\n', 'python')
    );
    expect(/\bblock\b|\w:/u.test(text)).toBe(false);
  });
});
