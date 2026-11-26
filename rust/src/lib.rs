//! Translate programs through a shared meta language with the grammar
//! translator, exchange sources as Links Notation documents and concrete
//! syntax trees, and rank dependent interpretations.

pub mod comment_language;
pub mod custom_rules;
mod detect;
pub mod formal;
pub mod fragments;
pub mod identifier_language;
pub mod layout;
pub mod meta;
pub mod natural;
pub mod nesting;
mod partial;
mod program;
mod referents;
pub mod server;
mod source_document;
pub mod translator;

pub use comment_language::{CommentTranslator, translate_comments};
pub use custom_rules::CustomRules;
pub use formal::versions::{Version, split_version, versions_of};
pub use fragments::{Fragment, FragmentKind};
pub use identifier_language::{translate_identifiers, translate_program_identifiers};
pub use meta::GrammarError;
pub use nesting::{nest_grammars, unnest};
pub use program::translate_program;
pub use referents::{
    Candidate, Observation, RankedCandidate, Ranking, rank_interpretations, read_referent_input,
};
pub use source_document::SourceDocument;
pub use translator::{
    Detection, LanguageListing, Options, PartError, PartStatus, PartialReading, PartialTranslation,
    TextLayout, Translator,
};

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

/// Read a fragment (a whole program, function definitions or statements)
/// with the default grammar translator.
pub fn parse_fragment(source: &str, from: &str) -> Result<Fragment, GrammarError> {
    Translator::new().parse_fragment(source, from)
}

/// Translate a fragment into the same kind of fragment with the default
/// grammar translator. A fragment must be complete: a function ends with its
/// closing and a statement is a whole statement.
pub fn translate_fragment(
    source: &str,
    from: &str,
    to: &str,
    options: Options,
) -> Result<String, GrammarError> {
    Translator::new().translate_fragment(source, from, to, options)
}

/// Translate what can be translated and mark the rest, with the default
/// grammar translator.
pub fn translate_partial(
    source: &str,
    from: &str,
    to: &str,
    options: Options,
) -> Result<PartialTranslation, GrammarError> {
    Translator::new().translate_partial(source, from, to, options, false)
}

/// Read what can be read, with the default grammar translator.
pub fn parse_partial(source: &str, from: &str) -> Result<PartialReading, GrammarError> {
    Translator::new().parse_partial(source, from)
}

/// Rank the languages a text may be written in, likeliest first.
pub fn detect_language(source: &str) -> Vec<Detection> {
    Translator::new().detect_language(source, 5)
}
