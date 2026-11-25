// The words of a programming language and the meta language concepts they
// stand for, as one flat list a standards editor can show and change.
//
// Each entry is a concept path into the syntax description ("operators.and",
// "functionKeyword", "print.line") with the words the language spells it
// with. Changed entries turn back into the syntax changes of a version of
// one's own (see registerLanguageVersion).

import { parseLinks } from '../meta/links.js';
import { languageSyntax } from './languages.js';
import {
  mergeSyntax,
  registerLanguageVersion,
  versionSyntax,
} from './versions.js';

// Fields that name the language; they spell no concept.
const notWords = new Set(['id', 'label', 'version', 'custom']);

const isWords = (value) =>
  typeof value === 'string' ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string'));

function collect(table, prefix, entries) {
  for (const [key, value] of Object.entries(table)) {
    const concept = prefix ? `${prefix}.${key}` : key;
    if (!prefix && notWords.has(key)) {
      continue;
    }
    if (isWords(value)) {
      entries.push({
        concept,
        words: Array.isArray(value) ? value : [value],
        list: Array.isArray(value),
      });
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      collect(value, concept, entries);
    }
  }
  return entries;
}

// [{ concept: 'operators.and', words: ['and'], list: false }, ...]
export function languageVocabulary(id) {
  return collect(languageSyntax(id), '', []);
}

// Entries -> the syntax changes they make to a language.
export function vocabularyChanges(id, entries) {
  const known = new Map(
    languageVocabulary(id).map((entry) => [entry.concept, entry])
  );
  const changes = {};
  for (const { concept, words } of entries) {
    const entry = known.get(concept);
    if (!entry) {
      throw new Error(`${id} has no concept "${concept}"`);
    }
    if (entry.words.join('\u0000') === words.join('\u0000')) {
      continue;
    }
    if (!entry.list && words.length !== 1) {
      throw new Error(`"${concept}" of ${id} is spelled with one word`);
    }
    const path = concept.split('.');
    let table = changes;
    for (const key of path.slice(0, -1)) {
      table[key] ??= {};
      table = table[key];
    }
    table[path.at(-1)] = entry.list ? [...words] : words[0];
  }
  return changes;
}

const quote = (text) => `'${text.split("'").join("''")}'`;

function flatten(table, prefix = '') {
  return Object.entries(table).flatMap(([key, value]) => {
    const concept = prefix ? `${prefix}.${key}` : key;
    return isWords(value)
      ? [[concept, Array.isArray(value) ? value : [value]]]
      : flatten(value, concept);
  });
}

// A version of one's own as Links Notation, to save and load it:
//
//   language-version:
//     language: python
//     version: mine
//     label: 'My Python'
//     base: '2'
//     syntax:
//       operators.and: '&&'
//
// A version made from another version (base) keeps the syntax of that
// version; its own syntax holds the changes made to it.
export function writeLanguageVersion({
  language,
  version,
  label,
  base,
  syntax,
}) {
  const lines = [
    'language-version:',
    `  language: ${language}`,
    `  version: ${quote(version)}`,
    ...(label ? [`  label: ${quote(label)}`] : []),
    ...(base ? [`  base: ${quote(base)}`] : []),
    '  syntax:',
    ...flatten(syntax).map(
      ([concept, words]) => `    ${concept}: ${words.map(quote).join(' ')}`
    ),
  ];
  return `${lines.join('\n')}\n`;
}

// Links Notation -> { language, version, label, base?, syntax }.
export function readLanguageVersion(source) {
  const [root] = parseLinks(source);
  if (root?.id !== 'language-version') {
    throw new Error('A language version starts with "language-version:"');
  }
  const fields = Object.fromEntries(
    root.values.map(({ id, values }) => [id, values])
  );
  const single = (name) => fields[name]?.map((value) => value.id).join(' ');
  const language = single('language');
  const base = single('base');
  const entries = (fields.syntax ?? []).map(({ id, values }) => ({
    concept: id,
    words: values.map((value) => value.id),
  }));
  return {
    language,
    version: single('version'),
    label: single('label'),
    ...(base ? { base } : {}),
    syntax: vocabularyChanges(base ? `${language}@${base}` : language, entries),
  };
}

// Read a saved version and make it available as "<language>@<version>".
export function loadLanguageVersion(source) {
  const { language, version, label, base, syntax } =
    readLanguageVersion(source);
  return registerLanguageVersion(language, version, {
    label,
    syntax: base ? mergeSyntax(versionSyntax(language, base), syntax) : syntax,
  });
}
