// Checks that a controlled language description, and text written in it,
// keeps the rules of the standard it follows.
//
// A description may state, under "rules:":
//
//   max-sentence-words      most words (a quoted text counts as one) a
//                           sentence may have
//   average-sentence-words  most words a sentence may have on average
//   sentence-starts         the only words a sentence may start with (for
//                           example the imperative verbs of ASD-STE100)
//   forbidden-words         words no template, lexicon entry or written
//                           sentence may use (for example "is" in E-Prime)
//   vocabulary              the only words templates may use
//   primes                  templates may also use the exponents of the
//                           65 semantic primes in this language
//   extra-words             further words templates may use (grammatical
//                           words and the molecules a minimal language
//                           allows, or the technical words a profile adds)
//   relations               relation phrases (Gellish) that templates must
//                           express facts with; each must appear in one
//
// Notes ("Note: ...") copy comments of the program and quoted texts are the
// program's own data, so neither is checked.

import { parseLinks } from '../meta/links.js';
import { naturalLanguage } from './catalog.js';
import { naturalSources } from './sources.js';
import { tokenize } from './tokens.js';

let primes;

// The 65 semantic primes of Natural Semantic Metalanguage, each with its
// exponents (word forms) in several languages.
export function semanticPrimes() {
  if (!primes) {
    const [root] = parseLinks(naturalSources['semantic-primes.lino']);
    primes = root.values.map(({ id, values }) => {
      const fields = Object.fromEntries(
        values.map((field) => [field.id, field.values.map((value) => value.id)])
      );
      const { category, ...exponents } = fields;
      return { prime: id, category: category[0], exponents };
    });
  }
  return primes;
}

const fold = (word) => word.toLocaleLowerCase();

// Single words of a list of words or multi-word phrases.
const wordsOf = (phrases = []) =>
  phrases.flatMap((phrase) => phrase.split(/[\s-]+/u)).map(fold);

function templateWords(language) {
  const words = new Set();
  for (const variants of Object.values(language.compiled)) {
    for (const token of variants.flat()) {
      // Symbols such as "<=" are not words of any vocabulary.
      if (token.type === 'word' && /\p{L}/u.test(token.folded)) {
        words.add(token.folded);
      }
    }
  }
  for (const word of [language.true, language.false, language.listAnd]) {
    wordsOf([word]).forEach((part) => words.add(part));
  }
  return words;
}

function allowedWords(language) {
  const { rules } = language;
  if (!rules.vocabulary && !rules.primes) {
    return undefined;
  }
  const allowed = new Set([
    ...wordsOf(rules.vocabulary),
    ...wordsOf(rules['extra-words']),
  ]);
  for (const id of rules.primes ?? []) {
    for (const { exponents } of semanticPrimes()) {
      wordsOf(exponents[id]).forEach((word) => allowed.add(word));
    }
  }
  return allowed;
}

function checkLexicon(language) {
  const problems = [];
  const seen = new Map();
  for (const [neutral, word] of Object.entries(language.lexicon)) {
    const tokens = tokenize(word, language);
    if (
      tokens.length !== 1 ||
      tokens[0].type !== 'word' ||
      word.includes(language.nameJoiner)
    ) {
      problems.push(`the word for "${neutral}" ("${word}") is not one word`);
    }
    const folded = fold(word);
    if (seen.has(folded)) {
      problems.push(
        `"${seen.get(folded)}" and "${neutral}" are both "${word}"`
      );
    }
    seen.set(folded, neutral);
  }
  return problems;
}

// Problems with a language description itself (empty when it keeps its rules).
export function checkDescription(id) {
  const language = naturalLanguage(id);
  const problems = checkLexicon(language);
  const words = templateWords(language);
  const allowed = allowedWords(language);
  if (allowed) {
    for (const word of words) {
      if (!allowed.has(word)) {
        problems.push(`template word "${word}" is outside the vocabulary`);
      }
    }
  }
  const texts = Object.values(language.templates).flat().map(fold);
  for (const relation of language.rules.relations ?? []) {
    if (!texts.some((text) => text.includes(fold(relation)))) {
      problems.push(`no template uses the relation "${relation}"`);
    }
  }
  const forbidden = new Set(wordsOf(language.rules['forbidden-words']));
  for (const word of [...words, ...Object.values(language.lexicon).map(fold)]) {
    if (forbidden.has(word)) {
      problems.push(`"${word}" is a forbidden word`);
    }
  }
  return problems;
}

function isNote(line, language) {
  const prefix = language.note.split('{text}')[0];
  return line.startsWith(prefix);
}

function sentenceProblems(line, tokens, { limit, starts, forbidden }, joiner) {
  const problems = [];
  if (tokens.length > limit) {
    problems.push(`${tokens.length} words (most ${limit}): ${line}`);
  }
  if (starts.size && !starts.has(tokens[0]?.folded)) {
    problems.push(`starts with "${tokens[0]?.value}": ${line}`);
  }
  const used = tokens
    .filter((token) => token.type === 'word')
    .flatMap((token) => token.folded.split(joiner));
  for (const word of used.filter((value) => forbidden.has(value))) {
    problems.push(`uses forbidden "${word}": ${line}`);
  }
  return problems;
}

// Problems with a text written in the language (empty when it keeps the
// rules). Each line holds one sentence.
export function checkText(text, id) {
  const language = naturalLanguage(id);
  const { rules } = language;
  const limits = {
    limit: Number(rules['max-sentence-words']?.[0] ?? Infinity),
    starts: new Set(wordsOf(rules['sentence-starts'])),
    forbidden: new Set(wordsOf(rules['forbidden-words'])),
  };
  const average = Number(rules['average-sentence-words']?.[0] ?? Infinity);
  const problems = [];
  const lengths = [];
  for (const line of text.split('\n').map((value) => value.trim())) {
    if (!line || isNote(line, language)) {
      continue;
    }
    const tokens = tokenize(line, language).filter((token) =>
      ['word', 'number', 'text'].includes(token.type)
    );
    lengths.push(tokens.length);
    problems.push(
      ...sentenceProblems(line, tokens, limits, language.nameJoiner)
    );
  }
  const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
  if (lengths.length && mean > average) {
    problems.push(
      `average sentence has ${mean.toFixed(1)} words (most ${average})`
    );
  }
  return problems;
}
