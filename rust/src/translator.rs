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

pub use crate::Mode;
use crate::formal::{
    common_library, emitter, languages, lifting, machine, machine_reader, parser, rules,
};
use crate::meta::{self, GrammarError, Node, Rule, Settings, Trace, apply_rules, types};
use crate::natural;
use std::sync::Arc;

use crate::custom_rules::CustomRules;
pub use crate::detect::Detection;
use crate::fragments;
pub use crate::fragments::{Fragment, FragmentKind};
pub use crate::partial::{PartError, PartStatus, PartialReading, PartialTranslation};

/// How a translation is written.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Options {
    pub mode: Mode,
    /// Print through the calls of the common library in `common-library/`.
    pub common_library: bool,
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
    /// Rules given as data (see [`crate::custom_rules`]).
    pub rules: Arc<CustomRules>,
}

impl Default for Translator {
    fn default() -> Self {
        Translator {
            understanding: rules::understanding_rules(),
            meaning: rules::meaning_rules(),
            context: rules::context_rules(),
            layers: Vec::new(),
            trace: None,
            rules: Arc::default(),
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

    /// The same translator with other data rules.
    pub fn with_rules(mut self, rules: CustomRules) -> Self {
        self.rules = Arc::new(rules);
        self
    }

    fn report(&self, stage: &str, tree: &Node) {
        if let Some(trace) = &self.trace {
            trace(stage, tree);
        }
    }

    /// Read a source text into a typed meta program.
    pub fn to_meta(&self, text: &str, from: &str) -> Result<Node, GrammarError> {
        let source = &self.rules.source(text, from);
        if natural::is_natural_language(from) {
            // A controlled natural language is read sentence by sentence
            // straight into the meta language; it has no source details to
            // understand.
            let read = match self.rules.natural_language(from) {
                Some(language) => natural::read_natural_with(source, language),
                None => natural::read_natural(source, from),
            }
            .map_err(GrammarError::new)?;
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
        let adapted = self.adapt(meta, to, from, options)?;
        self.write(&adapted, to)
    }

    /// Run the custom layers and the context rules for a target. A natural
    /// target receives the transformed program, since it has no syntax to
    /// adapt to.
    pub fn adapt(
        &self,
        meta: &Node,
        to: &str,
        from: Option<&str>,
        options: Options,
    ) -> Result<Node, GrammarError> {
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
        let mut transformed = self
            .layers
            .iter()
            .chain(&self.rules.layers())
            .fold(meta.clone(), |current, layer| {
                apply_rules(current, layer, &settings)
            });
        // The common library route is one more meta layer, run last.
        if options.common_library {
            transformed = common_library::use_common_library(transformed)?;
        }
        self.report("transformed", &transformed);
        if natural {
            return Ok(transformed);
        }
        let adapted = apply_rules(transformed, &self.context, &settings);
        self.report("adapted", &adapted);
        Ok(adapted)
    }

    /// Write an adapted program in a language, a machine target or words.
    pub fn write(&self, adapted: &Node, to: &str) -> Result<String, GrammarError> {
        let written = if natural::is_natural_language(to) {
            natural::write_natural(adapted, to).map_err(GrammarError::new)?
        } else if languages::language_syntax(to)?.machine {
            machine::emit_machine(adapted, to)?
        } else {
            emitter::emit_program(adapted, to)?
        };
        Ok(self.rules.output(&written, to))
    }

    /// Emit an adapted program in a programming language, with the output
    /// rules.
    pub fn emit_text(&self, adapted: &Node, to: &str) -> Result<String, GrammarError> {
        Ok(self.rules.output(&emitter::emit_program(adapted, to)?, to))
    }

    /// Comments that stand on their own as statements of the target.
    pub fn write_notes(&self, texts: &[String], to: &str) -> Result<String, GrammarError> {
        fragments::write_notes(self, texts, to)
    }

    /// Read as much of a text as the grammar covers.
    pub fn parse_partial(&self, source: &str, from: &str) -> Result<PartialReading, GrammarError> {
        crate::partial::parse_partial(self, source, from)
    }

    /// Translate every part that can be translated and mark the rest as
    /// comments of the target. `fragment` reads the whole text as a
    /// fragment first. Machine code is read and written as whole programs
    /// only.
    pub fn translate_partial(
        &self,
        source: &str,
        from: &str,
        to: &str,
        options: Options,
        fragment: bool,
    ) -> Result<PartialTranslation, GrammarError> {
        let machine = machine_target_ids().contains(&to)
            || (!natural::is_natural_language(from) && languages::language_syntax(from)?.machine);
        let whole = if fragment {
            self.translate_fragment(source, from, to, options)
        } else {
            self.translate_with(source, from, to, options)
        };
        match whole {
            Ok(text) => {
                let lines = source
                    .split('\n')
                    .filter(|line| !line.trim().is_empty())
                    .count();
                Ok(PartialTranslation {
                    text,
                    complete: true,
                    errors: Vec::new(),
                    lines,
                    read_lines: lines,
                    coverage: 1.0,
                })
            }
            Err(error) if machine => Err(error),
            Err(_) => crate::partial::translate_partial(self, source, from, to, options),
        }
    }

    /// Rank the languages a text may be written in, likeliest first, and
    /// keep the best `limit` partial reads (5 by default in JavaScript).
    pub fn detect_language(&self, source: &str, limit: usize) -> Vec<Detection> {
        crate::detect::detect_language(self, source, limit)
    }

    /// Read a complete fragment: a whole program, function definitions or
    /// statements.
    pub fn parse_fragment(&self, source: &str, from: &str) -> Result<Fragment, GrammarError> {
        fragments::parse_fragment(self, source, from)
    }

    /// Translate a complete fragment into the same kind of fragment.
    pub fn translate_fragment(
        &self,
        source: &str,
        from: &str,
        to: &str,
        options: Options,
    ) -> Result<String, GrammarError> {
        fragments::translate_fragment(self, source, from, to, options)
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
