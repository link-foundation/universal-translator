//! A verified embedded library acquires its contract independently of its caller.
use super::objpak_runtime;
use super::parser::{Parsed, Parser};
use super::{
    languages::{Blocks, Syntax},
    lexer::{Token, TokenType, tokenize},
};
use crate::meta::{GrammarError, Node, name};

fn library_tokens(source: &str, syntax: &Syntax) -> Result<Vec<Token>, GrammarError> {
    let mut lexical = syntax.clone();
    lexical.symbols = &[">>>", "^", "~"];
    Ok(tokenize(source, &lexical)?
        .into_iter()
        .filter(|token| {
            token.kind != TokenType::End
                && (syntax.blocks == Blocks::Indentation || token.kind != TokenType::Newline)
        })
        .collect())
}

fn significant_break(tokens: &[Token], index: usize, language: &str) -> bool {
    if language != "javascript" || index == 0 {
        return false;
    }
    let previous = &tokens[index - 1];
    let token = &tokens[index];
    (matches!(
        previous.value.as_str(),
        "return" | "throw" | "break" | "continue" | "yield"
    ) || matches!(token.value.as_str(), "++" | "--"))
        && previous.line != token.line
}

fn library_end(source: &str, start: usize, definition: &str, syntax: &Syntax) -> Option<usize> {
    let expected = library_tokens(definition, syntax).ok()?;
    let actual = library_tokens(&source[start..], syntax).ok()?;
    if actual.len() < expected.len()
        || !expected
            .iter()
            .zip(&actual)
            .enumerate()
            .all(|(index, (a, b))| {
                a.kind == b.kind
                    && (matches!(a.kind, TokenType::Indent | TokenType::Dedent)
                        || a.value == b.value)
                    && a.quote == b.quote
                    && a.style == b.style
                    && joined_words(&expected, index) == joined_words(&actual, index)
                    && significant_break(&expected, index, syntax.id)
                        == significant_break(&actual, index, syntax.id)
            })
    {
        return None;
    }
    let end = actual[..expected.len()]
        .iter()
        .filter_map(|t| t.raw_span.map(|(_, end)| end))
        .max()?;
    let byte_end = source[start..]
        .char_indices()
        .nth(end)
        .map_or(source.len() - start, |(offset, _)| offset);
    Some(start + byte_end)
}

fn joined_words(tokens: &[Token], index: usize) -> bool {
    if index == 0 {
        return false;
    }
    let previous = &tokens[index - 1];
    let token = &tokens[index];
    matches!(previous.kind, TokenType::Name | TokenType::Number)
        && matches!(token.kind, TokenType::Name | TokenType::Number)
        && previous
            .raw_span
            .zip(token.raw_span)
            .is_some_and(|((_, end), (start, _))| end == start)
}

fn top_level(source: &str, start: usize, syntax: &Syntax) -> bool {
    if start > 0 && !matches!(source.as_bytes()[start - 1], b'\r' | b'\n') {
        return false;
    }
    let mut lexical = syntax.clone();
    lexical.symbols = &["^", "~"];
    let Ok(tokens) = tokenize(&source[..start], &lexical) else {
        return false;
    };
    tokens
        .iter()
        .filter(|t| t.kind == TokenType::Symbol)
        .fold(0, |depth, t| {
            depth
                + match t.value.as_str() {
                    "{" => 1,
                    "}" => -1,
                    _ => 0,
                }
        })
        == 0
}

pub(crate) struct LibrarySource {
    pub masked: String,
    pub bindings: Vec<String>,
    definitions: Vec<(usize, usize)>,
}

pub(crate) fn prepare(source: &str, syntax: &Syntax) -> LibrarySource {
    let language = syntax.id;
    let runtime = match language {
        "objc" => objpak_runtime::OBJC,
        "python" => objpak_runtime::PYTHON,
        "javascript" => objpak_runtime::JAVASCRIPT,
        "rust" => objpak_runtime::RUST,
        _ => {
            return LibrarySource {
                masked: source.into(),
                bindings: Vec::new(),
                definitions: Vec::new(),
            };
        }
    };
    let prefix = if language == "objc" {
        "id UtObjpakSet"
    } else if language == "rust" {
        "struct UtObjpakSet"
    } else {
        "class UtObjpakSet"
    };
    let mut masked = source.to_owned();
    let mut bindings = Vec::new();
    let mut definitions = Vec::new();
    for (position, _) in source.match_indices(prefix) {
        let name_start = position
            + if language == "objc" {
                3
            } else if language == "rust" {
                7
            } else {
                6
            };
        let name_end = source[name_start..]
            .find(|c: char| !c.is_ascii_alphanumeric() && c != '_')
            .map_or(source.len(), |end| name_start + end);
        let binding = &source[name_start..name_end];
        if !binding
            .strip_prefix("UtObjpakSet")
            .is_some_and(|suffix| suffix.chars().all(|c| c == '_'))
        {
            continue;
        }
        let definition = runtime.replace("$SET$", binding);
        let Some(start) = position.checked_sub(if language == "rust" {
            "#[derive(Clone)]\n".len()
        } else {
            0
        }) else {
            continue;
        };
        if !top_level(source, start, syntax) {
            continue;
        }
        let Some(end) = library_end(source, start, &definition, syntax) else {
            continue;
        };
        let blank = source[start..end]
            .chars()
            .map(|c| if matches!(c, '\n' | '\r') { c } else { ' ' })
            .collect::<String>();
        masked.replace_range(start..end, &blank);
        bindings.push(binding.to_owned());
        definitions.push((start, end));
    }
    LibrarySource {
        masked,
        bindings,
        definitions,
    }
}

pub(crate) fn concrete(
    source: &str,
    language: &str,
    tokens: &[Token],
    productions: Vec<Node>,
    library: &LibrarySource,
) -> Node {
    let ranges = library
        .definitions
        .iter()
        .map(|&(start, end)| {
            (
                source[..start].chars().count(),
                source[..end].chars().count(),
            )
        })
        .collect::<Vec<_>>();
    let tokens = tokens
        .iter()
        .filter(|token| {
            !token.raw_span.is_some_and(|(start, end)| {
                ranges.iter().any(|&(from, to)| start >= from && end <= to)
            })
        })
        .cloned()
        .collect::<Vec<_>>();
    let mut syntax =
        crate::concrete_syntax::concrete_syntax(source, language, &tokens, productions);
    let mut children = syntax.node_list("children");
    let mut productions = syntax.node_list("productions");
    for &(start, end) in &library.definitions {
        children = children
            .into_iter()
            .flat_map(|child| {
                let from = child.number("start").unwrap_or_default() as usize;
                let to = child.number("end").unwrap_or_default() as usize;
                if !child.is("Trivia") || from > start || to < end {
                    return vec![child];
                }
                let mut split = Vec::new();
                if from < start {
                    split.push(
                        child
                            .clone()
                            .with("end", start as f64)
                            .with("text", &source[from..start]),
                    );
                }
                split.push(
                    Node::new("Token")
                        .with("type", "library-definition")
                        .with("start", start as f64)
                        .with("end", end as f64)
                        .with("text", &source[start..end]),
                );
                if to > end {
                    split.push(
                        child
                            .with("start", end as f64)
                            .with("text", &source[end..to]),
                    );
                }
                split
            })
            .collect();
        productions.push(
            Node::new("Production")
                .with("rule", "objpakLibrary")
                .with("concept", "LibraryDefinition")
                .with("start", start as f64)
                .with("end", end as f64),
        );
    }
    syntax.set("children", children);
    syntax.set("productions", productions);
    syntax
}

impl Parser {
    pub(crate) fn objpak_primary(&mut self) -> Parsed<Option<Node>> {
        if self.syntax.id == "python" && self.is("(") && self.is_at(":=", 2) {
            self.position += 1;
            let variable = self.expect_name()?;
            self.expect(":=")?;
            let value = self.expression()?;
            self.expect(")")?;
            if !value.is("Binary")
                || !matches!(value.str("operator"), Some("add" | "subtract"))
                || !value.node("left").is_some_and(|v| v.is_name(&variable))
                || value.node("right").and_then(|n| n.number("value")) != Some(1.0)
            {
                return Err(GrammarError::new(
                    "Assignment expressions currently support unit updates of their own variable",
                ));
            }
            return Ok(Some(
                Node::new("Update")
                    .with("operand", name(variable))
                    .with(
                        "delta",
                        if value.str("operator") == Some("add") {
                            1.0
                        } else {
                            -1.0
                        },
                    )
                    .with("prefix", true),
            ));
        }
        if self.syntax.id == "python"
            && ["sys", ".", "argv", "[", "1", ":", "]"]
                .iter()
                .enumerate()
                .all(|(i, value)| self.is_at(value, i))
        {
            self.position += 7;
            return Ok(Some(
                Node::new("ProcessArguments").with("includeProgram", false),
            ));
        }
        if self.syntax.id != "rust" {
            return Ok(None);
        }
        for include in [true, false] {
            let mut values = vec!["std", "::", "env", "::", "args", "(", ")"];
            if !include {
                values.extend([".", "skip", "(", "1", ")"]);
            }
            values.extend([
                ".", "collect", "::", "<", "Vec", "<", "String", ">>", "(", ")",
            ]);
            if values
                .iter()
                .enumerate()
                .all(|(i, value)| self.is_at(value, i))
            {
                self.position += values.len();
                return Ok(Some(
                    Node::new("ProcessArguments").with("includeProgram", include),
                ));
            }
        }
        if !self.is("{") {
            return Ok(None);
        }
        let body = self.block()?;
        let statements = body.nodes("statements");
        if matches!(statements.len(), 2 | 3) {
            let prefix = statements.len() == 2;
            let assignment = &statements[if prefix { 0 } else { 1 }];
            let variable = assignment.str("name").unwrap_or_default();
            let result = statements.last().and_then(|n| n.node("value"));
            let valid_result = if prefix {
                result.is_some_and(|r| r.is_name(variable))
            } else {
                statements[0].is("Declaration")
                    && statements[0]
                        .node("value")
                        .is_some_and(|v| v.is_name(variable))
                    && result
                        .is_some_and(|r| r.is_name(statements[0].str("name").unwrap_or_default()))
            };
            if assignment.is("Assignment")
                && matches!(assignment.str("operator"), Some("+=" | "-="))
                && assignment.node("value").and_then(|v| v.number("value")) == Some(1.0)
                && valid_result
            {
                return Ok(Some(
                    Node::new("Update")
                        .with("operand", name(variable))
                        .with(
                            "delta",
                            if assignment.str("operator") == Some("+=") {
                                1.0
                            } else {
                                -1.0
                            },
                        )
                        .with("prefix", prefix),
                ));
            }
        }
        Err(GrammarError::new(
            "A value block currently supports only a numeric unit update",
        ))
    }
}
