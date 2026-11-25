// Python 2 output with the common library route and fragments.
import { readFileSync } from 'node:fs';
import { translate, translateFragment } from '../js/src/index.js';
const src = readFileSync('examples/programs/sum-of-squares.js', 'utf8');
console.log(translate(src, 'javascript', 'python@2', { commonLibrary: true }));
console.log(
  translateFragment('console.log("a" + 1);', 'javascript', 'python@2')
);
console.log(translate(src, 'javascript', 'english-british'));
