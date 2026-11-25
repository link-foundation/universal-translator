// Which concepts of a language's vocabulary change the translation when a
// version of one's own spells them differently: each concept is given another
// word in turn, and JavaScript programs are written in that version and the
// usual text is read from it. A concept takes effect when either differs.
//
//   node experiments/vocabulary-audit.mjs [language...]
import { createGrammarTranslator } from '../js/src/translator.js';
import {
  grammarLanguageIds,
  languageSyntax,
} from '../js/src/formal/languages.js';
import {
  languageVocabulary,
  vocabularyChanges,
} from '../js/src/formal/vocabulary.js';
import {
  registerLanguageVersion,
  unregisterLanguageVersion,
} from '../js/src/formal/versions.js';

const translator = createGrammarTranslator();
const common = `// sum things
/* a block */
function both(a, b) {
  let c = a && b;
  const d = a || !b;
  return c != d;
}
function half(n) {
  return Math.trunc(n / 2);
}
function greet(n) {
  if (n > 1) {
    console.log("big");
  } else if (n > 0) {
    console.log("one");
  } else {
    console.log("none");
  }
}
function show(n) {
  console.log(n % 3 == 1);
}
function list(n) {
  for (let i = 0; i < n; i++) {
    console.log(i);
  }
}
function empty(n) {
}
let count = 7;
count = count + 1;
show(count);
list(count);
greet(count);
empty(count);
const items = [1, 2, 3];
console.log("Hi");
console.log(both(true, false));
console.log(half(count));
console.log(items[0]);
`;
const programs = [
  common,
  `${common}function name(n) {\n  return "n" + String(n);\n}\nconsole.log(name(count), count);\n`,
];

function attempt(work) {
  try {
    return work();
  } catch (error) {
    return `error: ${error.message}`;
  }
}

function effects(language, program) {
  const usual = translator.translateFragment(program, 'javascript', language);
  // The usual text, with a block comment where the language has one.
  const [open, close] = languageSyntax(language).blockComment ?? [];
  const text = open ? `${open} note ${close}\n${usual}` : usual;
  const read = (from) =>
    attempt(() => translator.translateFragment(text, from, 'javascript'));
  const usualReading = read(language);
  return (version) =>
    attempt(() =>
      translator.translateFragment(program, 'javascript', version)
    ) !== usual || read(version) !== usualReading;
}

const languages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : grammarLanguageIds;
for (const language of languages) {
  const checks = programs.flatMap((program) => {
    const check = attempt(() => effects(language, program));
    return typeof check === 'function' ? [check] : [];
  });
  const ineffective = [];
  for (const entry of languageVocabulary(language)) {
    const words = entry.words.map(
      (word, index) => `zz${index}${word.replace(/\W/g, '')}q`
    );
    const syntax = vocabularyChanges(language, [
      { concept: entry.concept, words },
    ]);
    registerLanguageVersion(language, 'audit', { syntax });
    try {
      if (!checks.some((takesEffect) => takesEffect(`${language}@audit`))) {
        ineffective.push(entry.concept);
      }
    } finally {
      unregisterLanguageVersion(language, 'audit');
    }
  }
  console.log(
    `${language}: ${ineffective.join(', ') || 'every concept takes effect'}`
  );
}
