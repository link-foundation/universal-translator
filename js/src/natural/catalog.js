// Controlled natural languages, described as data in data/natural/*.lino.
//
// Each file describes one controlled version of a natural language (or one
// profile of it, such as Attempto Controlled English): the sentence for
// every meta statement, the phrase for every operator, and a lexicon that
// translates the words of program names. The writer and the reader both use
// these tables, so a sentence the writer produces is exactly a sentence the
// reader accepts.

import { parseLinks } from '../translation/links.js';
import { tokenize } from './tokens.js';
import { naturalSources } from './sources.js';

// Every statement and expression form a language must describe.
export const templateKeys = [
  'function',
  'function-without-parameters',
  'declare',
  'assign',
  'print-line',
  'print',
  'return-value',
  'return',
  'evaluate',
  'nothing',
  'if',
  'else-if',
  'else',
  'while',
  'for',
  'call',
  'call-without-arguments',
  'array',
  'new-array',
  'element',
  'length',
  'set-element',
  'join',
  'or',
  'and',
  'not',
  'negate',
  'equal',
  'not-equal',
  'less',
  'less-or-equal',
  'greater',
  'greater-or-equal',
  'add',
  'subtract',
  'multiply',
  'divide',
  'remainder',
];

const scalarFields = [
  'id',
  'label',
  'native-label',
  'extends',
  'profile',
  'family',
  'sentence-end',
  'block-end',
  'list-separator',
  'list-and',
  'name-joiner',
  'true',
  'false',
  'note',
  'speakers',
  'source',
];

const plain = (values) => values.map(({ id }) => id);

// Read one .lino description into a plain object.
function readDescription(source) {
  const [root] = parseLinks(source);
  if (root?.id !== 'natural') {
    throw new Error('A natural language description starts with "natural:"');
  }
  const description = { templates: {}, words: {}, rules: {} };
  for (const { id, values } of root.values) {
    if (scalarFields.includes(id)) {
      description[id] = plain(values).join(' ');
    } else if (id === 'quotes') {
      description.quotes = plain(values);
    } else if (id === 'templates') {
      for (const entry of values) {
        description.templates[entry.id] = plain(entry.values);
      }
    } else if (id === 'words') {
      for (const entry of values) {
        description.words[entry.id] = plain(entry.values).join(' ');
      }
    } else if (id === 'rules') {
      for (const entry of values) {
        description.rules[entry.id] = plain(entry.values);
      }
    } else {
      throw new Error(`Unknown natural language field "${id}"`);
    }
  }
  return description;
}

function readAll() {
  const descriptions = {};
  for (const [file, source] of Object.entries(naturalSources)) {
    if (file === 'semantic-primes.lino') {
      continue;
    }
    const description = readDescription(source);
    if (`${description.id}.lino` !== file) {
      throw new Error(`${file} describes "${description.id}"`);
    }
    descriptions[description.id] = description;
  }
  return descriptions;
}

// A profile inherits everything it does not state from the language it
// extends; its own rules replace the inherited rules.
function resolve(descriptions, id, seen = new Set()) {
  const description = descriptions[id];
  if (!description) {
    throw new Error(`No natural language "${id}"`);
  }
  if (!description.extends) {
    return description;
  }
  if (seen.has(id)) {
    throw new Error(`Natural language "${id}" extends itself`);
  }
  seen.add(id);
  const base = resolve(descriptions, description.extends, seen);
  return {
    ...base,
    ...description,
    templates: { ...base.templates, ...description.templates },
    words: { ...base.words, ...description.words },
    rules: description.rules,
    base: base.base ?? base.id,
  };
}

// Templates become token lists once, with {slot} tokens for the holes.
function compile(description) {
  const missing = templateKeys.filter((key) => !description.templates[key]);
  if (missing.length) {
    throw new Error(`${description.id} has no ${missing.join(', ')} template`);
  }
  const language = {
    ...description,
    sentenceEnd: description['sentence-end'] ?? '.',
    blockEnd: description['block-end'] ?? ':',
    listSeparator: description['list-separator'] ?? ',',
    listAnd: description['list-and'],
    nameJoiner: description['name-joiner'] ?? '-',
    quotes: description.quotes ?? ['"', '"'],
  };
  language.compiled = Object.fromEntries(
    Object.entries(description.templates).map(([key, texts]) => [
      key,
      texts.map((text) => tokenize(text, language, { templates: true })),
    ])
  );
  // Every word that appears literally in a template is reserved: a program
  // name spelled the same way gets a trailing "_" so it stays a name.
  language.reserved = new Set(
    [
      ...Object.values(language.compiled)
        .flat(2)
        .filter((token) => token.type === 'word')
        .map((token) => token.folded),
      language.true,
      language.false,
      language.listAnd,
    ]
      .filter(Boolean)
      .map((word) => word.toLocaleLowerCase())
  );
  language.lexicon = description.words;
  language.reverseLexicon = new Map(
    Object.entries(description.words).map(([neutral, word]) => [
      word.toLocaleLowerCase(),
      neutral,
    ])
  );
  return language;
}

let catalog;

function load() {
  if (!catalog) {
    const descriptions = readAll();
    catalog = new Map(
      Object.keys(descriptions).map((id) => [
        id,
        compile(resolve(descriptions, id)),
      ])
    );
  }
  return catalog;
}

export function naturalLanguage(id) {
  const language = load().get(id);
  if (!language) {
    throw new Error(`No controlled natural language "${id}"`);
  }
  return language;
}

export const isNaturalLanguage = (id) => load().has(id);

export const naturalLanguageIds = () => [...load().keys()];
