//! Probabilities of translations as truth values of relative meta logic:
//! numbers in [0, 1] rounded to six decimals (`TruthValue`), combined by the
//! product, the conjunction of independent values (`Aggregator::Product`).
//!
//! - frequency: how often the chosen readings are meant, the product of the
//!   prior of every choice made;
//! - round trip: how much of the source the translation keeps, the words
//!   read back from it that match the source, in order;
//! - probability: frequency x round trip (x the share of lines translated).
//!
//! The JavaScript twin is js/src/natural/probability.js.

use rml::probability::{Aggregator, TruthValue};

use crate::corpus_frequencies::reading_counts;

/// A value on the truth value grid: clamped to [0, 1], six decimals, half
/// up; what is not a number is unknown (0.5).
pub fn truth(value: f64) -> f64 {
    TruthValue::new(value).get()
}

/// The product of truth values (1 for none), each put on the grid first.
pub fn product(values: &[f64]) -> f64 {
    let values: Vec<TruthValue> = values.iter().map(|value| TruthValue::new(*value)).collect();
    Aggregator::Product.combine(&values).get()
}

/// The prior of each of `count` readings listed most frequent first: the
/// frequency of a rank falls as 1 / rank (Zipf's law), normalized to sum 1.
pub fn priors(count: usize) -> Vec<f64> {
    let total: f64 = (1..=count).map(|rank| 1.0 / rank as f64).sum();
    (0..count)
        .map(|at| truth(1.0 / (at + 1) as f64 / total))
        .collect()
}

/// The observed proportions when each available reading has corpus evidence.
pub(crate) fn reading_priors(language: &str, phrase: &str, meanings: &[&str]) -> Vec<f64> {
    let counts = reading_counts(language, phrase, meanings.iter().copied());
    if let Some(counts) = counts.filter(|counts| counts.len() > 1) {
        let total: f64 = counts.iter().map(|count| f64::from(*count)).sum();
        return counts
            .into_iter()
            .map(|count| truth(f64::from(count) / total))
            .collect();
    }
    priors(meanings.len())
}

/// How much of `source` survives in `back`: the longest common subsequence
/// of two lists of keys over the longer length (1 for two empty lists).
pub fn similarity<S: PartialEq>(source: &[S], back: &[S]) -> f64 {
    let longest = source.len().max(back.len());
    if longest == 0 {
        return 1.0;
    }
    let mut row = vec![0usize; back.len() + 1];
    for key in source {
        let mut next = vec![0usize];
        for (at, other) in back.iter().enumerate() {
            next.push(if key == other {
                row[at] + 1
            } else {
                row[at + 1].max(next[at])
            });
        }
        row = next;
    }
    truth(row[back.len()] as f64 / longest as f64)
}
