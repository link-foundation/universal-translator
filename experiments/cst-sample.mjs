// Translate a JavaScript sample with comments and empty lines into a few
// languages to check that the concrete syntax (whitespace, comments) stays.
import { readFileSync } from 'node:fs';
import { translate } from '../js/src/translator.js';

const source = readFileSync(process.argv[2], 'utf8');
for (const to of process.argv.slice(3)) {
  console.log(`--- ${to}`);
  try {
    process.stdout.write(translate(source, 'javascript', to));
  } catch (error) {
    console.log('ERROR', error.message);
  }
}
