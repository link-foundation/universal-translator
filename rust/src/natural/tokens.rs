//! Split one controlled sentence (or one template) into tokens.
//!
//! ```text
//!   word       a run of letters, marks and digits; "-", "_", "'" and the
//!              language's name joiner may join such runs into one word
//!   number     an integer, optionally negative ("-5")
//!   text       a quoted literal, in the language's own quotation marks;
//!              a doubled closing mark stands for the mark itself
//!   open/close parentheses (ASCII or full width)
//!   separator  the language's list separator (or an ASCII comma)
//!   slot       "{name}", only inside templates
//! ```

use regex::Regex;
use std::sync::LazyLock;

use crate::meta::format_number;

/// What a token is.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Word,
    Number,
    Text,
    Open,
    Close,
    Separator,
    Slot,
}

/// One token: its kind, its text (the spelled number for numbers) and, for
/// words, the lower-case form the reader compares.
#[derive(Clone, Debug, PartialEq)]
pub struct Token {
    pub kind: Kind,
    pub value: String,
    pub folded: String,
    pub number: f64,
}

impl Token {
    pub fn new(kind: Kind, value: impl Into<String>) -> Self {
        let value = value.into();
        let folded = if kind == Kind::Word {
            fold(&value)
        } else {
            String::new()
        };
        Token {
            kind,
            value,
            folded,
            number: 0.0,
        }
    }

    pub fn word(value: impl Into<String>) -> Self {
        Token::new(Kind::Word, value)
    }

    pub fn number(value: f64) -> Self {
        Token {
            kind: Kind::Number,
            value: format_number(value),
            folded: String::new(),
            number: value,
        }
    }
}

/// Zero-width (non-)joiners belong to words, as in Persian "می\u{200c}شود".
static LETTER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[\p{L}\p{M}\p{N}\x{200c}\x{200d}]$").expect("letter pattern"));

pub fn is_letter(character: char) -> bool {
    let mut buffer = [0; 4];
    LETTER.is_match(character.encode_utf8(&mut buffer))
}

/// Lower case, as JavaScript's `toLowerCase` spells it.
pub fn fold(word: &str) -> String {
    word.to_lowercase()
}

fn is_space(character: char) -> bool {
    character.is_whitespace() || character == '\u{feff}'
}

/// The language details the tokenizer needs.
pub struct Spelling<'a> {
    pub quotes: (&'a str, &'a str),
    pub list_separator: &'a str,
    pub name_joiner: &'a str,
}

struct Context {
    opening: Vec<char>,
    closing: Vec<char>,
    templates: bool,
    separators: Vec<char>,
    joiners: Vec<char>,
}

fn starts_with(source: &[char], index: usize, part: &[char]) -> bool {
    !part.is_empty()
        && source.len() >= index + part.len()
        && source[index..index + part.len()] == *part
}

fn read_word(source: &[char], start: usize, joiners: &[char]) -> usize {
    let mut end = start;
    while end < source.len() {
        let character = source[end];
        let joins = joiners.contains(&character)
            && end > start
            && end + 1 < source.len()
            && (is_letter(source[end + 1]) || source[end + 1] == '_');
        if is_letter(character) || joins || character == '_' {
            end += 1;
        } else {
            break;
        }
    }
    end
}

fn read_text(source: &[char], start: usize, closing: &[char]) -> Result<(String, usize), String> {
    let mut value = String::new();
    let mut index = start;
    while index < source.len() {
        if starts_with(source, index, closing) {
            if starts_with(source, index + closing.len(), closing) {
                value.extend(closing);
                index += closing.len() * 2;
                continue;
            }
            return Ok((value, index + closing.len()));
        }
        value.push(source[index]);
        index += 1;
    }
    Err(format!(
        "Unclosed quotation in \"{}\"",
        source.iter().collect::<String>()
    ))
}

fn operand_end(token: Option<&Token>) -> bool {
    token.is_some_and(|token| matches!(token.kind, Kind::Number | Kind::Text | Kind::Close))
}

fn starts_number(source: &[char], index: usize, previous: Option<&Token>) -> bool {
    source[index].is_ascii_digit()
        || (source[index] == '-'
            && source.get(index + 1).is_some_and(char::is_ascii_digit)
            && !operand_end(previous))
}

fn read_number(source: &[char], index: usize) -> (Token, usize) {
    let mut end = index + 1;
    while end < source.len() && source[end].is_ascii_digit() {
        end += 1;
    }
    let text: String = source[index..end].iter().collect();
    (Token::number(text.parse::<f64>().unwrap_or(0.0)), end)
}

fn read_token(
    source: &[char],
    index: usize,
    context: &Context,
    previous: Option<&Token>,
) -> Result<(Token, usize), String> {
    let character = source[index];
    if context.templates && character == '{' {
        let end = source[index..]
            .iter()
            .position(|&other| other == '}')
            .map(|offset| index + offset)
            .ok_or_else(|| "Unclosed slot in a template".to_owned())?;
        let value: String = source[index + 1..end].iter().collect();
        return Ok((Token::new(Kind::Slot, value), end + 1));
    }
    if starts_with(source, index, &context.opening) {
        let (value, end) = read_text(source, index + context.opening.len(), &context.closing)?;
        return Ok((Token::new(Kind::Text, value), end));
    }
    if starts_number(source, index, previous) {
        return Ok(read_number(source, index));
    }
    if character == '(' || character == '（' {
        return Ok((Token::new(Kind::Open, "("), index + 1));
    }
    if character == ')' || character == '）' {
        return Ok((Token::new(Kind::Close, ")"), index + 1));
    }
    if context.separators.contains(&character) {
        return Ok((
            Token::new(Kind::Separator, character.to_string()),
            index + 1,
        ));
    }
    if is_letter(character) || character == '_' {
        let end = read_word(source, index, &context.joiners);
        let value: String = source[index..end].iter().collect();
        return Ok((Token::word(value), end));
    }
    // Any other mark (for example "!" or "=") is a word of its own.
    Ok((Token::word(character.to_string()), index + 1))
}

/// The only character of a one-character text.
fn single(text: &str) -> Option<char> {
    let mut characters = text.chars();
    let first = characters.next()?;
    characters.next().is_none().then_some(first)
}

/// The tokens of a sentence, or of a template when `templates` is set.
pub fn tokenize(source: &str, spelling: &Spelling, templates: bool) -> Result<Vec<Token>, String> {
    let mut separators: Vec<char> = single(spelling.list_separator).into_iter().collect();
    separators.push(',');
    let mut joiners = vec!['-', '\'', '’'];
    joiners.extend(single(spelling.name_joiner));
    let context = Context {
        opening: spelling.quotes.0.chars().collect(),
        closing: spelling.quotes.1.chars().collect(),
        templates,
        separators,
        joiners,
    };
    let characters: Vec<char> = source.chars().collect();
    let mut tokens: Vec<Token> = Vec::new();
    let mut index = 0;
    while index < characters.len() {
        if is_space(characters[index]) {
            index += 1;
            continue;
        }
        let (token, end) = read_token(&characters, index, &context, tokens.last())?;
        tokens.push(token);
        index = end;
    }
    Ok(tokens)
}
