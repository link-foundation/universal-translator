//! Whether a translation does what its source does, as far as the meta
//! language can tell: both texts are read into meta programs, and the two
//! must be the same when the parts without an effect on a run are left out.
//! Those parts are comments, imports, blank lines, declared types and
//! whether a variable may change. Two programs with the same meta program
//! run the same statements on the same values in the same order, so this is
//! a proof of the same effect for the narrow set of programs the meta
//! language reads; anything the meta language does not model (overflow,
//! float formatting, library behaviour) stays outside it.
//!
//! The same check as js/src/translation/equivalence.js.

use crate::GrammarError;
use crate::meta::notation::format_meta;
use crate::meta::tree::{Node, Value};
use crate::translator::{Options, Translator};

/// Fields that do not change what a program does.
const WITHOUT_EFFECT: [&str; 7] = [
    "blankAfter",
    "comments",
    "imports",
    "mainComments",
    "mutable",
    "returnType",
    "type",
];

/// Statements that do not change what a program does.
const LAYOUT: [&str; 2] = ["Blank", "Comment"];

const MAX_DIFFERENCES: usize = 5;

fn is_layout(value: &Value) -> bool {
    matches!(value, Value::Node(node) if LAYOUT.contains(&node.kind.as_str()))
}

fn value_effect(value: &Value) -> Value {
    match value {
        Value::List(items) => Value::List(
            items
                .iter()
                .filter(|item| !is_layout(item))
                .map(value_effect)
                .collect(),
        ),
        Value::Node(node) => Value::Node(effect_of(node)),
        other => other.clone(),
    }
}

/// The meta program without the parts that have no effect.
pub fn effect_of(node: &Node) -> Node {
    Node {
        kind: node.kind.clone(),
        origin: node.origin.clone(),
        fields: node
            .fields
            .iter()
            .filter(|(field, _)| !WITHOUT_EFFECT.contains(&field.as_str()))
            .map(|(field, value)| (field.clone(), value_effect(value)))
            .collect(),
    }
}

/// A line where the two meta programs differ, 1-based and without its
/// indentation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Difference {
    pub line: usize,
    pub source: String,
    pub target: String,
}

/// The outcome of a check.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Equivalence {
    pub equivalent: bool,
    /// The translation that was checked.
    pub translation: String,
    /// The lines of the meta program of the source.
    pub meta_lines: usize,
    /// At most five of the lines where the two differ.
    pub differences: Vec<Difference>,
}

fn lines_of(program: &Node) -> Vec<String> {
    format_meta(&effect_of(program))
        .trim_end()
        .split('\n')
        .map(str::to_owned)
        .collect()
}

fn differences_of(source: &[String], target: &[String]) -> Vec<Difference> {
    let line = |lines: &[String], index: usize| {
        lines
            .get(index)
            .map(|line| line.trim().to_owned())
            .unwrap_or_default()
    };
    (0..source.len().max(target.len()))
        .filter(|&index| source.get(index) != target.get(index))
        .take(MAX_DIFFERENCES)
        .map(|index| Difference {
            line: index + 1,
            source: line(source, index),
            target: line(target, index),
        })
        .collect()
}

/// Compares a source with a translation of it, written by the translator
/// when none is given (a hand-written one is checked the same way).
pub fn check_equivalence(
    translator: &Translator,
    (source, from): (&str, &str),
    (translation, to): (Option<&str>, &str),
    options: Options,
) -> Result<Equivalence, GrammarError> {
    let translation = match translation {
        Some(text) => text.to_owned(),
        None => translator.translate_with(source, from, to, options)?,
    };
    let source_lines = lines_of(&translator.to_meta(source, from)?);
    let target_lines = lines_of(&translator.to_meta(&translation, to)?);
    let differences = differences_of(&source_lines, &target_lines);
    Ok(Equivalence {
        equivalent: differences.is_empty(),
        translation,
        meta_lines: source_lines.len(),
        differences,
    })
}
