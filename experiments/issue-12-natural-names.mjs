// Which names the meta program of a natural-language translation keeps,
// and how the highlighter colours that text (Turkish, Russian, English).
import { createGrammarTranslator } from '../js/src/translator.js';
import { metaWords, sourceLexicon, highlightText, pieces } from '../examples/universal-app/src/highlight.js';
import { naturalLanguage } from '../js/src/natural/catalog.js';

const translator = createGrammarTranslator();
const source = `function result = gcd_of(first, second)
    while second ~= 0
        remainder = rem(first, second);
        first = second;
        second = remainder;
    end
    result = first;
end`;
for (const to of process.argv.slice(2).length ? process.argv.slice(2) : ['turkish', 'english', 'russian']) {
  const result = translator.translate(source, 'matlab', to, { fragment: true });
  const output = result.output ?? result;
  const program = translator.parseFragment(output, to).program;
  const words = metaWords(program);
  console.log('---', to, { names: [...words.names], functions: [...words.functions] });
  const lexicon = sourceLexicon(naturalLanguage(to), words);
  const lines = output.split('\n');
  highlightText(output, lexicon).forEach((tokens, i) => console.log(JSON.stringify(pieces(lines[i], tokens))));
}
