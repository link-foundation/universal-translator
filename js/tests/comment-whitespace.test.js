import { expect, it } from 'test-anywhere';
import {
  createTranslator,
  grammarLanguageIds,
  machineTargetIds,
  naturalLanguageIds,
  translateComments,
} from '../src/index.js';
import { languageSyntax } from '../src/formal/languages.js';
import { tokenize } from '../src/formal/lexer.js';
import { layoutSyntax, layoutTokens } from '../src/translation/layout.js';

const translator = createTranslator();
const replace = (text) => text.replaceAll('spaceprobe', 'пробел');
const options = {
  commentFrom: 'english',
  commentLanguage: 'russian',
  translateComment: replace,
};

it('changes only comment contents in every current reader family', () => {
  for (const language of [
    ...grammarLanguageIds,
    ...machineTargetIds,
    ...naturalLanguageIds(),
  ]) {
    const canonical = translator.translate(
      '# spaceprobe\n\nn = 1\n# spaceprobe\nprint(n)\n',
      'python',
      language
    );
    const source = `\r\n${canonical.replaceAll('\n', '\r\n')}\r\n`;
    const expected = replace(source);
    expect({
      language,
      text: translator.translate(source, language, language, options),
    }).toEqual({ language, text: expected });
    expect({
      language,
      text: translateComments(source, language, {
        from: 'english',
        to: 'russian',
        translateComment: replace,
      }),
    }).toEqual({ language, text: expected });
  }
});

it('keeps source layout in partial translations through every reader family', () => {
  for (const language of [
    ...grammarLanguageIds,
    ...naturalLanguageIds(),
    ...machineTargetIds,
  ]) {
    const canonical = translator.translate(
      '# spaceprobe\n\nprint(2)\n',
      'python',
      language
    );
    const header = naturalLanguageIds().includes(language)
      ? ''
      : (languageSyntax(language).header ?? '');
    const source = `${header}\r\n${canonical.slice(header.length).replaceAll('\n', '\r\n')}\r\n`;
    const result = translator.translatePartial(
      source,
      language,
      language,
      options
    );
    expect({ language, complete: result.complete, text: result.text }).toEqual({
      language,
      complete: true,
      text: replace(source),
    });
  }
});

it('leaves note-looking lines inside multiline natural text alone', () => {
  const source =
    '\r\nNote:\t number  \r\n\r\nWrite “first\nNote: number\nlast” and end the line.\r\nNote: sequence  \r\n';
  const expected = source
    .replace('Note:\t number', 'Note:\t число')
    .replace('Note: sequence', 'Note: последовательность');
  expect(
    translator.translate(source, 'english', 'english', {
      commentFrom: 'english',
      commentLanguage: 'russian',
    })
  ).toBe(expected);
  const printed = translator
    .toMeta(expected, 'english')
    .main.statements.find((statement) => statement.kind === 'Print');
  expect(printed.value.value).toBe('first\nNote: number\nlast');
});

it('retains machine strings, Unicode offsets, inline and nested comments', () => {
  const cases = [
    ['nasm', '\r\nlabel: db "😀; number", 0\t; number  \r\n'],
    ['gas', '.asciz "😀# number" /* number */\t# sequence\r\n'],
    ['arm64', '.asciz "😀// number"\t// number\r\n'],
    [
      'cil',
      '.method public void \'number//name\'() { ldstr "😀// number" } // number\r\n',
    ],
    ['jvm', 'ldc "😀; number"\t; number\r\n'],
    ['llvm', '@x = constant [5 x i8] c"; number" ; number\r\n'],
    [
      'wat',
      '(module (; number (; sequence ;) number ;) (data "😀;; number") ;; sequence\r\n)\r\n',
    ],
  ];
  const expected = [
    '\r\nlabel: db "😀; number", 0\t; число  \r\n',
    '.asciz "😀# number" /* число */\t# последовательность\r\n',
    '.asciz "😀// number"\t// число\r\n',
    '.method public void \'number//name\'() { ldstr "😀// number" } // число\r\n',
    'ldc "😀; number"\t; число\r\n',
    '@x = constant [5 x i8] c"; number" ; число\r\n',
    '(module (; число (; последовательность ;) число ;) (data "😀;; number") ;; последовательность\r\n)\r\n',
  ];
  for (const [index, [language, source]] of cases.entries()) {
    expect({
      language,
      text: translateComments(source, language, {
        from: 'english',
        to: 'russian',
      }),
    }).toEqual({ language, text: expected[index] });
  }
  for (const [language, source] of [
    ['wat', '(;'],
    ['wat', '(; number (; sequence ;)'],
    ['cil', '/* number'],
  ]) {
    expect(() =>
      translateComments(source, language, {
        from: 'english',
        to: 'russian',
      })
    ).toThrow('Unterminated comment');
  }
});

it('keeps SQL query comments and whitespace in place', () => {
  const source =
    '\r\n-- number\r\n\r\nSELECT age FROM people AS person; -- sequence\r\n\r\n';
  const expected = source
    .replace('number', 'число')
    .replace('sequence', 'последовательность');
  expect(
    translator.translatePartial(source, 'sql', 'sql', {
      commentFrom: 'english',
      commentLanguage: 'russian',
    }).text
  ).toBe(expected);
});

it('reads nested block comments according to each language grammar', () => {
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
    const source = `\r\n${open} number ${open} sequence ${close}\r\n  number ${close}\t\r\n\r\n`;
    const expected = source
      .replaceAll('number', 'число')
      .replaceAll('sequence', 'последовательность');
    expect({
      language,
      text: translateComments(source, language, {
        from: 'english',
        to: 'russian',
      }),
    }).toEqual({ language, text: expected });
    const comments = tokenize(source, syntax).filter(
      (token) => token.type === 'comment'
    );
    expect(comments.length).toBe(1);
    expect(comments[0].span).toEqual([
      source.indexOf(open) + open.length,
      source.lastIndexOf(close),
    ]);
    const layoutComments = layoutTokens(
      [...source],
      layoutSyntax(syntax)
    ).filter((token) => token.kind === 'comment');
    expect(layoutComments.length).toBe(1);
    expect(layoutComments[0].end).toBe(
      source.lastIndexOf(close) + close.length
    );
    expect(() =>
      translateComments(`${open} number ${open} sequence ${close}`, language, {
        from: 'english',
        to: 'russian',
      })
    ).toThrow('Unterminated comment');
  }
  for (const language of ['javascript', 'c', 'cpp', 'java', 'csharp']) {
    expect(
      translateComments('/* number /* sequence */ number */', language, {
        from: 'english',
        to: 'russian',
      })
    ).toBe('/* число /* последовательность */ number */');
  }
});

it('honours Rocq strings inside comments while other grammars treat quotes as text', () => {
  const source = '(* "*)" "(*" "😀""*)" number (* sequence *) number *)';
  const expected = source
    .replaceAll('number', 'число')
    .replaceAll('sequence', 'последовательность');
  expect(
    translateComments(source, 'rocq', { from: 'english', to: 'russian' })
  ).toBe(expected);
  const syntax = languageSyntax('rocq');
  expect(
    tokenize(source, syntax).filter((token) => token.type === 'comment').length
  ).toBe(1);
  expect(layoutTokens([...source], layoutSyntax(syntax)).length).toBe(1);
  expect(() =>
    translateComments('(* "number *)', 'rocq', {
      from: 'english',
      to: 'russian',
    })
  ).toThrow('Unterminated comment');
  expect(
    translateComments('/* " number */', 'rust', {
      from: 'english',
      to: 'russian',
    })
  ).toBe('/* " число */');
});
