//! The two routes of the server as pure functions from a request to a JSON
//! text, the way js/src/server.js answers them: `GET /languages` lists the
//! languages and `POST /translate` translates a JSON request.
//!
//! Answers are written with the fields in the order JavaScript's
//! `JSON.stringify` writes them, so both servers reply with the same bytes.

use serde_json::Value;

use crate::custom_rules::{CustomRules, read_rules, truthy};
use crate::formal::languages::language_syntax;
use crate::meta::format_number;
use crate::natural::{is_natural_language, natural_language};
use crate::style::{Braces, Indent, Style};
use crate::translator::{Options, TextLayout, Translator, languages, natural_languages};
use crate::{Mode, PartError};

const MODES: [&str; 3] = ["context-dependent", "literal", "same-effect"];

/// The text of a JSON string, quoted.
fn quoted(text: &str) -> String {
    serde_json::to_string(text).unwrap_or_default()
}

/// A JSON object whose fields keep the order given; each value is JSON text.
fn object(fields: &[(&str, String)]) -> String {
    let fields: Vec<String> = fields
        .iter()
        .map(|(name, value)| format!("{}:{value}", quoted(name)))
        .collect();
    format!("{{{}}}", fields.join(","))
}

fn list(items: Vec<String>) -> String {
    format!("[{}]", items.join(","))
}

/// An `{id, label}` entry of a language listing.
fn listing(id: &str, label: &str) -> Vec<(&'static str, String)> {
    vec![("id", quoted(id)), ("label", quoted(label))]
}

/// The answer to `GET /languages`.
pub fn languages_json() -> String {
    let programming = languages().into_iter().map(|language| {
        let mut fields = listing(language.id, language.label);
        if !language.versions.is_empty() {
            let versions = language.versions.iter().map(|version| {
                object(&[
                    ("version", quoted(version.version)),
                    ("label", quoted(version.label)),
                    ("default", version.default.to_string()),
                ])
            });
            fields.push(("versions", list(versions.collect())));
        }
        if language.machine {
            fields.push(("machine", "true".to_string()));
        }
        object(&fields)
    });
    let natural = natural_languages().into_iter().map(|language| {
        let mut fields = listing(language.id, language.label);
        if let Some(base) = language.base {
            fields.push(("base", quoted(base)));
        }
        object(&fields)
    });
    object(&[
        ("languages", list(programming.collect())),
        ("naturalLanguages", list(natural.collect())),
    ])
}

/// The body of an error answer.
pub fn error_json(message: &str) -> String {
    object(&[("error", quoted(message))])
}

/// A checked `POST /translate` request.
struct Request<'a> {
    source: &'a str,
    from: &'a str,
    to: &'a str,
    fragment: bool,
    all_or_nothing: bool,
    rules: Option<CustomRules>,
    options: Options,
}

fn text_field<'a>(body: &'a Value, key: &str) -> Result<&'a str, String> {
    body.get(key)
        .and_then(Value::as_str)
        .filter(|text| key == "source" || !text.is_empty())
        .ok_or_else(|| format!("\"{key}\" must be a string"))
}

/// An optional text field: `None` when absent or empty.
fn optional_text<'a>(body: &'a Value, key: &str) -> Result<Option<&'a str>, String> {
    match body.get(key) {
        None => Ok(None),
        Some(Value::String(text)) => Ok(Some(text.as_str()).filter(|text| !text.is_empty())),
        Some(_) => Err(format!("\"{key}\" must be a string")),
    }
}

fn mode_field(body: &Value) -> Result<Mode, String> {
    match body.get("mode") {
        None => Ok(Mode::default()),
        Some(Value::String(mode)) if MODES.contains(&mode.as_str()) => mode.parse(),
        Some(_) => Err(format!("\"mode\" must be one of {}", MODES.join(", "))),
    }
}

/// Whether a stage of the rules holds a rule with a regular expression.
/// Regular expressions from a client could take exponential time (ReDoS),
/// so a server accepts only plain text rules unless it is told otherwise.
fn has_regex_rule(rules: &Value) -> bool {
    ["source", "output"].iter().any(|stage| {
        rules
            .get(stage)
            .and_then(Value::as_array)
            .is_some_and(|rules| rules.iter().any(|rule| truthy(rule.get("regex"))))
    })
}

/// Rules are Links Notation text or an object; regular expressions in them
/// only when allowed.
fn rules_field(body: &Value, allow_regex_rules: bool) -> Result<Option<CustomRules>, String> {
    let Some(given) = body.get("rules") else {
        return Ok(None);
    };
    let rules = match given {
        Value::String(text) => read_rules(text)?,
        other => other.clone(),
    };
    if !rules.is_object() {
        return Err(r#""rules" must be Links Notation text or an object"#.into());
    }
    if !allow_regex_rules && has_regex_rule(&rules) {
        return Err("This server accepts only plain text rules (start it with allowRegexRules to accept regular expressions)".into());
    }
    CustomRules::from_value(&rules).map(Some)
}

/// A natural language to translate to and one to translate from, as a
/// request names them for comments or for declared names.
type Languages<'a> = (Option<&'a str>, Option<&'a str>);

fn layout_field(body: &Value) -> Result<TextLayout, String> {
    match body.get("layout") {
        None => Ok(TextLayout::default()),
        Some(Value::String(layout)) => layout
            .parse()
            .map_err(|_| r#""layout" must be one of source, target"#.to_owned()),
        Some(_) => Err(r#""layout" must be one of source, target"#.into()),
    }
}

/// The text of a field as the error messages name it.
fn field_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}

/// The brace placement and indent width of a request: `indent` is a number
/// of spaces or "tab".
fn style_field(body: &Value) -> Result<Style, String> {
    let braces = body
        .get("braces")
        .map(|braces| field_text(braces).parse::<Braces>())
        .transpose()?;
    let indent = body
        .get("indent")
        .map(|indent| match indent.as_f64() {
            // 2.0 is the number 2, as JavaScript reads it.
            Some(width) if width.fract() == 0.0 && width.abs() < 1e9 => {
                format!("{width}").parse::<Indent>()
            }
            _ => field_text(indent).parse::<Indent>(),
        })
        .transpose()?;
    Ok(Style { braces, indent })
}

/// The translation options of a request. A natural language that does not
/// exist is a wrong option.
fn options_field(
    body: &Value,
    mode: Mode,
    comments: Languages<'_>,
    identifiers: Languages<'_>,
) -> Result<Options, String> {
    for id in [comments, identifiers]
        .into_iter()
        .flat_map(|(to, from)| to.into_iter().chain(from))
    {
        natural_language(id)?;
    }
    let mut options = Options {
        mode,
        common_library: body.get("commonLibrary") == Some(&Value::Bool(true)),
        layout: layout_field(body)?,
        style: style_field(body)?,
        ..Options::default()
    };
    if let Some(to) = comments.0 {
        options = options
            .with_comment_language(to, comments.1)
            .map_err(|error| error.to_string())?;
    }
    if let Some(to) = identifiers.0 {
        options = options
            .with_identifier_language(to, identifiers.1)
            .map_err(|error| error.to_string())?;
    }
    Ok(options)
}

fn check_request(body: &Value, allow_regex_rules: bool) -> Result<Request<'_>, String> {
    if !body.is_object() {
        return Err("Send a JSON object".into());
    }
    let (source, from, to) = (
        text_field(body, "source")?,
        text_field(body, "from")?,
        text_field(body, "to")?,
    );
    let mode = mode_field(body)?;
    let comments = (
        optional_text(body, "commentLanguage")?,
        optional_text(body, "commentFrom")?,
    );
    let identifiers = (
        optional_text(body, "identifierLanguage")?,
        optional_text(body, "identifierFrom")?,
    );
    layout_field(body)?;
    style_field(body)?;
    let rules = rules_field(body, allow_regex_rules)?;
    Ok(Request {
        source,
        from,
        to,
        fragment: body.get("fragment") == Some(&Value::Bool(true)),
        all_or_nothing: body.get("allOrNothing") == Some(&Value::Bool(true)),
        rules,
        options: options_field(body, mode, comments, identifiers)?,
    })
}

fn error_list(errors: &[PartError]) -> String {
    list(
        errors
            .iter()
            .map(|error| {
                object(&[
                    ("line", error.line.to_string()),
                    ("endLine", error.end_line.to_string()),
                    ("message", quoted(&error.message)),
                ])
            })
            .collect(),
    )
}

/// Whether both languages are programming languages with a text syntax, the
/// translations that come with a map of their lines.
fn between_programming_languages(from: &str, to: &str) -> bool {
    let text_syntax = |id: &str| {
        !is_natural_language(id) && language_syntax(id).is_ok_and(|syntax| !syntax.machine)
    };
    text_syntax(from) && text_syntax(to)
}

/// 0-based pairs of a source line and a target line.
fn line_map(lines: &[(usize, usize)]) -> String {
    list(
        lines
            .iter()
            .map(|(from, to)| format!("[{from},{to}]"))
            .collect(),
    )
}

/// Partial by default: the answer holds the translation and the parts that
/// could not be translated. "allOrNothing" fails at the first such part. The
/// source language "auto" is detected first.
fn run_translation(base: &Translator, request: Request<'_>) -> Result<String, String> {
    let translator = match request.rules {
        Some(rules) => Translator::new().with_rules(rules),
        None => base.clone(),
    };
    let detected = if request.from == "auto" {
        let found = translator
            .detect_language(request.source, 5)
            .into_iter()
            .next()
            .ok_or("The language of the text could not be detected")?;
        Some(found.id)
    } else {
        None
    };
    let language = detected.as_deref().unwrap_or(request.from);
    let (source, to, options) = (request.source, request.to, request.options);
    let mut fields = if request.all_or_nothing {
        let output = if request.fragment {
            translator.translate_fragment(source, language, to, options)
        } else {
            translator.translate_with(source, language, to, options)
        }
        .map_err(|error| error.to_string())?;
        vec![
            ("output", quoted(&output)),
            ("complete", "true".into()),
            ("errors", "[]".into()),
        ]
    } else {
        let result = translator
            .translate_partial(source, language, to, options, request.fragment)
            .map_err(|error| error.to_string())?;
        let mut fields = vec![
            ("output", quoted(&result.text)),
            ("complete", result.complete.to_string()),
            ("errors", error_list(&result.errors)),
            ("coverage", format_number(result.coverage)),
        ];
        if !result.line_map.is_empty() || between_programming_languages(language, to) {
            fields.push(("lineMap", line_map(&result.line_map)));
        }
        fields.push((
            "regionMap",
            list(
                result
                    .region_map
                    .iter()
                    .map(|pair| {
                        let range = |range: crate::ByteRange| {
                            object(&[
                                ("start", range.start.to_string()),
                                ("end", range.end.to_string()),
                            ])
                        };
                        object(&[
                            ("source", range(pair.source)),
                            ("target", range(pair.target)),
                        ])
                    })
                    .collect(),
            ),
        ));
        fields
    };
    if let Some(detected) = detected {
        fields.push(("detected", quoted(&detected)));
    }
    Ok(object(&fields))
}

/// The answer to `POST /translate` with a request body: JSON text, or the
/// message of what is wrong with the request.
pub fn translate_json(
    translator: &Translator,
    body: &str,
    allow_regex_rules: bool,
) -> Result<String, String> {
    let body: Value =
        serde_json::from_str(body).map_err(|error| format!("The body is not JSON: {error}"))?;
    run_translation(translator, check_request(&body, allow_regex_rules)?)
}
