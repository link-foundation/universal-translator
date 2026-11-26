// Translate every example task JavaScript -> natural -> every programming
// language and compare meanings with the direct route.
// Usage: node experiments/natural-translate.mjs [natural] [target]
import { readFileSync, readdirSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';
import { sameMeaning, meaningDifference } from '../js/src/meta/tree.js';
const [natural = 'english', only] = process.argv.slice(2);
const t = createGrammarTranslator();
let failed = 0;
for (const file of readdirSync('examples/programs').filter((f) =>
  f.endsWith('.js')
)) {
  const js = readFileSync(`examples/programs/${file}`, 'utf8');
  const words = t.translate(js, 'javascript', natural);
  const meta = t.toMeta(words, natural);
  if (!sameMeaning(t.toMeta(js, 'javascript'), meta)) {
    failed++;
    console.log(
      file,
      'meta differs',
      meaningDifference(t.toMeta(js, 'javascript'), meta)
    );
  }
  for (const { id, machine } of t.languages()) {
    if (machine) {
      continue;
    }
    if (only && only !== id) {
      continue;
    }
    try {
      const direct = t.translate(js, 'javascript', id);
      const viaWords = t.translate(words, natural, id);
      // Comments name the language they were written in, which words do
      // not record, so the two routes are compared by meaning.
      if (!sameMeaning(t.toMeta(direct, id), t.toMeta(viaWords, id))) {
        failed++;
        console.log(file, id, 'differs from the direct translation');
      }
    } catch (error) {
      failed++;
      console.log(file, id, 'ERROR', error.message);
    }
  }
}
console.log(failed ? `${failed} failures` : 'all ok');
process.exitCode = failed ? 1 : 0;
