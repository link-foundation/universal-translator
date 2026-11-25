// What a meta program keeps for parameters and loop variables, and which
// names the highlighter takes from it (issue 12: variables coloured as keywords).
import { createGrammarTranslator } from '../js/src/translator.js';
import { metaWords } from '../examples/universal-app/src/highlight.js';
const translator = createGrammarTranslator();
const source = process.argv[2] ?? 'def gcd(a, b):\n    while b != 0:\n        a, b = b, a % b\n    return a\n\nprint(gcd(48, 18))\n';
const program = translator.parseFragment(source, process.argv[3] ?? 'python').program;
console.log(JSON.stringify(program, null, 1).slice(0, 3000));
console.log(metaWords(program));
