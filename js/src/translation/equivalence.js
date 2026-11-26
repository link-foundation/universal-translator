// Equivalence of two programs: both are read into the meta language, put in
// the general form of the standard library and compared by meaning. What a
// language writes but a program does not mean (comments, blank lines,
// imports, types an untyped language cannot spell, mutability) is left out,
// so a program and its translation are equivalent when they compute the
// same thing in the same way.

import { generalize } from '../meta/library.js';
import { meaningDifference } from '../meta/tree.js';

// The first path where two meta programs differ in meaning ("/main/...: a !=
// b"), or undefined when they are equivalent.
export const compareMeta = (left, right) =>
  meaningDifference(generalize(left), generalize(right));

// Whether `target` in `to` means what `source` in `from` means. Without a
// target the source is translated first, so this checks a translation.
// { equivalent, difference, target }
export function checkEquivalence(translator, { source, from, to, target }) {
  const written = target ?? translator.translate(source, from, to);
  const difference = compareMeta(
    translator.toMeta(source, from),
    translator.toMeta(written, to)
  );
  return {
    equivalent: difference === undefined,
    ...(difference === undefined ? {} : { difference }),
    target: written,
  };
}
