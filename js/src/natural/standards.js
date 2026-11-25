// Natural language standards: the words a standard has, the meta language
// concept each word stands for, and words defined through other words.
//
// A standard starts from the semantic primes of its language (the 65 words
// of Natural Semantic Metalanguage, which every human language has and which
// define each other's meaning only by use) and the grammatical words its
// minimal profile allows. Every other word is a composite word: it has a
// definition, a phrase made only of words the standard already has, so every
// word can be expanded down to the primes. A standard holds at most
// `standardWordLimit` words; the largest well-known controlled vocabularies
// below that limit are ASD-STE100 (875 words) and Basic English (850).
//
// defineWord() extends a standard in real time: it looks up the definition
// of an unknown word (in Wikidata, through a cache), then defines every
// unknown word of that definition the same way, recursively, and adds the
// word when its definition is made only of words of the standard.

import { parseLinks } from '../meta/links.js';
import { naturalLanguage, naturalLanguageIds } from './catalog.js';
import { semanticPrimes } from './rules.js';

export const standardWordLimit = 1024;

const fold = (text) => text.toLocaleLowerCase();

// Words are letters with inner apostrophes and hyphens; numbers are data and
// need no definition.
const wordPattern = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;
export const wordsOfText = (text) => fold(text).match(wordPattern) ?? [];

const baseOf = (id) => naturalLanguage(id).base ?? id;

// The minimal profile of a language (minimal-english for english).
function minimalProfile(base) {
  return naturalLanguageIds().find(
    (id) =>
      baseOf(id) === base && naturalLanguage(id).rules.primes?.includes(base)
  );
}

// The words every standard of a language starts from: prime exponents and
// the grammatical words of its minimal profile.
export function primitiveWords(id) {
  const base = baseOf(id);
  const words = new Map();
  for (const { prime, exponents } of semanticPrimes()) {
    // "a-long-time" is the phrase "a long time": its words count too.
    for (const phrase of exponents[base] ?? []) {
      const parts = wordsOfText(phrase.replaceAll('-', ' '));
      for (const word of [...wordsOfText(phrase), ...parts]) {
        if (!words.has(word)) {
          words.set(word, `prime:${prime}`);
        }
      }
    }
  }
  const minimal = minimalProfile(base);
  const extra = minimal ? naturalLanguage(minimal).rules['extra-words'] : [];
  for (const word of wordsOfText((extra ?? []).join(' '))) {
    if (!words.has(word)) {
      words.set(word, 'grammar');
    }
  }
  return words;
}

// Every word of a natural language description with the meta language
// concept it stands for, for a standards editor:
//
//   template:<statement>  a sentence or expression template
//   word:<neutral>        a word of program names
//   prime:<prime>         the exponents of a semantic prime
//   value:true|false      the words of the two truth values
export function naturalVocabulary(id) {
  const language = naturalLanguage(id);
  const base = baseOf(id);
  const entries = [
    ...Object.entries(language.templates).map(([key, texts]) => ({
      concept: `template:${key}`,
      words: texts,
    })),
    ...Object.entries(language.lexicon).map(([neutral, word]) => ({
      concept: `word:${neutral}`,
      words: [word],
    })),
    { concept: 'value:true', words: [language.true] },
    { concept: 'value:false', words: [language.false] },
  ];
  for (const { prime, exponents } of semanticPrimes()) {
    if (exponents[base]) {
      entries.push({ concept: `prime:${prime}`, words: exponents[base] });
    }
  }
  return entries.filter((entry) => entry.words.every(Boolean));
}

// Likely dictionary forms of an inflected word, the word itself first. Only
// English endings are known; other languages match exact forms.
export function lemmaCandidates(word, language = 'english') {
  const folded = fold(word);
  const forms = [folded];
  if (baseOf(language) !== 'english') {
    return forms;
  }
  const endings = [
    ['ies', 'y'],
    ['ied', 'y'],
    ['ves', 'f'],
    ['sses', 'ss'],
    ['ches', 'ch'],
    ['shes', 'sh'],
    ['xes', 'x'],
    ['es', 'e'],
    ['es', ''],
    ['s', ''],
    ['ied', 'y'],
    ['ed', 'e'],
    ['ed', ''],
    ['ing', 'e'],
    ['ing', ''],
    ['ly', ''],
    ['er', ''],
    ['est', ''],
    ["'s", ''],
  ];
  for (const [ending, replacement] of endings) {
    if (folded.endsWith(ending) && folded.length > ending.length + 1) {
      forms.push(folded.slice(0, -ending.length) + replacement);
    }
  }
  // Doubled final consonants: "bigger" -> "big", "running" -> "run".
  for (const ending of ['ing', 'ed', 'er', 'est']) {
    const stem = folded.slice(0, -ending.length);
    if (folded.endsWith(ending) && /([^aeiou])\1$/u.test(stem)) {
      forms.push(stem.slice(0, -1));
    }
  }
  return [...new Set(forms)];
}

// A standard: a language, its primitive words and its composite words.
export function createStandard({
  id = 'my-standard',
  language = 'english',
  words = {},
  limit = standardWordLimit,
} = {}) {
  const standard = {
    id,
    language,
    limit,
    primitives: primitiveWords(language),
    definitions: new Map(),
  };
  if (standard.primitives.size > limit) {
    throw new Error(
      `${language} has ${standard.primitives.size} primitive words, more than ${limit}`
    );
  }
  for (const [word, definition] of Object.entries(words)) {
    addDefinition(standard, word, definition);
  }
  return standard;
}

export const standardSize = (standard) =>
  standard.primitives.size + standard.definitions.size;

// The form of a word the standard has, if it has one.
export function knownForm(standard, word) {
  return lemmaCandidates(word, standard.language).find(
    (form) => standard.primitives.has(form) || standard.definitions.has(form)
  );
}

// Words of a definition the standard does not have.
export const unknownWords = (standard, definition) =>
  wordsOfText(definition).filter((word) => !knownForm(standard, word));

// Add a composite word. Its definition may use only words the standard has
// (a word cannot be defined through itself), and the standard must stay
// within its limit.
export function addDefinition(standard, word, definition) {
  const folded = fold(word);
  if (standard.primitives.has(folded)) {
    throw new Error(`"${word}" is a primitive word of ${standard.id}`);
  }
  const missing = unknownWords(standard, definition).filter(
    (unknown) => unknown !== folded
  );
  if (wordsOfText(definition).includes(folded)) {
    throw new Error(`"${word}" is defined through itself`);
  }
  if (missing.length) {
    throw new Error(
      `The definition of "${word}" uses unknown words: ${[...new Set(missing)].join(', ')}`
    );
  }
  if (
    !standard.definitions.has(folded) &&
    standardSize(standard) >= standard.limit
  ) {
    throw new Error(`${standard.id} already has ${standard.limit} words`);
  }
  standard.definitions.set(folded, definition.trim());
  return folded;
}

// Every word of a standard, primitive words first, for an editor.
export function standardEntries(standard) {
  return [
    ...[...standard.primitives].map(([word, meaning]) => ({
      word,
      kind: meaning === 'grammar' ? 'grammar' : 'prime',
      meaning,
    })),
    ...[...standard.definitions].map(([word, definition]) => ({
      word,
      kind: 'composite',
      definition,
    })),
  ];
}

// A word expanded down to primitive words: each composite word of its
// definition is replaced by that word's own expansion, in parentheses.
export function expandWord(standard, word, seen = new Set()) {
  const form = knownForm(standard, word);
  if (!form) {
    throw new Error(`${standard.id} has no word "${word}"`);
  }
  if (standard.primitives.has(form) || seen.has(form)) {
    return word;
  }
  const definition = standard.definitions.get(form);
  const inner = new Set([...seen, form]);
  const expanded = definition.replace(wordPattern, (part) => {
    const known = knownForm(standard, part);
    return known && standard.definitions.has(known)
      ? `(${expandWord(standard, part, inner)})`
      : part;
  });
  return expanded;
}

// Define a word, and recursively every unknown word of its definition,
// through the words of a standard. `lookup(word, language)` resolves to the
// candidate definitions of a word (a list of phrases, best first). Words the
// standard cannot reach within `depth` levels or `budget` lookups stay
// undefined. Returns what was added and which words are still missing.
export async function defineWord(
  standard,
  word,
  { lookup, depth = 4, budget = 64 } = {}
) {
  const added = [];
  const missing = new Set();
  const failed = new Set();
  let lookups = 0;

  async function define(candidate, level, visiting) {
    if (knownForm(standard, candidate)) {
      return true;
    }
    const forms = lemmaCandidates(candidate, standard.language);
    if (
      level > depth ||
      forms.some((form) => visiting.has(form) || failed.has(form))
    ) {
      return false;
    }
    for (const form of forms) {
      if (lookups >= budget) {
        break;
      }
      lookups += 1;
      const definitions = (await lookup(form, standard.language)) ?? [];
      const inner = new Set([...visiting, form]);
      for (const definition of definitions) {
        if (wordsOfText(definition).includes(form)) {
          continue;
        }
        let complete = true;
        for (const part of wordsOfText(definition)) {
          if (!(await define(part, level + 1, inner))) {
            complete = false;
          }
        }
        if (complete && standardSize(standard) < standard.limit) {
          addDefinition(standard, form, definition);
          added.push({ word: form, definition: definition.trim() });
          return true;
        }
      }
      if (definitions.length) {
        break;
      }
    }
    forms.forEach((form) => failed.add(form));
    missing.add(fold(candidate));
    return false;
  }

  const defined = await define(word, 0, new Set());
  return {
    word: fold(word),
    defined,
    added,
    missing: [...missing].filter((unknown) => !knownForm(standard, unknown)),
    lookups,
  };
}

// A lookup over a fixed table of definitions: { word: [definitions] }.
export const cachedLookup = (table) => (word) =>
  Promise.resolve(table[word] ?? []);

// Wikidata language codes of the natural languages.
export const wikidataLanguageCodes = {
  english: 'en',
  arabic: 'ar',
  bengali: 'bn',
  chinese: 'zh',
  dutch: 'nl',
  french: 'fr',
  german: 'de',
  gujarati: 'gu',
  hausa: 'ha',
  hindi: 'hi',
  indonesian: 'id',
  italian: 'it',
  japanese: 'ja',
  korean: 'ko',
  marathi: 'mr',
  persian: 'fa',
  polish: 'pl',
  portuguese: 'pt',
  punjabi: 'pa',
  russian: 'ru',
  spanish: 'es',
  swahili: 'sw',
  tagalog: 'tl',
  tamil: 'ta',
  telugu: 'te',
  thai: 'th',
  turkish: 'tr',
  ukrainian: 'uk',
  urdu: 'ur',
  vietnamese: 'vi',
};

const wikidataApi = 'https://www.wikidata.org/w/api.php';

// Definitions of a word from the senses of Wikidata lexemes: the glosses, in
// the word's own language, of every lexeme whose lemma is the word. Results
// (also empty ones) are kept in `cache` (a Map), so each word is fetched
// once; a cache filled ahead of time makes the lookup work offline.
// Requests are spaced `interval` milliseconds apart, and a request Wikidata
// refuses for being too frequent (429) is retried after the time it asks
// for, at most `retries` times. A request without an answer in `timeout`
// milliseconds fails, so a lost connection cannot keep a caller waiting.
export function wikidataLookup({
  fetch = globalThis.fetch,
  cache = new Map(),
  limit = 5,
  interval = 0,
  retries = 3,
  timeout = 20000,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  let next = 0;
  const getJson = async (parameters, attempt = 0) => {
    const query = new URLSearchParams({
      format: 'json',
      origin: '*',
      ...parameters,
    });
    const now = Date.now();
    if (next > now) {
      await wait(next - now);
    }
    next = Math.max(now, next) + interval;
    const response = await fetch(`${wikidataApi}?${query}`, {
      signal: AbortSignal.timeout(timeout),
    });
    if (response.status === 429 && attempt < retries) {
      const after = Number(response.headers?.get?.('retry-after'));
      await wait(
        (Number.isFinite(after) && after > 0 ? after : 2 ** attempt) * 1000
      );
      return getJson(parameters, attempt + 1);
    }
    if (!response.ok) {
      throw new Error(`Wikidata answered ${response.status}`);
    }
    return response.json();
  };
  return async (word, language = 'english') => {
    const code = wikidataLanguageCodes[baseOf(language)];
    const key = `${code}:${fold(word)}`;
    if (cache.has(key)) {
      return cache.get(key);
    }
    if (!code) {
      return [];
    }
    const found = await getJson({
      action: 'wbsearchentities',
      type: 'lexeme',
      search: word,
      language: code,
      uselang: code,
      limit: String(limit),
    });
    const ids = (found.search ?? []).map((result) => result.id);
    let glosses = [];
    if (ids.length) {
      const { entities = {} } = await getJson({
        action: 'wbgetentities',
        ids: ids.join('|'),
      });
      glosses = lexemeGlosses(Object.values(entities), word, code);
    }
    cache.set(key, glosses);
    return glosses;
  };
}

// Glosses in one language of the lexemes spelled `word` in that language.
export function lexemeGlosses(lexemes, word, code) {
  const glosses = [];
  for (const lexeme of lexemes) {
    const lemmas = Object.entries(lexeme.lemmas ?? {});
    const spelled = lemmas.some(
      ([lemmaCode, { value }]) =>
        lemmaCode.split('-')[0] === code && fold(value) === fold(word)
    );
    if (!spelled) {
      continue;
    }
    for (const sense of lexeme.senses ?? []) {
      const gloss = sense.glosses?.[code]?.value;
      if (gloss && !glosses.includes(gloss)) {
        glosses.push(gloss);
      }
    }
  }
  return glosses;
}

const quote = (text) => `'${text.split("'").join("''")}'`;

// A definition cache as Links Notation, to keep it in a file:
//
//   definitions:
//     en:double: 'being twice as much as something else'
export function writeDefinitionCache(cache) {
  const lines = ['definitions:'];
  for (const [key, glosses] of [...cache].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    lines.push(
      `  ${quote(key)}:${glosses.map((gloss) => ` ${quote(gloss)}`).join('')}`
    );
  }
  return `${lines.join('\n')}\n`;
}

// The standard as a list of definitions, to save it:
//
//   standard:
//     id: my-standard
//     language: english
//     words:
//       twice: 'two times'
export function writeStandard(standard) {
  const lines = [
    'standard:',
    `  id: ${quote(standard.id)}`,
    `  language: ${standard.language}`,
    `  limit: ${standard.limit}`,
    '  words:',
    ...[...standard.definitions].map(
      ([word, definition]) => `    ${quote(word)}: ${quote(definition)}`
    ),
  ];
  return `${lines.join('\n')}\n`;
}

// Links Notation -> definition cache (a Map for wikidataLookup).
export function readDefinitionCache(source) {
  const [root] = parseLinks(source);
  if (root?.id !== 'definitions') {
    throw new Error('A definition cache starts with "definitions:"');
  }
  return new Map(
    (root.values ?? []).map(({ id, values }) => [
      id,
      values.map((value) => value.id),
    ])
  );
}

// Links Notation -> standard, its words added in the order they were saved.
export function readStandard(source) {
  const [root] = parseLinks(source);
  if (root?.id !== 'standard') {
    throw new Error('A standard starts with "standard:"');
  }
  const fields = Object.fromEntries(
    root.values.map(({ id, values }) => [id, values])
  );
  const single = (name) => fields[name]?.map((value) => value.id).join(' ');
  const standard = createStandard({
    id: single('id'),
    language: single('language'),
    limit: Number(single('limit') ?? standardWordLimit),
  });
  for (const { id, values } of fields.words ?? []) {
    addDefinition(standard, id, values.map((value) => value.id).join(' '));
  }
  return standard;
}

// A natural language standard of one's own, as Links Notation for
// registerNaturalLanguage: the closest language it extends and the entries
// of its vocabulary (see naturalVocabulary) that differ. Semantic primes keep
// the exponents of the language they extend.
export function naturalStandardSource({ id, label, base, entries }) {
  const known = new Map(
    naturalVocabulary(base).map((entry) => [entry.concept, entry.words])
  );
  const templates = [];
  const words = [];
  const values = [];
  for (const { concept, words: spelled } of entries) {
    const before = known.get(concept);
    const [kind, key] = [
      concept.slice(0, concept.indexOf(':')),
      concept.slice(concept.indexOf(':') + 1),
    ];
    if (!before || kind === 'prime') {
      if (!before) {
        throw new Error(`${base} has no concept "${concept}"`);
      }
      continue;
    }
    if (before.join('\u0000') === spelled.join('\u0000')) {
      continue;
    }
    if (spelled.length === 0 || spelled.some((word) => !word.trim())) {
      throw new Error(`"${concept}" needs words`);
    }
    const line = `    ${key}: ${spelled.map(quote).join(' ')}`;
    if (kind === 'template') {
      templates.push(line);
    } else if (kind === 'word') {
      words.push(line);
    } else {
      values.push(`  ${key}: ${quote(spelled[0])}`);
    }
  }
  const lines = [
    'natural:',
    `  id: ${id}`,
    `  label: ${quote(label ?? id)}`,
    `  extends: ${base}`,
    ...values,
    ...(templates.length ? ['  templates:', ...templates] : []),
    ...(words.length ? ['  words:', ...words] : []),
  ];
  return `${lines.join('\n')}\n`;
}
