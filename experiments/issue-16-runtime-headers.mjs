// Finite lexer regression: six equivalent headers, no checkout or source build.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createTranslator } from '../js/src/index.js';
import { languageSyntax } from '../js/src/formal/languages.js';
import { tokenize as current } from '../js/src/formal/lexer.js';
import { rocqLayouts } from '../examples/runtime-headers/rocq-layout.mjs';

const before = process.argv.includes('--before');
let tokenize = current;
if (before) {
  const source = execFileSync(
    'git',
    ['show', '08e200c:js/src/formal/lexer.js'],
    {
      encoding: 'utf8',
      maxBuffer: 128 * 1024,
    }
  ).replace(
    /from '([.][^']+)'/g,
    (_, relative) =>
      `from ${JSON.stringify(new URL(relative, new URL('../js/src/formal/lexer.js', import.meta.url)).href)}`
  );
  ({ tokenize } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  ));
}
const syntax = languageSyntax('rocq');
const canonical = createTranslator().translate(
  'n = 2\nprint(n)\n',
  'python',
  'rocq'
);
const substantive = (tokens) =>
  tokens
    .filter((token) => !['newline', 'comment', 'end'].includes(token.type))
    .map(({ type, value, quote }) => ({ type, value, quote }));
const expected = substantive(current(canonical, syntax));
let failures = 0;
const cases = rocqLayouts(canonical).map((source, index) => {
  const tokens = tokenize(source, syntax);
  const print = tokens.find((token) => token.value === 'print_line');
  const expectedLine = source.slice(0, print.rawSpan[0]).split('\n').length;
  let error = null;
  try {
    assert.deepEqual(substantive(tokens), expected);
    assert.equal(print.line, expectedLine);
  } catch (failure) {
    failures += 1;
    error = failure.message.slice(0, 600);
  }
  return {
    index,
    line: print.line,
    expectedLine,
    tokenCount: tokens.length,
    error,
  };
});
console.log(
  JSON.stringify(
    { lexer: before ? '08e200c' : 'current', cases, failures },
    null,
    2
  )
);
process.exitCode = Number(failures > 0);
