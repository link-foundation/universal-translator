// Prints the first forms of every noun in a few languages, to see which
// grammatical forms the vocabulary lists and in what order.
import { vocabularyConcepts } from '../../js/src/natural/vocabulary.js';
const languages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['english', 'russian'];
for (const { id, part, forms } of vocabularyConcepts()) {
  if (part !== 'noun') {
    continue;
  }
  console.log(
    id.padEnd(12),
    languages.map((l) => (forms[l] ?? []).slice(0, 5).join('/')).join(' | ')
  );
}
