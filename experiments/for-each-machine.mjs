import { createTranslator } from '../js/src/index.js';
import { formatMeta } from '../js/src/meta/notation.js';
import fs from 'node:fs';
const t = createTranslator();
const src = fs.readFileSync(
  'examples/programs/greatest-element-of-a-list.js',
  'utf8'
);
const asm = t.translate(src, 'javascript', 'nasm');
const m = t.toMeta(asm, 'nasm');
console.log(formatMeta(m).split('\n').slice(10, 30).join('\n'));
