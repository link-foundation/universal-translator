import { readFileSync } from 'node:fs';
import { expect, it } from 'test-anywhere';
import { createTranslator } from '../src/index.js';
import { meaningDifference } from '../src/meta/tree.js';

const source = readFileSync(
  new URL('../../examples/printing/arithmetic.py', import.meta.url),
  'utf8'
);

it('keeps complete arithmetic and trailing text inside Perl print arguments', () => {
  const translator = createTranslator();
  const meta = translator.toMeta(source, 'python');
  const output = translator.translate(source, 'python', 'perl');
  expect(meaningDifference(meta, translator.toMeta(output, 'perl'))).toBe(
    undefined
  );
  expect(output).toContain('print((1 + 2) . "\\n");');
});
