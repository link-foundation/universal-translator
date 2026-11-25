// Prints a translation: node experiments/show.mjs <task> <target> [from]
import { readFileSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';

const [task, target, from = 'javascript', file] = process.argv.slice(2);
const path = file ?? `examples/programs/${task}.js`;
const output = createGrammarTranslator().translate(
  readFileSync(path, 'utf8'),
  from,
  target
);
console.log(output);
