// List node kinds, operators and identifier words used by the example tasks.
import { readFileSync, readdirSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';
import { walk } from '../js/src/meta/tree.js';
const t = createGrammarTranslator();
const kinds = new Map(),
  words = new Set(),
  ops = new Set(),
  assignOps = new Set();
for (const file of readdirSync('examples/programs').filter((f) =>
  f.endsWith('.js')
)) {
  const meta = t.toMeta(
    readFileSync(`examples/programs/${file}`, 'utf8'),
    'javascript'
  );
  if (process.argv[2] === file) {
    console.log(JSON.stringify(meta, null, 1));
  }
  walk(meta, (n) => {
    kinds.set(n.kind, (kinds.get(n.kind) ?? 0) + 1);
    if (n.kind === 'Binary' || n.kind === 'Unary') {
      ops.add(`${n.kind}:${n.operator}`);
    }
    if (n.kind === 'Assignment') {
      assignOps.add(String(n.operator));
    }
    for (const k of ['name', 'callee', 'variable']) {
      if (typeof n[k] === 'string') {
        n[k].split('-').forEach((w) => words.add(w));
      }
    }
  });
  meta.functions.forEach((f) => {
    f.name.split('-').forEach((w) => words.add(w));
    f.parameters.forEach((p) => p.name.split('-').forEach((w) => words.add(w)));
  });
}
console.log([...kinds], [...ops], [...assignOps], [...words].sort().join(' '));
