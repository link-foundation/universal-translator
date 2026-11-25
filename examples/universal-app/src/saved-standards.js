// Standards of one's own, kept in the browser storage as Links Notation and
// registered with the translator when the app starts:
//
//   programming   a version of a programming language ("python@mine")
//   natural       a natural language standard ("english-mine")
//   words         a standard of words defined through other words
//
// The list of standards is one record per standard, named by its id (a
// unique name, so "id:"), with its fields as (name value) links:
//
//   'python@spoken-python':
//     (kind programming) (label 'Spoken Python')
//     (source 'language: python
//   ...')
//
// The word standards are one text per natural language: "english: '…'".
// Values saved as JSON by earlier versions are still read.

import { parseLinks } from '../../../js/src/meta/links.js';
import { linoValue } from '../../../js/src/translation/rules-notation.js';
import {
  isNaturalLanguage,
  isOwnNaturalLanguage,
  naturalLanguage,
  registerNaturalLanguage,
  unregisterNaturalLanguage,
} from '../../../js/src/natural/catalog.js';
import {
  naturalStandardSource,
  readDefinitionCache,
  readStandard,
  writeDefinitionCache,
  writeStandard,
} from '../../../js/src/natural/standards.js';
import {
  loadLanguageVersion,
  vocabularyChanges,
  writeLanguageVersion,
} from '../../../js/src/formal/vocabulary.js';
import {
  splitVersion,
  unregisterLanguageVersion,
} from '../../../js/src/formal/versions.js';

export const standardsKey = 'universal-translator.standards';
export const wordStandardsKey = 'universal-translator.word-standards';
export const definitionsKey = 'universal-translator.definitions';

const memory = new Map();
// localStorage when the browser allows it, memory otherwise.
export const defaultStorage = () => {
  try {
    const { localStorage } = globalThis;
    localStorage.getItem(standardsKey);
    return localStorage;
  } catch {
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    };
  }
};

// Links Notation records -> [{ id, fields: { name: value } }]. A line of
// one (name value) link is read by links-notation as that link itself.
export function readRecords(text) {
  const words = (link) => (link.values?.length ? null : link.id);
  return parseLinks(text).map(({ id, values }) => {
    const fields = {};
    for (const line of values) {
      const links = line.values.every((link) => !link.values?.length)
        ? [line]
        : line.values;
      for (const link of links) {
        const [name, value] = link.id
          ? [link.id, ...link.values.map(words)]
          : link.values.map(words);
        fields[name] = value;
      }
    }
    return { id, fields };
  });
}

// [{ id, fields }] -> Links Notation text, each record a few lines.
export function writeRecords(records) {
  return records
    .map(
      ({ id, fields }) =>
        `${linoValue(id)}:\n${fields
          .map(
            (line) =>
              `  ${line.map(([name, value]) => `(${name} ${linoValue(value)})`).join(' ')}`
          )
          .join('\n')}\n`
    )
    .join('');
}

// A stored value: Links Notation, or JSON written by earlier versions.
function readStored(storage, key, fromLino, fallback) {
  try {
    const text = (storage.getItem(key) ?? '').trim();
    if (!text) {
      return fallback;
    }
    return /^[[{]/u.test(text) ? (JSON.parse(text) ?? fallback) : fromLino(text);
  } catch {
    return fallback;
  }
}

const standardsFromLino = (text) =>
  readRecords(text).map(({ id, fields }) => ({ ...fields, id }));

// [{ kind: 'programming' | 'natural', id, label, source }]
export const savedStandards = (storage) =>
  readStored(storage, standardsKey, standardsFromLino, []).filter(
    (item) => item && typeof item.source === 'string'
  );

export const standardsText = (items) =>
  writeRecords(
    items.map(({ id, kind, label, source }) => ({
      id,
      fields: [
        [
          ['kind', kind],
          ['label', label],
        ],
        [['source', source]],
      ],
    }))
  );

function store(storage, items) {
  storage.setItem(standardsKey, standardsText(items));
}

function register(item) {
  if (item.kind === 'programming') {
    return loadLanguageVersion(item.source);
  }
  if (isOwnNaturalLanguage(item.id)) {
    unregisterNaturalLanguage(item.id);
  }
  return registerNaturalLanguage(item.source);
}

// Register every saved standard; returns the ones that could not be read.
export function loadSavedStandards(storage) {
  const failed = [];
  for (const item of savedStandards(storage)) {
    try {
      register(item);
    } catch (error) {
      failed.push({ ...item, error: error.message });
    }
  }
  return failed;
}

const slug = (text) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'mine';

// Save the entries of a vocabulary editor as a standard of one's own made
// from the closest language (a choice such as "python@2" or
// "minimal-english"); returns the choice of the new standard.
export function saveStandard(storage, { closest, group, name, entries }) {
  const label = name.trim() || 'Mine';
  let item;
  if (group === 'programming') {
    const { id: language, version: base } = splitVersion(closest);
    const version = slug(label);
    const source = writeLanguageVersion({
      language,
      version,
      label,
      ...(base ? { base } : {}),
      syntax: vocabularyChanges(closest, entries),
    });
    item = { kind: 'programming', id: `${language}@${version}`, label, source };
  } else {
    const language = naturalLanguage(closest).base ?? closest;
    const id = `${language}-${slug(label)}`;
    if (isNaturalLanguage(id) && !isOwnNaturalLanguage(id)) {
      throw new Error(`${id} is a built-in language`);
    }
    const source = naturalStandardSource({ id, label, base: closest, entries });
    item = { kind: 'natural', id, label, source };
  }
  const id = register(item);
  store(storage, [
    ...savedStandards(storage).filter((saved) => saved.id !== item.id),
    item,
  ]);
  return id;
}

export function removeStandard(storage, id) {
  const item = savedStandards(storage).find((saved) => saved.id === id);
  if (!item) {
    return;
  }
  try {
    if (item.kind === 'programming') {
      const { id: language, version } = splitVersion(id);
      unregisterLanguageVersion(language, version);
    } else {
      unregisterNaturalLanguage(id);
    }
  } catch {
    // It was never registered (it could not be read).
  }
  store(
    storage,
    savedStandards(storage).filter((saved) => saved.id !== id)
  );
}

// Word standards: one per natural language, each a Links Notation text.
const wordStandardsFromLino = (text) =>
  Object.fromEntries(
    parseLinks(text).map(({ id, values }) => [id, values[0]?.id ?? ''])
  );

const wordStandards = (storage) =>
  readStored(storage, wordStandardsKey, wordStandardsFromLino, {});

export const wordStandardsText = (all) =>
  Object.entries(all)
    .map(([language, text]) => `${linoValue(language)}: ${linoValue(text)}\n`)
    .join('');

export function loadWordStandard(storage, language) {
  const text = wordStandards(storage)[language];
  try {
    return text ? readStandard(text) : undefined;
  } catch {
    return undefined;
  }
}

export function saveWordStandard(storage, standard) {
  storage.setItem(
    wordStandardsKey,
    wordStandardsText({
      ...wordStandards(storage),
      [standard.language]: writeStandard(standard),
    })
  );
}

// The Wikidata definitions read so far, with a pre-cache to start from.
export function loadDefinitions(storage, preCache = '') {
  const cache = preCache ? readDefinitionCache(preCache) : new Map();
  try {
    const saved = storage.getItem(definitionsKey);
    for (const [key, value] of saved ? readDefinitionCache(saved) : []) {
      cache.set(key, value);
    }
  } catch {
    // A broken cache is read again from Wikidata.
  }
  return cache;
}

export function saveDefinitions(storage, cache) {
  try {
    storage.setItem(definitionsKey, writeDefinitionCache(cache));
  } catch {
    // Storage is full: the definitions are read again next time.
  }
}
