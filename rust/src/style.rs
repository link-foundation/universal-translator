//! The style a program is written in: where the brace that opens a block
//! goes and how deep a block is indented. A style rewrites the lines of a
//! translation (or of a program translated into its own language), so C#
//! can be written with its traditional braces on lines of their own, or
//! JavaScript indented by two spaces. The JavaScript twin is
//! `js/src/translation/style.js`.

use std::collections::HashMap;

use crate::formal::languages::{Blocks, Syntax};
use crate::formal::lexer::{TokenType, tokenize};
use crate::meta::GrammarError;

/// Where the brace that opens a block goes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Braces {
    /// On the line of its statement: `if (a) {`.
    SameLine,
    /// On a line of its own, below its statement.
    NextLine,
}

impl std::str::FromStr for Braces {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "same-line" => Ok(Self::SameLine),
            "next-line" => Ok(Self::NextLine),
            _ => Err(format!(
                r#"Unsupported brace style "{value}": same-line or next-line"#
            )),
        }
    }
}

/// How deep each block is indented.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Indent {
    /// A number of spaces, from 1 to 16.
    Spaces(u8),
    Tab,
}

impl Indent {
    fn unit(self) -> String {
        match self {
            Indent::Spaces(width) => " ".repeat(usize::from(width)),
            Indent::Tab => "\t".to_owned(),
        }
    }
}

impl std::str::FromStr for Indent {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        if value == "tab" {
            return Ok(Self::Tab);
        }
        let digits = !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit());
        match value.parse::<u8>() {
            Ok(width) if digits && (1..=16).contains(&width) => Ok(Self::Spaces(width)),
            _ => Err(format!(
                r#"Unsupported indent "{value}": a number of spaces from 1 to 16 or "tab""#
            )),
        }
    }
}

/// The style of a translation; each part left out stays as the emitter
/// writes it.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Style {
    pub braces: Option<Braces>,
    pub indent: Option<Indent>,
}

impl Style {
    /// Whether the style asks for anything.
    pub fn is_set(&self) -> bool {
        self.braces.is_some() || self.indent.is_some()
    }
}

/// A styled text, and for each line of the text (from 1) the line it starts
/// at in the styled text.
pub struct Styled {
    pub text: String,
    pub starts: Vec<usize>,
}

/// Whether a language can be written in a style.
pub fn check_style(style: Style, syntax: &Syntax) -> Result<(), GrammarError> {
    // Go ends a statement at the end of a line, so `if x` followed by a line
    // with "{" alone does not compile.
    if style.braces == Some(Braces::NextLine) && syntax.id == "go" {
        return Err(GrammarError::new(
            "Go needs the opening brace on the line of its statement",
        ));
    }
    Ok(())
}

/// What a line of the text holds of its braces.
#[derive(Clone, Copy, Default)]
struct BraceLine {
    /// It ends with the brace that opens a block.
    opens: bool,
    /// It starts with a closing brace that the next word (else, catch,
    /// while) follows.
    continues: bool,
}

fn brace_lines(text: &str, syntax: &Syntax) -> Result<HashMap<usize, BraceLine>, GrammarError> {
    let mut lexical = syntax.clone();
    lexical.symbols = &["^", "~"];
    let tokens: Vec<_> = tokenize(text, &lexical)?
        .into_iter()
        .filter(|token| {
            !matches!(
                token.kind,
                TokenType::Newline | TokenType::End | TokenType::Indent | TokenType::Dedent
            )
        })
        .collect();
    let mut lines: HashMap<usize, BraceLine> = HashMap::new();
    for (index, token) in tokens.iter().enumerate() {
        let next = tokens.get(index + 1);
        let previous = index.checked_sub(1).map(|at| &tokens[at]);
        let line = lines.entry(token.line).or_default();
        let symbol = token.kind == TokenType::Symbol;
        if symbol
            && token.value == "{"
            && next.is_none_or(|next| next.line != token.line)
            && previous.is_some_and(|previous| previous.line == token.line)
        {
            line.opens = true;
        }
        if symbol
            && token.value == "}"
            && previous.is_none_or(|previous| previous.line != token.line)
            && next.is_some_and(|next| next.line == token.line && next.kind == TokenType::Name)
        {
            line.continues = true;
        }
    }
    Ok(lines)
}

/// The indentation of a line in steps of the emitter's unit and the spaces
/// left over (the " *" of a block comment line).
fn depth_of<'a>(leading: &'a str, unit: &str) -> (usize, &'a str) {
    let mut depth = 0;
    let mut rest = leading;
    while let Some(after) = rest.strip_prefix(unit) {
        depth += 1;
        rest = after;
    }
    (depth, rest)
}

/// The text in the style.
pub fn apply_style(text: &str, syntax: &Syntax, style: Style) -> Result<Styled, GrammarError> {
    check_style(style, syntax)?;
    let next_line = style.braces == Some(Braces::NextLine) && syntax.blocks == Blocks::Braces;
    let braces = if next_line {
        brace_lines(text, syntax)?
    } else {
        HashMap::new()
    };
    let written = if syntax.id == "go" { "\t" } else { "    " };
    let unit = style
        .indent
        .map_or_else(|| written.to_owned(), Indent::unit);
    let mut output: Vec<String> = Vec::new();
    let mut starts = Vec::new();
    for (index, line) in text.split('\n').enumerate() {
        starts.push(output.len() + 1);
        let code_start = line.len() - line.trim_start_matches([' ', '\t']).len();
        let (depth, rest) = depth_of(&line[..code_start], written);
        let indentation = format!("{}{rest}", unit.repeat(depth));
        let mut code = line[code_start..].trim_end();
        if code.is_empty() {
            output.push(if line.is_empty() {
                String::new()
            } else {
                indentation
            });
            continue;
        }
        let BraceLine { opens, continues } = braces.get(&(index + 1)).copied().unwrap_or_default();
        if continues {
            output.push(format!("{indentation}}}"));
            code = code[1..].trim_start();
        }
        if opens {
            output.push(format!(
                "{indentation}{}",
                code[..code.len() - 1].trim_end()
            ));
            code = "{";
        }
        output.push(format!("{indentation}{code}"));
    }
    Ok(Styled {
        text: output.join("\n"),
        starts,
    })
}
