// Identifier language: the declared names translated to another natural
// language, through the meta program and in place.
import { translate } from '../../js/src/index.js';

const js = `// Sum of squares
function sumOfSquares(numbers) {
  let total = 0;
  for (let index = 0; index < numbers.length; index++) {
    total += numbers[index] * numbers[index];
  }
  return total;
}
console.log(sumOfSquares([1, 2, 3]));
`;
const show = (label, text) => console.log(`--- ${label}\n${text}`);
for (const [to, options] of [
  ['javascript', { identifierLanguage: 'russian' }],
  ['javascript', { identifierLanguage: 'russian', commentLanguage: 'russian' }],
  ['python', { identifierLanguage: 'russian', commentLanguage: 'russian' }],
  ['c', { identifierLanguage: 'russian' }],
]) {
  try {
    show(
      `${to} ${JSON.stringify(options)}`,
      translate(js, 'javascript', to, options)
    );
  } catch (error) {
    show(`${to} ${JSON.stringify(options)}`, `ERROR ${error.message}`);
  }
}
const back = translate(js, 'javascript', 'javascript', {
  identifierLanguage: 'russian',
});
show(
  'back to english',
  translate(back, 'javascript', 'python', { identifierLanguage: 'english' })
);
