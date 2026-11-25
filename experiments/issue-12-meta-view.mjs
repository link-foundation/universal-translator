// Prints the meta view (formatMeta) of a text, to compare its shapes.
// Usage: node experiments/issue-12-meta-view.mjs [language] [file]
import { readFileSync } from 'node:fs';
import { createTranslator, formatMeta } from '../js/src/index.js';

const [language = 'python', file] = process.argv.slice(2);
const text = file
  ? readFileSync(file, 'utf8')
  : "# hi\n\nx = 'a b'\nprint(x * 3)\n";
process.stdout.write(formatMeta(createTranslator().toMeta(text, language)));
