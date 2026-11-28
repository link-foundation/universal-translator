//! Preserve native C and C++ library imports and C++ file scope.

use std::sync::LazyLock;

use regex::Regex;

use crate::meta::{Node, Settings};

use super::emitter::{Emitter, Result, field};

fn string_value(value: &Node) -> bool {
    (value.str("type") == Some("text") && !value.is("Text"))
        || matches!(
            value.str("type"),
            Some("source:std :: string &" | "source:const std :: string &")
        )
}

fn character_value(value: &Node) -> bool {
    value.is("CppCharacter")
        || (value.is("CppIntegralCast") && value.str("castType") == Some("char"))
        || value.str("type") == Some("source:char")
        || (value.is("Index") && value.node("array").is_some_and(string_value))
}

pub(crate) fn is_character_concat(left: &Node, right: &Node) -> bool {
    (character_value(left) && string_value(right)) || (string_value(left) && character_value(right))
}

pub(crate) fn write_character_expression(
    emitter: &mut Emitter,
    expression: &Node,
) -> Result<String> {
    if expression.is("CppCharacter") {
        let raw = expression.str("raw").unwrap_or_default();
        return Ok(format!("'{raw}'"));
    }
    let cast_type = expression.str("castType").unwrap_or_default();
    let operand = emitter.expression(field(expression, "operand")?)?;
    Ok(format!("({cast_type})({operand})"))
}

static INCLUDE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r#"^#[ \t]*include[ \t]*(<[^>\r\n]+>|"[^"\r\n]+")([ \t]*(?://[^\r\n]*|/\*[^\r\n]*\*/))?$"#,
    )
    .expect("include directive")
});
static USING: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^using (?:namespace [\p{L}\p{N}_]+|[\p{L}\p{N}_]+::[\p{L}\p{N}_]+)(?:::[\p{L}\p{N}_]+)*$",
    )
    .expect("using directive or declaration")
});

pub(crate) fn cpp_using_statement(text: &str) -> Option<String> {
    USING.is_match(text).then(|| format!("{text};"))
}

pub(crate) fn native_import_key(line: &str) -> &str {
    INCLUDE
        .captures(line)
        .and_then(|include| include.get(1))
        .map_or(line, |header| header.as_str())
}

fn keep_native_imports(mut program: Node, settings: &Settings) -> Node {
    if settings.from != settings.to || !matches!(settings.to.as_str(), "c" | "cpp") {
        return program;
    }
    let mut imports = Vec::new();
    for line in program.texts("imports") {
        if let Some(header) = INCLUDE.captures(&line) {
            let comment = header.get(2).map_or("", |comment| comment.as_str());
            imports.push(format!("#include {}{comment}", &header[1]));
        } else if settings.to == "cpp" {
            imports.extend(cpp_using_statement(&line));
        }
    }
    if !imports.is_empty() {
        for line in program.texts("libraryImports") {
            if !imports
                .iter()
                .any(|import| native_import_key(import) == native_import_key(&line))
            {
                imports.push(line);
            }
        }
        program.set("libraryImports", imports);
    }
    program
}

pub(crate) fn mark_cpp_file_items(items: &mut [Node]) {
    if !items.iter().any(|item| item.is("Declaration")) {
        return;
    }
    let mut order = 0.0;
    for item in items {
        if item.is("Declaration") || (item.is("Function") && item.str("name") != Some("main")) {
            item.set("cppFileOrder", order);
            order += 1.0;
        }
    }
}

fn keep_cpp_file_scope(mut program: Node, settings: &Settings) -> Node {
    if settings.from != "cpp" || settings.to != "cpp" {
        return program;
    }
    if let Some(main) = program.node("main") {
        let (declarations, statements): (Vec<_>, Vec<_>) = main
            .nodes("statements")
            .into_iter()
            .partition(|item| item.number("cppFileOrder").is_some());
        if !declarations.is_empty() {
            let declarations: Vec<_> = declarations.into_iter().cloned().collect();
            let statements: Vec<_> = statements.into_iter().cloned().collect();
            let mut main = main.clone();
            main.set("statements", statements);
            program.set("globalDeclarations", declarations);
            program.set("main", main);
        }
    }
    program
}

pub(crate) fn adapt_native_c_program(program: Node, settings: &Settings) -> Node {
    keep_cpp_file_scope(keep_native_imports(program, settings), settings)
}

pub(crate) fn cpp_file_items(program: &Node) -> Vec<&Node> {
    let mut items = program.nodes("globalDeclarations");
    if items.is_empty() {
        return program.nodes("functions");
    }
    items.extend(program.nodes("functions"));
    let order = |item: &Node| item.number("cppFileOrder").unwrap_or(f64::MAX);
    items.sort_by(|left, right| order(left).total_cmp(&order(right)));
    items
}
