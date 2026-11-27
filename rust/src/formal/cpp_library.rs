//! Preserve C++ library imports and file scope for C++ output.

use std::sync::LazyLock;

use regex::Regex;

use crate::meta::{Node, Settings};

static INCLUDE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"^#[ \t]*include[ \t]*(<[^>\r\n]+>|"[^"\r\n]+")([ \t]+//.*)?$"#)
        .expect("include directive")
});
static USING: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^using (?:namespace [\p{L}\p{N}_]+|[\p{L}\p{N}_]+::[\p{L}\p{N}_]+)(?:::[\p{L}\p{N}_]+)*$",
    )
    .expect("using directive or declaration")
});

fn keep_cpp_imports(mut program: Node, settings: &Settings) -> Node {
    if settings.from != "cpp" || settings.to != "cpp" {
        return program;
    }
    let mut imports = Vec::new();
    for line in program.texts("imports") {
        let written = if let Some(header) = INCLUDE.captures(&line) {
            let comment = header.get(2).map_or("", |comment| comment.as_str());
            format!("#include {}{comment}", &header[1])
        } else if USING.is_match(&line) {
            format!("{line};")
        } else {
            continue;
        };
        imports.push(written);
    }
    if !imports.is_empty() {
        for line in program.texts("libraryImports") {
            if !imports.contains(&line) {
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

pub(crate) fn adapt_cpp_program(program: Node, settings: &Settings) -> Node {
    keep_cpp_file_scope(keep_cpp_imports(program, settings), settings)
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
