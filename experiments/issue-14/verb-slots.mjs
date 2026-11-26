// Prints the second form of every verb in a few languages, to see whether
// the vocabulary lists the third person present tense second.
import { vocabularyConcepts } from '../../js/src/natural/vocabulary.js';
const languages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['english', 'russian', 'german', 'french', 'spanish'];
for (const { id, part, forms } of vocabularyConcepts()) {
  if (part !== 'verb') {
    continue;
  }
  console.log(
    id.padEnd(12),
    languages.map((l) => (forms[l] ?? []).slice(0, 3).join('/')).join(' | ')
  );
}
