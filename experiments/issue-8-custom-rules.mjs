import { createTranslator } from '../js/src/index.js';
const t = createTranslator({
  rules: {
    templates: { russian: { 'less-or-equal': ['{left} не больше {right}'] } },
    names: [{ find: 'n', replace: 'count' }],
    output: [
      { language: 'python', find: 'print', replace: 'print' },
      { find: '# ', replace: '#: ' },
    ],
    source: [{ language: 'russian', find: 'ничего', replace: 'Ничего' }],
  },
});
console.log(
  t.translate(
    'Если n не больше 1, сделать это:\n  ничего не делать\n',
    'russian',
    'python'
  )
);
console.log(
  t.translatePartial(
    'Если n не больше 1, сделать это:\n  ничего не делать\nЛетать.\n',
    'russian',
    'python'
  ).text
);
