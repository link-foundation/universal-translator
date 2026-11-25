//! A meta tree as indented Links Notation, for people to read. Every node
//! is one line: its kind, its main value as a plain word and its other
//! plain fields as `(name value)` links. Its child nodes are nested below
//! it, in the order they are read, with no field names:
//!
//! ```text
//!   program (comments hi)
//!     declaration x (mutable false) (type text)
//!       text 'a b' (type text)
//!     print (newline true)
//!       binary multiply (type integer)
//!         name x (type text)
//!         number 3 (type integer)
//! ```
//!
//! A block is not written: its statements are the children of the node
//! that holds it (the main program, a function, a loop, the "then" of an
//! if). A field that comes after a block is introduced by its name, a plain
//! word such as `otherwise`, so it cannot be mistaken for one more
//! statement. Links Notation keeps `name:` for links that define a unique
//! name, and no field name is unique here. The JavaScript `formatMeta`
//! writes the same text.

use super::tree::{Node, Value};

fn kebab(text: &str) -> String {
    let mut out = String::new();
    let mut previous: Option<char> = None;
    for letter in text.chars() {
        if letter.is_uppercase()
            && previous.is_some_and(|it| it.is_lowercase() || it.is_ascii_digit())
        {
            out.push('-');
        }
        out.extend(letter.to_lowercase());
        previous = Some(letter);
    }
    out
}

fn plain(text: &str) -> bool {
    !text.is_empty()
        && text
            .chars()
            .all(|it| it.is_alphanumeric() || "_.+*/<>=!-".contains(it))
}

fn atom(value: &Value) -> String {
    match value {
        Value::Bool(flag) => flag.to_string(),
        Value::Number(number) => number.to_string(),
        Value::Text(text) if plain(text) => text.clone(),
        Value::Text(text) => format!("'{}'", text.replace('\'', "''")),
        _ => String::new(),
    }
}

/// The field written as a plain word right after the kind.
fn main_field(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "Binary" | "Unary" => "operator",
        "Blank" => "lines",
        "Boolean" | "Number" | "Text" => "value",
        "Call" => "callee",
        "Comment" => "text",
        "CountingLoop" => "variable",
        "Assignment" | "Declaration" | "Function" | "IndexAssignment" | "Name" | "Parameter"
        | "" => "name",
        _ => return None,
    })
}

/// The order in which child nodes are read; other fields follow by name.
const CHILD_ORDER: [&str; 23] = [
    "condition",
    "array",
    "index",
    "left",
    "operand",
    "right",
    "start",
    "end",
    "step",
    "length",
    "fill",
    "expression",
    "value",
    "arguments",
    "elements",
    "parts",
    "parameters",
    "functions",
    "statements",
    "then",
    "body",
    "main",
    "otherwise",
];

fn rank(field: &str) -> usize {
    CHILD_ORDER
        .iter()
        .position(|it| *it == field)
        .unwrap_or(CHILD_ORDER.len())
}

fn scalar(value: &Value) -> bool {
    !matches!(value, Value::List(_) | Value::Node(_))
}

fn empty(value: &Value) -> bool {
    match value {
        Value::List(items) => items.is_empty(),
        Value::Node(node) => node.kind.is_empty() && node.fields.is_empty(),
        _ => false,
    }
}

fn is_block(value: &Value) -> bool {
    matches!(value, Value::Node(node) if node.kind == "Block")
}

/// Fields holding nodes, in reading order.
fn child_fields(node: &Node) -> Vec<(&String, &Value)> {
    let mut fields: Vec<(&String, &Value)> = node
        .fields
        .iter()
        .filter(|(_, value)| match value {
            _ if empty(value) => false,
            Value::Node(_) => true,
            Value::List(items) => !items.iter().all(scalar),
            _ => false,
        })
        .collect();
    // A stable sort keeps the fields of the same rank in name order.
    fields.sort_by_key(|(field, _)| rank(field));
    fields
}

/// A node without a kind is named after its list: "parameter".
fn kind_of(node: &Node, list: &str) -> String {
    if !node.kind.is_empty() {
        kebab(&node.kind)
    } else {
        let name = kebab(list);
        name.strip_suffix('s').unwrap_or(&name).to_string()
    }
}

fn head(node: &Node, list: &str) -> String {
    let main = main_field(&node.kind);
    let mut parts = vec![kind_of(node, list)];
    let main_value = main
        .and_then(|field| node.fields.get(field))
        .filter(|it| scalar(it));
    if let Some(value) = main_value {
        parts.push(atom(value));
    }
    for (field, value) in &node.fields {
        if empty(value) || (main == Some(field.as_str()) && main_value.is_some()) {
            continue;
        }
        match value {
            Value::List(items) if items.iter().all(scalar) => {
                let mut words = vec![kebab(field)];
                words.extend(items.iter().map(atom));
                parts.push(format!("({})", words.join(" ")));
            }
            _ if scalar(value) => parts.push(format!("({} {})", kebab(field), atom(value))),
            _ => {}
        }
    }
    parts.retain(|it| !it.is_empty());
    parts.join(" ")
}

fn children(value: &Value, field: &str, indent: &str, out: &mut Vec<String>) {
    let items: Vec<&Value> = match value {
        Value::Node(node) if node.kind == "Block" => node
            .fields
            .get("statements")
            .and_then(Value::as_list)
            .map(|items| items.iter().collect())
            .unwrap_or_default(),
        Value::List(items) => items.iter().collect(),
        _ => vec![value],
    };
    for item in items {
        match item {
            Value::Node(child) => lines(child, indent, field, out),
            _ => out.push(format!("{indent}{}", atom(item))),
        }
    }
}

fn lines(node: &Node, indent: &str, list: &str, out: &mut Vec<String>) {
    out.push(format!("{indent}{}", head(node, list)));
    let inner = format!("{indent}  ");
    let mut after_block = false;
    for (field, value) in child_fields(node) {
        if after_block {
            out.push(format!("{inner}{}", kebab(field)));
            children(value, field, &format!("{inner}  "), out);
        } else {
            children(value, field, &inner, out);
        }
        after_block |= is_block(value);
    }
}

/// Meta tree (a program or a fragment) -> Links Notation text.
pub fn format_meta(node: &Node) -> String {
    let mut out = Vec::new();
    lines(node, "", "", &mut out);
    format!("{}\n", out.join("\n"))
}
