//! Exception bodies and handlers retain their control-flow boundaries.
use super::{Parsed, Parser, source_type};
use crate::meta::{GrammarError, Node};

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
        let value = if self.is_statement_end() {
            None
        } else {
            Some(self.expression()?)
        };
        self.end_statement()?;
        Ok(Node::new("Throw").with_opt("value", value).with(
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
                    let mut words = Vec::new();
                    while !self.is(")") {
                        words.push(self.next_value()?);
                    }
                    if words.concat() != "..." {
                        if words.len() > 1 {
                            name = words.pop();
                        }
                        kind = source_type(&words.join(" "));
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
