// Finite reproduction of native nested comments and Rocq comment strings.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { languageSyntax } from '../js/src/formal/languages.js';
import { tokenize as currentTokenize } from '../js/src/formal/lexer.js';
import { translateComments } from '../js/src/index.js';

const before = process.argv.includes('--before');
let tokenize = currentTokenize;
if (before) {
  const previous = execFileSync(
    'git',
    ['show', 'bb3785c:js/src/formal/lexer.js'],
    { encoding: 'utf8', maxBuffer: 128 * 1024 }
  ).replace(
    /from '([.][^']+)'/g,
    (_, relative) =>
      `from ${JSON.stringify(new URL(relative, new URL('../js/src/formal/lexer.js', import.meta.url)).href)}`
  );
  ({ tokenize } = await import(
    `data:text/javascript;base64,${Buffer.from(previous).toString('base64')}`
  ));
}

const failures = [];
let checked = 0;
const check = (language, name, test) => {
  checked += 1;
  try {
    test();
  } catch (error) {
    failures.push({ language, name, error: error.message });
  }
};
const replace = (text) =>
  text
    .replaceAll('number', 'число')
    .replaceAll('sequence', 'последовательность');
const translate = (source, language) => {
  if (!before) {
    return translateComments(source, language, {
      from: 'english',
      to: 'russian',
      translateComment: replace,
    });
  }
  const tokens = tokenize(source, languageSyntax(language)).filter(
    (token) => token.type === 'comment'
  );
  let output = '',
    at = 0;
  for (const {
    span: [start, end],
  } of tokens) {
    output += source.slice(at, start) + replace(source.slice(start, end));
    at = end;
  }
  return output + source.slice(at);
};

for (const language of [
  'rust',
  'kotlin',
  'swift',
  'dart',
  'scala',
  'julia',
  'nim',
  'lean',
  'rocq',
]) {
  const syntax = languageSyntax(language);
  const [open, close] = syntax.blockComment;
  const source = `\r\n${open} number ${open} sequence ${close}\r\n number ${close}\t\r\n`;
  check(language, 'all comment words and exact layout', () =>
    assert.equal(translate(source, language), replace(source))
  );
  check(language, 'one complete comment token', () => {
    const comments = tokenize(source, syntax).filter(
      (token) => token.type === 'comment'
    );
    assert.equal(comments.length, 1);
    assert.deepEqual(comments[0].span, [
      source.indexOf(open) + open.length,
      source.lastIndexOf(close),
    ]);
  });
  check(language, 'unclosed outer comment', () =>
    assert.throws(
      () => tokenize(`${open} number ${open} sequence ${close}`, syntax),
      /Unterminated comment/
    )
  );
}
const quoted = '(* "*)" "(*" "😀""*)" number (* sequence *) number *)';
check('rocq', 'comment strings hide delimiters', () =>
  assert.equal(translate(quoted, 'rocq'), replace(quoted))
);
check('rocq', 'unclosed comment string', () =>
  assert.throws(
    () => tokenize('(* "number *)', languageSyntax('rocq')),
    /Unterminated comment/
  )
);
for (const language of ['javascript', 'c', 'cpp', 'java', 'csharp']) {
  check(language, 'non-nesting grammar', () =>
    assert.equal(
      translate('/* number /* sequence */ number */', language),
      '/* число /* последовательность */ number */'
    )
  );
}
console.log(
  JSON.stringify(
    { lexer: before ? 'bb3785c' : 'current', checked, failures },
    null,
    2
  )
);
process.exitCode = Number(failures.length !== 0);
