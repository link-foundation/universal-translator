//! Rules a user adds to the translation without writing code: plain data
//! that the command line accepts, written as indented Links Notation (JSON
//! is still read). Each list belongs to one stage of the pipeline:
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
//! As Links Notation a stage, a natural language and a template key are
//! unique, so each is written as `name:`; the rules of a stage are a list,
//! one rule per line, each a few `(field value)` links:
//!
//! ```text
//! source:
//!   (find colour) (replace color) (language english)
//! templates:
//!   english:
//!     print: 'Say {value}.'
//! names:
//!   (find x) (replace count)
//! ```
//!
//! The JavaScript twins are js/src/translation/custom-rules.js and
//! js/src/translation/rules-notation.js.

use std::collections::HashMap;
use std::sync::{Arc, LazyLock};

use links_notation::LiNo;
use regex::{NoExpand, Regex};
use serde_json::{Map, Value as Json};

use crate::meta::{Node, Rule, rewrite};
use crate::natural::{Language, with_templates};

/// The stages of the rules, in the order they are written.
pub const STAGES: [&str; 4] = ["source", "templates", "names", "output"];

type Link = LiNo<String>;

fn rule_fields(stage: &str) -> &'static [&'static str] {
    if stage == "names" {
        &["find", "replace"]
    } else {
        &["find", "replace", "regex", "language"]
    }
}

static PLAIN_WORD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[\p{L}\p{N}_.+*/<>=!?-]+$").expect("a valid pattern"));

/// A value as Links Notation: plain words stay plain, anything else is
/// quoted with ' (a ' inside is doubled).
pub fn lino_value(text: &str) -> String {
    if PLAIN_WORD.is_match(text) {
        text.to_owned()
    } else {
        format!("'{}'", text.replace('\'', "''"))
    }
}

fn word(link: &Link) -> Result<String, String> {
    match link {
        LiNo::Ref(text) => Ok(text.clone()),
        LiNo::Link { id, values } if values.is_empty() => Ok(id.clone().unwrap_or_default()),
        LiNo::Link { .. } => Err("Expected a word or a quoted text".into()),
    }
}

fn words(values: &[Link]) -> Result<Vec<String>, String> {
    values.iter().map(word).collect()
}

fn is_compound(link: &Link) -> bool {
    matches!(link, LiNo::Link { values, .. } if !values.is_empty())
}

/// One rule line: (find x) (replace y) ... A line of one link is read by
/// links-notation as that link itself.
fn read_rule(line: &Link, stage: &str, index: usize) -> Result<Json, String> {
    let place = format!("{stage} rule {}", index + 1);
    let links: Vec<&Link> = match line {
        LiNo::Link { values, .. } if values.iter().any(is_compound) => values.iter().collect(),
        _ => vec![line],
    };
    let allowed = rule_fields(stage);
    let mut rule = Map::new();
    for link in links {
        let mut parts = match link {
            LiNo::Link {
                id: Some(id),
                values,
            } => {
                let mut parts = vec![id.clone()];
                parts.extend(words(values)?);
                parts
            }
            LiNo::Link { id: None, values } => words(values)?,
            LiNo::Ref(text) => vec![text.clone()],
        }
        .into_iter();
        let field = parts.next().unwrap_or_default();
        let rest: Vec<String> = parts.collect();
        if !allowed.contains(&field.as_str()) {
            return Err(format!(
                "The {place} has no field \"{field}\"; use {}",
                allowed.join(", ")
            ));
        }
        if rule.contains_key(&field) {
            return Err(format!("The {place} has \"{field}\" twice"));
        }
        let [value] = rest.as_slice() else {
            return Err(format!("The {place} needs one value for \"{field}\""));
        };
        let value = if field == "regex" {
            match value.as_str() {
                "true" => Json::Bool(true),
                "false" => Json::Bool(false),
                other => {
                    return Err(format!(
                        "The {place} has \"regex\" {other}; use true or false"
                    ));
                }
            }
        } else {
            Json::String(value.clone())
        };
        rule.insert(field, value);
    }
    Ok(Json::Object(rule))
}

fn read_templates(values: &[Link]) -> Result<Json, String> {
    let mut templates = Map::new();
    for language in values {
        let (Some(id), keys) = (match language {
            LiNo::Link { id, values } => (id.as_ref(), values.as_slice()),
            LiNo::Ref(_) => (None, &[][..]),
        }) else {
            return Err("Templates are given once per natural language: \"english:\"".into());
        };
        if templates.contains_key(id) {
            return Err("Templates are given once per natural language: \"english:\"".into());
        }
        let mut variants = Map::new();
        for key in keys {
            let (Some(name), texts) = (match key {
                LiNo::Link { id, values } => (id.as_ref(), values.as_slice()),
                LiNo::Ref(_) => (None, &[][..]),
            }) else {
                return Err(format!(
                    "Templates of {id} are given once per key: \"print:\""
                ));
            };
            if variants.contains_key(name) {
                return Err(format!(
                    "Templates of {id} are given once per key: \"print:\""
                ));
            }
            let texts = words(texts)?.into_iter().map(Json::String).collect();
            variants.insert(name.clone(), Json::Array(texts));
        }
        templates.insert(id.clone(), Json::Object(variants));
    }
    Ok(Json::Object(templates))
}

/// Links Notation (or JSON) text -> the rules as data, as
/// `readRules` of the JavaScript library reads it.
pub fn read_rules(text: &str) -> Result<Json, String> {
    let source = text.trim();
    if source.is_empty() {
        return Ok(Json::Object(Map::new()));
    }
    if source.starts_with('{') {
        return serde_json::from_str(source).map_err(|error| error.to_string());
    }
    let links = links_notation::parse_lino_to_links(source).map_err(|error| error.to_string())?;
    let mut rules = Map::new();
    for link in &links {
        let (id, values) = match link {
            LiNo::Link { id, values } => (id.as_deref(), values.as_slice()),
            LiNo::Ref(id) => (Some(id.as_str()), &[][..]),
        };
        let Some(stage) = id.filter(|id| STAGES.contains(id)) else {
            let stages: Vec<String> = STAGES.iter().map(|stage| format!("{stage}:")).collect();
            return Err(format!(
                "Unknown rule stage \"{}\"; use {}",
                id.unwrap_or("(…)"),
                stages.join(", ")
            ));
        };
        if rules.contains_key(stage) {
            return Err(format!("The stage \"{stage}\" is given twice"));
        }
        let read = if stage == "templates" {
            read_templates(values)?
        } else {
            Json::Array(
                values
                    .iter()
                    .enumerate()
                    .map(|(index, line)| read_rule(line, stage, index))
                    .collect::<Result<_, _>>()?,
            )
        };
        rules.insert(stage.to_owned(), read);
    }
    Ok(Json::Object(rules))
}

fn rule_line(rule: &Json, stage: &str) -> String {
    let mut fields = vec![("find", rule.get("find").map(spelled).unwrap_or_default())];
    if let Some(replace) = rule.get("replace").filter(|replace| !replace.is_null()) {
        fields.push(("replace", spelled(replace)));
    }
    if stage != "names" && truthy(rule.get("regex")) {
        fields.push(("regex", "true".into()));
    }
    if stage != "names" && truthy(rule.get("language")) {
        fields.push((
            "language",
            rule.get("language").map(spelled).unwrap_or_default(),
        ));
    }
    let links: Vec<String> = fields
        .iter()
        .map(|(field, value)| format!("({field} {})", lino_value(value)))
        .collect();
    format!("  {}", links.join(" "))
}

/// The rules as data -> Links Notation text (empty when there are no
/// rules), as `formatRules` of the JavaScript library writes it.
pub fn format_rules(rules: &Json) -> String {
    let mut lines = Vec::new();
    for stage in STAGES {
        if stage == "templates" {
            let languages: Vec<(&String, &Map<String, Json>)> = rules
                .get("templates")
                .and_then(Json::as_object)
                .into_iter()
                .flatten()
                .filter_map(|(language, keys)| Some((language, keys.as_object()?)))
                .filter(|(_, keys)| !keys.is_empty())
                .collect();
            if !languages.is_empty() {
                lines.push("templates:".to_owned());
            }
            for (language, keys) in languages {
                lines.push(format!("  {language}:"));
                for (key, texts) in keys {
                    let texts: Vec<String> = match texts {
                        Json::Array(items) => items
                            .iter()
                            .map(|item| lino_value(&spelled(item)))
                            .collect(),
                        other => vec![lino_value(&spelled(other))],
                    };
                    lines.push(format!("    {key}: {}", texts.join(" ")));
                }
            }
        } else if let Some(list) = rules
            .get(stage)
            .and_then(Json::as_array)
            .filter(|list| !list.is_empty())
        {
            lines.push(format!("{stage}:"));
            lines.extend(list.iter().map(|rule| rule_line(rule, stage)));
        }
    }
    if lines.is_empty() {
        String::new()
    } else {
        format!("{}\n", lines.join("\n"))
    }
}

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

    /// Check rules written as indented Links Notation (or JSON) text.
    pub fn from_text(text: &str) -> Result<Self, String> {
        Self::from_value(&read_rules(text)?)
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
