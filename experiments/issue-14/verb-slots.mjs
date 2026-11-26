// Lists the forms of every verb concept per language, to check that the
// slots (lemma, present, past) are aligned across languages.
//
//   node experiments/issue-14/verb-slots.mjs english russian german
import { vocabularyConcepts } from '../../js/src/natural/vocabulary.js';

const languages = process.argv.slice(2);
for (const concept of vocabularyConcepts()) {
  if (concept.part !== 'verb') {
    continue;
  }
  console.log(concept.id);
  for (const language of languages) {
    const forms = (concept.forms[language] ?? []).join(' | ');
    console.log(`    ${language.padEnd(10)} ${forms}`);
  }
}
