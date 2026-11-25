import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import {
  addDefinition,
  baseNaturalLanguageIds,
  cachedLookup,
  createStandard,
  defineWord,
  expandWord,
  isOwnNaturalLanguage,
  languageVocabulary,
  lemmaCandidates,
  loadLanguageVersion,
  naturalLanguageIds,
  naturalLanguageSource,
  naturalLanguageVersions,
  naturalStandardSource,
  naturalVocabulary,
  primitiveWords,
  readDefinitionCache,
  readLanguageVersion,
  readStandard,
  registerLanguageVersion,
  registerNaturalLanguage,
  standardEntries,
  standardSize,
  standardWordLimit,
  translate,
  unregisterLanguageVersion,
  unregisterNaturalLanguage,
  versionsOf,
  vocabularyChanges,
  wikidataLookup,
  writeDefinitionCache,
  writeLanguageVersion,
  writeStandard,
} from '../src/index.js';

const program = [
  'function both(a, b) {',
  '  return a && b;',
  '}',
  'console.log(both(true, false));',
  '',
].join('\n');

describe('standards of programming languages', () => {
  it('lists every word of a language with the concept it spells', () => {
    const vocabulary = languageVocabulary('python');
    const concept = (name) =>
      vocabulary.find((entry) => entry.concept === name)?.words;
    expect(concept('operators.and')).toEqual(['and']);
    expect(concept('functionKeyword')).toEqual(['def']);
    expect(concept('words.true')).toEqual(['True']);
    expect(concept('lineComment')).toEqual(['#']);
  });

  it('saves a changed standard as a version of its own and translates with it', () => {
    const syntax = vocabularyChanges('python', [
      { concept: 'operators.and', words: ['&&'] },
      { concept: 'functionKeyword', words: ['fn'] },
      { concept: 'lineComment', words: ['#'] },
    ]);
    expect(syntax).toEqual({ operators: { and: '&&' }, functionKeyword: 'fn' });
    const saved = writeLanguageVersion({
      language: 'python',
      version: 'ampersand',
      label: "Python with C's and",
      syntax,
    });
    expect(readLanguageVersion(saved)).toEqual({
      language: 'python',
      version: 'ampersand',
      label: "Python with C's and",
      syntax,
    });
    const id = loadLanguageVersion(saved);
    try {
      expect(id).toBe('python@ampersand');
      expect(versionsOf('python').at(-1)).toEqual({
        version: 'ampersand',
        label: "Python with C's and",
        default: false,
        custom: true,
      });
      const written = translate(program, 'javascript', id);
      expect(written).toBe(
        'fn both(a, b):\n    return a && b\n\nprint(both(True, False))\n'
      );
      // The other operators and words of Python stay.
      expect(translate(written, id, 'javascript')).toBe(
        translate(
          translate(program, 'javascript', 'python'),
          'python',
          'javascript'
        )
      );
    } finally {
      unregisterLanguageVersion('python', 'ampersand');
    }
    expect(versionsOf('python').map(({ version }) => version)).toEqual([
      '3',
      '2',
    ]);
  });

  it('makes a version of one own from another version', () => {
    const base = languageVocabulary('python@2');
    const syntax = vocabularyChanges(
      'python@2',
      base.map((entry) =>
        entry.concept === 'operators.and' ? { ...entry, words: ['&&'] } : entry
      )
    );
    expect(syntax).toEqual({ operators: { and: '&&' } });
    const saved = writeLanguageVersion({
      language: 'python',
      version: 'old-and',
      base: '2',
      syntax,
    });
    expect(saved).toContain("  base: '2'\n");
    expect(readLanguageVersion(saved).base).toBe('2');
    const id = loadLanguageVersion(saved);
    try {
      // Python 2 prints with a statement and keeps the changed operator.
      expect(translate(program, 'javascript', id)).toBe(
        'def both(a, b):\n    return a && b\n\nprint both(True, False)\n'
      );
    } finally {
      unregisterLanguageVersion('python', 'old-and');
    }
  });

  it('keeps built-in versions and rejects unknown concepts', () => {
    expect(() =>
      registerLanguageVersion('python', '2', { syntax: {} })
    ).toThrow();
    expect(() =>
      vocabularyChanges('python', [{ concept: 'operators.xor', words: ['^'] }])
    ).toThrow();
    expect(() =>
      vocabularyChanges('python', [
        { concept: 'functionKeyword', words: ['fn', 'def'] },
      ])
    ).toThrow();
  });
});

describe('standards of natural languages', () => {
  it('shows every word of every language with its meta concept', () => {
    for (const id of baseNaturalLanguageIds()) {
      const vocabulary = naturalVocabulary(id);
      const concepts = new Set(vocabulary.map(({ concept }) => concept));
      expect(concepts.has('template:if')).toBe(true);
      expect(concepts.has('value:true')).toBe(true);
      expect(
        vocabulary.filter(({ concept }) => concept.startsWith('prime:')).length
      ).toBe(65);
    }
  });

  it('registers a standard of one own, extending the closest language', () => {
    const source = [
      'natural:',
      '  id: english-terse',
      "  label: 'Terse English'",
      '  extends: english',
      '  profile: terse',
      '  templates:',
      "    print-line: 'Show {value}'",
      '',
    ].join('\n');
    expect(registerNaturalLanguage(source)).toBe('english-terse');
    try {
      expect(isOwnNaturalLanguage('english-terse')).toBe(true);
      expect(naturalLanguageSource('english-terse')).toBe(source);
      expect(naturalLanguageIds()).toContain('english-terse');
      // It is listed last among the versions of English, as one's own.
      expect(naturalLanguageVersions('english').at(-1)).toEqual({
        id: 'english-terse',
        label: 'Terse English',
        kind: 'own',
        default: false,
      });
      const words = translate(program, 'javascript', 'english-terse');
      expect(words).toContain('Show both of (true, false).');
      expect(translate(words, 'english-terse', 'javascript')).toBe(
        translate(
          translate(program, 'javascript', 'english'),
          'english',
          'javascript'
        )
      );
    } finally {
      unregisterNaturalLanguage('english-terse');
    }
    expect(naturalLanguageIds()).not.toContain('english-terse');
    expect(() =>
      registerNaturalLanguage(naturalLanguageSource('english'))
    ).toThrow();
  });
});

describe('natural standards crafted in an editor', () => {
  it('writes only the changed entries over the closest language', () => {
    const entries = naturalVocabulary('english').map((entry) => {
      if (entry.concept === 'template:print-line') {
        return { ...entry, words: ['Show {value}'] };
      }
      return entry.concept === 'value:true'
        ? { ...entry, words: ['yes'] }
        : entry;
    });
    const source = naturalStandardSource({
      id: 'english-mine',
      label: 'My English',
      base: 'english',
      entries,
    });
    expect(source).toBe(
      [
        'natural:',
        '  id: english-mine',
        "  label: 'My English'",
        '  extends: english',
        "  true: 'yes'",
        '  templates:',
        "    print-line: 'Show {value}'",
        '',
      ].join('\n')
    );
    registerNaturalLanguage(source);
    try {
      const words = translate(
        'console.log(true);\n',
        'javascript',
        'english-mine'
      );
      expect(words).toBe('Show yes.\n');
      expect(translate(words, 'english-mine', 'javascript')).toBe(
        'console.log(true);\n'
      );
    } finally {
      unregisterNaturalLanguage('english-mine');
    }
    expect(() =>
      naturalStandardSource({
        id: 'x',
        base: 'english',
        entries: [{ concept: 'template:teleport', words: ['Go'] }],
      })
    ).toThrow();
  });
});

describe('words defined through other words', () => {
  it('starts every standard from the semantic primes of its language', () => {
    for (const id of baseNaturalLanguageIds()) {
      const primitives = primitiveWords(id);
      expect(primitives.size > 60).toBe(true);
      expect(primitives.size <= standardWordLimit).toBe(true);
    }
    const english = primitiveWords('english');
    expect(english.get('want')).toBe('prime:want');
    expect(english.get('long')).toBe('prime:a-long-time');
  });

  it('adds composite words only through words it has', () => {
    const standard = createStandard({ words: { twice: 'two times' } });
    expect(standardSize(standard)).toBe(primitiveWords('english').size + 1);
    expect(() => addDefinition(standard, 'triple', 'thrice as much')).toThrow(
      'unknown words: thrice'
    );
    expect(() => addDefinition(standard, 'loop', 'do loop again')).toThrow();
    addDefinition(standard, 'double', 'twice as much');
    expect(expandWord(standard, 'double')).toBe('(two times) as much');
    expect(standardEntries(standard).at(-1)).toEqual({
      word: 'double',
      kind: 'composite',
      definition: 'twice as much',
    });
    expect(writeStandard(readStandard(writeStandard(standard)))).toBe(
      writeStandard(standard)
    );
  });

  it('keeps a standard within its word limit', () => {
    const size = primitiveWords('english').size;
    const standard = createStandard({ limit: size + 1 });
    addDefinition(standard, 'twice', 'two times');
    expect(() => addDefinition(standard, 'double', 'twice as much')).toThrow(
      `already has ${size + 1} words`
    );
    expect(() => createStandard({ limit: 10 })).toThrow();
  });

  it('defines unknown words recursively, in real time', async () => {
    const standard = createStandard();
    const lookup = cachedLookup({
      quadruple: ['doubled double'],
      double: ['being twice as much as something else'],
      twice: ['two times'],
    });
    const result = await defineWord(standard, 'quadruple', { lookup });
    expect(result.defined).toBe(true);
    // Every word is added after the words its definition uses.
    expect(result.added.map(({ word }) => word)).toEqual([
      'twice',
      'double',
      'quadruple',
    ]);
    expect(expandWord(standard, 'quadruple')).toBe(
      '(being (two times) as much as something else) (being (two times) as much as something else)'
    );
  });

  it('reports the words it cannot reach and does not loop on cycles', async () => {
    const standard = createStandard();
    const lookup = cachedLookup({
      egg: ['what a chicken lays'],
      chicken: ['what comes out of an egg'],
    });
    const result = await defineWord(standard, 'egg', { lookup });
    expect(result.defined).toBe(false);
    expect(result.missing).toContain('egg');
    expect(result.missing).toContain('lays');
    expect(standardSize(standard)).toBe(primitiveWords('english').size);
  });

  it('finds the dictionary form of inflected English words', () => {
    expect(lemmaCandidates('being')).toContain('be');
    expect(lemmaCandidates('bigger')).toContain('big');
    expect(lemmaCandidates('parts')).toContain('part');
    expect(lemmaCandidates('happened')).toContain('happen');
    expect(lemmaCandidates('частей', 'russian')).toEqual(['частей']);
  });
});

describe('definitions from Wikidata', () => {
  const lexemes = {
    search: [{ id: 'L1' }, { id: 'L2' }],
  };
  const entities = {
    entities: {
      L1: {
        lemmas: { en: { value: 'double' } },
        senses: [
          {
            glosses: { en: { value: 'being twice as much as something else' } },
          },
          { glosses: { fr: { value: 'deux fois' } } },
        ],
      },
      L2: {
        lemmas: { fr: { value: 'double' } },
        senses: [{ glosses: { en: { value: 'not English' } } }],
      },
    },
  };
  const respond = (body, status = 200) => ({
    ok: status === 200,
    status,
    headers: { get: () => '0' },
    json: async () => body,
  });

  it('reads the glosses of lexemes spelled like the word, once', async () => {
    const urls = [];
    const fetch = async (url) => {
      urls.push(url);
      return respond(url.includes('wbsearchentities') ? lexemes : entities);
    };
    const cache = new Map();
    const lookup = wikidataLookup({ fetch, cache });
    expect(await lookup('double', 'english')).toEqual([
      'being twice as much as something else',
    ]);
    expect(await lookup('double', 'english-british')).toEqual([
      'being twice as much as something else',
    ]);
    expect(urls.length).toBe(2);
    expect(urls[0]).toContain('type=lexeme');
    expect(urls[0]).toContain('origin=*');
    expect(readDefinitionCache(writeDefinitionCache(cache))).toEqual(cache);
  });

  it('waits and retries when Wikidata asks to slow down', async () => {
    let calls = 0;
    const waits = [];
    const fetch = async (url) => {
      calls += 1;
      if (calls === 1) {
        return respond({}, 429);
      }
      return respond(url.includes('wbsearchentities') ? { search: [] } : {});
    };
    const lookup = wikidataLookup({
      fetch,
      wait: async (milliseconds) => waits.push(milliseconds),
    });
    expect(await lookup('nothing-like-it')).toEqual([]);
    expect(calls).toBe(2);
    expect(waits).toEqual([1000]);
  });

  it('gives up on a request without an answer', async () => {
    const fetch = (url, { signal }) =>
      new Promise((resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason))
      );
    const lookup = wikidataLookup({ fetch, timeout: 10 });
    const failure = await lookup('silence').then(
      () => undefined,
      (error) => error
    );
    expect(failure?.name).toBe('TimeoutError');
  });

  const cacheFile = 'data/definitions/wikidata-english.lino';
  it('defines words offline from the Wikidata pre-cache', async () => {
    expect(existsSync(cacheFile)).toBe(true);
    const cache = readDefinitionCache(readFileSync(cacheFile, 'utf8'));
    const lookup = wikidataLookup({
      cache,
      fetch: () => {
        throw new Error('The pre-cache has every word the test needs');
      },
    });
    const standard = createStandard();
    const result = await defineWord(standard, 'twice', { lookup });
    expect(result.defined).toBe(true);
    expect(expandWord(standard, 'twice')).toBe(result.added.at(-1).definition);
  });
});
