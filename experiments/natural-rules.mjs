// Check every controlled language description and every task written in it
// against the language's rules. Usage: node experiments/natural-rules.mjs [language]
import { readFileSync, readdirSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/grammar/translator.js';
import { writeNatural } from '../js/src/natural/writer.js';
import { naturalLanguageIds } from '../js/src/natural/catalog.js';
import { checkDescription, checkText } from '../js/src/natural/rules.js';
const t = createGrammarTranslator();
const tasks = readdirSync('examples/programs').filter((f) => f.endsWith('.js'));
let failed = 0;
for (const id of process.argv[2] ? [process.argv[2]] : naturalLanguageIds()) {
  const problems = checkDescription(id);
  for (const file of tasks) {
    const text = writeNatural(
      t.toMeta(readFileSync(`examples/programs/${file}`, 'utf8'), 'javascript'),
      id
    );
    problems.push(...checkText(text, id).map((p) => `${file}: ${p}`));
  }
  if (problems.length) {
    failed++;
  }
  console.log(id, problems.length ? `\n  ${problems.join('\n  ')}` : 'ok');
}
process.exitCode = failed ? 1 : 0;
