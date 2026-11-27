use std::collections::{HashMap, HashSet};

use super::{emitter::Emitter, languages::Syntax, names::avoid_reserved};
use crate::meta::{GrammarError, Node, Value, walk};

pub(super) fn supports_records(syntax: &Syntax) -> bool {
    syntax.id == "rust" || (syntax.id == "javascript" && syntax.declaration_keyword != Some("var"))
}

fn portable_name(name: &str) -> bool {
    let mut bytes = name.bytes();
    bytes
        .next()
        .is_some_and(|first| first.is_ascii_alphabetic() || first == b'_')
        && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        && !matches!(
            name,
            "_" | "__proto__"
                | "Self"
                | "arguments"
                | "eval"
                | "abstract"
                | "become"
                | "box"
                | "do"
                | "final"
                | "gen"
                | "implements"
                | "interface"
                | "macro"
                | "override"
                | "priv"
                | "protected"
                | "public"
                | "try"
                | "typeof"
                | "union"
                | "unsized"
                | "virtual"
                | "yield"
        )
        && ["javascript", "rust"]
            .iter()
            .all(|language| avoid_reserved(name.to_owned(), language) == name)
}

pub(super) fn valid_record(definition: &Node) -> bool {
    if !definition.is("RecordDefinition") || !definition.str("name").is_some_and(portable_name) {
        return false;
    }
    let Some(parameters) = definition.get("parameters").and_then(Value::as_list) else {
        return false;
    };
    let Some(fields) = definition.get("fields").and_then(Value::as_list) else {
        return false;
    };
    if fields.len() != parameters.len() {
        return false;
    }
    let parameters: HashSet<_> = parameters
        .iter()
        .filter_map(Value::as_str)
        .filter(|parameter| portable_name(parameter))
        .collect();
    let mut names = HashSet::new();
    let mut bound = HashSet::new();
    parameters.len() == fields.len()
        && fields.iter().all(|field| {
            let Some(field) = field.as_node().filter(|field| field.is("RecordField")) else {
                return false;
            };
            let Some(name) = field.str("name").filter(|name| portable_name(name)) else {
                return false;
            };
            field.str("parameter").is_some_and(|parameter| {
                names.insert(name) && parameters.contains(parameter) && bound.insert(parameter)
            })
        })
}

fn field_line(emitter: &mut Emitter, field: &Node, line: &str) {
    let _origin = crate::emission_map::active(field);
    emitter.line(line);
}

pub(super) fn write_record(emitter: &mut Emitter, definition: &Node) -> Result<(), GrammarError> {
    if !valid_record(definition) {
        return Err(GrammarError::new(
            "A record requires one field per distinct constructor parameter",
        ));
    }
    let _origin = crate::emission_map::active(definition);
    let name = definition.str("name").unwrap_or_default();
    let parameters = definition.texts("parameters");
    let fields = definition.nodes("fields");
    emitter.comments(definition, "comments");
    if emitter.id() == "javascript" {
        emitter.open_block(&format!("class {name}"));
        emitter.comments(definition, "constructorComments");
        emitter.open_block(&format!("constructor({})", parameters.join(", ")));
        for field in fields {
            let name = field.str("name").unwrap_or_default();
            let parameter = field.str("parameter").unwrap_or_default();
            field_line(emitter, field, &format!("this.{name} = {parameter};"));
        }
    } else {
        let types: Vec<String> = (0..parameters.len())
            .map(|index| {
                let candidate = format!("Field{index}");
                if candidate == name {
                    format!("{candidate}Type")
                } else {
                    candidate
                }
            })
            .collect();
        let kind_by_parameter: HashMap<_, _> =
            parameters.iter().map(String::as_str).zip(&types).collect();
        let generic = if types.is_empty() {
            String::new()
        } else {
            format!("<{}>", types.join(", "))
        };
        emitter.open_block(&format!("pub struct {name}{generic}"));
        for field in &fields {
            let name = field.str("name").unwrap_or_default();
            let parameter = field.str("parameter").unwrap_or_default();
            field_line(
                emitter,
                field,
                &format!("pub {name}: {},", kind_by_parameter[parameter]),
            );
        }
        emitter.close_block();
        emitter.line("");
        emitter.open_block(&format!("impl{generic} {name}{generic}"));
        emitter.comments(definition, "constructorComments");
        let args = parameters
            .iter()
            .zip(&types)
            .map(|(parameter, kind)| format!("{parameter}: {kind}"))
            .collect::<Vec<_>>()
            .join(", ");
        emitter.open_block(&format!("pub fn new({args}) -> Self"));
        emitter.open_block("Self");
        for field in fields {
            let name = field.str("name").unwrap_or_default();
            let parameter = field.str("parameter").unwrap_or_default();
            field_line(emitter, field, &format!("{name}: {parameter},"));
        }
        emitter.close_block();
    }
    emitter.close_block();
    emitter.close_block();
    Ok(())
}

// Keep raw class names out of executable output until their references have
// a representation independent of the source's constructor syntax.
pub(super) fn check_record_references(program: &Node) -> Result<(), GrammarError> {
    let definitions = program.nodes("definitions");
    let names: HashSet<_> = definitions
        .iter()
        .filter_map(|definition| definition.str("name"))
        .collect();
    if names.len() != definitions.len() {
        return Err(GrammarError::new("Duplicate record definitions"));
    }
    let mut found = false;
    walk(program, |node| {
        let name = match node.kind.as_str() {
            "Name" => node.str("name"),
            "Call" => node
                .str("callee")
                .map(|name| name.strip_prefix("new ").unwrap_or(name)),
            _ => None,
        };
        found |=
            name.is_some_and(|name| names.contains(name.split([':', '.']).next().unwrap_or(name)));
    });
    if found {
        return Err(GrammarError::new(
            "Record construction and references require instance translation",
        ));
    }
    Ok(())
}
