//! Grammar-based translation pipeline:
//!
//! ```text
//! source text --parse--> source tree --understanding rules--> meta program
//!   --type inference--> typed meta program --meaning rules-->
//!   --custom meta layers--> --context rules--> --emit--> target text
//! ```
//!
//! Machine targets (x86-64 assembly, CIL and JVM bytecode) replace the last
//! step: the adapted meta program is lowered to stack machine code and
//! written in the target's assembler syntax. Machine code is also read
//! back: its instructions are lifted into the meta language and continue
//! through type inference and the meaning rules.
//!
//! Every rule list is ordinary data, so callers can add, remove, reorder or
//! decorate rules, and a trace hook sees the tree after every stage.

pub mod emitter;
pub mod languages;
pub mod lexer;
pub mod lifting;
pub mod lowering;
pub mod machine;
pub mod machine_reader;
pub mod meta;
pub mod names;
pub mod parser;
pub mod rules;
pub mod types;

use std::fmt;
use std::sync::Arc;

pub use crate::Mode;
pub use meta::Node;

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

fn apply_rules(tree: Node, rules: &[Rule], settings: &Settings) -> Node {
    rules
        .iter()
        .fold(tree, |current, rule| (rule.apply)(current, settings))
}

/// The grammar translator with its rule layers.
#[derive(Clone)]
pub struct Translator {
    pub understanding: Vec<Rule>,
    pub meaning: Vec<Rule>,
    pub context: Vec<Rule>,
    /// Custom meta-to-meta layers that run before the context rules.
    pub layers: Vec<Vec<Rule>>,
    pub trace: Option<Trace>,
}

impl Default for Translator {
    fn default() -> Self {
        Translator {
            understanding: rules::understanding_rules(),
            meaning: rules::meaning_rules(),
            context: rules::context_rules(),
            layers: Vec::new(),
            trace: None,
        }
    }
}

impl Translator {
    /// A translator with the default rule layers.
    pub fn new() -> Self {
        Self::default()
    }

    /// The translator with a trace hook.
    pub fn with_trace(mut self, trace: impl Fn(&str, &Node) + Send + Sync + 'static) -> Self {
        self.trace = Some(Arc::new(trace));
        self
    }

    /// The translator with one more custom meta layer.
    pub fn with_layer(mut self, layer: Vec<Rule>) -> Self {
        self.layers.push(layer);
        self
    }

    fn report(&self, stage: &str, tree: &Node) {
        if let Some(trace) = &self.trace {
            trace(stage, tree);
        }
    }

    /// Read a source text into a typed meta program.
    pub fn to_meta(&self, source: &str, from: &str) -> Result<Node, GrammarError> {
        let syntax = languages::language_syntax(from)?;
        let settings = Settings {
            from: from.to_owned(),
            to: from.to_owned(),
            mode: Mode::default(),
        };
        if syntax.machine {
            // Machine code has no grammar to parse: read its instructions,
            // lift them to the meta language and continue like any other
            // source.
            let machine = machine_reader::read_machine(source, from)?;
            let lifted = rules::infer_mutability(lifting::lift_program(&machine)?);
            self.report("lifted", &lifted);
            let typed = apply_rules(types::infer_types(lifted), &self.meaning, &settings);
            self.report("typed", &typed);
            return Ok(typed);
        }
        let source_tree = parser::parse_program(source, &syntax)?;
        self.report("parsed", &source_tree);
        let meta = apply_rules(source_tree, &self.understanding, &settings);
        self.report("understood", &meta);
        let typed = apply_rules(types::infer_types(meta), &self.meaning, &settings);
        self.report("typed", &typed);
        Ok(typed)
    }

    /// Write a meta program in a language or machine target. `from` names
    /// the source language (the target itself when absent).
    pub fn from_meta(
        &self,
        meta: &Node,
        to: &str,
        from: Option<&str>,
        mode: Mode,
    ) -> Result<String, GrammarError> {
        let syntax = languages::language_syntax(to)?;
        let settings = Settings {
            from: from.unwrap_or(to).to_owned(),
            to: to.to_owned(),
            mode,
        };
        // Custom layers are meta -> meta transformations, so they see the
        // target independent program; context rules then adapt it.
        let transformed = self.layers.iter().fold(meta.clone(), |current, layer| {
            apply_rules(current, layer, &settings)
        });
        self.report("transformed", &transformed);
        let adapted = apply_rules(transformed, &self.context, &settings);
        self.report("adapted", &adapted);
        if syntax.machine {
            machine::emit_machine(&adapted, to)
        } else {
            emitter::emit_program(&adapted, to)
        }
    }

    /// Translate a source text from one language to another.
    pub fn translate(
        &self,
        source: &str,
        from: &str,
        to: &str,
        mode: Mode,
    ) -> Result<String, GrammarError> {
        let meta = self.to_meta(source, from)?;
        self.from_meta(&meta, to, Some(from), mode)
    }
}

/// The identifiers of the languages the translator reads and writes, in
/// listing order.
pub fn language_ids() -> Vec<&'static str> {
    languages::language_ids()
}

/// The identifiers of the machine targets.
pub fn machine_target_ids() -> Vec<&'static str> {
    languages::machine_target_ids()
}

/// Where two meta programs differ in meaning, or `None` when they mean the
/// same.
pub fn meaning_difference(left: &Node, right: &Node) -> Option<String> {
    meta::meaning_difference(left, right)
}
