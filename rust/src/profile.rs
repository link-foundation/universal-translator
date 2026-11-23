use crate::links::{self, Link};
use crate::{Adapter, Comment, Effect, Expression, Interpretation, Placement};
use regex::Regex;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::sync::OnceLock;

const REGISTRIES: &[&str] = &[
    include_str!("../../src/translation/data/01-systems.lino"),
    include_str!("../../src/translation/data/02-managed.lino"),
    include_str!("../../src/translation/data/03-scripts.lino"),
    include_str!("../../src/translation/data/04-machine.lino"),
    include_str!("../../src/translation/data/05-programming-languages.lino"),
    include_str!("../../src/translation/data/06-programming-languages.lino"),
    include_str!("../../src/translation/data/07-natural-languages.lino"),
    include_str!("../../src/translation/data/08-meta-language.lino"),
];

fn programming_kind() -> String {
    "programming".into()
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub label: String,
    #[serde(default = "programming_kind")]
    pub kind: String,
    pub comment: String,
    pub comment_end: Option<String>,
    #[serde(default)]
    pub header: usize,
    #[serde(default)]
    pub unicode_greeting: bool,
    pub call: String,
    pub output: String,
    pub forms: Vec<Form>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Form {
    pub task: String,
    pub name: String,
    pub source: Vec<String>,
    pub fixed: Option<BTreeMap<String, String>>,
    pub requires: Option<Vec<String>>,
    pub output: Option<String>,
}

impl Form {
    fn from_link(link: &Link, kind: &str) -> Result<Self, String> {
        let fields = links::fields(links::children(link, "form")?)?;
        let source = if kind == "meta-language" {
            Vec::new()
        } else {
            links::elements(&fields, "source")?
                .iter()
                .map(|line| links::reference(links::children(line, "line")?))
                .collect::<Result<_, _>>()?
        };
        let fixed = fields
            .get("fixed")
            .map(|values| {
                links::fields(values)?
                    .into_iter()
                    .map(|(name, value)| Ok((name.into(), links::reference(value)?)))
                    .collect::<Result<_, String>>()
            })
            .transpose()?;
        Ok(Self {
            task: links::value(&fields, "task")?,
            name: links::value(&fields, "name")?,
            source,
            fixed,
            requires: fields
                .get("requires")
                .map(|values| links::references(values))
                .transpose()?,
            output: fields
                .get("output")
                .map(|values| links::reference(values))
                .transpose()?,
        })
    }
}

impl Profile {
    fn from_link(link: &Link) -> Result<Self, String> {
        let fields = links::fields(links::children(link, "profile")?)?;
        let kind = fields
            .get("kind")
            .map(|values| links::reference(values))
            .transpose()?
            .unwrap_or_else(programming_kind);
        let forms = links::elements(&fields, "forms")?
            .iter()
            .map(|form| Form::from_link(form, &kind))
            .collect::<Result<_, _>>()?;
        Ok(Self {
            id: links::value(&fields, "id")?,
            label: links::value(&fields, "label")?,
            kind,
            comment: links::value(&fields, "comment")?,
            comment_end: fields
                .get("commentEnd")
                .map(|values| links::reference(values))
                .transpose()?,
            header: fields
                .get("header")
                .map(|values| {
                    links::reference(values)?
                        .parse()
                        .map_err(|_| "Invalid header length".to_owned())
                })
                .transpose()?
                .unwrap_or_default(),
            unicode_greeting: fields
                .get("unicodeGreeting")
                .map(|values| {
                    links::reference(values)?
                        .parse()
                        .map_err(|_| "Invalid unicodeGreeting flag".to_owned())
                })
                .transpose()?
                .unwrap_or_default(),
            call: links::value(&fields, "call")?,
            output: links::value(&fields, "output")?,
            forms,
        })
    }
}

pub fn language_profiles() -> Vec<Profile> {
    static PROFILES: OnceLock<Vec<Profile>> = OnceLock::new();
    PROFILES
        .get_or_init(|| {
            REGISTRIES
                .iter()
                .flat_map(|registry| {
                    links_notation::parse_lino_to_links(registry)
                        .expect("valid bundled Links Notation registry")
                })
                .map(|link| {
                    Profile::from_link(&link).unwrap_or_else(|error| {
                        let id = links::children(&link, "profile")
                            .ok()
                            .and_then(|children| children.first())
                            .map(|element| format!("{element:?}"));
                        panic!("Invalid bundled translation profile {id:?}: {error}")
                    })
                })
                .collect()
        })
        .clone()
}

fn slots() -> &'static Regex {
    static SLOTS: OnceLock<Regex> = OnceLock::new();
    SLOTS.get_or_init(|| Regex::new(r"\{\{([a-z]+)\}\}").unwrap())
}

fn flag_comment_control(character: char) -> bool {
    character <= '\u{001f}'
        || matches!(character, '\u{007f}' | '\u{0085}' | '\u{2028}' | '\u{2029}')
}

fn safe_comment(profile: &Profile, text: &str) -> bool {
    !text.chars().any(flag_comment_control)
        && !text.ends_with(['\r', '\n', '\\'])
        && !text.ends_with("??/")
        && !profile
            .comment_end
            .as_ref()
            .is_some_and(|end| text.contains(&profile.comment) || text.contains(end))
        && !(profile.id == "ocaml" && text.contains('"'))
        && !(profile.id == "xslt" && text.contains("--"))
        && !(profile.id == "php" && text.contains("?>"))
        && !(profile.id == "python" && (text.contains("coding:") || text.contains("coding=")))
}

fn comment_directive(profile: &Profile, line: &str) -> bool {
    static GO_DIRECTIVE: OnceLock<Regex> = OnceLock::new();
    static LUA_BLOCK: OnceLock<Regex> = OnceLock::new();
    static POWERSHELL_DIRECTIVE: OnceLock<Regex> = OnceLock::new();
    static RUBY_DIRECTIVE: OnceLock<Regex> = OnceLock::new();
    let content = line.trim_start_matches([' ', '\t']);
    match profile.id.as_str() {
        "java" => content.contains("\\u"),
        "go" => GO_DIRECTIVE
            .get_or_init(|| Regex::new(r"^(?://go:|//[ \t]*\+build\b|//line\b|/\*line\b)").unwrap())
            .is_match(content),
        "lua" => LUA_BLOCK
            .get_or_init(|| Regex::new(r"^--\[=*\[").unwrap())
            .is_match(content),
        "julia" => content.starts_with("#="),
        "nim" => content.starts_with("#[") || content.starts_with("##["),
        "raku" => content.starts_with("#`"),
        "powershell" => POWERSHELL_DIRECTIVE
            .get_or_init(|| Regex::new(r"(?i)^#requires\b").unwrap())
            .is_match(content),
        "ruby" => RUBY_DIRECTIVE
            .get_or_init(|| {
                Regex::new(
                    r"(?:coding|frozen_string_literal|warn_indent|shareable_constant_value)\s*:",
                )
                .unwrap()
            })
            .is_match(content),
        _ => false,
    }
}

fn comment_text<'a>(profile: &Profile, line: &'a str) -> Option<&'a str> {
    let trimmed = line.trim_start_matches([' ', '\t']);
    let supports_c_block = matches!(
        profile.id.as_str(),
        "c" | "cpp"
            | "csharp"
            | "go"
            | "java"
            | "javascript"
            | "kotlin"
            | "php"
            | "rust"
            | "swift"
            | "typescript"
    );
    if supports_c_block && trimmed.starts_with("/*") && trimmed.ends_with("*/") {
        let text = trimmed.strip_prefix("/*")?.strip_suffix("*/")?;
        return (!text.contains("/*") && !text.contains("*/")).then_some(text.trim());
    }
    if trimmed.starts_with("#!") {
        return None;
    }
    let text = trimmed.strip_prefix(&profile.comment)?;
    Some(match &profile.comment_end {
        Some(end) => text.strip_suffix(end)?.trim(),
        None => text.trim(),
    })
}

struct CompiledForm {
    form: Form,
    fields: Vec<String>,
    parts: Vec<String>,
    single_quoted_message: bool,
}

impl CompiledForm {
    fn new(form: Form) -> Self {
        let pattern = form
            .source
            .iter()
            .map(|line| line.trim_end_matches([' ', '\t']))
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        Self {
            fields: slots()
                .captures_iter(&pattern)
                .map(|capture| capture[1].to_owned())
                .collect(),
            parts: slots().split(&pattern).map(str::to_owned).collect(),
            single_quoted_message: pattern.contains("'{{message}}"),
            form,
        }
    }

    fn fixed_effect(&self) -> Option<Effect> {
        self.form
            .fixed
            .as_ref()
            .and_then(|fields| Effect::from_fields(&self.form.task, fields))
    }

    fn read(&self, source: &str) -> Option<Effect> {
        let mut remainder = source.strip_prefix(&self.parts[0])?;
        let mut values = self.form.fixed.clone().unwrap_or_default();
        for (field, next) in self.fields.iter().zip(self.parts.iter().skip(1)) {
            let (value, after) = if next.is_empty() {
                (remainder, "")
            } else {
                remainder.split_once(next)?
            };
            if let Some(previous) = values.insert(field.clone(), value.to_owned()) {
                if previous != value {
                    return None;
                }
            }
            remainder = after;
        }
        if !remainder.is_empty() {
            return None;
        }
        Effect::from_fields(&self.form.task, &values)
    }
}

pub(crate) struct ProfileAdapter {
    profile: Profile,
    forms: Vec<CompiledForm>,
    default_requirements: Vec<String>,
}

impl ProfileAdapter {
    pub(crate) fn new(profile: Profile) -> Self {
        let default_requirements = profile
            .forms
            .iter()
            .find(|form| form.task == "hello" && form.name == "standard")
            .and_then(|form| form.requires.clone())
            .unwrap_or_default();
        let forms = profile
            .forms
            .iter()
            .cloned()
            .map(CompiledForm::new)
            .collect();
        Self {
            profile,
            forms,
            default_requirements,
        }
    }

    fn supports_effect(&self, form: &CompiledForm, effect: &Effect) -> bool {
        if let Effect::Hello { message } = effect {
            let apostrophe = message.contains('\'');
            if apostrophe || !message.is_ascii() {
                return (self.profile.kind == "natural-language" || self.profile.unicode_greeting)
                    && !(form.single_quoted_message && apostrophe);
            }
        }
        true
    }

    fn make_comments(
        &self,
        comments: &[Comment],
        placement: Placement,
    ) -> Result<Vec<String>, String> {
        comments
            .iter()
            .filter(|comment| comment.placement == placement)
            .map(|comment| {
                let text = comment.text.as_str();
                if !safe_comment(&self.profile, text) || text.trim() != text {
                    return Err(
                        "Comment cannot be represented safely in the target language".into(),
                    );
                }
                let line = [
                    Some(self.profile.comment.as_str()),
                    Some(text),
                    self.profile.comment_end.as_deref(),
                ]
                .into_iter()
                .flatten()
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(" ");
                if comment_directive(&self.profile, &line) {
                    return Err(
                        "Comment cannot be represented safely in the target language".into(),
                    );
                }
                Ok(line)
            })
            .collect()
    }
}

impl Adapter for ProfileAdapter {
    fn parse(&self, source: &str) -> Option<Interpretation> {
        let profile = &self.profile;
        if profile.id == "php" && !source.starts_with("<?php\n") && !source.starts_with("<?php\r\n")
        {
            return None;
        }
        let mut code = Vec::new();
        let mut comments = Vec::new();
        for (index, line) in source.lines().enumerate() {
            let trimmed = line.trim_end_matches([' ', '\t']);
            if let Some(text) = comment_text(profile, trimmed) {
                if !safe_comment(profile, text)
                    || comment_directive(profile, trimmed)
                    || trimmed
                        .trim_start_matches([' ', '\t'])
                        .chars()
                        .any(flag_comment_control)
                {
                    return None;
                }
                let placement = if code.len() <= profile.header {
                    Placement::Leading
                } else {
                    Placement::Body
                };
                comments.push(Comment {
                    text: text.to_owned(),
                    placement,
                    line: index,
                });
            } else if !trimmed.is_empty() {
                code.push(trimmed);
            }
        }
        let normalized = code.join("\n");
        self.forms.iter().find_map(|compiled| {
            let form = &compiled.form;
            let effect = compiled.read(&normalized)?;
            if !self.supports_effect(compiled, &effect) {
                return None;
            }
            Some(Interpretation {
                effect,
                form: form.name.clone(),
                comments: comments.clone(),
                output: form.output.as_ref().unwrap_or(&profile.output).clone(),
                requires: form
                    .requires
                    .as_ref()
                    .unwrap_or(&self.default_requirements)
                    .clone(),
            })
        })
    }

    fn emit(&self, expression: &Expression) -> Result<String, String> {
        let profile = &self.profile;
        let effect = &expression.effect;
        let task = effect.task();
        let reject = || {
            format!(
                r#"Unsupported {task} effect or form "{}" for {}"#,
                expression.form, profile.id
            )
        };
        let compiled = self
            .forms
            .iter()
            .find(|candidate| candidate.form.task == task && candidate.form.name == expression.form)
            .ok_or_else(reject)?;
        if !self.supports_effect(compiled, effect)
            || (compiled.form.fixed.is_some() && compiled.fixed_effect().as_ref() != Some(effect))
        {
            return Err(reject());
        }
        let form = &compiled.form;
        let values = effect.fields();
        let mut lines: Vec<String> = form
            .source
            .iter()
            .map(|line| {
                slots()
                    .replace_all(line, |captures: &regex::Captures| {
                        values
                            .iter()
                            .find(|(name, _)| *name == &captures[1])
                            .map(|(_, value)| value.clone())
                            .unwrap_or_default()
                    })
                    .into_owned()
            })
            .collect();
        let body = self.make_comments(&expression.comments, Placement::Body)?;
        let leading = self.make_comments(&expression.comments, Placement::Leading)?;
        let output = form.output.as_ref().unwrap_or(&profile.output);
        let position = form
            .source
            .iter()
            .position(|line| line.contains("{{message}}"))
            .or_else(|| lines.iter().position(|line| line.contains(output)))
            .unwrap_or(profile.header)
            .max(profile.header);
        let indent: String = lines
            .get(position)
            .into_iter()
            .flat_map(|line| line.chars())
            .take_while(|character| character.is_whitespace())
            .collect();
        lines.splice(
            position..position,
            body.iter().map(|line| format!("{indent}{line}")),
        );
        lines.splice(profile.header..profile.header, leading);
        Ok(lines.join("\n") + "\n")
    }
}
