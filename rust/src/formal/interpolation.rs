//! Interpolated text literals: splitting their text into literal pieces
//! and embedded code, by interpolation style.

use super::lexer::InterpolationStyle;
use crate::meta::GrammarError;

type Parsed<T> = Result<T, GrammarError>;

/// A piece of interpolated text: literal text or embedded code.
pub enum Piece {
    Literal(String),
    Code(String),
}

/// Where an embedded expression starts, which bracket closes it, and what
/// the opener keeps of itself in the code.
fn interpolation_openers(
    style: InterpolationStyle,
) -> &'static [(&'static str, char, &'static str)] {
    match style {
        InterpolationStyle::Braces => &[("{", '}', "")],
        InterpolationStyle::DollarBraces => &[("${", '}', "")],
        InterpolationStyle::HashBraces => &[("#{", '}', "")],
        InterpolationStyle::Dollar => &[("${", '}', ""), ("{$", '}', "$")],
        InterpolationStyle::BackslashParentheses => &[("\\(", ')', "")],
        InterpolationStyle::DollarDoubled => &[("${", '}', "")],
        InterpolationStyle::DollarParentheses => &[("$(", ')', "")],
        InterpolationStyle::Plain => &[],
    }
}

fn starts_with_at(value: &[char], index: usize, prefix: &str) -> bool {
    prefix
        .chars()
        .enumerate()
        .all(|(offset, character)| value.get(index + offset) == Some(&character))
}

/// Split interpolated text into literal strings and code pieces. Nested
/// brackets inside the embedded expression are balanced, so `"\(f(x))"`
/// works.
pub fn split_interpolation(value: &str, style: InterpolationStyle) -> Parsed<Vec<Piece>> {
    let characters: Vec<char> = value.chars().collect();
    let mut pieces = Vec::new();
    let mut literal = String::new();
    let mut index = 0;
    while index < characters.len() {
        if let Some((code, end)) = embedded_code(&characters, index, style)? {
            if !literal.is_empty() {
                pieces.push(Piece::Literal(std::mem::take(&mut literal)));
            }
            pieces.push(Piece::Code(code));
            index = end;
            continue;
        }
        let length = literal_length(&characters, index, style);
        // A doubled brace stands for one brace.
        if length == 2 && characters[index] != '\\' {
            literal.push(characters[index]);
        } else {
            literal.extend(&characters[index..(index + length).min(characters.len())]);
        }
        index += length;
    }
    if !literal.is_empty() {
        pieces.push(Piece::Literal(literal));
    }
    Ok(pieces)
}

/// How many characters of literal text start at `index`: an escape sequence
/// or a doubled brace counts as two.
fn literal_length(value: &[char], index: usize, style: InterpolationStyle) -> usize {
    let backslash = value[index] == '\\';
    if backslash && style != InterpolationStyle::BackslashParentheses {
        return 2;
    }
    if style == InterpolationStyle::Braces
        && (starts_with_at(value, index, "{{") || starts_with_at(value, index, "}}"))
    {
        return 2;
    }
    if style == InterpolationStyle::DollarDoubled && starts_with_at(value, index, "$$") {
        return 2;
    }
    if backslash && !starts_with_at(value, index, "\\(") {
        2
    } else {
        1
    }
}

/// Code embedded in text at `index`, with the index just after it.
fn embedded_code(
    value: &[char],
    index: usize,
    style: InterpolationStyle,
) -> Parsed<Option<(String, usize)>> {
    if literal_length(value, index, style) == 2 {
        return Ok(None);
    }
    let opener = interpolation_openers(style)
        .iter()
        .find(|(open, _, _)| starts_with_at(value, index, open));
    let Some((open, close, keep)) = opener else {
        let dollar = matches!(
            style,
            InterpolationStyle::Dollar
                | InterpolationStyle::DollarDoubled
                | InterpolationStyle::DollarParentheses
        );
        if dollar
            && value[index] == '$'
            && value
                .get(index + 1)
                .is_some_and(|c| c.is_ascii_alphabetic() || *c == '_')
        {
            let length = value[index + 1..]
                .iter()
                .take_while(|c| c.is_ascii_alphanumeric() || **c == '_')
                .count();
            let code = value[index + 1..index + 1 + length].iter().collect();
            return Ok(Some((code, index + 1 + length)));
        }
        return Ok(None);
    };
    let start = index + open.chars().count();
    let end = closing_index(value, start, *close)?;
    let code: String = value[start..end - 1].iter().collect();
    Ok(Some((format!("{keep}{code}"), end)))
}

/// The index just after the bracket that closes one already opened.
fn closing_index(value: &[char], start: usize, close: char) -> Parsed<usize> {
    let inner = if close == '}' { '{' } else { '(' };
    let mut depth = 1;
    let mut end = start;
    while end < value.len() && depth > 0 {
        if value[end] == inner {
            depth += 1;
        } else if value[end] == close {
            depth -= 1;
        }
        end += 1;
    }
    if depth != 0 {
        return Err(GrammarError::syntax(
            format!("Unclosed \"{inner}\" in text"),
            0,
        ));
    }
    Ok(end)
}
