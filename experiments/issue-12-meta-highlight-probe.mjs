// What a meta program keeps of the names, texts and numbers of a source:
// the basis of the syntax highlighting of the web demo.
import { createTranslator } from '../js/src/index.js';
import { formatMeta } from '../js/src/meta/notation.js';

const translator = createTranslator();
const samples = [
  [
    'javascript',
    'let myValue = 1; // one\nfunction twice(n) { return n * 2; }\nconsole.log(twice(myValue), "hi");\n',
  ],
  [
    'python',
    'my_value = 1\ndef twice(n):\n    return n * 2\nprint(twice(my_value))\n',
  ],
  ['english', 'Create count with value 3.\nWrite “Hello” and end the line.\n'],
  ['russian', 'Если n меньше или равно 1, сделать это:\n  Ничего не делать\n'],
];
for (const [language, source] of samples) {
  const { program } = translator.parseFragment(source, language);
  console.log(`--- ${language}\n${formatMeta(program)}`);
}
