//! A meta tree as indented Links Notation, for people to read: one line per
//! node, its kind first, its plain fields as `(name value)` links and its
//! child nodes indented below it under their field name. Fields come in
//! name order, as in the JavaScript `formatMeta`.
//!
//! ```text
//!   program
//!     main: block
//!       statements
//!         print (newline true)
//!           value: binary (operator multiply) (type integer)
//!             left: name (name x) (type integer)
//!             right: number (type integer) (value 3)
//! ```

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

fn head(node: &Node) -> String {
    let mut parts = Vec::new();
    if !node.kind.is_empty() {
        parts.push(kebab(&node.kind));
    }
    for (field, value) in &node.fields {
        match value {
            _ if empty(value) => {}
            Value::List(items) if items.iter().all(scalar) => {
                let words: Vec<String> = items.iter().map(atom).collect();
                parts.push(format!("({field} {})", words.join(" ")));
            }
            _ if scalar(value) => parts.push(format!("({field} {})", atom(value))),
            _ => {}
        }
    }
    parts.join(" ")
}

fn lines(node: &Node, indent: &str, label: &str, out: &mut Vec<String>) {
    let prefix = if label.is_empty() {
        String::new()
    } else {
        format!("{label}: ")
    };
    out.push(
        format!("{indent}{prefix}{}", head(node))
            .trim_end()
            .to_string(),
    );
    let inner = format!("{indent}  ");
    for (field, value) in &node.fields {
        match value {
            _ if empty(value) => {}
            Value::Node(child) => lines(child, &inner, field, out),
            Value::List(items) if !items.iter().all(scalar) => {
                out.push(format!("{inner}{field}"));
                for item in items {
                    match item {
                        Value::Node(child) => lines(child, &format!("{inner}  "), "", out),
                        _ => out.push(format!("{inner}  {}", atom(item))),
                    }
                }
            }
            _ => {}
        }
    }
}

/// Meta tree (a program or a fragment) -> Links Notation text.
pub fn format_meta(node: &Node) -> String {
    let mut out = Vec::new();
    lines(node, "", "", &mut out);
    format!("{}\n", out.join("\n"))
}
