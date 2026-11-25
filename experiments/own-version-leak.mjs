// An own version of Python with "print" said as "say": translating from it
// to JavaScript must give console.log, and Python itself keeps print.
import { createGrammarTranslator } from '../js/src/translator.js';
import { languageVocabulary } from '../js/src/formal/vocabulary.js';
import { saveStandard } from '../examples/universal-app/src/saved-standards.js';

const memory = new Map();
const storage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v),
  removeItem: (k) => memory.delete(k),
};
const translator = createGrammarTranslator();
const entries = languageVocabulary('python').map((entry) => ({
  concept: entry.concept,
  words: entry.concept.includes('print') ? ['say'] : entry.words,
}));
console.log(entries.filter((e) => e.concept.includes('print')));
const id = saveStandard(storage, {
  closest: 'python',
  group: 'programming',
  name: 'Spoken Python',
  entries,
});
console.log(id);
for (const [from, to, text] of [
  [id, 'javascript', 'say("Hi")\n'],
  ['python', 'javascript', 'print("Hi")\n'],
  ['javascript', 'python', 'console.log("Hi");\n'],
  ['javascript', id, 'console.log("Hi");\n'],
]) {
  try {
    console.log(
      from,
      '->',
      to,
      JSON.stringify(translator.translateFragment(text, from, to))
    );
  } catch (e) {
    console.log(from, '->', to, 'ERR', e.message);
  }
}
