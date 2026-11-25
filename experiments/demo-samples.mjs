// Translate the web demo samples with the library to check they parse.
import { createTranslator } from '../js/src/index.js';

const t = createTranslator();
const samples = [
  ['javascript', 'console.log("Hello World!");\n'],
  [
    'python',
    'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n',
  ],
  [
    'rust',
    'fn main() {\n    for i in 1..=3 {\n        println!("{}", i * i);\n    }\n}\n',
  ],
  ['english', 'Write “Hello World!” and end the line.\n'],
];
for (const [from, source] of samples) {
  try {
    console.log(from, `→\n${t.translate(source, from, 'python')}`);
  } catch (error) {
    console.log(from, 'ERROR', error.message);
  }
}
