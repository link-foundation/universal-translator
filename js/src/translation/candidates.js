// The candidate translations of a text, the most probable first.
//
// The code of a program is translated by its rules one way only; the
// choices are in its prose (comments, declared names, the sentences of a
// natural language no template reads), where a phrase may have several
// readings. Every prose part is ranked on its own (rankProse in
// natural/comments.js), so the most probable candidate is the default
// translation; each other candidate takes one other translation of one
// part. A candidate's scores are truth values (natural/probability.js):
//
//   frequency    the product of the frequencies of its prose parts
//   roundTrip    the product of the round trips of its prose parts
//   coverage     the share of the lines translated (1 when complete)
//   probability  frequency x roundTrip x coverage
//
// The Rust twin is rust/src/candidates.rs.

import { rankProse } from '../natural/comments.js';
import { product, truth } from '../natural/probability.js';

// The most candidates listed for one text.
const candidateLimit = 16;

const partKey = (text, { from, to }) => JSON.stringify([text, from, to]);

// A candidate from a translation and the ranked option of each prose part.
// Prose is translated as a whole, so only parts left untranslated lower
// the coverage.
function candidateOf({ text, complete, coverage: read }, options) {
  const coverage = complete ? 1 : truth(read);
  const frequency = product(options.map((option) => option.frequency));
  const roundTrip = product(options.map((option) => option.roundTrip));
  return {
    text,
    probability: product([frequency, roundTrip, coverage]),
    frequency,
    roundTrip,
    coverage,
  };
}

// translateCandidates(source, from, to, options) on top of a partial
// translator. A caller's own translateComment gives one candidate.
export function createCandidateTranslator(translatePartial) {
  return (source, from, to, options = {}) => {
    if (options.translateComment) {
      return [candidateOf(translatePartial(source, from, to, options), [])];
    }
    // Every prose part met, in order, with its ranked translations.
    const ranked = new Map();
    const choose = (chosen) => (text, languages) => {
      const key = partKey(text, languages);
      if (!ranked.has(key)) {
        ranked.set(key, rankProse(text, languages));
      }
      const list = ranked.get(key);
      return (list[chosen.get(key) ?? 0] ?? list[0]).text;
    };
    const translateWith = (chosen) =>
      translatePartial(source, from, to, {
        ...options,
        translateComment: choose(chosen),
      });
    const best = translateWith(new Map());
    const variants = [];
    for (const [key, list] of ranked) {
      list.slice(1).forEach((_, at) => variants.push(new Map([[key, at + 1]])));
    }
    const scored = (chosen, result) =>
      candidateOf(
        result,
        [...ranked].map(([key, list]) => list[chosen.get(key) ?? 0])
      );
    const candidates = [
      scored(new Map(), best),
      ...variants
        .slice(0, candidateLimit - 1)
        .map((chosen) => scored(chosen, translateWith(chosen))),
    ];
    const seen = new Set();
    return candidates
      .sort((left, right) => right.probability - left.probability)
      .filter(({ text }) => !seen.has(text) && seen.add(text));
  };
}
