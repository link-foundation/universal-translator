use std::fs;
use std::io::{self, Read, Write};
use universal_translator::formal::languages::language_syntax;
use universal_translator::meta::to_json;
use universal_translator::natural::check_text;
use universal_translator::translator::{Translator, language_ids, natural_languages};
use universal_translator::{Mode, Options, SourceDocument, translate_program};

const USAGE: &str = "Usage:
  universal-translator translate <from> <to> [file|-] [--mode <mode>] [--trace] [--common-library] [--fragment]
  universal-translator meta <language> [file|-]
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
Omit the file or pass - to read standard input.";

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

fn translate(from: &str, to: &str, arguments: &[&str]) -> Result<String, String> {
    let mut file = None;
    let mut mode = None;
    let mut trace = false;
    let mut common_library = false;
    let mut fragment = false;
    let mut arguments = arguments.iter().copied();
    while let Some(argument) = arguments.next() {
        match argument {
            "--trace" => trace = true,
            "--common-library" => common_library = true,
            "--fragment" => fragment = true,
            "--mode" if mode.is_none() => {
                mode = Some(
                    arguments
                        .next()
                        .ok_or("Missing --mode value")?
                        .parse::<Mode>()?,
                );
            }
            part if (part == "-" || !part.starts_with('-')) && file.is_none() => file = Some(part),
            _ => return Err(format!("Unexpected argument {argument}")),
        }
    }
    let mut translator = Translator::new();
    if trace {
        // Every pipeline stage as JSON, so a translation can be followed
        // rule layer by rule layer.
        translator = translator.with_trace(|stage, tree| {
            eprintln!("[{stage}] {}", to_json(Some(&tree.clone().into())));
        });
    }
    let options = Options {
        mode: mode.unwrap_or_default(),
        common_library,
    };
    let source = source(file)?;
    // --fragment translates a single statement, function definitions or a
    // whole program into the same kind of fragment.
    if fragment {
        translator.translate_fragment(&source, from, to, options)
    } else {
        translator.translate_with(&source, from, to, options)
    }
    .map_err(|error| error.to_string())
}

fn run(arguments: &[String]) -> Result<String, String> {
    let arguments: Vec<&str> = arguments.iter().map(String::as_str).collect();
    match arguments.as_slice() {
        [] | ["--help" | "-h"] => Ok(format!("{USAGE}\n")),
        ["--version" | "-v"] => Ok(format!("{}\n", env!("CARGO_PKG_VERSION"))),
        ["languages"] => Ok(language_ids()
            .into_iter()
            .filter_map(|id| language_syntax(id).ok())
            .map(|syntax| format!("{}\t{}\n", syntax.id, syntax.label))
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
        ["meta", language, trailing @ ..] if trailing.len() <= 1 => {
            let meta = Translator::new()
                .to_meta(&source(trailing.first().copied())?, language)
                .map_err(|error| error.to_string())?;
            Ok(to_json(Some(&meta.into())) + "\n")
        }
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
