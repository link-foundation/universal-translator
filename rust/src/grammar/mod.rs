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

pub mod common_library;
mod dialects;
pub mod emitter;
mod interpolation;
pub mod languages;
mod lexer;
pub mod lifting;
pub mod lowering;
pub mod machine;
pub mod machine_reader;
pub mod meta;
pub mod names;
pub mod parser;
pub mod rules;
pub mod truth;
pub mod types;

use std::fmt;
use std::sync::Arc;

pub use crate::Mode;
use crate::natural;
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

/// How a translation is written.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Options {
    pub mode: Mode,
    /// Print through the calls of the common library in `common-library/`.
    pub common_library: bool,
}

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
        if natural::is_natural_language(from) {
            // A controlled natural language is read sentence by sentence
            // straight into the meta language; it has no source details to
            // understand.
            let read = natural::read_natural(source, from).map_err(GrammarError::new)?;
            let read = rules::infer_mutability(read);
            self.report("read", &read);
            let settings = Settings {
                from: from.to_owned(),
                to: from.to_owned(),
                mode: Mode::default(),
            };
            let typed = apply_rules(types::infer_types(read), &self.meaning, &settings);
            self.report("typed", &typed);
            return Ok(typed);
        }
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
        let options = Options {
            mode,
            ..Options::default()
        };
        self.from_meta_with(meta, to, from, options)
    }

    /// [`Translator::from_meta`] with all translation options.
    pub fn from_meta_with(
        &self,
        meta: &Node,
        to: &str,
        from: Option<&str>,
        options: Options,
    ) -> Result<String, GrammarError> {
        let natural = natural::is_natural_language(to);
        if natural && options.common_library {
            return Err(GrammarError::new(format!(
                "Natural languages have no common library ({to})"
            )));
        }
        let syntax = if natural {
            None
        } else {
            Some(languages::language_syntax(to)?)
        };
        let machine = syntax.as_ref().is_some_and(|syntax| syntax.machine);
        if options.common_library && machine {
            return Err(GrammarError::new(format!(
                "Machine targets have no common library ({to})"
            )));
        }
        // Words carry no syntax of their own, so a program read from words
        // is adapted as if it had been written in the target language.
        let from = from.filter(|from| !natural::is_natural_language(from));
        let settings = Settings {
            from: from.unwrap_or(to).to_owned(),
            to: to.to_owned(),
            mode: options.mode,
        };
        // Custom layers are meta -> meta transformations, so they see the
        // target independent program; context rules then adapt it.
        let mut transformed = self.layers.iter().fold(meta.clone(), |current, layer| {
            apply_rules(current, layer, &settings)
        });
        // The common library route is one more meta layer, run last.
        if options.common_library {
            transformed = common_library::use_common_library(transformed)?;
        }
        self.report("transformed", &transformed);
        if natural {
            return natural::write_natural(&transformed, to).map_err(GrammarError::new);
        }
        let adapted = apply_rules(transformed, &self.context, &settings);
        self.report("adapted", &adapted);
        if machine {
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
        let options = Options {
            mode,
            ..Options::default()
        };
        self.translate_with(source, from, to, options)
    }

    /// [`Translator::translate`] with all translation options.
    pub fn translate_with(
        &self,
        source: &str,
        from: &str,
        to: &str,
        options: Options,
    ) -> Result<String, GrammarError> {
        let meta = self.to_meta(source, from)?;
        self.from_meta_with(&meta, to, Some(from), options)
    }
}

/// The identifiers of the languages the translator reads and writes, in
/// listing order.
pub fn language_ids() -> Vec<&'static str> {
    languages::language_ids()
}

/// A controlled natural language the translator reads and writes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NaturalLanguage {
    pub id: &'static str,
    pub label: &'static str,
    /// The language a profile extends.
    pub base: Option<&'static str>,
}

/// The controlled natural languages and profiles, in listing order.
pub fn natural_languages() -> Vec<NaturalLanguage> {
    natural::natural_language_ids()
        .into_iter()
        .filter_map(|id| natural::natural_language(id).ok())
        .map(|language| NaturalLanguage {
            id: &language.id,
            label: &language.label,
            base: language.base.as_deref(),
        })
        .collect()
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
