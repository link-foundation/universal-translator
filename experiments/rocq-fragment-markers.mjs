// Shows how the Rocq emitter places the fragment end marker after a
// mutually recursive group (the group's closing "." must stay inside).
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createGrammarTranslator } from '../js/src/translator.js';

const source = readFileSync(
  new URL('../examples/programs/fragments/functions.js', import.meta.url),
  'utf8'
);
const program = `${source}\nconsole.log(sumOfSquares(3));\n`;
const out = createGrammarTranslator().translate(program, 'javascript', 'rocq');
console.log(out.slice(out.indexOf('Fixpoint') - 30));
