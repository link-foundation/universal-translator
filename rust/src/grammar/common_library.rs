//! The common library route. Every language has a small library in
//! `common-library/` with the same four output operations. The
//! [`use_common_library`] layer replaces print statements with calls to those
//! operations, so a translation that uses it is nearly line for line: each
//! language only has to spell a call. [`recognize_common_library`] does the
//! reverse, so a program that calls the library can be translated to any
//! language.
//!
//! The library only smooths over standard-library differences: it writes
//! text, integers and newlines, and it has no algorithms.

use std::collections::HashSet;

use super::GrammarError;
use super::Settings;
use super::languages::{Role, language_syntax};
use super::meta::{Node, Value, rewrite, text};
use super::names::{name_words, spell_name};
use super::rules::parts_to_value;

/// Neutral names of the operations, as the meta language stores names.
pub const COMMON_LIBRARY_OPERATIONS: [&str; 4] =
    ["print-line", "write-text", "write-integer", "end-line"];

/// The languages with a common library implementation, in listing order.
pub const COMMON_LIBRARY_LANGUAGES: [&str; 30] = [
    "javascript",
    "typescript",
    "python",
    "ruby",
    "lua",
    "php",
    "c",
    "cpp",
    "csharp",
    "java",
    "go",
    "rust",
    "kotlin",
    "swift",
    "perl",
    "dart",
    "scala",
    "julia",
    "r",
    "groovy",
    "objc",
    "nim",
    "d",
    "pascal",
    "fortran",
    "ada",
    "vb",
    "bash",
    "matlab",
    "zig",
];

/// The lines that make the library available in a language, given the
/// spelled operations a program uses.
pub fn library_imports(language: &str, names: &[String]) -> Vec<String> {
    let names = names.join(", ");
    match language {
        "javascript" => vec![format!("import {{ {names} }} from './common-library.mjs';")],
        "typescript" => vec![format!("import {{ {names} }} from './common-library.ts';")],
        "python" => vec![format!("from common_library import {names}")],
        "ruby" => vec!["require_relative \"common_library\"".into()],
        "lua" => vec!["local common_library = require(\"common_library\")".into()],
        "php" => vec!["require_once 'common_library.php';".into()],
        "c" => vec!["#include \"common_library.h\"".into()],
        "cpp" => vec!["#include \"common_library.hpp\"".into()],
        "perl" => vec!["require \"./common_library.pl\";".into()],
        "dart" => vec!["import 'common_library.dart';".into()],
        "julia" => vec!["include(\"common_library.jl\")".into()],
        "r" => vec!["source(\"common_library.R\")".into()],
        "objc" => vec!["#import \"CommonLibrary.h\"".into()],
        "nim" => vec!["import common_library".into()],
        "d" => vec!["import common_library;".into()],
        "pascal" => vec!["uses CommonLibrary;".into()],
        "fortran" => vec!["use common_library".into()],
        "ada" => vec!["Common_Library".into()],
        "bash" => vec!["source \"$(dirname \"$0\")/common_library.sh\"".into()],
        "matlab" => vec!["source('common_library.m');".into()],
        "zig" => vec!["const common_library = @import(\"common_library.zig\");".into()],
        "rust" => vec![
            "mod common_library;".into(),
            format!("use common_library::{{{names}}};"),
        ],
        _ => Vec::new(),
    }
}

/// The prefix of each library call in a language.
pub fn library_prefix(language: &str) -> &'static str {
    match language {
        "lua" | "zig" => "common_library.",
        "csharp" | "java" | "scala" | "groovy" | "vb" => "CommonLibrary.",
        _ => "",
    }
}

fn call(operation: &str, argument: Option<Node>) -> Node {
    Node::new("Evaluate").with(
        "expression",
        Node::new("Call")
            .with("callee", operation)
            .with("arguments", argument.into_iter().collect::<Vec<_>>())
            .with("library", "common")
            .with("type", "nothing"),
    )
}

/// One print statement becomes one or more library calls.
fn library_calls(print: &Node) -> Result<Vec<Node>, GrammarError> {
    let value = print.node("value").cloned().unwrap_or_else(|| text(""));
    let newline = print.flag("newline").unwrap_or(false);
    let parts = if value.is("Interpolation") {
        value.node_list("parts")
    } else {
        vec![value]
    };
    if newline && parts.len() == 1 && parts[0].str("type") == Some("text") {
        return Ok(vec![call("print-line", Some(parts[0].clone()))]);
    }
    let mut calls = Vec::new();
    for part in parts {
        let operation = match part.str("type") {
            Some("text") => "write-text",
            Some("integer") => "write-integer",
            other => {
                return Err(GrammarError::new(format!(
                    "The common library cannot write a {} value",
                    other.unwrap_or("untyped")
                )));
            }
        };
        calls.push(call(operation, Some(part)));
    }
    if newline {
        calls.push(call("end-line", None));
    }
    Ok(calls)
}

/// Meta layer: replace every print statement with common library calls.
pub fn use_common_library(program: Node) -> Result<Node, GrammarError> {
    let mut failure = None;
    let replaced = rewrite(program, |mut current| {
        if !current.is("Block") {
            return current;
        }
        let mut statements = Vec::new();
        for statement in current.node_list("statements") {
            if !statement.is("Print") {
                statements.push(statement);
                continue;
            }
            match library_calls(&statement) {
                Ok(calls) => statements.extend(calls),
                Err(error) => {
                    failure.get_or_insert(error);
                }
            }
        }
        current.set("statements", statements);
        current
    });
    match failure {
        Some(error) => Err(error),
        None => Ok(replaced.with("libraries", vec!["common".to_owned()])),
    }
}

/// The lines that make the library available are not part of the program.
fn is_library_import(line: &str) -> bool {
    let lower = line.to_lowercase();
    ["commonlibrary", "common-library", "common_library"]
        .iter()
        .any(|spelling| lower.contains(spelling))
}

/// Some languages load the library with a call: Lua's
/// `local common_library = require(...)`, Julia's `include(...)` and R's
/// `source(...)`.
fn is_library_load(statement: &Node) -> bool {
    let call = statement
        .node("value")
        .or_else(|| statement.node("expression"));
    call.is_some_and(|value| {
        value.is("Call")
            && matches!(value.str("callee"), Some("require" | "include" | "source"))
            && is_library_import(
                value
                    .nodes("arguments")
                    .first()
                    .and_then(|argument| argument.str("value"))
                    .unwrap_or_default(),
            )
    })
}

fn library_print(value: Node, newline: bool) -> Node {
    Node::new("Print")
        .with("value", value)
        .with("newline", newline)
        .with("fromLibrary", true)
}

/// Consecutive prints that came from library calls are one print statement:
/// the writes up to and including the one that ends the line are joined.
fn merge_library_prints(statements: Vec<Node>) -> Vec<Node> {
    let mut merged = Vec::new();
    let mut pending: Vec<Node> = Vec::new();
    let flush = |merged: &mut Vec<Node>, pending: &mut Vec<Node>, newline: bool| {
        if !pending.is_empty() || newline {
            let parts = pending
                .drain(..)
                .filter_map(|print| print.node("value").cloned())
                .collect();
            merged.push(
                Node::new("Print")
                    .with("value", parts_to_value(parts))
                    .with("newline", newline),
            );
        }
    };
    for statement in statements {
        if !statement.is("Print") || statement.flag("fromLibrary") != Some(true) {
            flush(&mut merged, &mut pending, false);
            merged.push(statement);
        } else if statement.flag("newline") == Some(true) {
            pending.push(statement);
            flush(&mut merged, &mut pending, true);
        } else {
            pending.push(statement);
        }
    }
    flush(&mut merged, &mut pending, false);
    merged
}

/// Understanding rule: a call to a library operation, however the source
/// spells and qualifies it, is a print statement again.
pub fn recognize_common_library(program: Node) -> Node {
    let own_functions: HashSet<String> = program
        .nodes("functions")
        .iter()
        .filter_map(|item| item.str("name").map(str::to_owned))
        .collect();
    let recognized = rewrite(program, |current| {
        let Some(expression) = current.node("expression") else {
            return current;
        };
        let callee = expression.str("callee").unwrap_or_default();
        if !current.is("Evaluate") || !expression.is("Call") || own_functions.contains(callee) {
            return current;
        }
        let last = callee
            .split("::")
            .flat_map(|part| part.split('.'))
            .last()
            .unwrap_or_default();
        let argument = expression
            .nodes("arguments")
            .first()
            .map(|&node| node.clone());
        match name_words(last).join("-").as_str() {
            "print-line" => library_print(argument.unwrap_or_else(|| text("")), true),
            "write-text" | "write-integer" => {
                library_print(argument.unwrap_or_else(|| text("")), false)
            }
            "end-line" => library_print(text(""), true),
            _ => current,
        }
    });
    let mut merged = rewrite(recognized, |mut current| {
        if current.is("Block") {
            let statements = merge_library_prints(current.node_list("statements"));
            current.set("statements", statements);
        }
        current
    });
    if let Some(mut main) = merged.node("main").cloned() {
        let statements: Vec<Node> = main
            .node_list("statements")
            .into_iter()
            .filter(|statement| !is_library_load(statement))
            .collect();
        main.set("statements", statements);
        merged.set("main", main);
    }
    let imports: Vec<String> = merged
        .texts("imports")
        .into_iter()
        .filter(|line| !is_library_import(line))
        .collect();
    merged.with("imports", imports)
}

/// Visit every node, children first, in the order the program reads: the
/// "then" branch of an "if" before its "otherwise" branch.
fn in_source_order(node: &Node, visit: &mut impl FnMut(&Node)) {
    fn value(item: &Value, visit: &mut impl FnMut(&Node)) {
        match item {
            Value::Node(node) => in_source_order(node, visit),
            Value::List(items) => items.iter().for_each(|item| value(item, visit)),
            _ => {}
        }
    }
    let (later, first): (Vec<_>, Vec<_>) = node
        .fields
        .iter()
        .partition(|(key, _)| key.as_str() == "otherwise");
    for (_, item) in first.into_iter().chain(later) {
        value(item, visit);
    }
    visit(node);
}

/// Context rule: spell each library call for the target language and list
/// the lines that make the library available.
pub fn spell_common_library(program: Node, settings: &Settings) -> Node {
    let uses_library = program
        .texts("libraries")
        .iter()
        .any(|library| library == "common");
    if !uses_library || !COMMON_LIBRARY_LANGUAGES.contains(&settings.to.as_str()) {
        return program;
    }
    let Ok(syntax) = language_syntax(&settings.to) else {
        return program;
    };
    let convention = syntax.naming_convention(Role::Function);
    let prefix = library_prefix(&settings.to);
    let mut used: Vec<String> = Vec::new();
    in_source_order(&program, &mut |node| {
        if node.is("Call") && node.str("library") == Some("common") {
            let spelling = spell_name(node.str("callee").unwrap_or_default(), convention);
            if !used.contains(&spelling) {
                used.push(spelling);
            }
        }
    });
    let spelled = rewrite(program, |current| {
        if !current.is("Call") || current.str("library") != Some("common") {
            return current;
        }
        let spelling = spell_name(current.str("callee").unwrap_or_default(), convention);
        current.with("callee", format!("{prefix}{spelling}"))
    });
    spelled.with("libraryImports", library_imports(&settings.to, &used))
}
