// A deep reading of prose: the sentences of a text, their words and the
// meanings the words stand for, with the code a text quotes between
// backticks read by the grammar of its programming language.
//
//   Prose     { language, sentences }
//   Sentence  { words, question? }
//   Word      { text, concept? | prime? | word?, part? }
//   Code      { language, program }   a quoted piece of code, read
//
// A word's meaning is a concept of the everyday vocabulary
// (data/natural/vocabulary.lino), a semantic prime or a neutral word of
// program names, found the way the free translation of prose finds it
// (comments.js): the longest known phrase of up to four words first, an
// inflected word through its stem, and in a question the interrogative
// meanings first. The Rust twin is rust/src/natural/prose_reading.rs.

import {
  detectCommentLanguage,
  likely,
  meaningsOf,
  pieces,
} from './comments.js';
import { knownForm } from './vocabulary.js';

const fold = (text) => text.toLocaleLowerCase();

const longestPhrase = 4;
// The longest word looked for inside a text written without spaces.
const longestRun = 8;

const terminators = /[.!?;。！？؟]/u;
const questionMarks = /[?？؟]/u;

// 'concept:print' -> { concept: 'print' }
function meaningFields(meaning, language) {
  const at = meaning.indexOf(':');
  return {
    [meaning.slice(0, at)]: meaning.slice(at + 1),
    part: language.parts.get(meaning),
  };
}

// The meaning of a known phrase, through its stem for a single word.
function meaningOf(phrase, language, single, question) {
  const form = language.meanings.has(phrase)
    ? phrase
    : single
      ? knownForm(phrase, language.stems, language.grammar)
      : undefined;
  return form === undefined ? undefined : likely(form, language, question)[0];
}

// The words of a run of letters written without spaces: the longest known
// runs first, unknown letters joined into one word.
function segmented(text, language, question) {
  const letters = [...text];
  const words = [];
  let at = 0;
  while (at < letters.length) {
    let size = Math.min(longestRun, letters.length - at);
    let meaning;
    for (; size > 0 && !meaning; size -= 1) {
      meaning = meaningOf(
        fold(letters.slice(at, at + size).join('')),
        language,
        false,
        question
      );
    }
    size += 1;
    if (meaning) {
      const run = letters.slice(at, at + size).join('');
      words.push({
        kind: 'Word',
        text: run,
        ...meaningFields(meaning, language),
      });
      at += size;
    } else if (words.at(-1) && !words.at(-1).part) {
      words.at(-1).text += letters[at];
      at += 1;
    } else {
      words.push({ kind: 'Word', text: letters[at] });
      at += 1;
    }
  }
  return words;
}

// The words of one sentence: `run` holds its word pieces and the gaps
// between them.
function sentenceWords(run, language, question) {
  const words = [];
  let index = 0;
  while (index < run.length) {
    let found;
    for (let size = longestPhrase; size >= 1 && !found; size -= 1) {
      const last = index + size - 1;
      const joined =
        last < run.length &&
        run.slice(index + 1, last + 1).every((word) => word.gap === ' ');
      if (joined) {
        const text = run
          .slice(index, last + 1)
          .map((word) => word.text)
          .join(' ');
        const meaning = meaningOf(fold(text), language, size === 1, question);
        found = meaning && { text, meaning, size };
      }
    }
    if (found) {
      words.push({
        kind: 'Word',
        text: found.text,
        ...meaningFields(found.meaning, language),
      });
      index += found.size;
    } else if (!language.grammar.spaced) {
      words.push(...segmented(run[index].text, language, question));
      index += 1;
    } else {
      words.push({ kind: 'Word', text: run[index].text });
      index += 1;
    }
  }
  return words;
}

// The text cut into sentences: each one a list of word pieces (with the
// gap before each word) and quoted code, and whether it asks.
function sentencesOf(text) {
  const sentences = [];
  let current = { items: [], question: false };
  const close = (mark) => {
    current.question = questionMarks.test(mark);
    if (current.items.length) {
      sentences.push(current);
    }
    current = { items: [], question: false };
  };
  text.split('`').forEach((segment, at) => {
    if (at % 2 === 1) {
      current.items.push({ code: segment });
      return;
    }
    let gap = '';
    pieces(segment).forEach((piece, index) => {
      if (index % 2 === 1) {
        current.items.push({ text: piece, gap });
        return;
      }
      const mark = piece.match(terminators);
      gap = piece;
      if (mark) {
        close(mark[0]);
        gap = '';
      }
    });
  });
  close('');
  return sentences;
}

// The words of a sentence, with its quoted code read by `readCode`.
function readSentence({ items, question }, language, readCode) {
  const words = [];
  let run = [];
  const flush = () => {
    words.push(...sentenceWords(run, language, question));
    run = [];
  };
  for (const item of items) {
    if (item.code === undefined) {
      run.push(item);
      continue;
    }
    flush();
    words.push(readCode(item.code) ?? { kind: 'Word', text: item.code });
  }
  flush();
  return { kind: 'Sentence', words, ...(question ? { question } : {}) };
}

// The deep reading of a text as prose of a natural language (the one most
// of its words belong to, unless `language` names it), or undefined when
// no word of it is known and it quotes no code.
export function readProse(text, { language, readCode = () => undefined } = {}) {
  const id = language ?? detectCommentLanguage([text]);
  const meanings = meaningsOf(id);
  const sentences = sentencesOf(text).map((sentence) =>
    readSentence(sentence, meanings, readCode)
  );
  const understood = sentences.some((sentence) =>
    sentence.words.some((word) => word.kind !== 'Word' || word.part)
  );
  return understood ? { kind: 'Prose', language: id, sentences } : undefined;
}
