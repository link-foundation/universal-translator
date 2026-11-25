// Translate every machine golden into every machine target and JavaScript,
// and compare with the translation from the JavaScript original.
import { readFileSync, readdirSync } from 'node:fs';
import { createGrammarTranslator } from '../js/src/translator.js';
const t = createGrammarTranslator();
const root = 'examples/programs/translated';
const ext = { nasm: '.asm', cil: '.il', jvm: '.j' };
let failures = 0;
for (const task of readdirSync(root)) {
  const js = readFileSync(`${root}/${task}/${task}.js`, 'utf8');
  for (const [from, e] of Object.entries(ext)) {
    const source = readFileSync(`${root}/${task}/${task}${e}`, 'utf8');
    for (const to of ['nasm', 'cil', 'jvm', 'javascript']) {
      let out;
      try {
        out = t.translate(source, from, to);
      } catch (error) {
        console.log(`ERROR ${task} ${from}->${to}: ${error.message}`);
        failures++;
        continue;
      }
      const expected = t.translate(js, 'javascript', to);
      if (to === 'javascript') {
        console.log(`--- ${task} ${from}->js\n${out}`);
        continue;
      }
      if (out !== expected) {
        failures++;
        console.log(`DIFF ${task} ${from}->${to}`);
      }
    }
  }
}
console.log('failures', failures);
