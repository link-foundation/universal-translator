// Comment language through translate(): same code, other comment language,
// and other code with another comment language.
import { readFileSync } from 'node:fs';
import { translate } from '../js/src/index.js';
const js = readFileSync('examples/programs/sum-of-squares.js', 'utf8');
const same = translate(js, 'javascript', 'javascript', {
  commentLanguage: 'russian',
});
console.log(same);
console.log(
  translate(js, 'javascript', 'python', { commentLanguage: 'german' })
);
console.log(
  translate(same, 'javascript', 'rust', { commentLanguage: 'english' }).split(
    '\n'
  )[0]
);
console.log(
  translate(js, 'javascript', 'french', { commentLanguage: 'french' }).split(
    '\n'
  )[0]
);
