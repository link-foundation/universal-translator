// Controlled natural languages, described as data in data/natural/*.lino.
//
// Each file describes one controlled version of a natural language (or one
// profile of it, such as Attempto Controlled English): the sentence for
// every meta statement, the phrase for every operator, and a lexicon that
// translates the words of program names. The writer and the reader both use
// these tables, so a sentence the writer produces is exactly a sentence the
// reader accepts.

import { parseLinks } from '../meta/links.js';
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

// Templates a language may leave out: a loop over an array is then written
// as the counting loop it lowers to, and increase and decrease (everyday
// wordings of an assignment that adds to or subtracts from the variable) are
// written as the assignment.
export const optionalTemplateKeys = [
  'for-each',
  'increase',
  'decrease',
  'documentation',
  ...['type', 'documentation', 'source', 'details'].flatMap((aspect) => [
    `question-${aspect}`,
    `answer-${aspect}`,
  ]),
];

// Everyday wordings a profile with its own rules does not inherit: a
// controlled standard keeps to its vocabulary, and the assignment still says
// what they say.
const everydayTemplateKeys = ['increase', 'decrease'];

function inheritedTemplates(base, description) {
  const templates = { ...base.templates };
  if (Object.keys(description.rules ?? {}).length > 0) {
    for (const key of everydayTemplateKeys) {
      delete templates[key];
    }
  }
  return { ...templates, ...description.templates };
}

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

// The files of data/natural that describe no language: the semantic primes,
// the everyday vocabulary and the grammar of free translation.
const sharedFiles = new Set([
  'semantic-primes.lino',
  'vocabulary.lino',
  'grammar.lino',
]);

function readAll() {
  const descriptions = {};
  for (const [file, source] of Object.entries(naturalSources)) {
    if (sharedFiles.has(file)) {
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
    templates: inheritedTemplates(base, description),
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
  for (const key of optionalTemplateKeys) {
    language.compiled[key] ??= [];
  }
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
let descriptions;
// Sources of the standards registered at run time, by id.
const ownSources = new Map();

function load() {
  if (!catalog) {
    descriptions = readAll();
    catalog = new Map(
      Object.keys(descriptions).map((id) => [
        id,
        compile(resolve(descriptions, id)),
      ])
    );
  }
  return catalog;
}

// Add a natural language standard of one's own, written like the files in
// data/natural: usually a profile that extends the closest language and
// changes some of its templates and words. Returns its id.
export function registerNaturalLanguage(source) {
  load();
  const description = readDescription(source);
  const { id } = description;
  if (!/^[\p{Ll}\p{N}][\p{Ll}\p{N}-]*$/u.test(id ?? '')) {
    throw new Error(`"${id}" is not a natural language id`);
  }
  if (descriptions[id] && !ownSources.has(id)) {
    throw new Error(`"${id}" is a built-in natural language`);
  }
  if (description.extends === id) {
    throw new Error(`Natural language "${id}" extends itself`);
  }
  const compiled = compile(resolve({ ...descriptions, [id]: description }, id));
  descriptions[id] = description;
  catalog.set(id, compiled);
  ownSources.set(id, source);
  return id;
}

// Remove a standard added with registerNaturalLanguage.
export function unregisterNaturalLanguage(id) {
  load();
  if (!ownSources.has(id)) {
    throw new Error(`"${id}" is not a natural language of one's own`);
  }
  if (Object.values(descriptions).some((other) => other.extends === id)) {
    throw new Error(`Another natural language extends "${id}"`);
  }
  ownSources.delete(id);
  delete descriptions[id];
  catalog.delete(id);
}

// The Links Notation description of a natural language, to read or to start
// a standard of one's own from.
export function naturalLanguageSource(id) {
  load();
  if (ownSources.has(id)) {
    return ownSources.get(id);
  }
  const source = naturalSources[`${id}.lino`];
  if (!source) {
    throw new Error(`No natural language "${id}"`);
  }
  return source;
}

export const isOwnNaturalLanguage = (id) => ownSources.has(id);

export function naturalLanguage(id) {
  const language = load().get(id);
  if (!language) {
    throw new Error(`No controlled natural language "${id}"`);
  }
  return language;
}

export const isNaturalLanguage = (id) => load().has(id);

export const naturalLanguageIds = () => [...load().keys()];

// A language that also reads the given template variants (key -> list of
// templates). The written form of every key stays the language's own.
export function withTemplates(id, templates = {}) {
  const language = naturalLanguage(id);
  const merged = { ...language.templates };
  for (const [key, variants] of Object.entries(templates)) {
    if (!templateKeys.includes(key) && !optionalTemplateKeys.includes(key)) {
      throw new Error(`No template "${key}" in natural languages`);
    }
    const list = Array.isArray(variants) ? variants : [variants];
    const known = merged[key] ?? [];
    merged[key] = [...known, ...list.filter((text) => !known.includes(text))];
  }
  return compile({ ...language, templates: merged });
}
