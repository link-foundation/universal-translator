// Does a comment right above a function keep its place (no blank line added)?
import { createGrammarTranslator } from '../js/src/translator.js';

const translator = createGrammarTranslator();
const source =
  '// say hello\nfunction greet(name) {\n  console.log(name);\n}\ngreet("x");\n';
for (const mode of ['context-dependent', 'literal']) {
  for (const to of ['python', 'rust', 'go', 'javascript']) {
    console.log(`--- ${to} (${mode})`);
    console.log(
      translator.translateFragment(source, 'javascript', to, { mode })
    );
  }
}
