//! Equivalence of two programs: both are read into the meta language, put in
//! the general form of the standard library and compared by meaning. What a
//! language writes but a program does not mean (comments, blank lines,
//! imports, types an untyped language cannot spell, mutability) is left
//! out, so a program and its translation are equivalent when they compute
//! the same thing in the same way.
//!
//! The JavaScript twin is js/src/translation/equivalence.js.

use crate::Mode;
use crate::meta::library::generalize;
use crate::meta::{GrammarError, Node, meaning_difference};
use crate::translator::Translator;

/// Whether a target program means what its source means.
#[derive(Clone, Debug, PartialEq)]
pub struct Equivalence {
    /// The first path where the programs differ ("/main/...: a != b"), or
    /// `None` when they are equivalent.
    pub difference: Option<String>,
    /// The target program: the one given, or the translation of the source.
    pub target: String,
}

impl Equivalence {
    pub fn equivalent(&self) -> bool {
        self.difference.is_none()
    }
}

/// The first path where two meta programs differ in meaning, or `None`.
pub fn compare_meta(left: &Node, right: &Node) -> Option<String> {
    meaning_difference(&generalize(left.clone()), &generalize(right.clone()))
}

/// Whether `target` in `to` means what `source` in `from` means. Without a
/// target the source is translated first, so this checks a translation.
pub fn check_equivalence(
    translator: &Translator,
    source: &str,
    from: &str,
    to: &str,
    target: Option<&str>,
) -> Result<Equivalence, GrammarError> {
    let written = match target {
        Some(text) => text.to_owned(),
        None => translator.translate(source, from, to, Mode::default())?,
    };
    let difference = compare_meta(
        &translator.to_meta(source, from)?,
        &translator.to_meta(&written, to)?,
    );
    Ok(Equivalence {
        difference,
        target: written,
    })
}
