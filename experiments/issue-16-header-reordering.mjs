import { readFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
import {
  commentOrigins,
  sourceOrigin,
} from '../js/src/translation/source-origins.js';

const translator = createTranslator();
const source = readFileSync(
  new URL('../examples/translation/comment-headers.cpp', import.meta.url),
  'utf8'
);
const text = translator.translate(source, 'cpp', 'fortran', {
  layout: 'target',
  commentFrom: 'english',
  commentLanguage: 'russian',
});
console.log(text);
const program = translator.toMeta(text, 'fortran');
console.log(
  JSON.stringify(
    {
      program,
      origins: {
        comments: commentOrigins(program.comments),
        main: program.main.statements.map(sourceOrigin),
        functions: program.functions.map((item) => ({
          origin: sourceOrigin(item),
          comments: commentOrigins(item.comments),
        })),
      },
    },
    null,
    2
  )
);
console.log(
  translator.translatePartial(text, 'fortran', 'python', {
    layout: 'target',
    commentFrom: 'russian',
    commentLanguage: 'english',
  })
);
