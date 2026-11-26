// Every field name and node kind the meta programs of the example programs
// use, read from JavaScript and from their translations.
import { readFileSync, readdirSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';

const t = createTranslator();
const fields = new Map();
const kinds = new Map();
const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
function walk(value) {
  if (Array.isArray(value)) {
    return value.forEach(walk);
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  count(kinds, value.kind);
  for (const [key, child] of Object.entries(value)) {
    count(fields, key);
    walk(child);
  }
}
const dir = 'examples/programs';
for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const source = readFileSync(`${dir}/${file}`, 'utf8');
  walk(t.toMeta(source, 'javascript'));
  for (const to of ['python', 'rust', 'go', 'java', 'c', 'ruby']) {
    try {
      walk(t.toMeta(t.translate(source, 'javascript', to), to));
    } catch (error) {
      console.log(`${file} -> ${to}: ${error.message.split('\n')[0]}`);
    }
  }
}
console.log(
  [...fields]
    .sort()
    .map(([k, n]) => `${k} ${n}`)
    .join('\n')
);
console.log('--');
console.log(
  [...kinds]
    .sort()
    .map(([k, n]) => `${k} ${n}`)
    .join('\n')
);
