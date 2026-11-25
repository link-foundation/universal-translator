import { describe, expect, it } from 'test-anywhere';

import { createTranslator, formatMeta } from '../src/index.js';
import { parseLinks } from '../src/meta/links.js';

// The same text as the Rust test "shows_the_meta_program_as_links_notation".
const expected = [
  'program (comments hi)',
  '  main: block',
  '    statements',
  '      declaration (mutable false) (name x) (type text)',
  "        value: text (type text) (value 'a b')",
  '      print (newline true)',
  '        value: binary (operator multiply) (type integer)',
  '          left: name (name x) (type text)',
  '          right: number (type integer) (value 3)',
  '',
].join('\n');

describe('meta view', () => {
  const translator = createTranslator();

  it('shows the meta program as Links Notation', () => {
    const meta = translator.toMeta("# hi\nx = 'a b'\nprint(x * 3)\n", 'python');
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
    ).toBe('call (callee f)\n  arguments\n    number (value 1)\n');
  });
});
