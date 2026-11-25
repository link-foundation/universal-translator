import { createGrammarTranslator } from '../js/src/translator.js';
const t = createGrammarTranslator();
const src = 'const name = "x";\nconsole.log(`a\\\\b {c} ${name}`);\n';
console.log(src);
console.log(t.translate(src, 'javascript', 'lean'));
