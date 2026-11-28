//! Explicit type template-ids with a fundamental type that disambiguates
//! them from ordinary comparisons, as in `left < middle > (right)`.

use super::{Parsed, Parser};
use crate::formal::lexer::TokenType;
use crate::meta::{GrammarError, Node};

const FUNDAMENTAL: &[&str] = &[
    "bool", "char", "char8_t", "char16_t", "char32_t", "double", "float", "int", "long", "short",
    "signed", "unsigned", "void", "wchar_t",
];

pub(super) fn cpp_declaration_type(
    language: &str,
    words: &[String],
    translated: Option<&str>,
    value: Option<&Node>,
) -> Option<String> {
    if is_cpp_template_declaration(language, words)
        && (value.is_none_or(|value| value.is("CppInitializerList"))
            || translated.is_some_and(|kind| kind.starts_with("source:")))
    {
        return Some(format!("source:{}", words.join(" ")));
    }
    None
}

pub(super) fn is_cpp_template_declaration(language: &str, words: &[String]) -> bool {
    language == "cpp" && words.iter().any(|word| word == "<")
}

impl Parser {
    pub(super) fn is_cpp_fixed_array(&self) -> bool {
        if self.syntax.id != "cpp" {
            return false;
        }
        let mut start = 0;
        while matches!(self.value(start), "const" | "static") {
            start += 1;
        }
        ["std", "::", "array", "<"]
            .iter()
            .enumerate()
            .all(|(offset, token)| self.is_at(token, start + offset))
    }

    pub(super) fn cpp_list_initializer(&self, head: usize) -> bool {
        self.syntax.id == "cpp"
            && self.is_at("{", head)
            && (0..head).any(|offset| self.is_at("<", offset))
    }

    pub(super) fn read_cpp_initializer_list(&mut self, direct: bool) -> Parsed {
        self.expect("{")?;
        let elements = self.element_list_with("}", Self::cpp_initializer_element)?;
        Ok(Node::new("CppInitializerList")
            .with("elements", elements)
            .with("direct", direct))
    }

    fn cpp_initializer_element(&mut self) -> Parsed {
        if self.is("{") {
            return self.read_cpp_initializer_list(false);
        }
        self.expression()
    }

    fn after_cpp_newlines(&self, mut offset: usize) -> usize {
        offset += 1;
        while self.kind(offset) == TokenType::Newline {
            offset += 1;
        }
        offset
    }

    // The first argument must start with syntax that cannot be a parameter
    // declaration. A name alone could denote a type.
    pub(super) fn cpp_first_argument_is_expression(&self, head: usize) -> bool {
        if self.syntax.id != "cpp" || !self.is_at("(", head) {
            return false;
        }
        let argument = self.after_cpp_newlines(head);
        match self.kind(argument) {
            TokenType::Number | TokenType::Text => true,
            TokenType::Name => {
                matches!(self.value(argument), "true" | "false" | "nullptr")
                    || self.is_at(".", self.after_cpp_newlines(argument))
            }
            _ => false,
        }
    }

    pub(super) fn cpp_direct_initializer(&self, head: usize) -> bool {
        head >= 2
            && self.kind(head - 1) == TokenType::Name
            && self.kind(head - 2) == TokenType::Name
            && self.cpp_first_argument_is_expression(head)
            && self
                .closing_parenthesis(head)
                .is_some_and(|close| self.is_at(";", self.after_cpp_newlines(close)))
    }

    pub(super) fn read_cpp_direct_initializer(&mut self) -> Parsed {
        self.expect("(")?;
        let arguments = self.element_list_with(")", Self::cpp_direct_argument)?;
        Ok(Node::new("CppDirectInitializer").with("arguments", arguments))
    }

    fn cpp_direct_argument(&mut self) -> Parsed {
        let after = self.after_cpp_newlines(0);
        if self.current().quote == Some('"')
            && matches!(self.value(after), "," | ")")
            && self.kind(after) == TokenType::Symbol
        {
            return self.concrete_rule("expression", |parser| {
                Ok(Node::new("CppStringLiteral").with("raw", parser.next_value()?))
            });
        }
        self.expression()
    }

    // A string literal or a count followed by a character literal disambiguates
    // an object declaration from a function prototype.
    pub(super) fn cpp_string_initializer(&self, head: usize) -> bool {
        if self.syntax.id != "cpp"
            || head != 4
            || !["std", "::", "string"]
                .iter()
                .enumerate()
                .all(|(index, token)| self.is_at(token, index))
            || self.kind(3) != TokenType::Name
            || !self.is_at("(", head)
        {
            return false;
        }
        let next = |offset| self.after_cpp_newlines(offset);
        let argument = next(head);
        let first = self.peek(argument);
        if first.kind == TokenType::Text && first.quote == Some('"') {
            return self.is_at(")", next(argument));
        }
        let comma = next(argument);
        if !matches!(first.kind, TokenType::Number | TokenType::Name) || !self.is_at(",", comma) {
            return false;
        }
        let character = next(comma);
        let second = self.peek(character);
        second.kind == TokenType::Text
            && second.quote == Some('\'')
            && self.is_at(")", next(character))
    }

    pub(super) fn read_cpp_string_initializer(&mut self) -> Parsed {
        self.expect("(")?;
        self.skip_newlines();
        let literal = self.current();
        if literal.quote != Some('"') {
            return Ok(Node::new("Call")
                .with("callee", "std::string")
                .with("arguments", self.element_list(")")?));
        }
        let mut chars = literal.value.chars().peekable();
        while let Some(character) = chars.next() {
            let valid = match character {
                '\r' | '\n' => false,
                '\\' => match chars.next() {
                    Some('n' | 'r' | 't' | '?' | '"' | '\'' | '\\') => true,
                    Some('0') => !matches!(chars.peek(), Some('0'..='7')),
                    _ => false,
                },
                _ => true,
            };
            if !valid {
                return Err(GrammarError::syntax(
                    "Unsupported C++ string initializer escape",
                    literal.line,
                ));
            }
        }
        let mut value = self.expression()?;
        // This overload reads characters up to the first null byte.
        if let Some((prefix, _)) = value.str("value").and_then(|text| text.split_once('\0')) {
            value.set("value", prefix.to_owned());
        }
        self.skip_newlines();
        self.expect(")")?;
        Ok(value)
    }

    pub(super) fn cpp_template_arguments(&mut self, callee: &Node) -> Option<String> {
        if self.syntax.id != "cpp"
            || !matches!(callee.kind.as_str(), "Name" | "Method")
            || !self.is("<")
        {
            return None;
        }
        let mut tokens = Vec::new();
        let mut depth = 1isize;
        let mut needs_type = true;
        let mut definite = false;
        for offset in 1.. {
            let token = self.peek(offset);
            let value = token.value.as_str();
            match token.kind {
                TokenType::Newline => continue,
                TokenType::Name => {
                    needs_type = false;
                    definite |= FUNDAMENTAL.contains(&value);
                }
                _ if value == "::" => needs_type = true,
                _ if needs_type => return None,
                _ if matches!(value, "," | "<") => {
                    depth += isize::from(value == "<");
                    needs_type = true;
                }
                _ if matches!(value, ">" | ">>") => {
                    depth -= value.len() as isize;
                    if depth <= 0 {
                        if depth != 0 || !definite || !self.is_at("(", offset + 1) {
                            return None;
                        }
                        if value == ">>" {
                            tokens.push(">");
                        }
                        let arguments = tokens.join(" ");
                        self.position += offset + 1;
                        return Some(arguments);
                    }
                }
                _ if matches!(value, "*" | "&" | "&&") => {}
                _ => return None,
            }
            tokens.push(value);
        }
        None
    }
}
