// The meta-based highlighter of the web demo on a few sources and on the
// meta view: each line as [text, type] pieces.
import {
  createTranslator,
  formatMeta,
  naturalLanguage,
} from '../js/src/index.js';
import { languageSyntax } from '../js/src/formal/languages.js';
import {
  metaWords,
  sourceLexicon,
  linoLexicon,
  highlightText,
  pieces,
} from '../examples/universal-app/src/highlight.js';

const translator = createTranslator();
const samples = [
  [
    'javascript',
    'let myValue = 1; // one\n/* a\n b */ function twice(n) { return n * 2; }\nconsole.log(twice(myValue), "hi");\n',
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
  const syntax = ['english', 'russian'].includes(language)
    ? naturalLanguage(language)
    : languageSyntax(language);
  const lexicon = sourceLexicon(syntax, metaWords(program));
  console.log(`--- ${language}`);
  const lines = source.split('\n');
  highlightText(source, lexicon).forEach(
    (tokens, i) =>
      lines[i] && console.log(JSON.stringify(pieces(lines[i], tokens)))
  );
  const meta = formatMeta(program);
  const metaLines = meta.split('\n');
  highlightText(meta, linoLexicon)
    .slice(0, 4)
    .forEach((tokens, i) =>
      console.log('  meta', JSON.stringify(pieces(metaLines[i], tokens)))
    );
}
