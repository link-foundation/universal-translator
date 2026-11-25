import { createGrammarTranslator } from '../js/src/translator.js';
const t = createGrammarTranslator();
const c = `/* Hello world in C */

#include <stdio.h>

main()
{
    /* print "Hello World!" into console followed by new line symbol by function call */
    printf("Hello World!\\n");
}
`;
const [, , from = 'c', file] = process.argv;
const { readFileSync } = await import('node:fs');
const src = file ? readFileSync(file, 'utf8') : c;
for (const to of process.argv.slice(4).length
  ? []
  : t.languages().map((l) => l.id)) {
  try {
    console.log(`==== ${to}\n${t.translate(src, from, to)}`);
  } catch (e) {
    console.log(`==== ${to} ERROR ${e.stack}`);
  }
}
