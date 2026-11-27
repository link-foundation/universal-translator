//! Rule-based lexer. One set of token rules serves every language; the
//! language description only decides which comment markers, quotes and
//! layout rules (indentation, line ends) apply.

use super::comment_syntax::block_comment_end;
pub use super::languages::InterpolationStyle;
use super::languages::{Blocks, Syntax};
use crate::meta::GrammarError;

const SYMBOLS: [&str; 54] = [
    "...", "..<", "..=", "===", "!==", "**", "//", "<<", ">>", "::", "->", "=>", ":=", "==", "!=",
    "~=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "..", "{", "}", "(",
    ")", "[", "]", ";", ",", ".", ":", "+", "-", "*", "/", "%", "<", ">", "=", "!", "&", "|", "?",
    "$", "#", "@", "\\",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenType {
    Newline,
    Indent,
    Dedent,
    Comment,
    Directive,
    Text,
    InlineText,
    Number,
    Name,
    Symbol,
    End,
}

impl TokenType {
    pub fn word(self) -> &'static str {
        match self {
            TokenType::Newline => "newline",
            TokenType::Indent => "indent",
            TokenType::Dedent => "dedent",
            TokenType::Comment => "comment",
            TokenType::Directive => "directive",
            TokenType::Text => "text",
            TokenType::InlineText => "inlineText",
            TokenType::Number => "number",
            TokenType::Name => "name",
            TokenType::Symbol => "symbol",
            TokenType::End => "end",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Token {
    pub kind: TokenType,
    /// The token text; indentation tokens hold the column width.
    pub value: String,
    pub line: usize,
    pub quote: Option<char>,
    pub style: InterpolationStyle,
    /// Whether a text value is already decoded, as doubled quotes are.
    pub decoded: bool,
    /// Newlines: the empty lines that follow this line end.
    pub blank: usize,
    /// Comments after code on the same line: the spaces before them.
    pub trailing: Option<String>,
    /// Comments written as block comments.
    pub block: bool,
    /// Comments: where the comment text starts and stops in the source, in
    /// characters (the comment markers are outside). Names: where the name
    /// starts and stops.
    pub span: Option<(usize, usize)>,
    /// Entire source spelling, including comment markers and quote delimiters.
    pub raw_span: Option<(usize, usize)>,
}

impl Token {
    /// The value, or the token type when the value is empty, as error
    /// messages show it.
    pub fn shown(&self) -> &str {
        let empty = self.value.is_empty() || (self.kind == TokenType::Dedent && self.value == "0");
        if empty { self.kind.word() } else { &self.value }
    }
}

/// Text between quotes. Most languages escape with a backslash; Pascal, Ada,
/// Fortran and Visual Basic write a quote inside text as two quotes instead,
/// and keep backslashes as they are.
fn read_quoted(
    source: &[char],
    start: usize,
    quote: char,
    line: usize,
    doubled: bool,
    triple: bool,
) -> Result<(String, usize), GrammarError> {
    let width = if triple { 3 } else { 1 };
    let mut index = start + width;
    let mut raw = String::new();
    while index < source.len() {
        if source
            .get(index..index + width)
            .is_some_and(|part| part.iter().all(|c| *c == quote))
        {
            if !doubled || source.get(index + 1) != Some(&quote) {
                break;
            }
            raw.push(quote);
            index += 2;
        } else if source[index] == '\\' && !doubled {
            raw.extend(&source[index..(index + 2).min(source.len())]);
            index += 2;
        } else {
            if source[index] == '\n' && quote != '`' && !triple {
                return Err(GrammarError::syntax("Unterminated text literal", line));
            }
            raw.push(source[index]);
            index += 1;
        }
    }
    if index >= source.len() {
        return Err(GrammarError::syntax("Unterminated text literal", line));
    }
    Ok((raw, index + width))
}

/// Replace escape sequences such as `\n` and `\u{1F600}` with the characters
/// they stand for. An unknown escape stands for the escaped character.
pub fn decode_escapes(raw: &str) -> String {
    let characters: Vec<char> = raw.chars().collect();
    let mut result = String::new();
    let mut index = 0;
    while index < characters.len() {
        let character = characters[index];
        let following = characters.get(index + 1).copied();
        match following {
            Some(code) if character == '\\' && code != '\n' && code != '\r' => {
                if let Some((decoded, length)) = unicode_escape(&characters[index + 1..]) {
                    result.push(decoded);
                    index += 1 + length;
                    continue;
                }
                result.push(match code {
                    'n' => '\n',
                    't' => '\t',
                    'r' => '\r',
                    '0' => '\0',
                    other => other,
                });
                index += 2;
            }
            _ => {
                result.push(character);
                index += 1;
            }
        }
    }
    result
}

/// `u{hex}` at the start of `rest`: the character and the length consumed.
fn unicode_escape(rest: &[char]) -> Option<(char, usize)> {
    if rest.first() != Some(&'u') || rest.get(1) != Some(&'{') {
        return None;
    }
    let digits: String = rest[2..]
        .iter()
        .take_while(|c| c.is_ascii_hexdigit())
        .collect();
    if digits.is_empty() || rest.get(2 + digits.len()) != Some(&'}') {
        return None;
    }
    let decoded = u32::from_str_radix(&digits, 16)
        .ok()
        .and_then(char::from_u32)?;
    Some((decoded, digits.len() + 3))
}

/// Concrete syntax: the text of a comment keeps its inner whitespace. Only
/// the one space that usually follows the marker and the spaces before the
/// line end are dropped.
pub fn comment_text(raw: &str) -> String {
    raw.strip_prefix(' ').unwrap_or(raw).trim_end().to_owned()
}

/// A block comment keeps its lines. Continuation lines lose the indentation
/// of the comment itself, so they keep their place relative to it.
pub fn block_comment_text(raw: &str, column: usize) -> String {
    let lines: Vec<&str> = raw.split('\n').collect();
    let outdent = |line: &str| -> String {
        let width = line
            .chars()
            .take(column)
            .take_while(|c| *c == ' ' || *c == '\t')
            .count();
        line.chars().skip(width).collect()
    };
    let mut text = lines[0].to_owned();
    for line in &lines[1..] {
        text.push('\n');
        text.push_str(&outdent(line));
    }
    if lines.len() > 1 {
        comment_text(&text)
    } else {
        text.trim().to_owned()
    }
}

pub fn tokenize(source: &str, syntax: &Syntax) -> Result<Vec<Token>, GrammarError> {
    let tokens = Lexer::new(source, syntax).run()?;
    let Some(header) = syntax
        .header
        .filter(|header| syntax.id == "rocq" && !source.starts_with(header))
    else {
        return Ok(tokens);
    };
    // Match the verified runtime by lexical content, retaining native layout
    // and comments without treating changed names or literal values as trivia.
    let mut bare = syntax.clone();
    bare.header = None;
    let expected = Lexer::new(header, &bare).run()?;
    let mut position = 0;
    let mut comments = Vec::new();
    for token in expected.iter().filter(|token| {
        !matches!(
            token.kind,
            TokenType::Newline | TokenType::Comment | TokenType::End
        )
    }) {
        while let Some(actual) = tokens
            .get(position)
            .filter(|actual| matches!(actual.kind, TokenType::Newline | TokenType::Comment))
        {
            if actual.kind == TokenType::Comment {
                comments.push(actual.clone());
            }
            position += 1;
        }
        let Some(actual) = tokens.get(position) else {
            return Ok(tokens);
        };
        if actual.kind != token.kind
            || actual.value != token.value
            || actual.quote != token.quote
            || actual.style != token.style
            || actual.decoded != token.decoded
        {
            return Ok(tokens);
        }
        position += 1;
    }
    comments.extend_from_slice(&tokens[position..]);
    Ok(comments)
}

/// Letters of every script make names ("сумма").
fn is_word(character: char) -> bool {
    character.is_alphanumeric() || character == '_'
}

fn is_name_start(character: char) -> bool {
    character.is_alphabetic() || character == '_'
}

/// Reads one token kind at a time. Each reader returns true when it consumed
/// input at the current position; the first reader that does wins.
struct Lexer<'a> {
    source: Vec<char>,
    syntax: &'a Syntax,
    tokens: Vec<Token>,
    index: usize,
    line: usize,
    line_start: bool,
    indentation: Vec<usize>,
    /// Open brackets; newlines inside them are not significant.
    depth: usize,
    /// Comment lines waiting for the next code line to show their block:
    /// (index of their first token, width).
    pending: Vec<(usize, usize)>,
}

type Reader<'a> = fn(&mut Lexer<'a>) -> Result<bool, GrammarError>;

impl<'a> Lexer<'a> {
    fn new(source: &str, syntax: &'a Syntax) -> Self {
        let leading = source.len()
            - source
                .trim_start_matches([' ', '\t', '\r', '\n', '\x0c', '\x0b'])
                .len();
        let php = syntax.id == "php"
            && source
                .get(leading..leading + 5)
                .is_some_and(|tag| tag.eq_ignore_ascii_case("<?php"));
        let invalid_php = php
            && source[leading + 5..]
                .chars()
                .next()
                .is_some_and(|c| !matches!(c, ' ' | '\t' | '\r' | '\n'));
        let index = if invalid_php {
            source.chars().count()
        } else if php {
            source[..leading].chars().count() + 5
        } else {
            match syntax.header {
                Some(header) if source.starts_with(header) => header.chars().count(),
                _ => 0,
            }
        };
        let mut lexer = Lexer {
            source: source.chars().collect(),
            syntax,
            tokens: Vec::new(),
            index,
            line: 1 + source.chars().take(index).filter(|c| *c == '\n').count(),
            line_start: true,
            indentation: vec![0],
            depth: 0,
            pending: Vec::new(),
        };
        let outside_end = if invalid_php {
            source.len()
        } else if php {
            leading
        } else {
            0
        };
        if outside_end > 0 {
            lexer.push(TokenType::InlineText, &source[..outside_end]);
            let token = lexer.tokens.last_mut().unwrap();
            token.line = 1;
            token.raw_span = Some((0, source[..outside_end].chars().count()));
        }
        lexer
    }

    fn run(mut self) -> Result<Vec<Token>, GrammarError> {
        let readers: [Reader<'a>; 10] = [
            Self::newline,
            |lexer| Ok(lexer.space()),
            Self::block_comment,
            |lexer| Ok(lexer.line_comment()),
            |lexer| Ok(lexer.directive()),
            Self::text,
            |lexer| Ok(lexer.number()),
            |lexer| Ok(lexer.name()),
            |lexer| Ok(lexer.sigil()),
            Self::symbol,
        ];
        while self.index < self.source.len() {
            if self.line_start && self.syntax.blocks == Blocks::Indentation {
                self.indent()?;
            }
            if self.closing_tag()? {
                break;
            }
            let start = self.index;
            let first = self.tokens.len();
            for read in readers {
                if read(&mut self)? {
                    break;
                }
            }
            for token in &mut self.tokens[first..] {
                token.raw_span = Some((start, self.index));
            }
        }
        if self
            .tokens
            .last()
            .is_some_and(|token| token.kind != TokenType::Newline)
        {
            self.push(TokenType::Newline, "\n");
        }
        if self.syntax.blocks == Blocks::Indentation {
            self.place_blocks(0);
        }
        self.push(TokenType::End, "");
        Ok(self.tokens)
    }

    /// PHP consumes the first newline after ?>; remaining outside whitespace
    /// is literal output, as is whitespace before its opening tag.
    fn closing_tag(&mut self) -> Result<bool, GrammarError> {
        if self.syntax.id != "php" || !self.starts_with("?>", self.index) {
            return Ok(false);
        }
        if self.source[self.index + 2..]
            .iter()
            .any(|character| !character.is_whitespace())
        {
            return Err(GrammarError::syntax(
                "Text after the closing \"?>\" tag",
                self.line,
            ));
        }
        let after = self.index + 2;
        let newline = if self.starts_with("\r\n", after) {
            2
        } else if self
            .source
            .get(after)
            .is_some_and(|c| matches!(c, '\r' | '\n'))
        {
            1
        } else {
            0
        };
        let start = after + newline;
        self.line += self.source[self.index..start]
            .iter()
            .filter(|c| **c == '\n')
            .count();
        if start < self.source.len() {
            if self
                .tokens
                .last()
                .is_none_or(|token| token.kind != TokenType::Newline)
            {
                self.push(TokenType::Newline, "\n");
            }
            let text = self.slice(start, self.source.len());
            self.push(TokenType::InlineText, &text);
            self.tokens.last_mut().unwrap().raw_span = Some((start, self.source.len()));
            self.line += text.matches('\n').count();
        }
        self.index = self.source.len();
        Ok(true)
    }

    fn push(&mut self, kind: TokenType, value: &str) {
        self.push_text(kind, value, None, InterpolationStyle::Plain);
    }

    fn push_text(
        &mut self,
        kind: TokenType,
        value: &str,
        quote: Option<char>,
        style: InterpolationStyle,
    ) {
        self.tokens.push(Token {
            kind,
            value: value.to_owned(),
            line: self.line,
            quote,
            style,
            decoded: false,
            blank: 0,
            trailing: None,
            block: false,
            span: None,
            raw_span: None,
        });
    }

    fn at(&self, offset: usize) -> Option<char> {
        self.source.get(self.index + offset).copied()
    }

    fn starts_with(&self, text: &str, index: usize) -> bool {
        text.chars()
            .enumerate()
            .all(|(offset, character)| self.source.get(index + offset) == Some(&character))
    }

    fn slice(&self, start: usize, end: usize) -> String {
        self.source[start..end].iter().collect()
    }

    /// Offside rule: compare the width of a code line with the open blocks.
    fn indent(&mut self) -> Result<(), GrammarError> {
        self.line_start = false;
        let width = self.source[self.index..]
            .iter()
            .take_while(|c| **c == ' ' || **c == '\t')
            .count();
        match self.at(width) {
            None | Some('\r' | '\n') => return Ok(()),
            _ if self.depth > 0 => return Ok(()),
            _ => {}
        }
        if self.starts_comment(self.index + width) {
            self.pending.push((self.tokens.len(), width));
            return Ok(());
        }
        self.place_blocks(width);
        if Some(&width) != self.indentation.last() {
            return Err(GrammarError::syntax("Inconsistent indentation", self.line));
        }
        Ok(())
    }

    fn starts_comment(&self, index: usize) -> bool {
        let open = self.syntax.block_comment.map(|(open, _)| open);
        [Some(self.syntax.line_comment), open]
            .into_iter()
            .flatten()
            .any(|marker| !marker.is_empty() && self.starts_with(marker, index))
    }

    /// Open or close blocks up to a code line of this width. Comment lines
    /// before it go into the new block when it opens one; when it closes
    /// blocks, the comments indented deeper than it stay in the block they
    /// follow, and the others go after the closed blocks.
    fn place_blocks(&mut self, width: usize) {
        let pending = std::mem::take(&mut self.pending);
        let start = pending.first().map_or(self.tokens.len(), |(at, _)| *at);
        let comments = self.tokens.split_off(start);
        let current = |lexer: &Self| *lexer.indentation.last().unwrap_or(&0);
        let mut inside = pending
            .iter()
            .find(|(_, comment)| *comment <= width)
            .map_or(comments.len(), |(at, _)| at - start);
        if width > current(self) {
            self.indentation.push(width);
            self.push(TokenType::Indent, &width.to_string());
            inside = 0;
        }
        let mut comments = comments.into_iter();
        self.tokens.extend(comments.by_ref().take(inside));
        while width < current(self) {
            self.indentation.pop();
            self.push(TokenType::Dedent, &width.to_string());
        }
        self.tokens.extend(comments);
    }

    fn newline(&mut self) -> Result<bool, GrammarError> {
        if self.at(0) != Some('\n') {
            return Ok(false);
        }
        if self.depth == 0 {
            match self.tokens.last_mut() {
                // Concrete syntax: count the empty lines between two
                // statements.
                Some(last) if last.kind == TokenType::Newline => last.blank += 1,
                Some(_) => self.push(TokenType::Newline, "\n"),
                None => {}
            }
        }
        self.line += 1;
        self.index += 1;
        self.line_start = true;
        Ok(true)
    }

    fn space(&mut self) -> bool {
        if !self.at(0).is_some_and(char::is_whitespace) {
            return false;
        }
        self.index += 1;
        true
    }

    /// The index of the end of the line, or of the source.
    fn until_line_end(&self) -> usize {
        self.source[self.index..]
            .iter()
            .position(|c| *c == '\n')
            .map_or(self.source.len(), |offset| self.index + offset)
    }

    /// The line comment marker here: Lua skips a first line that starts
    /// with "#" (a #! line), and fixed-form Fortran comments out a line with
    /// C or * in its first column (`C     Hello World`, not `c = 1`).
    fn comment_marker(&self) -> &'static str {
        let id = self.syntax.id;
        if id == "lua" && self.index == 0 && self.source.first() == Some(&'#') {
            return "#";
        }
        if id == "fortran" && (self.index == 0 || self.source[self.index - 1] == '\n') {
            let line = &self.source[self.index..self.until_line_end()];
            let rest = line.get(1..).unwrap_or_default();
            let separated = rest.first().is_none_or(|c| matches!(c, ' ' | '\t' | '\r'));
            let assigned = rest
                .iter()
                .find(|c| !matches!(c, ' ' | '\t'))
                .is_some_and(|c| matches!(c, '=' | '('));
            if separated && !assigned {
                match line.first() {
                    Some('C') => return "C",
                    Some('c') => return "c",
                    Some('*') => return "*",
                    _ => {}
                }
            }
        }
        self.syntax.line_comment
    }

    fn line_comment(&mut self) -> bool {
        let marker = self.comment_marker();
        if !self.starts_with(marker, self.index)
            || (self.syntax.id == "lua" && self.starts_with("--[[", self.index))
            // Bash: ${#a[@]} is the length of a, not a comment.
            || (self.syntax.id == "bash"
                && self.index > 0
                && self.source[self.index - 1] == '{')
        {
            return false;
        }
        let stop = self.until_line_end();
        let start = self.index + marker.chars().count();
        let text = self.slice(start, stop);
        self.push_comment(&comment_text(&text), false, (start, stop));
        self.index = stop;
        true
    }

    /// A comment after code on the same line stays a trailing comment.
    fn push_comment(&mut self, text: &str, block: bool, span: (usize, usize)) {
        let trailing = self.tokens.last().is_some_and(|last| {
            last.line == self.line
                && !matches!(
                    last.kind,
                    TokenType::Newline | TokenType::Indent | TokenType::Dedent
                )
        });
        // A trailing comment keeps the spaces that separate it from the code.
        let gap_start = self.source[..self.index]
            .iter()
            .rposition(|c| *c != ' ' && *c != '\t')
            .map_or(0, |position| position + 1);
        let gap = self.slice(gap_start, self.index);
        self.push(TokenType::Comment, text);
        let token = self.tokens.last_mut().expect("pushed");
        token.block = block;
        token.span = Some(span);
        if trailing {
            token.trailing = Some(if gap.is_empty() { " ".into() } else { gap });
        }
    }

    /// Columns from the start of the current line.
    fn column(&self) -> usize {
        let start = self.source[..self.index]
            .iter()
            .rposition(|c| *c == '\n')
            .map_or(0, |position| position + 1);
        self.index - start
    }

    fn block_comment(&mut self) -> Result<bool, GrammarError> {
        let Some((open, close)) = self.syntax.block_comment else {
            return Ok(false);
        };
        if !self.starts_with(open, self.index) {
            return Ok(false);
        }
        let from = self.index + open.chars().count();
        let (after, closed) = block_comment_end(
            &self.source,
            self.index,
            &open.chars().collect::<Vec<_>>(),
            &close.chars().collect::<Vec<_>>(),
            self.syntax.nested_comments,
            self.syntax.comment_strings,
        );
        if !closed {
            return Err(GrammarError::syntax("Unterminated comment", self.line));
        }
        let end = after - close.chars().count();
        let text = self.slice(from, end);
        self.push_comment(&block_comment_text(&text, self.column()), true, (from, end));
        self.line += text.matches('\n').count();
        self.index = end + close.chars().count();
        Ok(true)
    }

    /// Preprocessor lines such as `#include <stdio.h>`.
    fn directive(&mut self) -> bool {
        let runtime = super::dialects::OBJC_RUNTIME_HEADER;
        if self.syntax.id == "objc" && self.starts_with(runtime, self.index) {
            let end = self.index + runtime.chars().count();
            if self
                .source
                .get(end)
                .is_none_or(|c| matches!(c, '\r' | '\n'))
            {
                self.push(TokenType::Directive, runtime);
                self.index = end;
                self.line += runtime.matches('\n').count();
                return true;
            }
        }
        if self.syntax.line_comment == "#" || self.at(0) != Some('#') {
            return false;
        }
        let after: String = self.source[self.index + 1..]
            .iter()
            .skip_while(|c| c.is_whitespace())
            .take(7)
            .collect();
        if !after.starts_with("include") && !after.starts_with("import") {
            return false;
        }
        let stop = self.until_line_end();
        let text = self.slice(self.index, stop);
        self.push(TokenType::Directive, text.trim());
        self.index = stop;
        true
    }

    fn text(&mut self) -> Result<bool, GrammarError> {
        let Some(character) = self.at(0) else {
            return Ok(false);
        };
        let is_quote = |c: Option<char>| c.is_some_and(|c| self.syntax.quotes.contains(&c));
        // A prefix such as Python's f or Nim's fmt marks an interpolated
        // literal.
        let prefix = self.syntax.interpolation.iter().find_map(|entry| {
            entry.prefix.filter(|prefix| {
                self.starts_with(prefix, self.index) && is_quote(self.at(prefix.chars().count()))
            })
        });
        if prefix.is_none() && !is_quote(Some(character)) {
            return Ok(false);
        }
        let start = self.index + prefix.map_or(0, |prefix| prefix.chars().count());
        let quote = self.source[start];
        let doubled = self.syntax.doubled_quotes;
        let triple = self.syntax.id == "python"
            && self
                .source
                .get(start..start + 3)
                .is_some_and(|part| part.iter().all(|c| *c == quote));
        let (raw, end) = read_quoted(&self.source, start, quote, self.line, doubled, triple)?;
        let style = interpolation_style(self.syntax, quote, prefix);
        let kind = if self.syntax.id == "sql" && quote == '"' {
            TokenType::Name
        } else {
            TokenType::Text
        };
        self.push_text(kind, &raw, Some(quote), style);
        // Doubled quotes are already read, so the text has no escapes left.
        self.tokens.last_mut().expect("pushed").decoded = doubled;
        self.line += raw.matches('\n').count();
        self.index = end;
        Ok(true)
    }

    fn number(&mut self) -> bool {
        let rest = &self.source[self.index..];
        let mut length = rest.iter().take_while(|c| c.is_ascii_digit()).count();
        if length == 0 {
            return false;
        }
        if rest.get(length) == Some(&'.') {
            let fraction = rest[length + 1..]
                .iter()
                .take_while(|c| c.is_ascii_digit())
                .count();
            if fraction > 0 {
                length += 1 + fraction;
            }
        }
        length += exponent(&rest[length..]);
        let value = self.slice(self.index, self.index + length);
        self.push(TokenType::Number, &value);
        self.index += length;
        let suffix = self.syntax.number_suffix.or(self.syntax.long_suffix);
        if let Some(suffix) = suffix.filter(|suffix| self.starts_with(suffix, self.index)) {
            self.index += suffix.chars().count();
        }
        true
    }

    /// Names, including Rust macro names such as `println!` (but not `x != y`).
    /// Where `!` starts a comment (Fortran), it never ends a name.
    fn name(&mut self) -> bool {
        if !self.at(0).is_some_and(is_name_start) {
            return false;
        }
        let mut length = self.source[self.index..]
            .iter()
            .take_while(|c| is_word(**c))
            .count();
        if self.syntax.line_comment != "!"
            && self.at(length) == Some('!')
            && self.at(length + 1) != Some('=')
        {
            length += 1;
        }
        let value = self.slice(self.index, self.index + length);
        let value = if self.syntax.id == "sql" {
            value.to_lowercase()
        } else {
            value
        };
        self.push(TokenType::Name, &value);
        // Where the name stands, so identifiers can be renamed in place.
        self.tokens.last_mut().expect("pushed").span = Some((self.index, self.index + length));
        self.index += length;
        true
    }

    /// PHP's `$` before variable names carries no meaning of its own.
    fn sigil(&mut self) -> bool {
        if self.syntax.variable_sigil.is_none()
            || self.syntax.variable_sigil != self.at(0)
            || !self.at(1).is_some_and(is_name_start)
        {
            return false;
        }
        self.index += 1;
        true
    }

    fn symbol(&mut self) -> Result<bool, GrammarError> {
        let Some(symbol) = self
            .syntax
            .symbols
            .iter()
            .chain(SYMBOLS.iter())
            .find(|candidate| self.starts_with(candidate, self.index))
        else {
            let character = self.at(0).unwrap_or_default();
            return Err(GrammarError::syntax(
                format!("Unexpected character \"{character}\""),
                self.line,
            ));
        };
        // Newlines inside parentheses and brackets do not end a statement.
        // Braces delimit blocks, so their contents keep line structure.
        match *symbol {
            "(" | "[" => self.depth += 1,
            ")" | "]" if self.depth > 0 => self.depth -= 1,
            _ => {}
        }
        self.push(TokenType::Symbol, symbol);
        self.index += symbol.chars().count();
        Ok(true)
    }
}

/// Which interpolation style a text literal uses, from the language's
/// interpolation table. Literals that match no entry are plain text.
fn interpolation_style(syntax: &Syntax, quote: char, prefix: Option<&str>) -> InterpolationStyle {
    syntax
        .interpolation
        .iter()
        .find(|entry| entry.prefix == prefix && entry.quote.is_none_or(|own| own == quote))
        .map_or(InterpolationStyle::Plain, |entry| entry.style)
}

/// The length of the exponent (`e3`, `E-2`) that starts `rest`, or 0.
fn exponent(rest: &[char]) -> usize {
    if !matches!(rest.first(), Some('e' | 'E')) {
        return 0;
    }
    let sign = usize::from(matches!(rest.get(1), Some('+' | '-')));
    let digits = rest[1 + sign..]
        .iter()
        .take_while(|c| c.is_ascii_digit())
        .count();
    if digits == 0 { 0 } else { 1 + sign + digits }
}
