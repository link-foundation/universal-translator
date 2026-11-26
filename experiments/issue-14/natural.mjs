// Reproduce the natural language reports of issue 14:
// «Привет» is not detected, «Как хорошо покакать?» is read as
// minimal-russian and fails, «// Привет мир» is not translated to English.
import {
  detectLanguage,
  translatePartial,
  translateComments,
} from '../../js/src/index.js';

const show = (label, run) => {
  try {
    console.log(label, JSON.stringify(run()));
  } catch (error) {
    console.log(label, 'ERROR', error.message);
  }
};
for (const text of [
  'Привет',
  'Привет мир',
  'Как хорошо покакать?',
  'Hello world',
]) {
  show(`detect ${text}:`, () =>
    detectLanguage(text)
      .slice(0, 3)
      .map(({ id, coverage }) => [id, coverage])
  );
}
show('comment:', () =>
  translateComments('// Привет мир\nlet x = 1;\n', 'javascript', {
    to: 'english',
  })
);
show(
  'js->js english comments:',
  () =>
    translatePartial(
      '// Привет мир\nconsole.log("Hello World!");\n',
      'javascript',
      'python',
      {
        commentLanguage: 'english',
      }
    ).text
);
for (const [text, from, to] of [
  ['Как хорошо покакать?', 'russian', 'english'],
  ['Как хорошо покакать?', 'minimal-russian', 'english'],
  ['Привет мир', 'russian', 'english'],
  ['Hello world', 'english', 'russian'],
]) {
  show(`${from}->${to} ${text}:`, () => translatePartial(text, from, to));
}
