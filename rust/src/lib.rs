//! Translate admitted program forms through a concrete source and an effect network.

mod network;
mod profile;
mod referents;

use meta_language::{LinkId, LinkNetwork};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

pub use profile::{Form, Profile, language_profiles};
pub use referents::{Candidate, Observation, RankedCandidate, Ranking, rank_interpretations};

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(tag = "task", rename_all = "kebab-case")]
pub enum Effect {
    Hello { message: String },
    GreatestCommonDivisor { left: u32, right: u32 },
    FizzBuzz { limit: u32 },
}

impl Effect {
    pub fn task(&self) -> &'static str {
        match self {
            Self::Hello { .. } => "hello",
            Self::GreatestCommonDivisor { .. } => "greatest-common-divisor",
            Self::FizzBuzz { .. } => "fizz-buzz",
        }
    }

    fn fields(&self) -> Vec<(&'static str, String)> {
        match self {
            Self::Hello { message } => vec![("message", message.clone())],
            Self::GreatestCommonDivisor { left, right } => {
                vec![("left", left.to_string()), ("right", right.to_string())]
            }
            Self::FizzBuzz { limit } => vec![("limit", limit.to_string())],
        }
    }

    fn validate(&self) -> Result<(), String> {
        let valid = match self {
            Self::Hello { message } => {
                message.len() <= 96
                    && !message
                        .as_bytes()
                        .windows(3)
                        .any(|bytes| bytes.starts_with(b"??") && b"=/()!<>-".contains(&bytes[2]))
                    && message.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || b" ,.!?;:_+/()=<>-".contains(&byte)
                    })
            }
            Self::GreatestCommonDivisor { left, right } => {
                *left <= i32::MAX as u32 && *right <= i32::MAX as u32
            }
            Self::FizzBuzz { limit } => (1..=1000).contains(limit),
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
    verify: Box<Verifier>,
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
                let adapter: Box<dyn Adapter> =
                    Box::new(profile::ProfileAdapter::new(profile.clone()));
                (profile, adapter)
            })
            .collect();
        Self {
            languages,
            layers: Vec::new(),
            verify: Box::new(|expected, actual, _| Some(expected) == actual),
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
        self.verify = Box::new(verifier);
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
        let (_, adapter) = self.language(language)?;
        let interpretation = adapter.parse(source);
        let network = network::source_network(source, language, interpretation.as_ref());
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
        let actual = adapter.parse(&code);
        if !(self.verify)(
            &expression.effect,
            actual.as_ref().map(|value| &value.effect),
            expression,
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
        let expression = self.transform(&document, to, options)?;
        let restore_original = from == to
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
        Ok(self.translate_detailed(source, from, to, options)?.code)
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
