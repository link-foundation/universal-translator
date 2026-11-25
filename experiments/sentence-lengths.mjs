// Longest sentence (in words; a quoted text counts as one) per task for a language.
// Usage: node experiments/sentence-lengths.mjs [language]
import { readFileSync, readdirSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';
import { writeNatural } from '../js/src/natural/writer.js';
import { naturalLanguage } from '../js/src/natural/catalog.js';
import { tokenize } from '../js/src/natural/tokens.js';
const id = process.argv[2] ?? 'english';
const language = naturalLanguage(id);
const t = createGrammarTranslator();
for (const file of readdirSync('examples/programs').filter((f) =>
  f.endsWith('.js')
)) {
  const text = writeNatural(
    t.toMeta(readFileSync(`examples/programs/${file}`, 'utf8'), 'javascript'),
    id
  );
  let longest = '';
  let max = 0;
  for (const line of text.split('\n')) {
    const n = tokenize(line, language).filter((x) =>
      ['word', 'number', 'text'].includes(x.type)
    ).length;
    if (n > max) {
      max = n;
      longest = line.trim();
    }
  }
  console.log(String(max).padStart(3), file, '|', longest);
}
