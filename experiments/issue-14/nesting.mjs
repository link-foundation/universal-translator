// Prints the nested reading of a few programs: comments and strings read by
// the grammar they are written in (issue 14, nested grammars).
import { createGrammarTranslator as createTranslator } from '../../js/src/translator.js';
import { formatMeta } from '../../js/src/meta/notation.js';
import { nestGrammars, unnest } from '../../js/src/translation/nesting.js';
import { isDeepStrictEqual } from 'node:util';

const translator = createTranslator();
const sources = [
  ['javascript', '// Greets someone by name\nconsole.log("Hello, world");\n'],
  [
    'javascript',
    '// Prints `x + 1` twice\nconst x = 1;\nconsole.log(x + 1);\n',
  ],
  ['python', 'code = "print(1 + 2)"\nprint(code)\n'],
  ['javascript', '// Как хорошо покакать?\nconsole.log("Привет мир");\n'],
  [
    'javascript',
    '// This program reads a list of numbers, adds them together and prints the sum of all of them\nconst message = "This program reads a list of numbers, adds them together and prints the sum of all of them";\nconsole.log(message);\n',
  ],
];
for (const [language, source] of sources) {
  const meta = translator.toMeta(source, language);
  const nested = nestGrammars(meta, language, translator);
  console.log(`--- ${language}\n${formatMeta(nested)}`);
  console.log('unnest round trip:', isDeepStrictEqual(unnest(nested), meta));
}
