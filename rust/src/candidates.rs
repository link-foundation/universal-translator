//! The candidate translations of a text, the most probable first.
//!
//! The code of a program is translated by its rules one way only; the
//! choices are in its prose (comments, declared names, the sentences of a
//! natural language no template reads), where a phrase may have several
//! readings. Every prose part is ranked on its own
//! ([`crate::natural::rank_prose`]), so the most probable candidate is the
//! default translation; each other candidate takes one other translation of
//! one part. A candidate's scores are truth values
//! (natural/probability.rs):
//!
//! ```text
//!   frequency    the product of the frequencies of its prose parts
//!   round_trip   the product of the round trips of its prose parts
//!   coverage     the share of the lines translated (1 when complete)
//!   probability  frequency x round_trip x coverage
//! ```
//!
//! The JavaScript twin is js/src/translation/candidates.js.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use crate::meta::GrammarError;
use crate::natural::probability::{product, truth};
use crate::natural::{RankedProse, rank_prose};
use crate::translator::{Options, PartialTranslation, Translator};

/// The most candidates listed for one text.
const CANDIDATE_LIMIT: usize = 16;

/// A candidate translation and its scores (truth values).
#[derive(Clone, Debug, PartialEq)]
pub struct TranslationCandidate {
    pub text: String,
    /// frequency x round trip x coverage.
    pub probability: f64,
    /// How often the readings of its prose are meant.
    pub frequency: f64,
    /// How much of the meanings of its source prose a reader reads back.
    pub round_trip: f64,
    /// The share of the lines translated, 1 when complete.
    pub coverage: f64,
}

/// A prose part: its text, and the languages it is translated between.
type PartKey = (String, String, String);

/// Every prose part met, in order, with its ranked translations.
type Ranked = Arc<Mutex<Vec<(PartKey, Vec<RankedProse>)>>>;

/// A candidate from a translation and the ranked option of each prose
/// part. Prose is translated as a whole, so only parts left untranslated
/// lower the coverage.
fn candidate_of(result: PartialTranslation, options: &[&RankedProse]) -> TranslationCandidate {
    let coverage = if result.complete {
        1.0
    } else {
        truth(result.coverage)
    };
    let frequency = product(&options.iter().map(|it| it.frequency).collect::<Vec<_>>());
    let round_trip = product(&options.iter().map(|it| it.round_trip).collect::<Vec<_>>());
    TranslationCandidate {
        text: result.text,
        probability: product(&[frequency, round_trip, coverage]),
        frequency,
        round_trip,
        coverage,
    }
}

/// The translation with the option `chosen` names for each prose part (the
/// most probable one for the others), recording the parts met in `ranked`.
fn translate_with(
    translator: &Translator,
    ranked: &Ranked,
    chosen: HashMap<PartKey, usize>,
    (source, from, to, options): (&str, &str, &str, Options),
) -> Result<PartialTranslation, GrammarError> {
    let parts = Arc::clone(ranked);
    translator
        .clone()
        .with_comment_translator(move |text, from, to| {
            let key = (text.to_owned(), from.to_owned(), to.to_owned());
            let mut parts = parts.lock().map_err(|error| error.to_string())?;
            let at = match parts.iter().position(|(part, _)| *part == key) {
                Some(at) => at,
                None => {
                    parts.push((key.clone(), rank_prose(text, from, to)?));
                    parts.len() - 1
                }
            };
            let list = &parts[at].1;
            let option = chosen.get(&key).and_then(|at| list.get(*at));
            Ok(option
                .or(list.first())
                .map_or_else(String::new, |it| it.text.clone()))
        })
        .translate_partial(source, from, to, options, false)
}

impl Translator {
    /// The candidate translations of a text, the most probable first: the
    /// first is the text [`Translator::translate_partial`] writes. A
    /// translator with a comment translator of its own gives one candidate.
    pub fn translate_candidates(
        &self,
        source: &str,
        from: &str,
        to: &str,
        options: Options,
    ) -> Result<Vec<TranslationCandidate>, GrammarError> {
        if self.comment_translator.is_some() {
            let result = self.translate_partial(source, from, to, options, false)?;
            return Ok(vec![candidate_of(result, &[])]);
        }
        let ranked: Ranked = Arc::default();
        let task = (source, from, to, options);
        let best = translate_with(self, &ranked, HashMap::new(), task)?;
        let parts = ranked.lock().map(|parts| parts.clone()).unwrap_or_default();
        let variants: Vec<HashMap<PartKey, usize>> = parts
            .iter()
            .flat_map(|(key, list)| (1..list.len()).map(|at| HashMap::from([(key.clone(), at)])))
            .take(CANDIDATE_LIMIT - 1)
            .collect();
        let scored = |chosen: &HashMap<PartKey, usize>, result| {
            let parts = ranked.lock().map(|parts| parts.clone()).unwrap_or_default();
            let options: Vec<&RankedProse> = parts
                .iter()
                .filter_map(|(key, list)| {
                    chosen
                        .get(key)
                        .and_then(|at| list.get(*at))
                        .or(list.first())
                })
                .collect();
            candidate_of(result, &options)
        };
        let mut candidates = vec![scored(&HashMap::new(), best)];
        for chosen in variants {
            let result = translate_with(self, &ranked, chosen.clone(), task)?;
            candidates.push(scored(&chosen, result));
        }
        candidates.sort_by(|left, right| right.probability.total_cmp(&left.probability));
        let mut seen = HashSet::new();
        candidates.retain(|candidate| seen.insert(candidate.text.clone()));
        Ok(candidates)
    }
}
