// Grow the Wikidata pre-cache the word standards read offline
// (data/definitions/wikidata-<language>.lino): every word given is defined
// through the semantic primes, and every lookup on the way (also the empty
// ones) is kept in the cache file.
//
//   node scripts/precache-definitions.mjs [--language english] word...
//
// Without words, the everyday words listed below are defined.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  createStandard,
  defineWord,
  readDefinitionCache,
  wikidataLookup,
  writeDefinitionCache,
} from '../js/src/natural/standards.js';

const everydayWords = [
  'twice',
  'double',
  'half',
  'mother',
  'father',
  'child',
  'friend',
  'water',
  'food',
  'eat',
  'drink',
  'sleep',
  'walk',
  'run',
  'house',
  'day',
  'night',
  'begin',
  'end',
  'open',
  'close',
  'give',
  'take',
  'find',
  'help',
];

const args = process.argv.slice(2);
const at = args.indexOf('--language');
const language = at === -1 ? 'english' : args[at + 1];
const words = args.filter(
  (_, index) => at === -1 || (index !== at && index !== at + 1)
);
const file = new URL(
  `../data/definitions/wikidata-${language}.lino`,
  import.meta.url
);
const cache = existsSync(file)
  ? readDefinitionCache(readFileSync(file, 'utf8'))
  : new Map();
const lookup = wikidataLookup({ cache, interval: 250 });
const standard = createStandard({ language });

for (const word of words.length ? words : everydayWords) {
  try {
    const result = await defineWord(standard, word, { lookup });
    console.log(
      `${result.defined ? 'defined' : 'missing'} ${word}${
        result.missing.length ? ` (missing: ${result.missing.join(', ')})` : ''
      }`
    );
  } catch (error) {
    console.error(`${word}: ${error.message}`);
  }
  // Every word keeps what was looked up so far, also when a later one fails.
  writeFileSync(file, writeDefinitionCache(cache));
}
console.log(`${cache.size} lookups cached in ${file.pathname}`);
