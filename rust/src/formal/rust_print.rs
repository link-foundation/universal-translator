use std::collections::HashSet;

use crate::meta::{Node, name, text};

pub(super) fn is_print(callee: &str) -> bool {
    matches!(callee, "print!" | "println!")
}

fn identifier(value: &str) -> bool {
    let mut bytes = value.bytes();
    match bytes.next() {
        Some(first) if first.is_ascii_alphabetic() || first == b'_' && value.len() > 1 => {
            bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        }
        _ => false,
    }
}

fn simple(value: &Node) -> bool {
    matches!(value.kind.as_str(), "Text" | "Number" | "Boolean")
        || value.is("Name") && value.str("name").is_some_and(identifier)
}

enum Piece<'a> {
    Literal(&'a str),
    Field(&'a str),
}

fn next_piece<'a>(format: &mut &'a str) -> Option<Piece<'a>> {
    let literal_end = format.find(['{', '}']).unwrap_or(format.len());
    if literal_end != 0 {
        let (literal, remainder) = format.split_at(literal_end);
        *format = remainder;
        return Some(Piece::Literal(literal));
    }
    if format.starts_with("{{") || format.starts_with("}}") {
        let literal = &format[..1];
        *format = &format[2..];
        return Some(Piece::Literal(literal));
    }
    let (field, remainder) = format.strip_prefix('{')?.split_once('}')?;
    if field.contains('{') {
        return None;
    }
    *format = remainder;
    Some(Piece::Field(field))
}

/// Resolve default Display fields. Only empty fields advance the automatic
/// index, and explicit named arguments take precedence over captures.
pub(super) fn parts(mut format: &str, values: &[Node], named: &[Node]) -> Option<Vec<Node>> {
    let mut parts = Vec::new();
    let mut used = Vec::new();
    let mut automatic = 0;
    let mut captured = false;
    while !format.is_empty() {
        let field = match next_piece(&mut format)? {
            Piece::Literal(literal) => {
                parts.push(text(literal));
                continue;
            }
            Piece::Field(field) => field.trim_end(),
        };
        if field.is_empty() || field.bytes().all(|byte| byte.is_ascii_digit()) {
            let position = if field.is_empty() {
                let position = automatic;
                automatic += 1;
                position
            } else {
                field.parse::<usize>().ok()?
            };
            parts.push(values.get(position)?.clone());
            used.push(position);
        } else if let Some(position) = named
            .iter()
            .position(|argument| argument.str("name") == Some(field))
        {
            parts.push(named[position].node("value")?.clone());
            used.push(values.len() + position);
        } else if identifier(field) {
            parts.push(name(field));
            captured = true;
        } else {
            return None;
        }
    }
    let mut arguments = values
        .iter()
        .chain(named.iter().filter_map(|argument| argument.node("value")));
    let argument_count = values.len() + named.len();
    let ordered =
        !captured && used.len() == argument_count && used.iter().copied().eq(0..used.len());
    // A different field order must not move or duplicate side effects.
    (used.into_iter().collect::<HashSet<_>>().len() == argument_count
        && (ordered || arguments.all(simple)))
    .then_some(parts)
}

/// Native format strings retain their spelling. Expose direct captures as
/// arguments so the identifier rules can rename the variables they read.
pub(super) fn native_call(call: &Node, mut format: &str, named: &[Node]) -> Node {
    let mut seen: HashSet<_> = named
        .iter()
        .filter_map(|argument| argument.str("name"))
        .collect();
    let mut arguments = call.node_list("arguments");
    while let Some(piece) = next_piece(&mut format) {
        if let Piece::Field(field) = piece {
            let label = field.split(':').next().unwrap_or_default().trim_end();
            if identifier(label) && seen.insert(label) {
                arguments.push(
                    Node::new("NamedArgument")
                        .with("name", label)
                        .with("value", name(label)),
                );
            }
        }
    }
    call.clone().with("arguments", arguments)
}
