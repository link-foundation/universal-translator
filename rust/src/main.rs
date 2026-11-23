use std::fs;
use std::io::{self, Read, Write};
use universal_translator::{Mode, Options, SourceDocument, Translator};

const USAGE: &str = "Usage:
  universal-translator translate <from> <to> [file|-] [--mode <mode>] [--form <form>]
  universal-translator roundtrip <language> [file|-]
  universal-translator encode-source <language> [file|-]
  universal-translator decode-source [file|-]
  universal-translator languages
  universal-translator --version

Modes: context-dependent (default), literal, same-effect
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

fn translate(
    translator: &Translator,
    from: &str,
    to: &str,
    arguments: &[&str],
) -> Result<String, String> {
    let mut file = None;
    let mut mode = None;
    let mut form = None;
    let mut arguments = arguments.iter().copied();
    while let Some(argument) = arguments.next() {
        match argument {
            "--mode" if mode.is_none() => {
                mode = Some(
                    arguments
                        .next()
                        .ok_or("Missing --mode value")?
                        .parse::<Mode>()?,
                );
            }
            "--form" if form.is_none() => {
                form = Some(
                    arguments
                        .next()
                        .filter(|value| !value.starts_with('-'))
                        .ok_or("Missing --form value")?,
                );
            }
            part if (part == "-" || !part.starts_with('-')) && file.is_none() => file = Some(part),
            _ => return Err(format!("Unexpected argument {argument}")),
        }
    }
    let options = Options {
        mode: mode.unwrap_or_default(),
        form,
    };
    translator.translate(&source(file)?, from, to, &options)
}

fn run(arguments: &[String]) -> Result<String, String> {
    let arguments: Vec<&str> = arguments.iter().map(String::as_str).collect();
    match arguments.as_slice() {
        [] | ["--help" | "-h"] => Ok(format!("{USAGE}\n")),
        ["--version" | "-v"] => Ok(format!("{}\n", env!("CARGO_PKG_VERSION"))),
        ["languages"] => Ok(Translator::default()
            .profiles()
            .map(|profile| format!("{}\t{}\n", profile.id, profile.label))
            .collect()),
        ["roundtrip", language] => Ok(Translator::default()
            .parse(&source(None)?, language)?
            .restore()),
        ["roundtrip", language, file] => Ok(Translator::default()
            .parse(&source(Some(file))?, language)?
            .restore()),
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
        ["translate", from, to, trailing @ ..] => {
            translate(&Translator::default(), from, to, trailing)
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
