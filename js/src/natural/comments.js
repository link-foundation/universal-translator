// Free translation of prose: the comments of a program, and the sentences
// of a natural language text that no controlled template reads.
//
// A dictionary pairs the phrases of two natural languages through their
// shared meaning: the exponents of the semantic primes, the neutral words
// of program names (the `words` of each language description) and the
// concepts of the everyday vocabulary (data/natural/vocabulary.lino). Every
// meaning of a phrase is kept, likeliest first, and the translation takes
// the first meaning the other language has. Of that meaning's phrases it
// writes the first one that reads back to the same meaning, so the words
// chosen are the frequent ones that survive the round trip.
//
// The longest known phrase wins. A little grammar (data/natural/grammar.lino)
// goes beyond word for word:
//
// - in a question, interrogative concepts come first (как -> how, not like);
// - an inflected form is found through its stem (мира -> мир -> world);
// - an infinitive stays one (покакать -> to poop, to poop -> покакать);
// - a verb form keeps its slot when both languages name their verb forms
//   (verb-forms): prints -> печатает, a finite form is never written as an
//   infinitive;
// - the object of a verb takes the accusative when the language has one
//   (object-endings, object-forms): greets someone -> приветствует кого-то,
//   prints the sum -> печатает сумму;
// - "of" between two nouns is left out before a name the dictionary does not
//   know, in a language whose second noun takes the genitive (of-genitive):
//   factorial of n -> факториал n;
// - an article the other language does not have is left out;
// - words of languages written without spaces are found inside the text
//   (你好世界 -> hello world), and are joined without spaces when written.
//
// Unknown words, numbers, punctuation and every other space stay as they
// are, so the layout inside a comment is kept. A dictionary cannot
// translate free prose perfectly. Callers with a better translator (a
// machine translation service, a human) pass it as
// `translateComment(text, { from, to })`; the dictionary is the default.

import { naturalLanguage, naturalLanguageIds } from './catalog.js';
import { semanticPrimes } from './rules.js';
import {
  grammarOf,
  knownForm,
  stemIndex,
  vocabularyConcepts,
} from './vocabulary.js';

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

const meaningSets = new WeakMap();

// The meanings of one language:
//   phrases   meaning -> phrases, the preferred phrase first
//   meanings  phrase -> meanings, the likeliest first
//   parts     meaning -> part of speech ('prime' and 'name' for the primes
//             and the words of program names)
//   forms     concept meaning -> its forms in the order of the vocabulary,
//             so the slot of a verb form (lemma, present) is its position
function meaningsOf(id) {
  const language = naturalLanguage(id);
  if (meaningSets.has(language)) {
    return meaningSets.get(language);
  }
  const base = baseOf(id);
  const phrases = new Map();
  const meanings = new Map();
  const parts = new Map();
  const forms = new Map();
  const add = (meaning, part, phrase) => {
    if (!phrase) {
      return;
    }
    const folded = fold(phrase);
    const known = phrases.get(meaning) ?? [];
    if (!known.includes(folded)) {
      phrases.set(meaning, [...known, folded]);
      parts.set(meaning, part);
      meanings.set(folded, [...(meanings.get(folded) ?? []), meaning]);
    }
  };
  for (const { prime, exponents } of semanticPrimes()) {
    (exponents[base] ?? []).forEach((phrase) =>
      add(`prime:${prime}`, 'prime', phrase)
    );
  }
  // Program words are neutral English words: English spells each of them as
  // it is (or in its regional spelling, color -> colour), other languages
  // through their lexicon.
  if (base === 'english') {
    for (const word of neutralWords()) {
      add(`word:${word}`, 'name', language.lexicon[word]);
      add(`word:${word}`, 'name', word);
    }
  } else {
    for (const [word, phrase] of Object.entries(language.lexicon)) {
      add(`word:${word}`, 'name', phrase);
    }
  }
  for (const {
    id: concept,
    part,
    forms: conceptForms,
  } of vocabularyConcepts()) {
    const written = conceptForms[base] ?? [];
    forms.set(`concept:${concept}`, written);
    written.forEach((phrase) => add(`concept:${concept}`, part, phrase));
  }
  const grammar = grammarOf(base);
  // The accusative of a word with a form of its own is read as the word.
  for (const [nominative, accusative] of grammar.objectForms) {
    for (const meaning of [...(meanings.get(nominative) ?? [])]) {
      add(meaning, parts.get(meaning), accusative);
    }
  }
  const result = {
    phrases,
    meanings,
    parts,
    forms,
    grammar,
    stems: stemIndex(meanings.keys(), grammar),
  };
  meaningSets.set(language, result);
  return result;
}

// The meanings of a phrase in the order a sentence makes likely: first the
// meanings that list it earliest (a word mostly means what it is the main
// word of: "в" is first "in", only then "inside"), then in a question the
// interrogative concepts first, elsewhere last.
function likely(phrase, language, question) {
  const rank = (meaning) => language.phrases.get(meaning).indexOf(phrase);
  const meanings = [...(language.meanings.get(phrase) ?? [])].sort(
    (a, b) => rank(a) - rank(b)
  );
  const asked = meanings.filter(
    (meaning) => language.parts.get(meaning) === 'interrogative'
  );
  const others = meanings.filter(
    (meaning) => language.parts.get(meaning) !== 'interrogative'
  );
  return question ? [...asked, ...others] : [...others, ...asked];
}

// The phrase of `target` for a meaning: the first that reads back to it.
function preferredPhrase(meaning, target, question) {
  const phrases = target.phrases.get(meaning);
  return (
    phrases.find((phrase) => likely(phrase, target, question)[0] === meaning) ??
    phrases[0]
  );
}

// The form of a verb in the slot (lemma, present) the source form has, when
// both languages name their verb forms; undefined for the lemma and for
// every verb form the languages do not both name.
function slotForm(phrase, meaning, source, target) {
  const slot = source.forms.get(meaning)?.indexOf(phrase) ?? -1;
  const name = slot > 0 ? source.grammar.verbForms[slot] : undefined;
  const at = target.grammar.verbForms.indexOf(name);
  return at > 0 ? target.forms.get(meaning)?.[at] : undefined;
}

// The translation of one known phrase: { text, part, lemma, meaning } or
// undefined. An article the target does not have becomes an empty text.
function translatePhrase(phrase, source, target, question) {
  const meanings = likely(phrase, source, question);
  for (const meaning of meanings) {
    const part = source.parts.get(meaning);
    if (target.phrases.has(meaning)) {
      const form = part === 'verb' && slotForm(phrase, meaning, source, target);
      return {
        text: form || preferredPhrase(meaning, target, question),
        part,
        meaning,
        lemma: !form && source.phrases.get(meaning)[0] === phrase,
      };
    }
    if (part === 'article') {
      return { text: '', part, lemma: true };
    }
  }
  return undefined;
}

// Phrase of `from` -> phrase of `to`, for every meaning both languages have
// (outside questions).
export function commentDictionary(from, to) {
  const source = meaningsOf(from);
  const target = meaningsOf(to);
  const dictionary = new Map();
  for (const phrase of source.meanings.keys()) {
    const translated = translatePhrase(phrase, source, target, false);
    if (translated?.text) {
      dictionary.set(phrase, translated.text);
    }
  }
  return dictionary;
}

// Words are letters with inner apostrophes and hyphens; everything else
// (spaces, digits, punctuation, code) is kept as it is.
const pieces = (text) => text.split(/([\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*)/u);

const longestPhrase = 4;
// The longest word looked for inside a text written without spaces.
const longestRun = 8;

// A word written in capitals is written in capitals, a capitalized word is
// capitalized; scripts without case (你好) leave the translation as it is.
function matchCase(original, replacement) {
  if (
    original === original.toLocaleUpperCase() &&
    original !== original.toLocaleLowerCase() &&
    original.length > 1
  ) {
    return replacement.toLocaleUpperCase();
  }
  const first = original.charAt(0);
  return first !== first.toLocaleLowerCase()
    ? replacement.charAt(0).toLocaleUpperCase() + replacement.slice(1)
    : replacement;
}

const terminators = /[.!?;。！？؟]/u;
const questionMarks = /[?？؟]/u;

// For every word piece, whether the sentence it belongs to is a question:
// the first end mark after the word decides.
function questionsOf(parts) {
  const questions = [];
  let question = false;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (index % 2 === 0) {
      const mark = parts[index].match(terminators);
      if (mark) {
        question = questionMarks.test(mark[0]);
      }
    } else {
      questions[index] = question;
    }
  }
  return questions;
}

// Phrase translation through the grammar of both languages.
class ProseTranslator {
  constructor(from, to) {
    this.source = meaningsOf(from);
    this.target = meaningsOf(to);
    this.disagree();
  }

  // The written form of a translated phrase.
  write(translated, infinitive) {
    const pattern = this.target.grammar.infinitive;
    return infinitive && translated.part === 'verb' && pattern
      ? pattern.replace('{verb}', translated.text)
      : translated.text;
  }

  phrase(phrase, question) {
    const translated = translatePhrase(
      phrase,
      this.source,
      this.target,
      question
    );
    if (!translated) {
      return undefined;
    }
    const infinitive =
      translated.lemma && this.source.grammar.verbLemma === 'infinitive';
    return {
      text: this.write(translated, infinitive),
      part: translated.part,
      meaning: translated.meaning,
    };
  }

  // The accusative of the object of a verb: a word with its own form
  // (кто-то -> кого-то) or a noun with the ending of the case (сумма -> сумму).
  accusative(result) {
    const { objectForms, objectEndings } = this.target.grammar;
    if (objectForms.has(result.text)) {
      return objectForms.get(result.text);
    }
    // Only a singular nominative has the endings: the first phrase of the
    // meaning, and not a word of the program names in the plural (numbers).
    const nominative = this.target.phrases.get(result.meaning)?.[0];
    const plural = /^word:.*s$/u.test(result.meaning);
    if (
      !['noun', 'name'].includes(result.part) ||
      result.text.includes(' ') ||
      result.text !== nominative ||
      plural
    ) {
      return result.text;
    }
    // The longest ending decides (a neuter имя keeps its form).
    const endings = [...objectEndings].sort(
      ([a], [b]) => [...b].length - [...a].length
    );
    const found = endings.find(([ending]) => result.text.endsWith(ending));
    return found
      ? result.text.slice(0, result.text.length - found[0].length) + found[1]
      : result.text;
  }

  // Whether the words at parts[index] are none the dictionary knows (the
  // name of something in the program).
  unknown(parts, index) {
    return index < parts.length && !this.words(parts, index, false);
  }

  // The words around a verb agree in case: the first noun after a verb (an
  // article may come between) is its object and takes the accusative, and
  // "of" between two nouns is left out of a language whose second noun takes
  // the genitive when the second noun is a name the dictionary does not know.
  // Only words separated by blanks belong together.
  agree(parts, result) {
    const { object, last } = this;
    const blank = /^[ \t]*$/u.test(parts[result.end + 1] ?? '');
    let { text } = result;
    if (object && result.part !== 'article') {
      text = this.accusative(result);
    }
    if (
      result.meaning === 'word:of' &&
      this.target.grammar.ofGenitive &&
      ['noun', 'name'].includes(last) &&
      parts[result.end + 1] === ' ' &&
      this.unknown(parts, result.end + 2)
    ) {
      text = '';
    }
    this.object =
      blank &&
      (result.part === 'verb' || (object && result.part === 'article'));
    this.last = blank ? result.part : undefined;
    return { ...result, text };
  }

  // A word no translation reads ends the sentence parts that agree.
  disagree() {
    this.object = false;
    this.last = undefined;
  }

  // An infinitive written around its verb ('to poop'): the words of the
  // pattern before the verb, then the verb.
  infinitive(parts, index, question) {
    const pattern = this.source.grammar.infinitive;
    if (!pattern) {
      return undefined;
    }
    const before = pattern.split('{verb}')[0].trim().split(/\s+/u);
    const verbAt = index + 2 * before.length;
    if (verbAt >= parts.length) {
      return undefined;
    }
    for (let word = 0; word < before.length; word += 1) {
      const at = index + 2 * word;
      if (fold(parts[at]) !== before[word] || parts[at + 1] !== ' ') {
        return undefined;
      }
    }
    const translated = translatePhrase(
      this.known(fold(parts[verbAt])),
      this.source,
      this.target,
      question
    );
    if (translated?.part !== 'verb') {
      return undefined;
    }
    return { text: this.write(translated, true), end: verbAt, part: 'verb' };
  }

  // A known form of a word, directly or through its stem.
  known(word) {
    return this.source.meanings.has(word)
      ? word
      : knownForm(word, this.source.stems, this.source.grammar);
  }

  // Known words inside a run of letters written without spaces, longest
  // first; undefined when none is known.
  segments(word, question) {
    if (this.source.grammar.spaced) {
      return undefined;
    }
    const letters = [...word];
    const found = [];
    let known = false;
    let at = 0;
    while (at < letters.length) {
      let size = Math.min(longestRun, letters.length - at);
      let translated;
      for (; size > 0 && !translated; size -= 1) {
        const run = fold(letters.slice(at, at + size).join(''));
        translated = this.phrase(run, question);
        if (translated) {
          found.push({ text: translated.text, known: true });
          at += size;
          known = true;
        }
      }
      if (!translated) {
        const last = found.at(-1);
        if (last && !last.known) {
          last.text += letters[at];
        } else {
          found.push({ text: letters[at], known: false });
        }
        at += 1;
      }
    }
    if (!known) {
      return undefined;
    }
    const joiner = this.target.grammar.spaced ? ' ' : '';
    return found.map(({ text }) => text).join(joiner);
  }

  // The translation of the words starting at parts[index]:
  // { text, end, part } where end is the index of the last word read.
  words(parts, index, question) {
    const infinitive = this.infinitive(parts, index, question);
    if (infinitive) {
      return infinitive;
    }
    for (let size = longestPhrase; size >= 1; size -= 1) {
      const end = index + 2 * (size - 1);
      if (end >= parts.length) {
        continue;
      }
      const gaps = parts.slice(index + 1, end).filter((_, at) => at % 2 === 0);
      if (gaps.some((gap) => gap !== ' ')) {
        continue;
      }
      const phrase = fold(parts.slice(index, end + 1).join(''));
      const translated =
        this.phrase(phrase, question) ??
        (size === 1 ? this.inflected(phrase, question) : undefined);
      if (translated) {
        return { ...translated, end };
      }
    }
    const segmented = this.segments(parts[index], question);
    return segmented === undefined
      ? undefined
      : { text: segmented, end: index, part: 'segments' };
  }

  inflected(word, question) {
    const form = knownForm(word, this.source.stems, this.source.grammar);
    return form === undefined ? undefined : this.phrase(form, question);
  }
}

// Translate the words of a text with the dictionary and the grammar of both
// languages. Phrases of up to four words joined by single spaces are tried
// longest first.
export function translateCommentText(text, { from, to }) {
  if (from === to) {
    return text;
  }
  const translator = new ProseTranslator(from, to);
  const parts = pieces(text);
  const questions = questionsOf(parts);
  // Every word piece written: { text, translated }, between the gaps.
  const written = [parts[0]];
  let capitalize = false;
  let index = 1;
  while (index < parts.length) {
    const found = translator.words(parts, index, questions[index]);
    if (!found) {
      translator.disagree();
      written.push({ text: parts[index], translated: false }, parts[index + 1]);
      capitalize = false;
      index += 2;
      continue;
    }
    const result = translator.agree(parts, found);
    const original = parts.slice(index, result.end + 1).join('');
    let output = matchCase(original, result.text);
    if (capitalize) {
      output = matchCase('A', output);
    }
    capitalize = false;
    let gap = parts[result.end + 1];
    if (!output) {
      // An article or an "of" left out goes with the space after it; a
      // capital moves on to the next word.
      capitalize = original.charAt(0) !== fold(original.charAt(0));
      gap = gap === ' ' ? '' : gap;
    }
    written.push({ text: output, translated: true }, gap);
    index = result.end + 2;
  }
  // Words of a language written without spaces are joined.
  const joined = !translator.target.grammar.spaced;
  return written
    .map((piece, at) => {
      if (typeof piece !== 'string') {
        return piece.text;
      }
      const around = [written[at - 1], written[at + 1]];
      return joined &&
        piece === ' ' &&
        around.every((word) => word?.translated && word.text)
        ? ''
        : piece;
    })
    .join('');
}

// Translate a text of prose between two natural languages.
export const translateProse = (text, from, to) =>
  translateCommentText(text, { from, to });

const phraseSets = new WeakMap();
function knownWords(id) {
  const language = naturalLanguage(id);
  if (!phraseSets.has(language)) {
    phraseSets.set(
      language,
      new Set(
        [...meaningsOf(id).meanings.keys()].flatMap((phrase) =>
          phrase.split(' ')
        )
      )
    );
  }
  return phraseSets.get(language);
}

// Whether a word (folded) is a word of a language, directly or through its
// stem.
export function isKnownWord(word, id) {
  if (knownWords(id).has(word)) {
    return true;
  }
  const { stems, grammar } = meaningsOf(id);
  return knownForm(word, stems, grammar) !== undefined;
}

// The words of a text (folded).
export const wordsOf = (text) =>
  pieces(text)
    .filter((_, index) => index % 2)
    .map(fold);

// The natural language most words of the comments belong to (English when
// no language knows them).
export function detectCommentLanguage(texts) {
  const words = texts.flatMap(wordsOf);
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
