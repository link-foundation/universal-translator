//! Python type hints on parameters, results and assignments, which tell the
//! meta type where one fits. (Arrow functions are read in arrows.rs.)

use super::{Parsed, Parser};
use crate::formal::lexer::TokenType;
use crate::meta::Node;

/// Built-in hints use shared types; application types retain their spelling.
pub fn hint_type(spelling: &str) -> Option<String> {
    let meta = match spelling {
        "int" => "integer",
        "str" => "text",
        "bool" => "boolean",
        "None" => "nothing",
        "list[int]" | "List[int]" => "array",
        "float" => "real",
        "" => return None,
        _ => return Some(format!("source:{spelling}")),
    };
    Some(meta.to_owned())
}

/// Words that start a Python statement and may be followed by `:`.
const PYTHON_KEYWORDS: [&str; 9] = [
    "else", "elif", "try", "except", "finally", "with", "lambda", "class", "def",
];

impl Parser {
    /// A Python hint ends at `:`, `=`, `,` or `)` outside brackets, so
    /// `dict[str, int]` is read whole.
    pub(crate) fn type_hint(&mut self) -> Parsed<Option<String>> {
        let mut words = Vec::new();
        let mut depth = 0i64;
        while !matches!(self.kind(0), TokenType::Newline | TokenType::End) {
            if depth == 0 && [":", "=", ",", ")", "]"].iter().any(|stop| self.is(stop)) {
                break;
            }
            if self.is("[") {
                depth += 1;
            } else if self.is("]") {
                depth -= 1;
            }
            words.push(self.next_value()?);
        }
        Ok(hint_type(&words.concat()))
    }

    /// Python: `name: hint [= value]`
    pub(crate) fn is_annotated_assignment(&self) -> bool {
        self.syntax.id == "python"
            && self.kind(0) == TokenType::Name
            && !PYTHON_KEYWORDS.contains(&self.value(0))
            && self.is_at(":", 1)
    }

    /// `total: int = 0` assigns as `total = 0` does, with the hinted type;
    /// a hint without a value (`total: int`) assigns nothing.
    pub(crate) fn annotated_assignment(&mut self) -> Parsed {
        let variable = self.next_value()?;
        self.expect(":")?;
        let kind = self.type_hint()?;
        if !self.accept("=") {
            self.end_statement()?;
            return Ok(Node::new("Statements").with("statements", Vec::<Node>::new()));
        }
        let value = self.expression()?;
        self.end_statement()?;
        Ok(Node::new("Assignment")
            .with("name", variable)
            .with("operator", "=")
            .with("value", value)
            .with_opt("type", kind))
    }
}
