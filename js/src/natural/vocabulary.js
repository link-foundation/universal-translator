// The everyday words of the natural languages, beyond what their controlled
// templates need (data/natural/vocabulary.lino), and the little grammar the
// free translation of prose uses (data/natural/grammar.lino).
//
// The vocabulary is indexed by concept, like the semantic primes: each
// concept has a part of speech and, per language, its word forms, the most
// frequent first. The first form is the one a translation writes; the other
// forms (cases, plurals, tenses) are read.
//
// The grammar of a language states:
//
//   infinitive  how an infinitive is written around the verb ('to {verb}')
//   verb-lemma  'infinitive' when the first form of a verb is its infinitive
//   verb-forms  the names of the first forms of a verb (lemma present): a
//               verb form is translated into the form of the same name
//   object-endings  pairs of nominative -> accusative endings of a noun
//   object-forms    pairs of nominative -> accusative forms of a word
//                   (кто-то -> кого-то), for words the endings do not cover
//   of-genitive     'yes' when "of" between nouns is the case of the second
//                   noun, so it is left out before a word that has no case
//   endings     inflection endings, so an inflected form that is not listed
//               is still found through its stem (мира -> мир)
//   spaced      'no' when words are written without spaces between them

import { parseLinks } from '../meta/links.js';
import { naturalSources } from './sources.js';

const fold = (text) => text.toLocaleLowerCase();
const length = (text) => [...text].length;

// [a, b, c, d] -> Map { a -> b, c -> d }
const pairsOf = (list) =>
  new Map(
    Array.from({ length: Math.floor(list.length / 2) }, (_, at) => [
      fold(list[2 * at]),
      fold(list[2 * at + 1]),
    ])
  );

let concepts;

// [{ id, part, forms: { language: [form, ...] } }] in the order of the file,
// the most frequent concept first.
export function vocabularyConcepts() {
  if (!concepts) {
    const [root] = parseLinks(naturalSources['vocabulary.lino']);
    concepts = root.values.map(({ id, values }) => {
      const forms = {};
      let part;
      for (const field of values) {
        const words = field.values.map((value) => value.id);
        if (field.id === 'part') {
          [part] = words;
        } else {
          forms[field.id] = words.map(fold);
        }
      }
      return { id, part, forms };
    });
  }
  return concepts;
}

let grammars;

// The grammar of a base language (every field is optional).
export function grammarOf(base) {
  if (!grammars) {
    const [root] = parseLinks(naturalSources['grammar.lino']);
    grammars = new Map(
      root.values.map(({ id, values }) => {
        const fields = Object.fromEntries(
          values.map((field) => [
            field.id,
            field.values.map((value) => value.id),
          ])
        );
        // Longer endings first, so the shortest stem is tried last.
        const endings = (fields.endings ?? [])
          .map((ending, at) => ({ ending, at }))
          .sort((a, b) => length(b.ending) - length(a.ending) || a.at - b.at)
          .map(({ ending }) => ending);
        return [
          id,
          {
            infinitive: fields.infinitive?.[0],
            verbLemma: fields['verb-lemma']?.[0],
            verbForms: fields['verb-forms'] ?? [],
            objectEndings: pairsOf(fields['object-endings'] ?? []),
            objectForms: pairsOf(fields['object-forms'] ?? []),
            ofGenitive: fields['of-genitive']?.[0] === 'yes',
            endings,
            spaced: fields.spaced?.[0] !== 'no',
          },
        ];
      })
    );
  }
  return (
    grammars.get(base) ?? {
      verbForms: [],
      objectEndings: new Map(),
      objectForms: new Map(),
      ofGenitive: false,
      endings: [],
      spaced: true,
    }
  );
}

// A stem keeps at least this many letters.
const shortestStem = 3;

// The stems of a word: the word without each ending it has.
export function stemsOf(word, grammar) {
  const stems = [];
  for (const ending of grammar.endings) {
    if (
      word.endsWith(ending) &&
      length(word) - length(ending) >= shortestStem
    ) {
      stems.push(word.slice(0, word.length - ending.length));
    }
  }
  return stems;
}

// Stem -> the first known form with that stem, for the words of a language.
export function stemIndex(words, grammar) {
  const index = new Map();
  for (const word of words) {
    if (word.includes(' ')) {
      continue;
    }
    for (const stem of [word, ...stemsOf(word, grammar)]) {
      if (!index.has(stem)) {
        index.set(stem, word);
      }
    }
  }
  return index;
}

// The known form an inflected word stands for, if any.
export function knownForm(word, index, grammar) {
  if (index.has(word)) {
    return index.get(word);
  }
  for (const stem of stemsOf(word, grammar)) {
    if (index.has(stem)) {
      return index.get(stem);
    }
  }
  return undefined;
}
