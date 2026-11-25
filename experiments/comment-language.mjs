// Translate only the comments of a program to another natural language.
import { readFileSync } from 'node:fs';
import {
  translateComments,
  translateCommentText,
} from '../js/src/natural/comments.js';
const [
  file = 'examples/programs/translated/sum-of-squares/sum-of-squares.py',
  language = 'python',
  to = 'russian',
] = process.argv.slice(2);
const source = readFileSync(file, 'utf8');
console.log(translateComments(source, language, { to }));
console.log(
  translateCommentText('The sum of the numbers, and I think it is good.', {
    from: 'english',
    to,
  })
);
console.log(
  translateCommentText('Сумма чисел', { from: 'russian', to: 'english' })
);
