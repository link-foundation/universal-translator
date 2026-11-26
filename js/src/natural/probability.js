// Probabilities of translations as truth values of relative meta logic
// (the relative-meta-logic package): numbers in [0, 1] rounded to six
// decimals, combined by the product, the conjunction of independent
// values. The Rust twin is rust/src/natural/probability.rs, which uses the
// package's TruthValue and Aggregator::Product.
//
//   frequency    how often the chosen readings are meant: the product of
//                the prior of every choice made
//   round trip   how much of the source the translation keeps: the words
//                read back from it that match the source, in order
//   probability  frequency x round trip (x the share of lines translated)

const scale = 1e6;

// A value on the truth value grid: clamped to [0, 1], six decimals, half up;
// what is not a number is unknown (0.5).
export function truth(value) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  const scaled = Math.min(Math.max(value, 0), 1) * scale;
  const whole = Math.floor(scaled);
  return (whole + (scaled - whole >= 0.5 ? 1 : 0)) / scale;
}

// The product of truth values (1 for none), each put on the grid first.
export const product = (values) =>
  truth(values.reduce((total, value) => total * truth(value), 1));

// The prior of each of `count` readings listed most frequent first: the
// frequency of a rank falls as 1 / rank (Zipf's law), normalized to sum 1.
export function priors(count) {
  let total = 0;
  for (let rank = 1; rank <= count; rank += 1) {
    total += 1 / rank;
  }
  return Array.from({ length: count }, (_, at) => truth(1 / (at + 1) / total));
}

// How much of `source` survives in `back`: the longest common subsequence
// of two lists of keys over the longer length (1 for two empty lists).
export function similarity(source, back) {
  const longest = Math.max(source.length, back.length);
  if (longest === 0) {
    return 1;
  }
  let row = new Array(back.length + 1).fill(0);
  for (const key of source) {
    const next = [0];
    back.forEach((other, at) => {
      next.push(key === other ? row[at] + 1 : Math.max(row[at + 1], next[at]));
    });
    row = next;
  }
  return truth(row[back.length] / longest);
}
