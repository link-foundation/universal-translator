//! Exception bodies and handlers retain their control-flow boundaries.
use super::{Parsed, Parser, source_type};
use crate::formal::lexer::{Token, TokenType};
use crate::meta::{GrammarError, Node};

fn cpp_int_literal(tokens: &[Token]) -> bool {
    let literal = match tokens {
        [literal] => literal,
        [sign, literal] if sign.value == "-" => literal,
        _ => return false,
    };
    let text = literal.value.as_str();
    literal.kind == TokenType::Number
        && (text == "0" || !text.starts_with('0'))
        && text.len() <= 5
        && text.bytes().all(|byte| byte.is_ascii_digit())
        && text.parse::<i16>().is_ok()
}

impl Parser {
    pub(crate) fn is_exception_start(&self) -> bool {
        ["cpp", "javascript", "typescript", "python"].contains(&self.syntax.id)
            && (self.is("try")
                || self.is(if self.syntax.id == "python" {
                    "raise"
                } else {
                    "throw"
                }))
    }

    pub(crate) fn exception_statement(&mut self) -> Parsed {
        if self.accept("try") {
            return self.try_statement();
        }
        self.position += 1;
        if self.syntax.id == "cpp" {
            self.skip_newlines();
        }
        let start = self.position;
        let value = if self.is_statement_end() {
            None
        } else {
            Some(self.expression()?)
        };
        let cpp_type = (self.syntax.id == "cpp"
            && cpp_int_literal(&self.tokens[start..self.position]))
        .then_some("int");
        self.end_statement()?;
        Ok(Node::new("Throw")
            .with_opt("value", value)
            .with_opt("cppType", cpp_type)
            .with(
                "mode",
                if self.syntax.id == "python" {
                    "exception"
                } else {
                    "value"
                },
            ))
    }

    fn try_statement(&mut self) -> Parsed {
        let body = self.block()?;
        let mut handlers = Vec::new();
        self.skip_newlines();
        let python = self.syntax.id == "python";
        while self.accept(if python { "except" } else { "catch" }) {
            let mut name = None;
            let mut kind = None;
            let mut cpp_type = None;
            if python {
                if !self.is(":") {
                    let mut words = Vec::new();
                    while !self.is("as") && !self.is(":") {
                        words.push(self.next_value()?);
                    }
                    kind = Some(format!("source:{}", words.concat()));
                    if self.accept("as") {
                        name = Some(self.expect_name()?);
                    }
                }
            } else if self.accept("(") {
                if self.syntax.id == "cpp" {
                    let mut tokens = Vec::new();
                    while !self.is(")") {
                        tokens.push(self.next()?);
                    }
                    let mut words: Vec<_> =
                        tokens.iter().map(|token| token.value.as_str()).collect();
                    if words.concat() == "..." {
                        cpp_type = Some("...".to_owned());
                    } else {
                        if words.len() > 1 {
                            name = words.pop().map(str::to_owned);
                        }
                        kind = source_type(&words.join(" "));
                        if let [word] = words.as_slice()
                            && matches!(
                                *word,
                                "bool" | "char" | "double" | "float" | "int" | "long" | "short"
                            )
                            && name.as_deref().is_none_or(|name| {
                                tokens[1].kind == TokenType::Name
                                    && !matches!(name, "const" | "volatile")
                            })
                        {
                            cpp_type = Some((*word).to_owned());
                        }
                    }
                } else {
                    name = Some(self.expect_name()?);
                }
                self.expect(")")?;
            }
            handlers.push(
                Node::new("Catch")
                    .with_opt("name", name)
                    .with_opt("type", kind)
                    .with_opt("cppType", cpp_type)
                    .with("body", self.block()?),
            );
            self.skip_newlines();
        }
        let success = if python && self.accept("else") {
            Some(self.block()?)
        } else {
            None
        };
        self.skip_newlines();
        let finalizer = if self.accept("finally") {
            Some(self.block()?)
        } else {
            None
        };
        if handlers.is_empty() && finalizer.is_none() {
            return Err(GrammarError::new(
                "A try statement needs a handler or finally block",
            ));
        }
        Ok(Node::new("Try")
            .with("body", body)
            .with("handlers", handlers)
            .with_opt("success", success)
            .with_opt("finalizer", finalizer))
    }
}
