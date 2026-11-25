// For local testing of a minimal (semantic primes) profile: copy the
// exponents of experiments/primes/<lang>.lino into
// data/natural/semantic-primes.lino (replacing that language's line under
// each prime when it is already there).
//   node experiments/insert-primes.mjs chinese hindi
//   node scripts/build-natural-sources.mjs
//   node experiments/check-natural-language.mjs minimal-chinese
// Restore afterwards with:
//   git checkout data/natural/semantic-primes.lino js/src/natural/sources.js
import { readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';

const primesUrl = new URL(
  '../data/natural/semantic-primes.lino',
  import.meta.url
);

function readExponents(lang) {
  const text = readFileSync(
    new URL(`./primes/${lang}.lino`, import.meta.url),
    'utf8'
  );
  const exponents = new Map();
  for (const line of text.split('\n')) {
    const match = line.match(/^ {2}(\S+): (.+)$/u);
    if (match) {
      exponents.set(match[1], match[2].trim());
    }
  }
  if (exponents.size !== 65) {
    throw new Error(`${lang}: ${exponents.size} primes, expected 65`);
  }
  return exponents;
}

let lines = readFileSync(primesUrl, 'utf8').split('\n');
for (const lang of process.argv.slice(2)) {
  const exponents = readExponents(lang);
  const out = [];
  let prime;
  let done = true;
  const finish = () => {
    if (prime && !done) {
      out.push(`    ${lang}: ${exponents.get(prime)}`);
    }
    done = true;
  };
  for (const line of lines) {
    const head = line.match(/^ {2}(\S+):$/u);
    if (head) {
      finish();
      prime = head[1];
      if (!exponents.has(prime)) {
        throw new Error(`${lang}: no exponents for ${prime}`);
      }
      done = false;
      out.push(line);
      continue;
    }
    if (prime && line.startsWith(`    ${lang}: `)) {
      out.push(`    ${lang}: ${exponents.get(prime)}`);
      done = true;
      continue;
    }
    if (prime && !done && !line.startsWith('    ')) {
      finish();
    }
    out.push(line);
  }
  // The last prime block runs to the end of the file.
  if (!done) {
    const tail = [];
    while (out.length && out[out.length - 1] === '') {
      tail.push(out.pop());
    }
    finish();
    out.push(...tail);
  }
  lines = out;
}
writeFileSync(primesUrl, lines.join('\n'));
