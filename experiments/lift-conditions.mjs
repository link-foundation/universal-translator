import { readFileSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';
const t = createGrammarTranslator();
const src = readFileSync(process.argv[2], 'utf8');
const target = process.argv[3] ?? 'nasm';
const machine = t.translate(src, 'javascript', target);
console.log(t.translate(machine, target, 'javascript'));
