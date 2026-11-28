//! JavaScript and TypeScript functions written without the `function`
//! keyword: arrow functions assigned to a constant and the static methods of
//! a class.

use super::{MODIFIERS, Parsed, Parser};
use crate::formal::lexer::TokenType;
use crate::meta::{Node, block};

/// The languages whose arrow functions are read as named functions.
const ARROW_LANGUAGES: [&str; 2] = ["javascript", "typescript"];

impl Parser {
    fn reads_arrows(&self) -> bool {
        ARROW_LANGUAGES.contains(&self.syntax.id)
    }

    /// The index of the parenthesis closing the one at `offset`.
    pub(crate) fn closing_parenthesis(&self, offset: usize) -> Option<usize> {
        if !self.is_at("(", offset) {
            return None;
        }
        let mut depth = 0i64;
        let mut index = offset;
        while self.kind(index) != TokenType::End {
            if self.kind(index) == TokenType::Symbol {
                depth += match self.value(index) {
                    "(" => 1,
                    ")" => -1,
                    _ => 0,
                };
            }
            if depth == 0 {
                return Some(index);
            }
            index += 1;
        }
        None
    }

    /// `const name = (first, second) => ...` or `const name = single => ...`.
    pub(crate) fn is_arrow_function_start(&self) -> bool {
        if !self.reads_arrows()
            || !self.syntax.declarations.contains(&self.value(0))
            || self.kind(1) != TokenType::Name
            || !self.is_at("=", 2)
        {
            return false;
        }
        if self.kind(3) == TokenType::Name {
            return self.is_at("=>", 4);
        }
        let Some(closing) = self.closing_parenthesis(3) else {
            return false;
        };
        // A TypeScript return type may follow the parameters.
        let mut offset = closing + 1;
        if self.is_at(":", offset) {
            while !matches!(self.kind(offset), TokenType::End | TokenType::Newline)
                && !self.is_at("=>", offset)
            {
                offset += 1;
            }
        }
        self.is_at("=>", offset)
    }

    /// The arrow function as a function of its own: an expression body
    /// returns its value.
    pub(crate) fn arrow_function_definition(&mut self) -> Parsed {
        self.position += 1;
        let function_name = self.expect_name()?;
        self.expect("=")?;
        let parameters = if self.is("(") {
            self.parameter_list()?
        } else {
            vec![Node::new("Parameter").with("name", self.expect_name()?)]
        };
        let return_type = if self.accept(":") {
            self.type_expression()?
        } else {
            None
        };
        self.expect("=>")?;
        let body = if self.is("{") {
            let body = self.block()?;
            self.accept(";");
            body
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

    /// A JavaScript or TypeScript class holds functions as static methods:
    /// `static name(first, second) { ... }`. Methods of objects need objects
    /// in the meta language and are not read.
    pub(crate) fn is_static_method_start(&self) -> bool {
        if !self.reads_arrows() || self.class_depth == 0 {
            return false;
        }
        let offset = self.modifier_count();
        offset > 0
            && self.value(offset - 1) == "static"
            && self.kind(offset) == TokenType::Name
            && self.is_at("(", offset + 1)
    }

    pub(crate) fn static_method_definition(&mut self) -> Parsed {
        while MODIFIERS.contains(&self.value(0)) {
            self.position += 1;
        }
        let function_name = self.expect_name()?;
        let parameters = self.parameter_list()?;
        let return_type = if self.accept(":") {
            self.type_expression()?
        } else {
            None
        };
        Ok(Node::new("Function")
            .with("name", function_name)
            .with("parameters", parameters)
            .with_opt("returnType", return_type)
            .with("body", self.block()?))
    }
}
