//! Lossless records for line-oriented readers and incomplete source.

use std::sync::LazyLock;

use regex::Regex;

use crate::meta::{Node, Value};
use crate::partial::{Part, PartStatus};

static LEXEMES: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[\p{L}\p{M}\p{N}_\x{200c}\x{200d}]+|[^\s\x{feff}]").expect("source lexemes")
});

fn leaf(kind: &str, token_type: &str, source: &str, start: usize, end: usize) -> Node {
    Node::new(kind)
        .with("type", token_type)
        .with("start", start as f64)
        .with("end", end as f64)
        .with("text", &source[start..end])
}

fn production(concept: &str, rule: &str, start: usize, end: usize) -> Node {
    Node::new("Production")
        .with("rule", rule)
        .with("concept", concept)
        .with("start", start as f64)
        .with("end", end as f64)
}

fn productions(source: &str, tree: &Node, starts: &[usize], result: &mut Vec<Node>) {
    if let Some(origin) = &tree.origin
        && &*origin.source == source
    {
        let mut lines = origin.lines.clone();
        lines.sort_unstable();
        lines.dedup();
        let mut index = 0;
        while index < lines.len() {
            let first = lines[index];
            let mut last = first;
            while lines.get(index + 1) == Some(&(last + 1)) {
                index += 1;
                last = lines[index];
            }
            if let Some(start) = starts.get(first) {
                result.push(production(
                    &tree.kind,
                    "source-lines",
                    *start,
                    starts.get(last + 1).copied().unwrap_or(source.len()),
                ));
            }
            index += 1;
        }
    }
    fn visit(source: &str, value: &Value, starts: &[usize], result: &mut Vec<Node>) {
        match value {
            Value::Node(node) => productions(source, node, starts, result),
            Value::List(items) => items
                .iter()
                .for_each(|item| visit(source, item, starts, result)),
            _ => {}
        }
    }
    tree.fields
        .values()
        .for_each(|value| visit(source, value, starts, result));
}

pub(crate) fn source_syntax(
    source: &str,
    language: &str,
    tree: Option<&Node>,
    parts: &[Part],
) -> Node {
    let starts: Vec<_> = std::iter::once(0)
        .chain(source.match_indices('\n').map(|(index, _)| index + 1))
        .collect();
    let mut children = Vec::new();
    let mut position = 0;
    for token in LEXEMES.find_iter(source) {
        if token.start() > position {
            children.push(leaf("Trivia", "layout", source, position, token.start()));
        }
        let first = token.as_str().chars().next().expect("nonempty lexeme");
        let token_type = if first == '_' || crate::natural::tokens::is_letter(first) {
            "word"
        } else {
            "symbol"
        };
        children.push(leaf(
            "Token",
            token_type,
            source,
            token.start(),
            token.end(),
        ));
        position = token.end();
    }
    if position < source.len() {
        children.push(leaf("Trivia", "layout", source, position, source.len()));
    }
    let mut views = Vec::new();
    if let Some(tree) = tree {
        productions(source, tree, &starts, &mut views);
    }
    let mut errors = Vec::new();
    for part in parts {
        let start = starts.get(part.start).copied().unwrap_or(source.len());
        let end = starts.get(part.end).copied().unwrap_or(source.len());
        if part.status == PartStatus::Read {
            views.push(production(
                part.kind.map_or("fragment", |kind| kind.as_str()),
                "fragment",
                start,
                end,
            ));
        } else {
            errors.push(
                Node::new("Error")
                    .with("start", start as f64)
                    .with("end", end as f64)
                    .with("message", part.message.as_deref().unwrap_or_default()),
            );
        }
    }
    crate::concrete_syntax::record(source, language, children, views).with("errors", errors)
}

pub(crate) fn source_tree(source: &str, language: &str, tree: &Node) -> Node {
    Node::new("SourceProgram")
        .with("language", language)
        .with("syntax", source_syntax(source, language, Some(tree), &[]))
}
