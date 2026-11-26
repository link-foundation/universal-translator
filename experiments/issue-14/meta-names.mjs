// Print the meta program of a small source to see where names live.
import { createGrammarTranslator } from '../../js/src/translator.js';

const source = `// Sum of squares
function sumOfSquares(numbers) {
  let total = 0;
  for (let index = 0; index < numbers.length; index++) {
    total += numbers[index] * numbers[index];
  }
  return total;
}
console.log(sumOfSquares([1, 2, 3]));
`;
const translator = createGrammarTranslator({
  trace: (stage, tree) => {
    if (stage === 'typed') {
      console.log(JSON.stringify(tree, null, 1).slice(0, 4000));
    }
  },
});
console.log(translator.translate(source, 'javascript', 'python'));
