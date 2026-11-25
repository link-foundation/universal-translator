// Which languages keep the empty line between two functions, and the lack
// of one, when a JavaScript program goes there and back?
import { createGrammarTranslator } from '../js/src/translator.js';
import { grammarLanguageIds } from '../js/src/formal/languages.js';

const translator = createGrammarTranslator();
const spaced =
  'function one() {\n  return 1;\n}\n\nfunction two() {\n  return 2;\n}\n';
const tight =
  'function one() {\n  return 1;\n}\nfunction two() {\n  return 2;\n}\n';
for (const id of grammarLanguageIds) {
  const result = [];
  for (const source of [spaced, tight]) {
    try {
      const text = translator.translateFragment(source, 'javascript', id);
      const back = translator.translateFragment(text, id, 'javascript');
      const same = translator.translateFragment(
        source,
        'javascript',
        'javascript'
      );
      result.push(back === same ? 'kept' : 'LOST');
    } catch (error) {
      result.push(`error ${error.message}`);
    }
  }
  console.log(`${id.padEnd(12)} spaced ${result[0]}  tight ${result[1]}`);
}

// The texts of one language, to see where a difference comes from.
const [, , show] = process.argv;
if (show) {
  for (const source of [spaced, tight]) {
    const text = translator.translateFragment(source, 'javascript', show);
    console.log(
      `--- ${show}\n${text}--- back\n${translator.translateFragment(text, show, 'javascript')}`
    );
  }
}
