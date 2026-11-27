import { createTranslator } from '../js/src/index.js';

const source = `// number

// sequence
int twice(int n) {
  return n * 2;
}

// iteratively
int main() {
  printf("%d\\n", twice(5));
  return 0;
}
`;
const translator = createTranslator();
for (const to of ['python', 'bash', 'java', 'english', 'russian', 'nasm']) {
  const result = translator.translatePartial(source, 'cpp', to, {
    layout: 'target',
    commentFrom: 'english',
    commentLanguage: 'russian',
  });
  const lines = result.text.split('\n');
  console.log(
    JSON.stringify({
      to,
      complete: result.complete,
      text: result.text,
      comments: [0, 2, 7].map((from) => ({
        from,
        lines: (result.lineMap ?? [])
          .filter(([line]) => line === from)
          .map(([, line]) => [line, lines[line]]),
      })),
    })
  );
}
