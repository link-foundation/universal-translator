// Check every example program against its translation into every language:
// which pairs differ, and on which meta paths.
import { readdirSync, readFileSync } from 'node:fs';
import { createTranslator } from '../../js/src/index.js';
import { checkEquivalence } from '../../js/src/translation/equivalence.js';
import { extensions } from '../../examples/programs/verify-native.mjs';

const translator = createTranslator();
const programs = readdirSync('examples/programs').filter((f) =>
  f.endsWith('.js')
);
const targets = translator.languages().map((l) => l.id);
const tally = new Map();
let pairs = 0;
let equal = 0;
// The first line where the two meta programs differ.
const firstDifference = ({ differences: [first] }) =>
  `line ${first.line}: ${first.source} != ${first.target}`;
for (const file of programs) {
  const source = readFileSync(`examples/programs/${file}`, 'utf8');
  for (const to of targets) {
    pairs += 1;
    let result;
    try {
      result = checkEquivalence(translator, { source, from: 'javascript', to });
    } catch (error) {
      const key = `${to}: throws ${error.message.slice(0, 60)}`;
      tally.set(key, [...(tally.get(key) ?? []), file]);
      continue;
    }
    if (result.equivalent) {
      equal += 1;
    } else {
      const key = `${to}: ${firstDifference(result).slice(0, 120)}`;
      tally.set(key, [...(tally.get(key) ?? []), file]);
    }
  }
}
console.log(`${equal} of ${pairs} equivalent`);
for (const [key, files] of [...tally].sort(
  (a, b) => b[1].length - a[1].length
)) {
  console.log(`${files.length}\t${key}\t${files.slice(0, 3).join(' ')}`);
}

// Every committed golden against its JavaScript source.
const goldens = new Map();
let goldenPairs = 0;
let goldenEqual = 0;
for (const file of programs) {
  const name = file.replace(/\.js$/, '');
  const source = readFileSync(`examples/programs/${file}`, 'utf8');
  for (const [language, extension] of Object.entries(extensions)) {
    let target;
    try {
      target = readFileSync(
        `examples/programs/translated/${name}/${name}${extension}`,
        'utf8'
      );
    } catch {
      continue;
    }
    goldenPairs += 1;
    try {
      const result = checkEquivalence(translator, {
        source,
        from: 'javascript',
        to: language,
        translation: target,
      });
      if (result.equivalent) {
        goldenEqual += 1;
      } else {
        goldens.set(
          `${name}${extension}`,
          firstDifference(result).slice(0, 120)
        );
      }
    } catch (error) {
      goldens.set(
        `${name}${extension}`,
        `throws ${error.message.slice(0, 80)}`
      );
    }
  }
}
console.log(`${goldenEqual} of ${goldenPairs} goldens equivalent`);
for (const [entry, why] of goldens) {
  console.log(`${entry}\t${why}`);
}
