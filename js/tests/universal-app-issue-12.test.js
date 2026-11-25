// Issue 12: the demo's highlighting taken from the meta language and its
// standards kept as indented Links Notation (JSON of earlier versions is
// still read). Only modules without React are imported here.
import { describe, it, expect } from 'test-anywhere';
import { createGrammarTranslator } from '../src/translator.js';
import { naturalLanguage } from '../src/natural/catalog.js';
import { languageSyntax } from '../src/formal/languages.js';
import {
  highlightText,
  linoLexicon,
  metaWords,
  pieces,
  sourceLexicon,
} from '../../examples/universal-app/src/highlight.js';
import {
  readRecords,
  savedStandards,
  standardsKey,
  standardsText,
  wordStandardsKey,
  wordStandardsText,
  writeRecords,
} from '../../examples/universal-app/src/saved-standards.js';

const translator = createGrammarTranslator();

// [text, type] pieces of every line, without the plain ones.
function coloured(text, lexicon) {
  const lines = text.split('\n');
  return highlightText(text, lexicon).flatMap((tokens, index) =>
    pieces(lines[index], tokens)
      .filter(([, type]) => type)
      .map(([part, type]) => [part.trim(), type])
  );
}

const typeOf = (all, text) => all.find(([part]) => part === text)?.[1];
const has = (list, [text, type]) =>
  list.some(([part, kind]) => part.trim() === text && kind === type);

function lexiconFor(text, language, syntax) {
  const { program } = translator.parseFragment(text, language);
  return sourceLexicon(syntax, metaWords(program));
}

const gcd = [
  'def gcd(a, b):',
  '    while b != 0:',
  '        t = b',
  '        b = a % b',
  '        a = t',
  '    return a',
  '',
  'print(gcd(48, 18))  # 6',
].join('\n');

const memoryStorage = (entries = {}) => {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
};

describe('issue 12: highlighting from the meta language', () => {
  it('colours names, functions, keywords, numbers and comments', () => {
    const lexicon = lexiconFor(gcd, 'python', languageSyntax('python'));
    expect([...lexicon.functions]).toContain('gcd');
    expect([...lexicon.names].sort()).toEqual(['a', 'b', 't']);
    const all = coloured(gcd, lexicon);
    expect(typeOf(all, 'def')).toBe('keyword');
    expect(typeOf(all, 'gcd')).toBe('function');
    expect(typeOf(all, 'a')).toBe('variable');
    expect(typeOf(all, '48')).toBe('number');
    expect(typeOf(all, '# 6')).toBe('comment');
    // print is a statement of the meta language, not a Call: a keyword.
    expect(typeOf(all, 'print')).toBe('keyword');
  });

  it('keeps the indentation of a line as a plain piece', () => {
    const lexicon = lexiconFor(gcd, 'python', languageSyntax('python'));
    const [line] = highlightText('    return a', lexicon);
    expect(pieces('    return a', line)[0]).toEqual(['    ', '']);
    expect(
      pieces('    return a', line)
        .map(([part]) => part)
        .join('')
    ).toBe('    return a');
  });

  it('carries a block comment or a quoted text over to the next line', () => {
    const lexicon = sourceLexicon(languageSyntax('javascript'));
    const all = coloured('/* one\ntwo */ x = "a\\"b"', lexicon);
    expect(all[0]).toEqual(['/* one', 'comment']);
    expect(all[1]).toEqual(['two */', 'comment']);
    expect(typeOf(all, '"a\\"b"')).toBe('string');
  });

  it('colours the names a natural language writes in its own words', () => {
    const matlab = [
      'function r = gcd_of(first, second)',
      '  r = first + second;',
      'end',
    ].join('\n');
    for (const language of ['turkish', 'russian']) {
      const result = translator.translate(matlab, 'matlab', language, {
        fragment: true,
      });
      const text = result.output ?? result;
      const lexicon = lexiconFor(text, language, naturalLanguage(language));
      expect(lexicon.phrases.length).toBeGreaterThan(0);
      const types = new Set(coloured(text, lexicon).map(([, type]) => type));
      expect(types.has('function')).toBe(true);
      expect(types.has('variable')).toBe(true);
    }
  });

  it('keeps a word with combining marks whole', () => {
    const lexicon = sourceLexicon(naturalLanguage('bengali'));
    const [tokens] = highlightText('লেখো এবং', lexicon);
    expect(pieces('লেখো এবং', tokens)).toEqual([['লেখো এবং', 'keyword']]);
  });

  it('colours Links Notation: kinds, unique names, fields and values', () => {
    const text = 'output:\n  (find print) (replace "say")\nfunction gcd';
    const lines = text.split('\n');
    const all = highlightText(text, linoLexicon).map((tokens, index) =>
      pieces(lines[index], tokens)
    );
    expect(all[0][0]).toEqual(['output', 'type']);
    expect(has(all[1], ['find', 'attribute'])).toBe(true);
    expect(has(all[1], ['"say"', 'string'])).toBe(true);
    expect(has(all[2], ['function', 'keyword'])).toBe(true);
    expect(has(all[2], ['gcd', 'function'])).toBe(true);
  });
});

describe('issue 12: standards stored as Links Notation', () => {
  const items = [
    {
      kind: 'programming',
      id: 'python@spoken-python',
      label: "Spoken 'Python'",
      source: 'language: python\nversion: spoken-python',
    },
  ];

  it('writes records as indented Links Notation and reads them back', () => {
    const text = standardsText(items);
    expect(text.trimStart().startsWith('{')).toBe(false);
    expect(text.trimStart().startsWith('[')).toBe(false);
    expect(text).toContain('(kind programming)');
    const storage = memoryStorage({ [standardsKey]: text });
    expect(savedStandards(storage)).toEqual([
      {
        kind: 'programming',
        label: "Spoken 'Python'",
        source: 'language: python\nversion: spoken-python',
        id: 'python@spoken-python',
      },
    ]);
  });

  it('still reads standards saved as JSON by earlier versions', () => {
    const storage = memoryStorage({ [standardsKey]: JSON.stringify(items) });
    expect(savedStandards(storage)).toEqual(items);
  });

  it('round-trips records with quotes and several lines', () => {
    const records = [
      { id: 'a b', fields: [[['x', "it's"]], [['y', 'one\ntwo']]] },
    ];
    expect(readRecords(writeRecords(records))).toEqual([
      { id: 'a b', fields: { x: "it's", y: 'one\ntwo' } },
    ]);
  });

  it('keeps word standards as one Links Notation line per language', () => {
    const text = wordStandardsText({ english: 'one two' });
    expect(text).toBe("english: 'one two'\n");
    expect(wordStandardsKey).toBe('universal-translator.word-standards');
  });
});
