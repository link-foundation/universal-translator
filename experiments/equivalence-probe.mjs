// Compare the meta program of a source with the meta program read back from
// its translation: where do the two differ?
import { readFileSync } from 'node:fs';
import { createTranslator, formatMeta } from '../js/src/index.js';

const [file, from, to] = process.argv.slice(2);
const t = createTranslator();
const source = readFileSync(file, 'utf8');
const a = formatMeta(t.toMeta(source, from)).split('\n');
const target = t.translate(source, from, to);
const b = formatMeta(t.toMeta(target, to)).split('\n');
let shown = 0;
for (let i = 0; i < Math.max(a.length, b.length) && shown < 8; i++) {
  if (a[i] !== b[i]) {
    console.log(`${i}: ${a[i]}\n${i}: ${b[i]}`);
    shown++;
  }
}
console.log(shown ? 'differs' : 'same');
