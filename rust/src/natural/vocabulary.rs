//! The everyday words of the natural languages, beyond what their controlled
//! templates need (data/natural/vocabulary.lino), and the little grammar the
//! free translation of prose uses (data/natural/grammar.lino).
//!
//! The vocabulary is indexed by concept, like the semantic primes: each
//! concept has a part of speech and, per language, its word forms, the most
//! frequent first. The first form is the one a translation writes; the other
//! forms (cases, plurals, tenses) are read.
//!
//! The grammar of a language states:
//!
//! ```text
//!   infinitive  how an infinitive is written around the verb ('to {verb}')
//!   verb-lemma  'infinitive' when the first form of a verb is its infinitive
//!   endings     inflection endings, so an inflected form that is not listed
//!               is still found through its stem (мира -> мир)
//!   spaced      'no' when words are written without spaces between them
//! ```
//!
//! The JavaScript twin is js/src/natural/vocabulary.js.

use std::collections::{BTreeMap, HashMap};
use std::sync::LazyLock;

use super::catalog::{
    GRAMMAR_FILE, SOURCES, VOCABULARY_FILE, label_of, parse_root, plain, values_of,
};

/// A concept of the vocabulary: its part of speech and its word forms per
/// language (folded), the most frequent first.
#[derive(Clone, Debug)]
pub struct Concept {
    pub id: String,
    pub part: String,
    pub forms: BTreeMap<String, Vec<String>>,
}

/// The grammar of free translation for one base language.
#[derive(Clone, Debug)]
pub struct Grammar {
    pub infinitive: Option<String>,
    pub verb_lemma: Option<String>,
    /// Longer endings first, so the shortest stem is tried last.
    pub endings: Vec<String>,
    pub spaced: bool,
}

impl Default for Grammar {
    fn default() -> Self {
        Self {
            infinitive: None,
            verb_lemma: None,
            endings: Vec::new(),
            spaced: true,
        }
    }
}

fn source_of(name: &str) -> Result<&'static str, String> {
    SOURCES
        .iter()
        .find(|(file, _)| *file == name)
        .map(|(_, source)| *source)
        .ok_or_else(|| format!("No {name}"))
}

static CONCEPTS: LazyLock<Result<Vec<Concept>, String>> = LazyLock::new(|| {
    let root = parse_root(source_of(VOCABULARY_FILE)?)?;
    Ok(values_of(&root)
        .iter()
        .map(|concept| {
            let mut part = String::new();
            let mut forms = BTreeMap::new();
            for field in values_of(concept) {
                let words = plain(values_of(field));
                if label_of(field) == "part" {
                    part = words.into_iter().next().unwrap_or_default();
                } else {
                    forms.insert(
                        label_of(field).to_owned(),
                        words.iter().map(|word| word.to_lowercase()).collect(),
                    );
                }
            }
            Concept {
                id: label_of(concept).to_owned(),
                part,
                forms,
            }
        })
        .collect())
});

/// The concepts in the order of the file, the most frequent first.
pub fn vocabulary_concepts() -> Result<&'static [Concept], String> {
    CONCEPTS.as_deref().map_err(Clone::clone)
}

static GRAMMARS: LazyLock<Result<HashMap<String, Grammar>, String>> = LazyLock::new(|| {
    let root = parse_root(source_of(GRAMMAR_FILE)?)?;
    Ok(values_of(&root)
        .iter()
        .map(|language| {
            let fields: HashMap<&str, Vec<String>> = values_of(language)
                .iter()
                .map(|field| (label_of(field), plain(values_of(field))))
                .collect();
            let first = |name: &str| fields.get(name).and_then(|values| values.first()).cloned();
            let mut endings = fields.get("endings").cloned().unwrap_or_default();
            // A stable sort keeps the order of the file among equal lengths.
            endings.sort_by_key(|ending| std::cmp::Reverse(ending.chars().count()));
            (
                label_of(language).to_owned(),
                Grammar {
                    infinitive: first("infinitive"),
                    verb_lemma: first("verb-lemma"),
                    endings,
                    spaced: first("spaced").as_deref() != Some("no"),
                },
            )
        })
        .collect())
});

/// The grammar of a base language (every field is optional).
pub fn grammar_of(base: &str) -> Grammar {
    GRAMMARS
        .as_ref()
        .ok()
        .and_then(|grammars| grammars.get(base).cloned())
        .unwrap_or_default()
}

/// A stem keeps at least this many letters.
const SHORTEST_STEM: usize = 3;

/// The stems of a word: the word without each ending it has.
pub fn stems_of<'a>(word: &'a str, grammar: &Grammar) -> Vec<&'a str> {
    grammar
        .endings
        .iter()
        .filter(|ending| {
            word.ends_with(ending.as_str())
                && word.chars().count() - ending.chars().count() >= SHORTEST_STEM
        })
        .map(|ending| &word[..word.len() - ending.len()])
        .collect()
}

/// Stem -> the first known form with that stem, for the words of a language.
pub fn stem_index<'a, I: IntoIterator<Item = &'a String>>(
    words: I,
    grammar: &Grammar,
) -> HashMap<String, String> {
    let mut index = HashMap::new();
    for word in words {
        if word.contains(' ') {
            continue;
        }
        let stems = std::iter::once(word.as_str()).chain(stems_of(word, grammar));
        for stem in stems {
            index.entry(stem.to_owned()).or_insert_with(|| word.clone());
        }
    }
    index
}

/// The known form an inflected word stands for, if any.
pub fn known_form(
    word: &str,
    index: &HashMap<String, String>,
    grammar: &Grammar,
) -> Option<String> {
    if let Some(form) = index.get(word) {
        return Some(form.clone());
    }
    stems_of(word, grammar)
        .into_iter()
        .find_map(|stem| index.get(stem).cloned())
}
