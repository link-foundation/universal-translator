// Comment language: translate only the comments of a program, word by word,
// with the dictionaries the natural languages already have.
//
// A comment dictionary pairs the phrases of two natural languages through
// their shared meaning: the neutral words of program names (the `words` of
// each language description) and the exponents of the semantic primes. The
// longest known phrase wins; unknown words, numbers, punctuation and every
// space stay as they are, so the layout inside a comment is kept.
//
// A dictionary cannot translate free prose well. Callers with a better
// translator (a machine translation service, a human) pass it as
// `translateComment(text, { from, to })`; the dictionary is the default.

import { naturalLanguage, naturalLanguageIds } from './catalog.js';
import { semanticPrimes } from './rules.js';

const fold = (text) => text.toLocaleLowerCase();
const baseOf = (id) => naturalLanguage(id).base ?? id;

let neutral;
// Every neutral word some language has a word for.
function neutralWords() {
  neutral ??= [
    ...new Set(
      naturalLanguageIds().flatMap((id) =>
        Object.keys(naturalLanguage(id).lexicon)
      )
    ),
  ];
  return neutral;
}

// Neutral meaning -> phrases of one language, the preferred phrase first.
function phrasesOf(id) {
  const language = naturalLanguage(id);
  const base = baseOf(id);
  const phrases = new Map();
  const add = (meaning, phrase) => {
    if (!phrase) {
      return;
    }
    const known = phrases.get(meaning) ?? [];
    if (!known.includes(fold(phrase))) {
      phrases.set(meaning, [...known, fold(phrase)]);
    }
  };
  for (const { prime, exponents } of semanticPrimes()) {
    (exponents[base] ?? []).forEach((phrase) => add(`prime:${prime}`, phrase));
  }
  // Program words are neutral English words: English spells each of them as
  // it is (or in its regional spelling, color -> colour), other languages
  // through their lexicon.
  if (base === 'english') {
    for (const neutral of neutralWords()) {
      add(`word:${neutral}`, language.lexicon[neutral]);
      add(`word:${neutral}`, neutral);
    }
  } else {
    for (const [neutral, word] of Object.entries(language.lexicon)) {
      add(`word:${neutral}`, word);
    }
  }
  return phrases;
}

const dictionaries = new Map();

// Phrase of `from` -> phrase of `to`, for every meaning both languages have.
export function commentDictionary(from, to) {
  const key = `${from}>${to}`;
  if (!dictionaries.has(key)) {
    const source = phrasesOf(from);
    const target = phrasesOf(to);
    const dictionary = new Map();
    for (const [meaning, phrases] of source) {
      const [preferred] = target.get(meaning) ?? [];
      if (preferred) {
        phrases
          .filter((phrase) => !dictionary.has(phrase))
          .forEach((phrase) => dictionary.set(phrase, preferred));
      }
    }
    dictionaries.set(key, dictionary);
  }
  return dictionaries.get(key);
}

// Words are letters with inner apostrophes and hyphens; everything else
// (spaces, digits, punctuation, code) is kept as it is.
const pieces = (text) => text.split(/([\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*)/u);

const longestPhrase = 4;

function matchCase(original, replacement) {
  if (original === original.toLocaleUpperCase() && original.length > 1) {
    return replacement.toLocaleUpperCase();
  }
  const first = original.charAt(0);
  return first !== first.toLocaleLowerCase()
    ? replacement.charAt(0).toLocaleUpperCase() + replacement.slice(1)
    : replacement;
}

// Translate the words of a text with a comment dictionary. Phrases of up to
// four words joined by single spaces are tried longest first.
export function translateCommentText(text, { from, to }) {
  if (baseOf(from) === baseOf(to) && from === to) {
    return text;
  }
  const dictionary = commentDictionary(from, to);
  const parts = pieces(text);
  let output = '';
  let index = 0;
  while (index < parts.length) {
    if (index % 2 === 0) {
      output += parts[index];
      index += 1;
      continue;
    }
    let matched = false;
    for (let size = longestPhrase; size >= 1 && !matched; size -= 1) {
      const end = index + 2 * (size - 1);
      if (end >= parts.length) {
        continue;
      }
      const gaps = parts.slice(index + 1, end).filter((_, at) => at % 2 === 0);
      if (gaps.some((gap) => gap !== ' ')) {
        continue;
      }
      const phrase = parts.slice(index, end + 1).join('');
      const translated = dictionary.get(fold(phrase));
      if (translated) {
        output += matchCase(phrase, translated);
        index = end + 1;
        matched = true;
      }
    }
    if (!matched) {
      output += parts[index];
      index += 1;
    }
  }
  return output;
}

const phraseSets = new Map();
function knownWords(id) {
  if (!phraseSets.has(id)) {
    phraseSets.set(
      id,
      new Set(
        [...phrasesOf(id).values()]
          .flat()
          .flatMap((phrase) => phrase.split(' '))
      )
    );
  }
  return phraseSets.get(id);
}

// The natural language most words of the comments belong to (English when
// no language knows them).
export function detectCommentLanguage(texts) {
  const words = texts
    .flatMap((text) => pieces(text).filter((_, index) => index % 2))
    .map(fold);
  let best = { id: 'english', score: 0 };
  for (const id of naturalLanguageIds()) {
    if (naturalLanguage(id).base) {
      continue;
    }
    const known = knownWords(id);
    const score = words.filter((word) => known.has(word)).length;
    if (score > best.score) {
      best = { id, score };
    }
  }
  return best.id;
}
