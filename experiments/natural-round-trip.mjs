// Round trip every example task through a controlled natural language:
// JavaScript -> meta -> words -> meta, and compare meanings.
// Usage: node experiments/natural-round-trip.mjs [language] [task.js] [--print]
import { readFileSync, readdirSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';
import { meaningDifference, sameMeaning } from '../js/src/meta/tree.js';
import { writeNatural } from '../js/src/natural/writer.js';
import { readNatural } from '../js/src/natural/reader.js';
const [language = 'english', only] = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'));
const print = process.argv.includes('--print');
const t = createGrammarTranslator();
let failed = 0;
for (const file of readdirSync('examples/programs').filter((f) =>
  f.endsWith('.js')
)) {
  if (only && only !== file) {
    continue;
  }
  const meta = t.toMeta(
    readFileSync(`examples/programs/${file}`, 'utf8'),
    'javascript'
  );
  try {
    const words = writeNatural(meta, language);
    if (print) {
      console.log(words);
    }
    const back = readNatural(words, language);
    if (!sameMeaning(meta, back)) {
      failed++;
      console.log(file, 'DIFFERS', meaningDifference(meta, back));
    } else {
      console.log(file, 'ok');
    }
  } catch (error) {
    failed++;
    console.log(file, 'ERROR', error.message);
  }
}
process.exitCode = failed ? 1 : 0;
