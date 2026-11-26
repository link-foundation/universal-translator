// Write a program in a language with some syntax changes, to find out
// whether a version can be described with the existing settings.
// node experiments/issue-14/version-probe.mjs <file.js> <language> '<syntax json>'
import { readFileSync } from 'node:fs';
import { registerLanguageVersion, translate } from '../../js/src/index.js';

const [file, language, changes = '{}'] = process.argv.slice(2);
registerLanguageVersion(language, 'probe', {
  label: 'probe',
  syntax: JSON.parse(changes),
});
const written = translate(
  readFileSync(file, 'utf8'),
  'javascript',
  `${language}@probe`
);
console.log(written);
console.log('--- read back as javascript');
console.log(translate(written, language, 'javascript'));
