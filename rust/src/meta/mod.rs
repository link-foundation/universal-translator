//! The meta language shared by every formal and natural language: the
//! language-independent tree ([`tree`]), its type inference ([`types`]) and
//! truth rules ([`truth`]), its standard library ([`library`]), Links
//! Notation reading ([`links`]), and the
//! rule and error types that every stage uses.

pub mod library;
pub mod links;
pub mod notation;
pub mod tree;
pub mod truth;
pub mod types;

use std::fmt;
use std::sync::Arc;

pub use crate::Mode;
pub use tree::*;

/// A failure to read, lower or write a program. Syntax errors name the
/// source line.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GrammarError {
    pub message: String,
    pub line: Option<usize>,
}

impl GrammarError {
    pub fn new(message: impl Into<String>) -> Self {
        GrammarError {
            message: message.into(),
            line: None,
        }
    }

    /// A syntax error at a source line.
    pub fn syntax(message: impl Into<String>, line: usize) -> Self {
        GrammarError {
            message: message.into(),
            line: Some(line),
        }
    }
}

impl fmt::Display for GrammarError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.line {
            Some(line) => write!(formatter, "{} (line {line})", self.message),
            None => formatter.write_str(&self.message),
        }
    }
}

impl std::error::Error for GrammarError {}

/// What a rule knows about the translation it takes part in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Settings {
    pub from: String,
    pub to: String,
    pub mode: Mode,
}

/// The tree-to-tree function of a rule.
pub type RuleFn = Arc<dyn Fn(Node, &Settings) -> Node + Send + Sync>;

/// A named tree-to-tree step.
#[derive(Clone)]
pub struct Rule {
    pub name: String,
    pub apply: RuleFn,
}

impl fmt::Debug for Rule {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("Rule")
            .field("name", &self.name)
            .finish()
    }
}

/// A hook that receives the name of each finished stage ("parsed",
/// "understood", "typed", "transformed", "adapted") and its tree.
pub type Trace = Arc<dyn Fn(&str, &Node) + Send + Sync>;

/// Apply rules in order.
pub fn apply_rules(tree: Node, rules: &[Rule], settings: &Settings) -> Node {
    rules
        .iter()
        .fold(tree, |current, rule| (rule.apply)(current, settings))
}
