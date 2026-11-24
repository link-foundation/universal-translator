//! Translate admitted program forms through a concrete source and an effect network.

pub mod common_library;
mod links;
mod meta;
mod network;
mod profile;
mod program;
mod referents;
mod source_document;

use meta_language::{LinkId, LinkNetwork, grammar_provenance};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::OnceLock;

pub use profile::{Form, Profile, language_profiles};
pub use program::translate_program;
pub use referents::{
    Candidate, Observation, RankedCandidate, Ranking, rank_interpretations, read_referent_input,
};
pub use source_document::SourceDocument;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(tag = "task", rename_all = "kebab-case")]
pub enum Effect {
    Hello { message: String },
    BrowserAlert { message: String },
    BrowserWrite { message: String },
    WriteText { message: String },
    WriteCrlf { message: String },
    EmptyProgram { status: u32 },
    IntegerSum { limit: u32 },
    IntegerSumOrUsage { limit: u32 },
    BrowserIntegerSum { limit: u32 },
    AckermannFunction { left: u32, right: u32 },
    AckermannCli { left: u32, right: u32 },
    AckermannJson { left: u32, right: u32 },
    AckermannValue { left: u32, right: u32 },
    GcdFunction { max: u32 },
    GreatestCommonDivisor { left: u32, right: u32 },
    FizzBuzz { limit: u32 },
    FizzBuzzFunction { limit: u32 },
    FizzBuzzLowercase { limit: u32 },
    FizzBuzzQuoted { limit: u32 },
    FizzBuzzLowercaseBlankLine { limit: u32 },
    FizzBuzzJoined { limit: u32, separator: u32 },
}

impl Effect {
    pub fn task(&self) -> &'static str {
        match self {
            Self::Hello { .. } => "hello",
            Self::BrowserAlert { .. } => "browser-alert",
            Self::BrowserWrite { .. } => "browser-write",
            Self::WriteText { .. } => "write-text",
            Self::WriteCrlf { .. } => "write-crlf",
            Self::EmptyProgram { .. } => "empty-program",
            Self::IntegerSum { .. } => "integer-sum",
            Self::IntegerSumOrUsage { .. } => "integer-sum-or-usage",
            Self::BrowserIntegerSum { .. } => "browser-integer-sum",
            Self::AckermannFunction { .. } => "ackermann-function",
            Self::AckermannCli { .. } => "ackermann-cli",
            Self::AckermannJson { .. } => "ackermann-json",
            Self::AckermannValue { .. } => "ackermann-value",
            Self::GcdFunction { .. } => "gcd-function",
            Self::GreatestCommonDivisor { .. } => "greatest-common-divisor",
            Self::FizzBuzz { .. } => "fizz-buzz",
            Self::FizzBuzzFunction { .. } => "fizz-buzz-function",
            Self::FizzBuzzLowercase { .. } => "fizz-buzz-lowercase",
            Self::FizzBuzzQuoted { .. } => "fizz-buzz-quoted",
            Self::FizzBuzzLowercaseBlankLine { .. } => "fizz-buzz-lowercase-blank-line",
            Self::FizzBuzzJoined { .. } => "fizz-buzz-joined",
        }
    }

    fn fields(&self) -> Vec<(&'static str, String)> {
        match self {
            Self::Hello { message }
            | Self::BrowserAlert { message }
            | Self::BrowserWrite { message }
            | Self::WriteText { message }
            | Self::WriteCrlf { message } => {
                vec![("message", message.clone())]
            }
            Self::GcdFunction { max } => vec![("max", max.to_string())],
            Self::EmptyProgram { status } => vec![("status", status.to_string())],
            Self::IntegerSum { limit }
            | Self::IntegerSumOrUsage { limit }
            | Self::BrowserIntegerSum { limit } => vec![("limit", limit.to_string())],
            Self::GreatestCommonDivisor { left, right }
            | Self::AckermannFunction { left, right }
            | Self::AckermannCli { left, right }
            | Self::AckermannJson { left, right }
            | Self::AckermannValue { left, right } => {
                vec![("left", left.to_string()), ("right", right.to_string())]
            }
            Self::FizzBuzz { limit }
            | Self::FizzBuzzFunction { limit }
            | Self::FizzBuzzLowercase { limit }
            | Self::FizzBuzzQuoted { limit }
            | Self::FizzBuzzLowercaseBlankLine { limit } => vec![("limit", limit.to_string())],
            Self::FizzBuzzJoined { limit, separator } => {
                vec![
                    ("limit", limit.to_string()),
                    ("separator", separator.to_string()),
                ]
            }
        }
    }

    fn from_fields(task: &str, fields: &BTreeMap<String, String>) -> Option<Self> {
        let integer = |name| {
            let text: &String = fields.get(name)?;
            let value: u32 = text.parse().ok()?;
            (value.to_string() == *text).then_some(value)
        };
        let effect = match task {
            "hello" if fields.len() == 1 => Self::Hello {
                message: fields.get("message")?.clone(),
            },
            "browser-alert" if fields.len() == 1 => Self::BrowserAlert {
                message: fields.get("message")?.clone(),
            },
            "browser-write" if fields.len() == 1 => Self::BrowserWrite {
                message: fields.get("message")?.clone(),
            },
            "write-text" if fields.len() == 1 => Self::WriteText {
                message: fields.get("message")?.clone(),
            },
            "write-crlf" if fields.len() == 1 => Self::WriteCrlf {
                message: fields.get("message")?.clone(),
            },
            "empty-program" if fields.len() == 1 => Self::EmptyProgram {
                status: integer("status")?,
            },
            "integer-sum" if fields.len() == 1 => Self::IntegerSum {
                limit: integer("limit")?,
            },
            "integer-sum-or-usage" if fields.len() == 1 => Self::IntegerSumOrUsage {
                limit: integer("limit")?,
            },
            "browser-integer-sum" if fields.len() == 1 => Self::BrowserIntegerSum {
                limit: integer("limit")?,
            },
            "gcd-function" if fields.len() == 1 => Self::GcdFunction {
                max: integer("max")?,
            },
            "ackermann-function" if fields.len() == 2 => Self::AckermannFunction {
                left: integer("left")?,
                right: integer("right")?,
            },
            "ackermann-cli" if fields.len() == 2 => Self::AckermannCli {
                left: integer("left")?,
                right: integer("right")?,
            },
            "ackermann-json" if fields.len() == 2 => Self::AckermannJson {
                left: integer("left")?,
                right: integer("right")?,
            },
            "ackermann-value" if fields.len() == 2 => Self::AckermannValue {
                left: integer("left")?,
                right: integer("right")?,
            },
            "greatest-common-divisor" if fields.len() == 2 => Self::GreatestCommonDivisor {
                left: integer("left")?,
                right: integer("right")?,
            },
            "fizz-buzz" if fields.len() == 1 => Self::FizzBuzz {
                limit: integer("limit")?,
            },
            "fizz-buzz-function" if fields.len() == 1 => Self::FizzBuzzFunction {
                limit: integer("limit")?,
            },
            "fizz-buzz-lowercase" if fields.len() == 1 => Self::FizzBuzzLowercase {
                limit: integer("limit")?,
            },
            "fizz-buzz-quoted" if fields.len() == 1 => Self::FizzBuzzQuoted {
                limit: integer("limit")?,
            },
            "fizz-buzz-lowercase-blank-line" if fields.len() == 1 => {
                Self::FizzBuzzLowercaseBlankLine {
                    limit: integer("limit")?,
                }
            }
            "fizz-buzz-joined" if fields.len() == 2 => Self::FizzBuzzJoined {
                limit: integer("limit")?,
                separator: integer("separator")?,
            },
            _ => return None,
        };
        effect.validate().ok()?;
        Some(effect)
    }

    /// Reads one or more typed effects from their Links Notation representation.
    pub fn read_links_notation(source: &str) -> Result<Vec<Self>, String> {
        let records =
            links_notation::parse_lino_to_links(source).map_err(|error| error.to_string())?;
        if records.is_empty() {
            return Err("Expected a Links Notation effect".into());
        }
        records
            .iter()
            .map(|link| {
                let (task, values) = links::named(link)?;
                let fields = links::fields(values)?
                    .into_iter()
                    .map(|(id, values)| Ok((id.into(), links::reference(values)?)))
                    .collect::<Result<_, String>>()?;
                Self::from_fields(task, &fields).ok_or_else(|| format!("Invalid {task} effect"))
            })
            .collect()
    }

    /// Writes the effect as a Links Notation expression usable by either implementation.
    pub fn to_links_notation(&self) -> String {
        links_notation::binary::format_document(&[links::record(self.task(), self.fields())])
    }

    fn validate(&self) -> Result<(), String> {
        let valid = match self {
            Self::Hello { message }
            | Self::BrowserAlert { message }
            | Self::BrowserWrite { message }
            | Self::WriteText { message }
            | Self::WriteCrlf { message } => {
                static MESSAGE: OnceLock<Regex> = OnceLock::new();
                message.len() <= 96
                    && !message
                        .as_bytes()
                        .windows(3)
                        .any(|bytes| bytes.starts_with(b"??") && b"=/()!<>-".contains(&bytes[2]))
                    && MESSAGE
                        .get_or_init(|| {
                            Regex::new(r"\A[ \p{L}\p{M}\p{N},.!?;:_+/()=<>'¡՛։、！-]*\z").unwrap()
                        })
                        .is_match(message)
            }
            Self::GreatestCommonDivisor { left, right } => {
                *left <= i32::MAX as u32 && *right <= i32::MAX as u32
            }
            Self::GcdFunction { max } => *max == i32::MAX as u32,
            Self::AckermannFunction { left, right } | Self::AckermannCli { left, right } => {
                *left == 3 && *right == 4
            }
            Self::AckermannJson { left, right } => *left == 3 && *right == 3,
            Self::AckermannValue { left, right } => *left == 3 && *right <= 4,
            Self::EmptyProgram { status } => *status == 0,
            Self::IntegerSum { limit }
            | Self::IntegerSumOrUsage { limit }
            | Self::BrowserIntegerSum { limit } => *limit == 1000,
            Self::FizzBuzz { limit }
            | Self::FizzBuzzFunction { limit }
            | Self::FizzBuzzLowercase { limit }
            | Self::FizzBuzzQuoted { limit }
            | Self::FizzBuzzLowercaseBlankLine { limit } => (1..=1000).contains(limit),
            Self::FizzBuzzJoined { limit, separator } => {
                (1..=1000).contains(limit) && matches!(separator, 10 | 32)
            }
        };
        valid
            .then_some(())
            .ok_or_else(|| "Effect is outside the supported task domain".into())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Placement {
    Leading,
    Body,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Comment {
    pub text: String,
    pub placement: Placement,
    pub line: usize,
}

#[derive(Clone, Debug)]
pub struct Interpretation {
    pub effect: Effect,
    pub form: String,
    pub comments: Vec<Comment>,
    pub output: String,
    pub requires: Vec<String>,
}

pub struct Document {
    pub language: String,
    pub network: LinkNetwork,
    pub interpretation: Option<Interpretation>,
}

impl Document {
    pub fn restore(&self) -> String {
        self.network.reconstruct_text()
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Mode {
    #[default]
    ContextDependent,
    Literal,
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

#[derive(Clone, Debug, Default)]
pub struct Options<'a> {
    pub mode: Mode,
    pub form: Option<&'a str>,
}

pub struct Expression {
    pub language: String,
    pub effect: Effect,
    pub comments: Vec<Comment>,
    pub form: String,
    pub network: LinkNetwork,
    pub id: LinkId,
}

impl Expression {
    pub fn new(language: impl Into<String>, effect: Effect) -> Result<Self, String> {
        effect.validate()?;
        let mut network = LinkNetwork::new();
        let id = network::insert_effect(&mut network, &effect);
        Ok(Self {
            language: language.into(),
            effect,
            comments: Vec::new(),
            form: "standard".into(),
            network,
            id,
        })
    }

    fn rebuild_network(&mut self) {
        self.network = LinkNetwork::new();
        self.id = network::insert_effect(&mut self.network, &self.effect);
    }
}

pub struct Translation {
    pub code: String,
    pub document: Document,
    pub expression: Expression,
}

pub trait Adapter: Send + Sync {
    fn parse(&self, source: &str) -> Option<Interpretation>;
    fn emit(&self, expression: &Expression) -> Result<String, String>;
}

pub type Rule = Box<dyn Fn(&mut Expression, &Document, Mode) -> Result<(), String> + Send + Sync>;
type Verifier = dyn Fn(&Effect, Option<&Effect>, &Expression) -> bool + Send + Sync;

pub struct Translator {
    languages: Vec<(Profile, Box<dyn Adapter>)>,
    layers: Vec<Vec<Rule>>,
    verify: Option<Box<Verifier>>,
}

impl Default for Translator {
    fn default() -> Self {
        Self::with_profiles(language_profiles())
    }
}

impl Translator {
    pub fn with_profiles(profiles: Vec<Profile>) -> Self {
        let languages = profiles
            .into_iter()
            .map(|profile| {
                let adapter: Box<dyn Adapter> = if profile.kind == "meta-language" {
                    Box::new(meta::MetaAdapter)
                } else {
                    Box::new(profile::ProfileAdapter::new(profile.clone()))
                };
                (profile, adapter)
            })
            .collect();
        Self {
            languages,
            layers: Vec::new(),
            verify: None,
        }
    }

    pub fn profiles(&self) -> impl Iterator<Item = &Profile> {
        self.languages.iter().map(|(profile, _)| profile)
    }

    pub fn decorate_adapter(
        &mut self,
        language: &str,
        decorate: impl FnOnce(Box<dyn Adapter>) -> Box<dyn Adapter>,
    ) -> Result<(), String> {
        let index = self
            .languages
            .iter()
            .position(|(profile, _)| profile.id == language)
            .ok_or_else(|| format!(r#"Unsupported language "{language}""#))?;
        let (profile, adapter) = self.languages.remove(index);
        self.languages.insert(index, (profile, decorate(adapter)));
        Ok(())
    }

    pub fn set_verifier(
        &mut self,
        verifier: impl Fn(&Effect, Option<&Effect>, &Expression) -> bool + Send + Sync + 'static,
    ) {
        self.verify = Some(Box::new(verifier));
    }

    pub fn add_layer(&mut self, rules: Vec<Rule>) {
        self.layers.push(rules);
    }

    fn language(&self, id: &str) -> Result<&(Profile, Box<dyn Adapter>), String> {
        self.languages
            .iter()
            .find(|(profile, _)| profile.id == id)
            .ok_or_else(|| format!(r#"Unsupported language "{id}""#))
    }

    pub fn parse(&self, source: &str, language: &str) -> Result<Document, String> {
        let (profile, adapter) = self.language(language)?;
        let grammar_id = if language == "sqlite" {
            "sql-sqlite"
        } else {
            language
        };
        let grammar = (profile.kind == "programming")
            .then(|| [grammar_id, profile.label.as_str()])
            .into_iter()
            .flatten()
            .find(|name| !grammar_provenance(name).is_empty());
        let (network, interpretation) = if let Some(grammar) = grammar {
            let mut network = source_document::parse_syntax(source, grammar)?;
            let root = source_document::syntax_root(&network, grammar)
                .ok_or_else(|| format!("Expected a grammar document for {grammar}"))?;
            let interpretation = adapter.parse(&network.reconstruct_text());
            network::bind_source(&mut network, language, interpretation.as_ref(), root);
            (network, interpretation)
        } else {
            let interpretation = adapter.parse(source);
            let network = network::source_network(source, language, interpretation.as_ref());
            (network, interpretation)
        };
        Ok(Document {
            language: language.into(),
            network,
            interpretation,
        })
    }

    pub fn transform(
        &self,
        document: &Document,
        target: &str,
        options: &Options<'_>,
    ) -> Result<Expression, String> {
        let (source, _) = self.language(&document.language)?;
        let (target_profile, _) = self.language(target)?;
        let interpretation = document
            .interpretation
            .as_ref()
            .ok_or_else(|| format!("Unsupported program for {}", document.language))?;
        let mut expression = Expression::new(target, interpretation.effect.clone())?;
        if let Some(form) = options.form {
            expression.form = form.into();
        } else if document.language == target && options.mode != Mode::SameEffect {
            expression.form = interpretation.form.clone();
        }
        if options.mode != Mode::SameEffect {
            expression.comments = interpretation.comments.clone();
        }
        if options.mode == Mode::ContextDependent && document.language != target {
            for comment in &mut expression.comments {
                adapt_comment(comment, source, target_profile);
            }
        }
        for layer in &self.layers {
            for rule in layer {
                rule(&mut expression, document, options.mode)?;
            }
        }
        expression.effect.validate()?;
        if options.mode == Mode::SameEffect && expression.effect != interpretation.effect {
            return Err("A translation rule changed the source effect in same-effect mode".into());
        }
        if expression.language != target {
            return Err("A translation rule changed the requested target language".into());
        }
        expression.rebuild_network();
        network::bind_target(&mut expression, target_profile);
        Ok(expression)
    }

    pub fn materialize(&self, expression: &Expression) -> Result<String, String> {
        expression.effect.validate()?;
        let (_, adapter) = self.language(&expression.language)?;
        let code = adapter.emit(expression)?;
        let parsed = adapter.parse(&code);
        let actual = parsed.as_ref().map(|value| &value.effect);
        let expected = &expression.effect;
        if !self.verify.as_ref().map_or_else(
            || Some(expected) == actual,
            |verify| verify(expected, actual, expression),
        ) {
            return Err(format!(
                "Emitted program failed the effect round trip for {}",
                expression.language
            ));
        }
        Ok(code)
    }

    pub fn translate_detailed(
        &self,
        source: &str,
        from: &str,
        to: &str,
        options: &Options<'_>,
    ) -> Result<Translation, String> {
        let document = self.parse(source, from)?;
        self.translate_document(document, to, options)
    }

    fn translate_document(
        &self,
        document: Document,
        to: &str,
        options: &Options<'_>,
    ) -> Result<Translation, String> {
        let expression = self.transform(&document, to, options)?;
        let restore_original = document.language == to
            && options.mode != Mode::SameEffect
            && options.form.is_none()
            && self.layers.is_empty();
        let code = if restore_original {
            document.restore()
        } else {
            self.materialize(&expression)?
        };
        Ok(Translation {
            code,
            document,
            expression,
        })
    }

    pub fn translate(
        &self,
        source: &str,
        from: &str,
        to: &str,
        options: &Options<'_>,
    ) -> Result<String, String> {
        let document = self.parse(source, from)?;
        if document.interpretation.is_none()
            && options.mode == Mode::SameEffect
            && options.form.is_none()
            && self.layers.is_empty()
            && self.verify.is_none()
            && matches!((from, to), ("javascript", "rust") | ("rust", "javascript"))
        {
            self.language(to)?;
            return program::translate_syntax(&document.network, from, to);
        }
        Ok(self.translate_document(document, to, options)?.code)
    }
}

fn adapt_comment(comment: &mut Comment, source: &Profile, target: &Profile) {
    for prefix in ["Hello World in ", "Hello world in ", "Hello, World! in "] {
        if comment.text.strip_prefix(prefix) == Some(&source.label) {
            comment.text = format!("{prefix}{}", target.label);
            return;
        }
    }
    let pattern = format!(r"(?-u:\b){}(?-u:\b)", regex::escape(&source.call));
    let pattern = regex::Regex::new(&pattern).expect("escaped call terminology");
    comment.text = pattern
        .replace_all(&comment.text, regex::NoExpand(&target.call))
        .into_owned();
}

pub fn translate(source: &str, from: &str, to: &str) -> Result<String, String> {
    static TRANSLATOR: OnceLock<Translator> = OnceLock::new();
    TRANSLATOR
        .get_or_init(Translator::default)
        .translate(source, from, to, &Options::default())
}
