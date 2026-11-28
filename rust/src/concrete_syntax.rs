//! Lossless tokens and grammar productions, with UTF-8 byte ranges.

use crate::formal::lexer::Token;
use crate::meta::Node;

pub(crate) fn concrete_syntax(
    source: &str,
    language: &str,
    tokens: &[Token],
    mut productions: Vec<Node>,
) -> Node {
    let offsets: Vec<usize> = source
        .char_indices()
        .map(|(offset, _)| offset)
        .chain(std::iter::once(source.len()))
        .collect();
    let mut children = Vec::new();
    let mut position = 0;
    let mut append = |kind: &str, token_type: &str, start: usize, end: usize| {
        if end > start {
            children.push(
                Node::new(kind)
                    .with("type", token_type)
                    .with("start", offsets[start] as f64)
                    .with("end", offsets[end] as f64)
                    .with("text", &source[offsets[start]..offsets[end]]),
            );
        }
    };
    for token in tokens {
        if let Some((start, end)) = token.raw_span {
            append("Trivia", "layout", position, start);
            append("Token", token.kind.word(), start, end);
            position = end;
        }
    }
    append("Trivia", "layout", position, offsets.len() - 1);
    for production in &mut productions {
        for field in ["start", "end"] {
            let character = production.number(field).unwrap_or(0.0) as usize;
            production.set(field, offsets[character] as f64);
        }
    }
    record(source, language, children, productions)
}

pub(crate) fn record(
    source: &str,
    language: &str,
    children: Vec<Node>,
    productions: Vec<Node>,
) -> Node {
    Node::new("ConcreteSyntax")
        .with("language", language)
        .with("unit", "utf8")
        .with("start", 0.0)
        .with("end", source.len() as f64)
        .with("children", children)
        .with("productions", productions)
        .with("errors", Vec::<Node>::new())
}

/// Reconstruct the exact original text from the concrete token stream.
pub fn reconstruct_concrete(syntax: &Node) -> Result<String, String> {
    if !syntax.is("ConcreteSyntax") {
        return Err("Expected a concrete syntax tree".into());
    }
    Ok(syntax
        .nodes("children")
        .into_iter()
        .map(|child| child.str("text").unwrap_or_default())
        .collect())
}
