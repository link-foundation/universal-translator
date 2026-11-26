//! Two more surface forms of familiar concepts: JavaScript arrow functions
//! bound to a name, which define a function as `function name(...) { ... }`
//! does, and Python type hints on parameters, results and assignments, which
//! tell the meta type where one fits.

use super::{Parsed, Parser, source_type};
use crate::formal::lexer::TokenType;
use crate::meta::{Node, block};

/// The meta type of a Python hint. Every other hint (`float`,
/// `dict[str, int]`, a class name) is read and left to type inference.
pub fn hint_type(spelling: &str) -> Option<String> {
    let meta = match spelling {
        "int" => "integer",
        "str" => "text",
        "bool" => "boolean",
        "None" => "nothing",
        "list[int]" | "List[int]" => "array",
        _ => return None,
    };
    Some(meta.to_owned())
}

/// Words that start a Python statement and may be followed by `:`.
const PYTHON_KEYWORDS: [&str; 9] = [
    "else", "elif", "try", "except", "finally", "with", "lambda", "class", "def",
];

impl Parser {
    fn is_arrow_modifier(&self, offset: usize) -> bool {
        ["export", "async"].contains(&self.value(offset))
    }

    /// `[modifiers] const|let|var name = (parameters) => ...` or
    /// `[modifiers] const|let|var name = parameter => ...`
    pub(crate) fn is_arrow_function_start(&self) -> bool {
        if !["javascript", "typescript"].contains(&self.syntax.id) {
            return false;
        }
        let offset = (0..)
            .take_while(|offset| self.is_arrow_modifier(*offset))
            .count();
        let bound = self.syntax.declarations.contains(&self.value(offset))
            && self.kind(offset + 1) == TokenType::Name
            && self.is_at("=", offset + 2);
        if !bound {
            return false;
        }
        let start = offset + 3;
        if self.kind(start) == TokenType::Name {
            return self.is_at("=>", start + 1);
        }
        self.closing_parenthesis(start)
            .is_some_and(|close| self.is_at("=>", self.after_result_type(close + 1)))
    }

    /// The offset of the `)` closing the parentheses opening at `offset`.
    fn closing_parenthesis(&self, offset: usize) -> Option<usize> {
        if !self.is_at("(", offset) {
            return None;
        }
        let mut depth = 0i64;
        let mut index = offset;
        while self.kind(index) != TokenType::End {
            depth += match self.value(index) {
                "(" => 1,
                ")" => -1,
                _ => 0,
            };
            if depth == 0 {
                return Some(index);
            }
            index += 1;
        }
        None
    }

    /// The offset after a TypeScript result type written before `=>`.
    fn after_result_type(&self, offset: usize) -> usize {
        if !self.is_at(":", offset) {
            return offset;
        }
        let mut after = offset;
        while !self.is_at("=>", after)
            && !self.is_at(";", after)
            && !matches!(self.kind(after), TokenType::Newline | TokenType::End)
        {
            after += 1;
        }
        after
    }

    /// The same Function node as `function name(parameters) { body }`; an
    /// expression body is the value the function returns.
    pub(crate) fn arrow_function(&mut self) -> Parsed {
        while self.is_arrow_modifier(0) {
            self.position += 1;
        }
        self.next()?;
        let function_name = self.expect_name()?;
        self.expect("=")?;
        let parameters = if self.is("(") {
            self.parameter_list()?
        } else {
            vec![Node::new("Parameter").with("name", self.expect_name()?)]
        };
        let mut return_type = None;
        if self.accept(":") {
            let words = self.words_until(&["=>"])?;
            return_type = source_type(&words.join(" "));
        }
        self.expect("=>")?;
        let body = if self.is("{") {
            self.block()?
        } else {
            let value = self.expression()?;
            self.end_statement()?;
            block(vec![Node::new("Return").with("value", value)])
        };
        Ok(Node::new("Function")
            .with("name", function_name)
            .with("parameters", parameters)
            .with_opt("returnType", return_type)
            .with("body", body))
    }

    /// A Python hint ends at `:`, `=`, `,` or `)` outside brackets, so
    /// `dict[str, int]` is read whole.
    pub(crate) fn type_hint(&mut self) -> Parsed<Option<String>> {
        let mut words = Vec::new();
        let mut depth = 0i64;
        while !matches!(self.kind(0), TokenType::Newline | TokenType::End) {
            if depth == 0 && [":", "=", ",", ")"].iter().any(|stop| self.is(stop)) {
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
