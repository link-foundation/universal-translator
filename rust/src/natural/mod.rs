//! Controlled natural languages: programs written as sentences.
//!
//! The JavaScript twin lives in js/src/natural/.

mod agreement;
pub mod catalog;
mod collection_templates;
pub mod comments;
pub mod levels;
mod lines;
pub mod probability;
pub mod prose_reading;
mod query_templates;
pub mod reader;
pub mod rules;
pub mod standards;
pub mod tokens;
pub mod variants;
pub mod vocabulary;
pub mod writer;

pub use catalog::{
    Language, is_natural_language, natural_language, natural_language_ids, with_templates,
};
pub use comments::{
    RankedProse, comment_dictionary, detect_comment_language, is_known_word, rank_prose,
    translate_comment_text, words_of,
};
pub use prose_reading::read_prose;
pub use reader::{read_natural, read_natural_with};
pub use rules::{SemanticPrime, check_description, check_text, semantic_primes};
pub use variants::{
    NaturalVersion, VersionKind, base_natural_language_ids, natural_language_versions,
    preferred_natural_version, primes_version,
};
pub use writer::write_natural;
