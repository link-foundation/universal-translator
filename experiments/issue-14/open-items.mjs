// Probe the open requirements: natural wordings and symbolic arithmetic.
import { createTranslator } from '../../js/src/index.js';

const translator = createTranslator();
const probes = [
  [
    'english',
    'javascript',
    'Let n be 0.\nWhile n is less than 3, do this:\n  Print n.\n  Set n to n plus 1.\nEnd.\n',
  ],
  ['english', 'javascript', 'Let n be 0.\nSet n to n + 1.\nPrint n.\n'],
  ['english', 'javascript', 'Let n be 2 * 3 + 1.\nPrint n.\n'],
  [
    'english',
    'javascript',
    'Let n be 0.\nwhile n is less than 3, do this\n  Print n.\n  Set n to n plus 1.\nEnd.\n',
  ],
];
for (const [from, to, source] of probes) {
  try {
    console.log(`--- ok\n${translator.translate(source, from, to)}`);
  } catch (error) {
    console.log(`--- FAIL ${JSON.stringify(source)}: ${error.message}`);
  }
}
