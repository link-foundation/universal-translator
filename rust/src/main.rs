use std::fs;
use std::io::{self, Read, Write};
use universal_translator::custom_rules::lino_value;
use universal_translator::meta::notation::format_meta;
use universal_translator::meta::{format_number, to_json};
use universal_translator::natural::check_text;
use universal_translator::translator::{Translator, languages, natural_languages};
use universal_translator::{
    CustomRules, Detection, Mode, Options, PartialReading, SourceDocument, translate_program,
};

const USAGE: &str = "Usage:
  universal-translator translate <from> <to> [file|-] [--mode <mode>] [--trace] [--common-library] [--fragment] [--all-or-nothing] [--rules <file.lino>] [--comment-language <natural>] [--comment-from <natural>]
  universal-translator meta <language> [file|-] [--json]
  universal-translator coverage <language> [file|-] [--json]
  universal-translator detect [file|-] [--json]
  universal-translator translate-program <from|cst> <to> [file|-]
  universal-translator encode-source <language> [file|-]
  universal-translator decode-source [file|-]
  universal-translator encode-cst <language> [file|-]
  universal-translator decode-cst [file|-]
  universal-translator languages
  universal-translator check-words <natural> [file|-]
  universal-translator --version

A language may be a controlled natural language (english, russian,
english-asd-ste100, minimal-english, ...): translate reads and writes
its sentences like any programming language. check-words checks a text
against the rules of a controlled language.

Modes: context-dependent (default), literal, same-effect
--trace writes every pipeline stage to standard error as \"[stage] <json>\".
--common-library prints through common-library/ calls.
--fragment translates statements or functions on their own.
Parts that cannot be translated become comments and are listed on
standard error; --all-or-nothing fails instead.
The source language may be \"auto\" to detect it.
--rules <file.lino> adds source, templates, names and output rules
(indented Links Notation; JSON files are read too).
--comment-language <natural> translates the comments too (only them when
<from> is <to>); --comment-from <natural> names the language of the
comments (detected otherwise).
<to> may name a version: python@2.
meta prints the meta program as indented Links Notation; --json prints JSON.
coverage prints which parts of a text can be read as indented Links
Notation; detect prints the most likely languages of a text, one per
line. --json prints either as JSON.
Omit the file or pass - to read standard input.";

/// The file of `meta`, `coverage` or `detect` (`[file|-] [--json]`):
/// `Some(None)` reads standard input, `None` means the arguments are wrong.
fn report_file<'a>(trailing: &[&'a str]) -> Option<Option<&'a str>> {
    let files: Vec<&str> = trailing
        .iter()
        .copied()
        .filter(|argument| *argument != "--json")
        .collect();
    let flags = trailing.len() - files.len();
    (files.len() <= 1 && flags <= 1).then(|| files.first().copied())
}

fn source(file: Option<&str>) -> Result<String, String> {
    if let Some(file) = file.filter(|file| *file != "-") {
        fs::read_to_string(file).map_err(|error| format!("{file}: {error}"))
    } else {
        let mut input = String::new();
        io::stdin()
            .read_to_string(&mut input)
            .map_err(|error| error.to_string())?;
        Ok(input)
    }
}

/// A JSON value written the way JavaScript's `JSON.stringify(value, null, 2)`
/// writes it.
enum Json {
    Bool(bool),
    Number(f64),
    Text(String),
    List(Vec<Json>),
    Object(Vec<(&'static str, Json)>),
}

impl Json {
    fn write(&self, indent: usize, out: &mut String) {
        let inner = "  ".repeat(indent + 1);
        let close = "  ".repeat(indent);
        match self {
            Json::Bool(flag) => out.push_str(&flag.to_string()),
            Json::Number(value) => out.push_str(&format_number(*value)),
            Json::Text(text) => out.push_str(&serde_json::to_string(text).unwrap_or_default()),
            Json::List(items) if items.is_empty() => out.push_str("[]"),
            Json::Object(entries) if entries.is_empty() => out.push_str("{}"),
            Json::List(items) => {
                out.push_str("[\n");
                for (index, item) in items.iter().enumerate() {
                    out.push_str(&inner);
                    item.write(indent + 1, out);
                    out.push_str(if index + 1 < items.len() { ",\n" } else { "\n" });
                }
                out.push_str(&close);
                out.push(']');
            }
            Json::Object(entries) => {
                out.push_str("{\n");
                for (index, (key, value)) in entries.iter().enumerate() {
                    out.push_str(&format!("{inner}\"{key}\": "));
                    value.write(indent + 1, out);
                    out.push_str(if index + 1 < entries.len() {
                        ",\n"
                    } else {
                        "\n"
                    });
                }
                out.push_str(&close);
                out.push('}');
            }
        }
    }

    fn pretty(&self) -> String {
        let mut out = String::new();
        self.write(0, &mut out);
        out + "\n"
    }

    /// A plain value as Links Notation (a list or a record is not one).
    fn lino_value(&self) -> String {
        match self {
            Json::Bool(flag) => flag.to_string(),
            Json::Number(value) => format_number(*value),
            Json::Text(text) => lino_value(text),
            Json::List(_) | Json::Object(_) => String::new(),
        }
    }

    /// A record as one line of links: (field value) (field value) ...
    fn lino_links(&self) -> String {
        match self {
            Json::Object(entries) => entries
                .iter()
                .map(|(field, value)| format!("({field} {})", value.lino_value()))
                .collect::<Vec<_>>()
                .join(" "),
            other => other.lino_value(),
        }
    }

    /// A report as indented Links Notation, as the JavaScript CLI writes it:
    /// every field is unique, so it is "name: value"; a list gets one record
    /// per line under its name, and an empty list writes nothing. A list on
    /// its own is one record per line.
    fn lino(&self) -> String {
        let lines: Vec<String> = match self {
            Json::Object(entries) => entries
                .iter()
                .flat_map(|(field, value)| match value {
                    Json::List(items) if items.is_empty() => Vec::new(),
                    Json::List(items) => std::iter::once(format!("{field}:"))
                        .chain(items.iter().map(|item| format!("  {}", item.lino_links())))
                        .collect(),
                    value => vec![format!("{field}: {}", value.lino_value())],
                })
                .collect(),
            Json::List(items) => items.iter().map(Json::lino_links).collect(),
            other => vec![other.lino_value()],
        };
        lines.iter().map(|line| format!("{line}\n")).collect()
    }

    /// The report as JSON with `--json`, as Links Notation otherwise.
    fn report(&self, json: bool) -> String {
        if json { self.pretty() } else { self.lino() }
    }
}

fn count(value: usize) -> Json {
    Json::Number(value as f64)
}

/// What `coverage` prints: the summary and where each part starts and ends.
fn coverage_report(reading: &PartialReading, json: bool) -> String {
    let errors = reading
        .errors
        .iter()
        .map(|error| {
            Json::Object(vec![
                ("line", count(error.line)),
                ("endLine", count(error.end_line)),
                ("message", Json::Text(error.message.clone())),
                ("source", Json::Text(error.source.clone())),
            ])
        })
        .collect();
    let parts = reading
        .parts
        .iter()
        .map(|part| {
            let mut entries = vec![
                ("start", count(part.start)),
                ("end", count(part.end)),
                ("status", Json::Text(part.status.as_str().to_owned())),
            ];
            if let Some(kind) = part.kind {
                entries.push(("kind", Json::Text(kind.as_str().to_owned())));
            }
            if let Some(message) = &part.message {
                entries.push(("message", Json::Text(message.clone())));
            }
            entries.push(("line", count(part.line)));
            entries.push(("endLine", count(part.end_line)));
            Json::Object(entries)
        })
        .collect();
    Json::Object(vec![
        ("complete", Json::Bool(reading.complete)),
        ("lines", count(reading.lines)),
        ("readLines", count(reading.read_lines)),
        ("coverage", Json::Number(reading.coverage)),
        ("errors", Json::List(errors)),
        ("parts", Json::List(parts)),
    ])
    .report(json)
}

/// What `detect` prints: the likeliest languages first.
fn detection_report(detections: &[Detection], json: bool) -> String {
    Json::List(
        detections
            .iter()
            .map(|detection| {
                Json::Object(vec![
                    ("id", Json::Text(detection.id.clone())),
                    ("natural", Json::Bool(detection.natural)),
                    ("reads", Json::Bool(detection.reads)),
                    ("coverage", Json::Number(detection.coverage)),
                    ("score", Json::Number(detection.score)),
                ])
            })
            .collect(),
    )
    .report(json)
}

fn translate(from: &str, to: &str, arguments: &[&str]) -> Result<String, String> {
    let mut file = None;
    let mut mode = None;
    let mut trace = false;
    let mut common_library = false;
    let mut fragment = false;
    let mut all_or_nothing = false;
    let mut rules = None;
    let mut comment_language = None;
    let mut comment_from = None;
    let mut arguments = arguments.iter().copied();
    // An option with a value takes one value, given once.
    fn value<'a>(
        argument: &str,
        set: bool,
        arguments: &mut impl Iterator<Item = &'a str>,
    ) -> Result<&'a str, String> {
        arguments
            .next()
            .filter(|value| !set && !value.is_empty() && !value.starts_with('-'))
            .ok_or_else(|| format!("Expected a single value for {argument}"))
    }
    while let Some(argument) = arguments.next() {
        match argument {
            "--trace" => trace = true,
            "--common-library" => common_library = true,
            "--fragment" => fragment = true,
            "--all-or-nothing" => all_or_nothing = true,
            "--rules" => {
                let value = arguments
                    .next()
                    .filter(|_| rules.is_none())
                    .ok_or("Expected a single rules file for --rules")?;
                let text =
                    fs::read_to_string(value).map_err(|error| format!("{value}: {error}"))?;
                rules = Some(CustomRules::from_text(&text)?);
            }
            "--mode" => {
                mode = Some(value(argument, mode.is_some(), &mut arguments)?.parse::<Mode>()?);
            }
            "--comment-language" => {
                comment_language =
                    Some(value(argument, comment_language.is_some(), &mut arguments)?);
            }
            "--comment-from" => {
                comment_from = Some(value(argument, comment_from.is_some(), &mut arguments)?);
            }
            part if (part == "-" || !part.starts_with('-')) && file.is_none() => file = Some(part),
            _ => return Err(format!("Unexpected argument {argument}")),
        }
    }
    let mut translator = Translator::new().with_rules(rules.unwrap_or_default());
    if trace {
        // Every pipeline stage as JSON, so a translation can be followed
        // rule layer by rule layer.
        translator = translator.with_trace(|stage, tree| {
            eprintln!("[{stage}] {}", to_json(Some(&tree.clone().into())));
        });
    }
    let mut options = Options {
        mode: mode.unwrap_or_default(),
        common_library,
        ..Options::default()
    };
    // --comment-from only matters with --comment-language.
    if let Some(comment_language) = comment_language {
        options = options
            .with_comment_language(comment_language, comment_from)
            .map_err(|error| error.to_string())?;
    }
    let source = source(file)?;
    let language = if from == "auto" {
        let detected = translator
            .detect_language(&source, 5)
            .into_iter()
            .next()
            .ok_or("The language of the text could not be detected")?
            .id;
        eprintln!("Detected language: {detected}");
        detected
    } else {
        from.to_owned()
    };
    // --fragment translates a single statement, function definitions or a
    // whole program into the same kind of fragment. By default every part
    // that can be translated is, and the others are marked and listed on
    // standard error; --all-or-nothing fails at the first part it cannot
    // read.
    if all_or_nothing {
        return if fragment {
            translator.translate_fragment(&source, &language, to, options)
        } else {
            translator.translate_with(&source, &language, to, options)
        }
        .map_err(|error| error.to_string());
    }
    let result = translator
        .translate_partial(&source, &language, to, options, fragment)
        .map_err(|error| error.to_string())?;
    if !result.complete {
        eprintln!(
            "Translated {} of {} lines; {} part(s) could not be translated:",
            result.read_lines,
            result.lines,
            result.errors.len()
        );
        for error in &result.errors {
            let place = if error.end_line > error.line {
                format!("lines {}-{}", error.line, error.end_line)
            } else {
                format!("line {}", error.line)
            };
            eprintln!("  {place}: {}", error.message);
        }
    }
    Ok(result.text)
}

fn run(arguments: &[String]) -> Result<String, String> {
    let arguments: Vec<&str> = arguments.iter().map(String::as_str).collect();
    match arguments.as_slice() {
        [] | ["--help" | "-h"] => Ok(format!("{USAGE}\n")),
        ["--version" | "-v"] => Ok(format!("{}\n", env!("CARGO_PKG_VERSION"))),
        ["languages"] => Ok(languages()
            .into_iter()
            .map(|language| {
                let kind = if language.machine { " (machine)" } else { "" };
                format!("{}\t{}{kind}\n", language.id, language.label)
            })
            .chain(
                natural_languages()
                    .into_iter()
                    .map(|language| format!("{}\t{} (natural)\n", language.id, language.label)),
            )
            .collect()),
        ["check-words", language, trailing @ ..] if trailing.len() <= 1 => {
            let problems = check_text(&source(trailing.first().copied())?, language)?;
            if problems.is_empty() {
                Ok(format!("The text keeps the rules of {language}\n"))
            } else {
                Err(problems.join("\n"))
            }
        }
        ["meta", language, trailing @ ..] if report_file(trailing).is_some() => {
            let json = trailing.contains(&"--json");
            let meta = Translator::new()
                .to_meta(&source(report_file(trailing).flatten())?, language)
                .map_err(|error| error.to_string())?;
            Ok(if json {
                // Indented like the JavaScript CLI; the fields are in name order.
                let compact = to_json(Some(&meta.into()));
                serde_json::from_str::<serde_json::Value>(&compact)
                    .and_then(|value| serde_json::to_string_pretty(&value))
                    .unwrap_or(compact)
                    + "\n"
            } else {
                format_meta(&meta)
            })
        }
        ["coverage", language, trailing @ ..] if report_file(trailing).is_some() => {
            let reading = Translator::new()
                .parse_partial(&source(report_file(trailing).flatten())?, language)
                .map_err(|error| error.to_string())?;
            Ok(coverage_report(&reading, trailing.contains(&"--json")))
        }
        ["detect", trailing @ ..] if report_file(trailing).is_some() => Ok(detection_report(
            &Translator::new().detect_language(&source(report_file(trailing).flatten())?, 5),
            trailing.contains(&"--json"),
        )),
        ["encode-source", language, trailing @ ..] if trailing.len() <= 1 => {
            let document = SourceDocument {
                language: (*language).to_owned(),
                source: source(trailing.first().copied())?,
            };
            Ok(document.to_links_notation()? + "\n")
        }
        ["decode-source", trailing @ ..] if trailing.len() <= 1 => {
            Ok(SourceDocument::from_links_notation(&source(trailing.first().copied())?)?.source)
        }
        ["encode-cst", language, trailing @ ..] if trailing.len() <= 1 => {
            let document = SourceDocument {
                language: (*language).to_owned(),
                source: source(trailing.first().copied())?,
            };
            Ok(document.syntax_network()?.to_lino())
        }
        ["decode-cst", trailing @ ..] if trailing.len() <= 1 => {
            Ok(SourceDocument::from_syntax_notation(&source(trailing.first().copied())?)?.source)
        }
        ["translate", from, to, trailing @ ..] => translate(from, to, trailing),
        ["translate-program", from, to, trailing @ ..] if trailing.len() <= 1 => {
            let input = source(trailing.first().copied())?;
            let document = if *from == "cst" {
                SourceDocument::from_syntax_notation(&input)?
            } else {
                SourceDocument {
                    language: (*from).to_owned(),
                    source: input,
                }
            };
            translate_program(&document, to)
        }
        _ => Err(USAGE.into()),
    }
}

fn main() -> std::process::ExitCode {
    match run(&std::env::args().skip(1).collect::<Vec<_>>()).and_then(|output| {
        io::stdout()
            .write_all(output.as_bytes())
            .map_err(|error| error.to_string())
    }) {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            std::process::ExitCode::FAILURE
        }
    }
}
