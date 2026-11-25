// Every node kind of the meta language with the fields it has, read from
// the meta programs of all Rosetta Code examples (issue 12: the meta view).
import { readdirSync, readFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';

const translator = createTranslator();
const kinds = new Map();
function walk(node, owner) {
  if (Array.isArray(node)) return node.forEach((it) => walk(it, owner));
  if (!node || typeof node !== 'object') return;
  const kind = node.kind ?? `(${owner})`;
  const fields = kinds.get(kind) ?? new Map();
  kinds.set(kind, fields);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'kind') continue;
    const type = Array.isArray(value) ? 'list' : value && typeof value === 'object' ? `node:${value.kind}` : typeof value;
    fields.set(key, new Set([...(fields.get(key) ?? []), type]));
    walk(value, key);
  }
}
const dir = new URL('./../examples/programs/', import.meta.url);
for (const file of readdirSync(dir).filter((it) => it.endsWith('.js'))) {
  try {
    walk(translator.toMeta(readFileSync(new URL(file, dir), 'utf8'), 'javascript'), 'program');
  } catch (error) {
    console.error(file, error.message);
  }
}
for (const [kind, fields] of kinds) {
  console.log(kind, [...fields].map(([k, t]) => `${k}=${[...t].join('|')}`).join(' '));
}
