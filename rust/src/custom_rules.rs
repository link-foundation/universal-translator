//! Rules a user adds to the translation without writing code: plain data
//! (JSON) that the command line accepts. Each list belongs to one stage of
//! the pipeline:
//!
//! ```text
//! source     text -> text before the source is read
//! templates  more wordings a natural language reads, per template key
//! names      meta -> meta: renames of variables and functions
//! output     text -> text after the target is written
//! ```
//!
//! A text rule is `{ find, replace, regex?, language? }`: `find` is plain
//! text unless `regex` is true, and `language` limits the rule to one
//! source (source rules) or target (output rules) language. A name rule is
//! `{ find, replace }`. Templates map a language to `{ key: [templates] }`.
//!
//! The JavaScript twin is js/src/translation/custom-rules.js.

use std::collections::HashMap;
use std::sync::Arc;

use regex::{NoExpand, Regex};
use serde_json::Value as Json;

use crate::meta::{Node, Rule, rewrite};
use crate::natural::{Language, with_templates};

const STAGES: [&str; 4] = ["source", "templates", "names", "output"];

/// A JavaScript regular expression (with the `u` flag) for the regex
/// crate: `\b`, `\w` and `\d` stay ASCII as they are in JavaScript.
pub(crate) fn js_regex(pattern: &str) -> Result<Regex, regex::Error> {
    let mut result = String::new();
    let mut in_class = false;
    let mut characters = pattern.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '\\' => match characters.next() {
                Some('b') if in_class => result.push_str("\\x08"),
                Some('b') => result.push_str("(?-u:\\b)"),
                Some('B') => result.push_str("(?-u:\\B)"),
                Some('w') => result.push_str("[0-9A-Za-z_]"),
                Some('W') => result.push_str("[^0-9A-Za-z_]"),
                Some('d') => result.push_str("[0-9]"),
                Some('D') => result.push_str("[^0-9]"),
                Some(other) => {
                    result.push('\\');
                    result.push(other);
                }
                None => result.push('\\'),
            },
            '[' if !in_class => {
                in_class = true;
                result.push('[');
                if characters.peek() == Some(&'^') {
                    result.push('^');
                    characters.next();
                }
            }
            '[' => result.push_str("\\["),
            ']' if in_class => {
                in_class = false;
                result.push(']');
            }
            other => result.push(other),
        }
    }
    Regex::new(&result)
}

/// A JavaScript replacement text (`$1`, `$&`, `$<name>`, `$$`) for the
/// regex crate.
fn js_replacement(replace: &str) -> String {
    let mut result = String::new();
    let mut characters = replace.chars().peekable();
    while let Some(character) = characters.next() {
        if character != '$' {
            result.push(character);
            continue;
        }
        match characters.peek().copied() {
            Some('$') => {
                characters.next();
                result.push_str("$$");
            }
            Some('&') => {
                characters.next();
                result.push_str("${0}");
            }
            Some(digit) if digit.is_ascii_digit() => {
                let mut group = String::new();
                while let Some(digit) = characters.peek().filter(|c| c.is_ascii_digit()) {
                    group.push(*digit);
                    characters.next();
                    if group.len() == 2 {
                        break;
                    }
                }
                result.push_str(&format!("${{{group}}}"));
            }
            Some('<') => {
                let rest: String = characters.clone().collect();
                match rest.find('>') {
                    Some(end) => {
                        result.push_str(&format!("${{{}}}", &rest[1..end]));
                        for _ in 0..rest[..=end].chars().count() {
                            characters.next();
                        }
                    }
                    None => result.push_str("$$"),
                }
            }
            _ => result.push_str("$$"),
        }
    }
    result
}

/// JavaScript truthiness of a JSON value.
fn truthy(value: Option<&Json>) -> bool {
    match value {
        None | Some(Json::Null) => false,
        Some(Json::Bool(flag)) => *flag,
        Some(Json::Number(number)) => number.as_f64().is_some_and(|n| n != 0.0),
        Some(Json::String(text)) => !text.is_empty(),
        Some(_) => true,
    }
}

/// A JSON value as JavaScript's `String(value)` spells it.
fn spelled(value: &Json) -> String {
    match value {
        Json::String(text) => text.clone(),
        other => other.to_string(),
    }
}

#[derive(Clone, Debug)]
struct TextRule {
    language: Option<String>,
    pattern: Regex,
    replace: String,
    regex: bool,
}

impl TextRule {
    fn compile(rule: &Json, stage: &str, index: usize) -> Result<Self, String> {
        let place = format!("{stage} rule {}", index + 1);
        let Some(find) = rule.as_object().and_then(|rule| rule.get("find")?.as_str()) else {
            return Err(format!("The {place} needs a \"find\" text"));
        };
        if find.is_empty() {
            return Err(format!("The {place} has an empty \"find\" text"));
        }
        let replace = match rule.get("replace") {
            None | Some(Json::Null) => String::new(),
            Some(Json::String(text)) => text.clone(),
            Some(_) => return Err(format!("The {place} needs a \"replace\" text")),
        };
        let regex = truthy(rule.get("regex"));
        let pattern = if regex {
            js_regex(find)
        } else {
            Regex::new(&regex::escape(find))
        }
        .map_err(|error| format!("The {place} is not a regular expression: {error}"))?;
        let language = rule
            .get("language")
            .filter(|language| truthy(Some(language)))
            .map(spelled);
        Ok(TextRule {
            language,
            pattern,
            replace,
            regex,
        })
    }

    fn apply(&self, text: &str) -> String {
        if self.regex {
            self.pattern
                .replace_all(text, js_replacement(&self.replace).as_str())
                .into_owned()
        } else {
            // A plain rule replaces literally, without "$1" substitutions.
            self.pattern
                .replace_all(text, NoExpand(&self.replace))
                .into_owned()
        }
    }
}

fn apply_text(rules: &[TextRule], text: &str, language: &str) -> String {
    rules
        .iter()
        .filter(|rule| rule.language.as_deref().is_none_or(|only| only == language))
        .fold(text.to_owned(), |current, rule| rule.apply(&current))
}

/// Checked rules as data, turned into the hooks the translator calls.
#[derive(Clone, Debug, Default)]
pub struct CustomRules {
    source: Vec<TextRule>,
    output: Vec<TextRule>,
    languages: HashMap<String, Arc<Language>>,
    names: Vec<(String, String)>,
}

impl CustomRules {
    /// Check rules written as JSON text.
    pub fn from_json(text: &str) -> Result<Self, String> {
        let value: Json = serde_json::from_str(text).map_err(|error| error.to_string())?;
        Self::from_value(&value)
    }

    /// Check a rule set and compile it.
    pub fn from_value(rules: &Json) -> Result<Self, String> {
        let Some(rules) = rules.as_object() else {
            return Err("Rules must be an object".into());
        };
        if let Some(key) = rules.keys().find(|key| !STAGES.contains(&key.as_str())) {
            return Err(format!(
                "Unknown rule stage \"{key}\"; use {}",
                STAGES.join(", ")
            ));
        }
        let list = |stage: &str| -> Result<Vec<Json>, String> {
            match rules.get(stage) {
                None | Some(Json::Null) => Ok(Vec::new()),
                Some(Json::Array(items)) => Ok(items.clone()),
                Some(_) => Err(format!("\"{stage}\" rules must be a list")),
            }
        };
        let text_rules = |stage: &str| -> Result<Vec<TextRule>, String> {
            list(stage)?
                .iter()
                .enumerate()
                .map(|(index, rule)| TextRule::compile(rule, stage, index))
                .collect()
        };
        let source = text_rules("source")?;
        let output = text_rules("output")?;
        let entries: Vec<(String, Json)> = match rules.get("templates") {
            Some(Json::Object(map)) => map.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
            Some(Json::Array(items)) => items
                .iter()
                .enumerate()
                .map(|(index, value)| (index.to_string(), value.clone()))
                .collect(),
            _ => Vec::new(),
        };
        let mut languages = HashMap::new();
        for (id, variants) in entries {
            let templates: Vec<(String, Vec<String>)> = variants
                .as_object()
                .map(|map| {
                    map.iter()
                        .map(|(key, value)| {
                            let list = match value {
                                Json::Array(items) => items.iter().map(spelled).collect(),
                                other => vec![spelled(other)],
                            };
                            (key.clone(), list)
                        })
                        .collect()
                })
                .unwrap_or_default();
            languages.insert(id.clone(), Arc::new(with_templates(&id, &templates)?));
        }
        let names = list("names")?
            .iter()
            .enumerate()
            .map(|(index, rule)| {
                let find = rule
                    .get("find")
                    .and_then(Json::as_str)
                    .filter(|find| !find.is_empty());
                match (find, rule.get("replace")) {
                    (Some(find), Some(replace)) if truthy(Some(replace)) => {
                        Ok((find.to_owned(), spelled(replace)))
                    }
                    _ => Err(format!(
                        "The names rule {} needs \"find\" and \"replace\"",
                        index + 1
                    )),
                }
            })
            .collect::<Result<_, _>>()?;
        Ok(CustomRules {
            source,
            output,
            languages,
            names,
        })
    }

    /// Whether the rules change nothing.
    pub fn is_empty(&self) -> bool {
        self.source.is_empty()
            && self.output.is_empty()
            && self.languages.is_empty()
            && self.names.is_empty()
    }

    /// The source text after the source rules of its language.
    pub fn source(&self, text: &str, from: &str) -> String {
        apply_text(&self.source, text, from)
    }

    /// The target text after the output rules of its language.
    pub fn output(&self, text: &str, to: &str) -> String {
        apply_text(&self.output, text, to)
    }

    /// The natural language with the added templates, when there are any.
    pub fn natural_language(&self, id: &str) -> Option<&Language> {
        self.languages.get(id).map(Arc::as_ref)
    }

    /// The meta layers of the name rules.
    pub fn layers(&self) -> Vec<Vec<Rule>> {
        if self.names.is_empty() {
            return Vec::new();
        }
        let renames: Arc<HashMap<String, String>> = Arc::new(self.names.iter().cloned().collect());
        let rename_node = move |mut node: Node| {
            for key in ["name", "variable", "callee"] {
                let renamed = node.str(key).and_then(|value| renames.get(value)).cloned();
                if let Some(renamed) = renamed {
                    node.set(key, renamed);
                }
            }
            node
        };
        vec![vec![Rule {
            name: "names".into(),
            apply: Arc::new(move |tree, _| rewrite(tree, rename_node.clone())),
        }]]
    }
}
