// Partial translation of texts with parts the grammar does not cover.
import { translatePartial } from '../js/src/index.js';

const show = (source, from, to) => {
  const result = translatePartial(source, from, to, { fragment: true });
  console.log(
    `--- ${from} -> ${to} (${result.readLines}/${result.lines} lines)`
  );
  console.log(result.text);
  console.log(result.errors);
};

show(
  'let x = 1;\nx = x + 1;\nlet y = x ? 1 : 2;\nconsole.log(x);\n',
  'javascript',
  'python'
);
show(
  'function f(a) {\n  let s = a + 1;\n  return s;\n}\nconsole.log(f(1));\n',
  'javascript',
  'russian'
);
show(
  'function* gen(a) {\n  let s = a + 1;\n  console.log(s);\n}\nconsole.log(2);\n',
  'javascript',
  'python'
);
show(
  'Создать x со значением 1.\nСделать что-то непонятное.\nНаписать x и закончить строку.\n',
  'russian',
  'c'
);
show(
  'x = 1\nprint(x)\nwith open("f") as f:\n    y = 2\n    print(y)\nprint(x)\n',
  'python',
  'javascript'
);
