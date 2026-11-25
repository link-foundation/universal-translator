// Every word a standard of one's own may change takes effect: a version that
// spells a concept with another word writes or reads programs differently.
import { describe, expect, it } from 'test-anywhere';

import { createGrammarTranslator } from '../src/translator.js';
import { grammarLanguageIds, languageSyntax } from '../src/formal/languages.js';
import {
  languageVocabulary,
  vocabularyChanges,
} from '../src/formal/vocabulary.js';
import {
  registerLanguageVersion,
  unregisterLanguageVersion,
} from '../src/formal/versions.js';

const translator = createGrammarTranslator();

const common = `// sum things
function both(a, b) {
  let c = a && b;
  const d = a || !b;
  return c != d;
}
function half(n) {
  return Math.trunc(n / 2);
}
function greet(n) {
  if (n > 1) {
    console.log("big");
  } else if (n > 0) {
    console.log("one");
  } else {
    console.log("none");
  }
}
function show(n) {
  console.log(n % 3 == 1);
}
function list(n) {
  for (let i = 0; i < n; i++) {
    console.log(i);
  }
}
function empty(n) {
}
let count = 7;
count = count + 1;
show(count);
list(count);
greet(count);
empty(count);
const items = [1, 2, 3];
console.log("Hi");
console.log(both(true, false));
console.log(half(count));
console.log(items[0]);
`;
const programs = [
  common,
  `${common}function name(n) {\n  return "n" + String(n);\n}\nconsole.log(name(count), count);\n`,
];

// Words these programs do not show: a word only read (a line comment where
// block comments are written, the type of nothing a signature leaves out,
// PHP's elseif next to `else if`) or one a dialect writes by itself.
const unshown = {
  php: ['operators.concatenate', 'elseIf'],
  c: ['lineComment', 'types.text'],
  csharp: ['lineComment'],
  go: ['types.nothing'],
  rust: ['types.nothing'],
  swift: ['types.nothing'],
  objc: ['lineComment', 'types.text'],
  nim: ['types.nothing'],
  d: ['operators.concatenate'],
  pascal: ['types.text', 'types.nothing'],
  fortran: ['types.integer', 'types.text', 'types.boolean', 'types.nothing'],
  ada: ['types.text', 'types.nothing'],
  vb: ['types.nothing'],
  bash: ['variableSigil'],
  zig: ['types.text'],
  lean: ['assignment', 'operators.concatenate', 'types.nothing'],
  rocq: [
    'lineComment',
    'blockComment',
    'assignment',
    'operators.notEqual',
    'operators.concatenate',
    'types.nothing',
  ],
};

function attempt(work) {
  try {
    return work();
  } catch (error) {
    return `error: ${error.message}`;
  }
}

// A check whether a version writes or reads this program differently from
// the language itself; undefined when the language cannot say the program.
function effectCheck(language, program) {
  const usual = attempt(() =>
    translator.translateFragment(program, 'javascript', language)
  );
  if (usual.startsWith('error: ')) {
    return undefined;
  }
  const [open, close] = languageSyntax(language).blockComment ?? [];
  const text = open ? `${open} note ${close}\n${usual}` : usual;
  const read = (from) =>
    attempt(() => translator.translateFragment(text, from, 'javascript'));
  const usualReading = read(language);
  return (version) =>
    attempt(() =>
      translator.translateFragment(program, 'javascript', version)
    ) !== usual || read(version) !== usualReading;
}

function ineffectiveConcepts(language) {
  const checks = programs
    .map((program) => effectCheck(language, program))
    .filter(Boolean);
  return languageVocabulary(language)
    .filter(({ concept, words }) => {
      const other = words.map(
        (word, index) => `zz${index}${word.replace(/\W/g, '')}q`
      );
      registerLanguageVersion(language, 'effect', {
        syntax: vocabularyChanges(language, [{ concept, words: other }]),
      });
      try {
        return !checks.some((takesEffect) => takesEffect(`${language}@effect`));
      } finally {
        unregisterLanguageVersion(language, 'effect');
      }
    })
    .map(({ concept }) => concept);
}

describe('the vocabulary of a standard of one own', () => {
  it('lists words, not how a language is laid out', () => {
    const concepts = languageVocabulary('go').map(({ concept }) => concept);
    for (const layout of [
      'naming',
      'blocks',
      'entryPoint',
      'typed',
      'terms.call',
    ]) {
      expect(concepts.includes(layout)).toBe(false);
    }
    expect(concepts.includes('print.line')).toBe(true);
  });

  for (const language of grammarLanguageIds) {
    it(`${language}: every changed word takes effect`, () => {
      expect(ineffectiveConcepts(language)).toEqual(unshown[language] ?? []);
    });
  }

  it('writes and reads a renamed print', () => {
    registerLanguageVersion('python', 'spoken', {
      syntax: vocabularyChanges('python', [
        { concept: 'print.line', words: ['say'] },
      ]),
    });
    try {
      expect(
        translator.translateFragment(
          'say("Hi")\n',
          'python@spoken',
          'javascript'
        )
      ).toBe('console.log("Hi");\n');
      expect(
        translator.translateFragment(
          'console.log("Hi");\n',
          'javascript',
          'python@spoken'
        )
      ).toBe('say("Hi")\n');
    } finally {
      unregisterLanguageVersion('python', 'spoken');
    }
  });

  it('refuses concepts that would name fields of Object itself', () => {
    for (const concept of ['__proto__.polluted', 'constructor.prototype.x']) {
      expect(() =>
        vocabularyChanges('python', [{ concept, words: ['x'] }])
      ).toThrow();
    }
    expect({}.polluted).toBe(undefined);
  });
});
