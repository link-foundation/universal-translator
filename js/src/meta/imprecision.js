// The imprecision of a meta program: where reading a source lost something
// a translation cannot bring back. A node read imprecisely carries
//
//   (imprecision kind)   what was lost
//   (alternatives n)     how many readings it had, when it had several
//   (probability p)      the probability of the reading kept
//
// Emitters write a program from its other fields and ignore these. The
// kinds:
//
//   ambiguous     a word of prose that may mean several things
//                 (natural/prose-reading.js)
//   untranslated  a word of prose no meaning is known for
//                 (natural/prose-reading.js)
//   truncated     a number with a fraction typed as an integer: a
//                 language whose integers are integers drops the fraction
//   rounded       an integer beyond 2^53 - 1, the largest one a double
//                 keeps exactly: its digits past the 16th are lost
//
// The Rust twin is rust/src/meta/imprecision.rs.

import { rewrite } from './tree.js';

// What a number typed as an integer loses, if anything.
function numberImprecision({ value, type }) {
  if (type !== 'integer' || typeof value !== 'number') {
    return undefined;
  }
  if (!Number.isInteger(value)) {
    return 'truncated';
  }
  return Number.isSafeInteger(value) ? undefined : 'rounded';
}

// The program with the imprecision of each of its numbers recorded.
export function markImprecision(meta) {
  return rewrite(meta, (current) => {
    if (current.kind !== 'Number' || current.imprecision) {
      return current;
    }
    const imprecision = numberImprecision(current);
    return imprecision ? { ...current, imprecision } : current;
  });
}
