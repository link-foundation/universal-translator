// Define words through the semantic primes of English with live Wikidata
// lexemes, and save what was fetched as a definition cache.
//   node experiments/define-words.mjs double twice square > /tmp/defs.log
import { writeFileSync } from 'node:fs';
import {
  createStandard,
  defineWord,
  expandWord,
  standardSize,
  wikidataLookup,
  writeDefinitionCache,
} from '../js/src/natural/standards.js';

const cache = new Map();
const fetchPolitely = (url) =>
  fetch(url, { headers: { 'User-Agent': 'universal-translator-tests' } });
const lookup = wikidataLookup({ fetch: fetchPolitely, cache, interval: 1000 });
const standard = createStandard({ language: 'english' });
console.log('primitive words', standardSize(standard));
for (const word of process.argv.slice(2)) {
  const result = await defineWord(standard, word, {
    lookup,
    depth: Number(process.env.DEPTH ?? 2),
    budget: Number(process.env.BUDGET ?? 12),
  });
  console.log(JSON.stringify(result));
  if (result.defined) {
    console.log(word, '=', expandWord(standard, word));
  }
  // Save after every word, so a slow or rate-limited run keeps its progress.
  if (process.env.CACHE) {
    writeFileSync(process.env.CACHE, writeDefinitionCache(cache));
  }
}
