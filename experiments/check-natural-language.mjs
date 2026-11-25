// Check one controlled natural language description end to end:
//   node scripts/build-natural-sources.mjs
//   node experiments/check-natural-language.mjs minimal-german
// It checks the description's own rules, then writes every example program
// in the language, checks the text keeps the rules and reads it back to the
// same meaning.
import { readdirSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';

import {
  checkDescription,
  checkText,
  createTranslator,
  readNatural,
  writeNatural,
} from '../js/src/index.js';
import { meaningDifference, sameMeaning } from '../js/src/meta/tree.js';

const id = process.argv[2];
const translator = createTranslator();
const problems = checkDescription(id).map(
  (problem) => `description: ${problem}`
);
const folder = new URL('../examples/programs/', import.meta.url);
for (const file of readdirSync(folder).filter((name) => name.endsWith('.js'))) {
  const meta = translator.toMeta(
    readFileSync(new URL(file, folder), 'utf8'),
    'javascript'
  );
  let text;
  try {
    text = writeNatural(meta, id);
    const back = readNatural(text, id);
    if (!sameMeaning(meta, back)) {
      problems.push(
        `${file}: ${JSON.stringify(meaningDifference(meta, back))}`
      );
    }
  } catch (error) {
    problems.push(`${file}: ${error.message}`);
  }
  if (text) {
    problems.push(
      ...checkText(text, id).map((problem) => `${file}: ${problem}`)
    );
  }
  if (process.argv.includes('--show') && text) {
    console.log(`--- ${file}\n${text}`);
  }
}
console.log(problems.length ? problems.join('\n') : `${id}: all checks pass`);
process.exitCode = problems.length ? 1 : 0;
