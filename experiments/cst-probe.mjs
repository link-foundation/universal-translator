import { translate } from '../js/src/translator.js';
const cases = [
  ['x = 1  # c\nprint(x)\n', 'python', 'javascript'],
  ['let x = 1 // c\nconsole.log(x)\n', 'javascript', 'python'],
  ['let x = 1; // c\nconsole.log(x);\n', 'javascript', 'python'],
];
for (const [s, f, t] of cases) {
  try {
    console.log(translate(s, f, t));
  } catch (e) {
    console.log('ERR', e.message);
  }
}
