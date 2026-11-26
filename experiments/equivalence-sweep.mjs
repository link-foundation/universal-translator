// Which example programs translate to an equivalent program in each
// language: the sweep behind the equivalence tests.
import { readFileSync, readdirSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
import { checkEquivalence } from '../js/src/translation/equivalence.js';

const t = createTranslator();
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : t.languages().map((language) => language.id);
const dir = 'examples/programs';
const summary = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const source = readFileSync(`${dir}/${file}`, 'utf8');
  for (const to of targets) {
    let verdict;
    try {
      const result = checkEquivalence(t, { source, from: 'javascript', to });
      verdict = result.equivalent
        ? 'same'
        : `differs ${JSON.stringify(result.differences[0])}`;
    } catch (error) {
      verdict = `error ${error.message.split('\n')[0]}`;
    }
    summary[to] = (summary[to] ?? 0) + (verdict === 'same' ? 1 : 0);
    if (verdict !== 'same') {
      console.log(`${file} -> ${to}: ${verdict}`);
    }
  }
}
console.log(JSON.stringify(summary));
