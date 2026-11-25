import { createGrammarTranslator } from '../js/src/translator.js';
import { meaningDifference } from '../js/src/meta/tree.js';
import { readFileSync, readdirSync } from 'node:fs';
const t = createGrammarTranslator();
let bad = 0;
for (const f of readdirSync('examples/programs').filter((f) =>
  f.endsWith('.js')
)) {
  const src = readFileSync(`examples/programs/${f}`, 'utf8');
  const meta = t.toMeta(src, 'javascript');
  for (const { id } of t.languages()) {
    try {
      const code = t.translate(src, 'javascript', id);
      const back = t.toMeta(code, id);
      const d = meaningDifference(meta, back);
      if (d) {
        bad++;
        console.log('DIFF', f, id, d.slice(0, 300));
      }
    } catch (e) {
      bad++;
      console.log('ERR', f, id, e.message);
    }
  }
}
console.log('bad', bad);
