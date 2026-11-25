//! Controlled natural languages: programs written as sentences.
//!
//! The JavaScript twin lives in js/src/natural/.

pub mod catalog;
pub mod levels;
pub mod reader;
pub mod rules;
pub mod tokens;
pub mod writer;

pub use catalog::{
    Language, is_natural_language, natural_language, natural_language_ids, with_templates,
};
pub use reader::{read_natural, read_natural_with};
pub use rules::{SemanticPrime, check_description, check_text, semantic_primes};
pub use writer::write_natural;
