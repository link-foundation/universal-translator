// Prints the meta program of a JS example after a trip through a language:
// node experiments/meta.mjs <task> <language> [path]
import { readFileSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';

const [task, language] = process.argv.slice(2);
const translator = createGrammarTranslator();
const meta = translator.toMeta(
  readFileSync(`examples/programs/${task}.js`, 'utf8'),
  'javascript'
);
const target = translator.fromMeta(meta, language, { from: 'javascript' });
const back = translator.toMeta(target, language);
console.log(JSON.stringify(meta.main.statements.slice(0, 2), null, 1));
console.log(JSON.stringify(back.main.statements.slice(0, 2), null, 1));
