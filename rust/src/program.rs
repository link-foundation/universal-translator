use crate::{SourceDocument, source_document::parse_syntax};
use meta_language::{LinkNetwork, translate_program as translate_portable_core};

fn program_language(language: &str) -> Result<&'static str, String> {
    match language {
        "javascript" | "JavaScript" => Ok("JavaScript"),
        "rust" | "Rust" => Ok("Rust"),
        "lean" | "Lean" => Ok("Lean"),
        "coq" | "Coq" | "rocq" | "Rocq" => Ok("Rocq"),
        _ => Err(format!("No portable program translator for {language}")),
    }
}

fn check_syntax(network: &LinkNetwork, language: &str) -> Result<(), String> {
    if !network.verify_full_match(None).is_clean() {
        return Err(format!("{language} CST contains syntax errors"));
    }
    Ok(())
}

/// Translates through Meta Language's syntax network and checked portable core.
///
/// Returns an error for unsupported constructs, including those for which Meta
/// Language's other mode can emit a reversible source envelope.
pub fn translate_program(document: &SourceDocument, target: &str) -> Result<String, String> {
    let from = program_language(&document.language)?;
    let syntax = parse_syntax(&document.source, from)?;
    translate_syntax(&syntax, from, target)
}

pub(crate) fn translate_syntax(
    syntax: &LinkNetwork,
    from: &str,
    to: &str,
) -> Result<String, String> {
    let from = program_language(from)?;
    let to = program_language(to)?;
    check_syntax(syntax, from)?;
    let result =
        translate_portable_core(&syntax.reconstruct_text(), from, to).map_err(|e| e.to_string())?;
    if let Some(diagnostic) = result.diagnostic() {
        return Err(format!(
            "Unsupported {from} program: {}",
            diagnostic.message
        ));
    }
    if result.semantics().is_none() {
        return Err(format!(
            "Expected a semantic translation from {from} to {to}"
        ));
    }
    let target_syntax = parse_syntax(result.code(), to)?;
    check_syntax(&target_syntax, to)?;
    Ok(target_syntax.reconstruct_text())
}
