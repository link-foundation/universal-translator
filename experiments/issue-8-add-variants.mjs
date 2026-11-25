// Adds accepted template variants (issue #8) to data/natural/*.lino.
//
// The first template of a key stays the one the writer uses; every later
// template is an alternative the reader also accepts. The script is
// idempotent: a variant already listed is not added again.
//
//   node experiments/issue-8-add-variants.mjs && node scripts/build-natural-sources.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../data/natural/', import.meta.url);

// Every language (and profile) also reads the usual mathematical symbols.
const symbols = {
  equal: ['{left} = {right}', '{left} == {right}'],
  'not-equal': ['{left} != {right}', '{left} ≠ {right}', '{left} <> {right}'],
  less: ['{left} < {right}'],
  'less-or-equal': ['{left} <= {right}', '{left} ≤ {right}'],
  greater: ['{left} > {right}'],
  'greater-or-equal': ['{left} >= {right}', '{left} ≥ {right}'],
};

// Common wordings of each language.
const words = {
  english: {
    equal: ['{left} is equal to {right}', '{left} is equal {right}'],
    'not-equal': ['{left} is not equal to {right}'],
    less: ['{left} is less than {right}', '{left} is smaller than {right}'],
    'less-or-equal': [
      '{left} is less than or equal to {right}',
      '{left} is at most {right}',
      '{left} is not more than {right}',
      '{left} is not greater than {right}',
    ],
    greater: [
      '{left} is greater than {right}',
      '{left} is more than {right}',
      '{left} is larger than {right}',
    ],
    'greater-or-equal': [
      '{left} is greater than or equal to {right}',
      '{left} is at least {right}',
      '{left} is not less than {right}',
    ],
    if: ['If {condition}, then', 'If {condition} then', 'If {condition}'],
    else: ['Else', 'Otherwise'],
    'else-if': ['Else if {condition}', 'Otherwise, if {condition}'],
    while: ['While {condition}'],
  },
  russian: {
    equal: ['{left} равен {right}', '{left} равна {right}'],
    'not-equal': ['{left} не равен {right}', '{left} не равна {right}'],
    less: ['{left} меньше чем {right}'],
    'less-or-equal': [
      '{left} меньше или равно {right}',
      '{left} меньше либо равно {right}',
      '{left} меньше или равен {right}',
      '{left} меньше или равна {right}',
    ],
    greater: ['{left} больше чем {right}'],
    'greater-or-equal': [
      '{left} больше или равно {right}',
      '{left} больше либо равно {right}',
      '{left} больше или равен {right}',
      '{left} больше или равна {right}',
    ],
    if: [
      'Если {condition}, то сделать это',
      'Если {condition}, то',
      'Если {condition}',
    ],
    else: ['Иначе'],
    'else-if': ['Иначе, если {condition}', 'Иначе если {condition}'],
    while: ['Пока {condition}'],
  },
  ukrainian: {
    'less-or-equal': [
      '{left} менше або дорівнює {right}',
      '{left} менше чи дорівнює {right}',
    ],
    'greater-or-equal': [
      '{left} більше або дорівнює {right}',
      '{left} більше чи дорівнює {right}',
    ],
    less: ['{left} менше {right}', '{left} менше ніж {right}'],
    greater: ['{left} більше {right}', '{left} більше ніж {right}'],
    if: ['Якщо {condition}, то', 'Якщо {condition}'],
  },
  german: {
    'less-or-equal': [
      '{left} ist kleiner oder gleich {right}',
      '{left} ist kleiner gleich {right}',
    ],
    'greater-or-equal': [
      '{left} ist größer oder gleich {right}',
      '{left} ist größer gleich {right}',
    ],
    if: ['Wenn {condition}, dann', 'Falls {condition}'],
  },
  french: {
    'less-or-equal': ['{left} est inférieur ou égal à {right}'],
    'greater-or-equal': ['{left} est supérieur ou égal à {right}'],
    if: ['Si {condition}, alors'],
  },
  spanish: {
    'less-or-equal': [
      '{left} es menor o igual que {right}',
      '{left} es menor o igual a {right}',
    ],
    'greater-or-equal': [
      '{left} es mayor o igual que {right}',
      '{left} es mayor o igual a {right}',
    ],
    if: ['Si {condition}, entonces'],
  },
  portuguese: {
    'less-or-equal': ['{left} é menor ou igual a {right}'],
    'greater-or-equal': ['{left} é maior ou igual a {right}'],
    if: ['Se {condition}, então'],
  },
  italian: {
    'less-or-equal': ['{left} è minore o uguale a {right}'],
    'greater-or-equal': ['{left} è maggiore o uguale a {right}'],
    if: ['Se {condition}, allora'],
  },
  polish: {
    'less-or-equal': ['{left} jest mniejsze lub równe {right}'],
    'greater-or-equal': ['{left} jest większe lub równe {right}'],
    less: ['{left} jest mniejsze niż {right}'],
    greater: [
      '{left} jest większe niż {right}',
      '{left} jest większe od {right}',
    ],
  },
  dutch: {
    'less-or-equal': ['{left} is kleiner dan of gelijk aan {right}'],
    'greater-or-equal': ['{left} is groter dan of gelijk aan {right}'],
  },
  indonesian: {
    'less-or-equal': ['{left} kurang dari atau sama dengan {right}'],
    'greater-or-equal': ['{left} lebih dari atau sama dengan {right}'],
  },
};

const quote = (text) => (text.includes("'") ? `"${text}"` : `'${text}'`);

for (const file of readdirSync(dir).filter((name) => name.endsWith('.lino'))) {
  const id = file.replace(/\.lino$/, '');
  if (id === 'semantic-primes') {
    continue;
  }
  const path = new URL(file, dir);
  const lines = readFileSync(path, 'utf8').split('\n');
  const extra = { ...symbols };
  for (const [key, list] of Object.entries(words[id] ?? {})) {
    extra[key] = [...list, ...(extra[key] ?? [])];
  }
  let section;
  const updated = lines.map((line) => {
    const header = /^ {2}([a-z-]+):/.exec(line);
    if (header) {
      section = header[1];
    }
    const match = /^( {4})([a-z-]+): (.*)$/.exec(line);
    if (section !== 'templates' || !match || !extra[match[2]]) {
      return line;
    }
    const [, indent, key, rest] = match;
    const missing = extra[key].filter(
      (variant) => !rest.includes(quote(variant))
    );
    return missing.length
      ? `${indent}${key}: ${[rest, ...missing.map(quote)].join(' ')}`
      : line;
  });
  writeFileSync(path, updated.join('\n'));
}
