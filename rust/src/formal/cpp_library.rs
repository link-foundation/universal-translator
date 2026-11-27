//! Pass through C++ library imports when the emitted code uses the same
//! library and namespace as the source program.

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

pub(crate) fn keep_cpp_imports(mut program: Node, settings: &Settings) -> Node {
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
