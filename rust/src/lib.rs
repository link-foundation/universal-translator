//! Translate programs through a shared meta language with the grammar
//! translator, exchange sources as Links Notation documents and concrete
//! syntax trees, and rank dependent interpretations.

pub mod grammar;
mod links;
pub mod natural;
mod program;
mod referents;
mod source_document;

pub use grammar::{GrammarError, Options, Translator};
pub use program::translate_program;
pub use referents::{
    Candidate, Observation, RankedCandidate, Ranking, rank_interpretations, read_referent_input,
};
pub use source_document::SourceDocument;

/// How closely a translation follows the source.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Mode {
    /// Adapt comments and names to the target language.
    #[default]
    ContextDependent,
    /// Keep comments word for word.
    Literal,
    /// Keep only the behaviour, without comments.
    SameEffect,
}

impl std::str::FromStr for Mode {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "context-dependent" => Ok(Self::ContextDependent),
            "literal" => Ok(Self::Literal),
            "same-effect" => Ok(Self::SameEffect),
            _ => Err(format!(r#"Unsupported mode "{value}""#)),
        }
    }
}

/// Translate a program with the default grammar translator.
pub fn translate(source: &str, from: &str, to: &str, mode: Mode) -> Result<String, GrammarError> {
    Translator::new().translate(source, from, to, mode)
}
