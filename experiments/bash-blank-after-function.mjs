// Does a blank line between two Bash functions survive reading?
import { readFileSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';

const translator = createGrammarTranslator();
const text = readFileSync(
  new URL(
    '../examples/programs/fragments/translated/functions/functions.sh',
    import.meta.url
  ),
  'utf8'
);
const meta = translator.toMeta(text, 'bash');
console.log(
  JSON.stringify(
    meta.functions.map(({ name, blankAfter }) => ({ name, blankAfter }))
  )
);
