//! Objective-C messages and Portable Object Compiler block expressions.
use super::{EmitterDialect, ParserDialect};
use crate::formal::parser::{Parsed, Parser};
use crate::formal::{
    emitter::{Emitter, Result},
    objpak_objc,
};
use crate::meta::{Node, block};

pub(crate) const RUNTIME_HEADER: &str =
    "#ifdef __PORTABLE_OBJC__\n#include <objcrt.h>\n#else\n#import <objc/objc.h>\n#endif";

pub(crate) struct ObjectiveC;

impl ParserDialect for ObjectiveC {
    fn primary(&self, p: &mut Parser) -> Parsed {
        if p.accept("[") {
            p.skip_newlines();
            let receiver = p.expression()?;
            p.skip_newlines();
            let mut selector = p.expect_name()?;
            let mut arguments = Vec::new();
            if p.accept(":") {
                selector.push(':');
                loop {
                    p.skip_newlines();
                    arguments.push(p.expression()?);
                    p.skip_newlines();
                    if !p.is_at(":", 1) {
                        break;
                    }
                    selector.push_str(&p.expect_name()?);
                    selector.push(':');
                    p.expect(":")?;
                }
            }
            p.expect("]")?;
            return Ok(Node::new("Message")
                .with("receiver", receiver)
                .with("selector", selector)
                .with("arguments", arguments));
        }
        if p.is("{") && p.is_at(":", 1) {
            p.position += 1;
            let mut parameters = Vec::new();
            while p.accept(":") {
                parameters.push(p.expect_name()?);
            }
            p.expect("|")?;
            let body = block(p.items(&|p| p.is("}"))?);
            p.expect("}")?;
            return Ok(Node::new("BlockLambda")
                .with("parameters", parameters)
                .with("body", body));
        }
        p.base_primary()
    }

    fn while_statement(&self, p: &mut Parser) -> Parsed {
        p.position += 1;
        let condition = p.condition()?;
        p.skip_newlines();
        let body = if p.is("{") {
            p.block()?
        } else {
            block(vec![p.statement()?])
        };
        Ok(Node::new("While")
            .with("condition", condition)
            .with("body", body))
    }

    fn program(&self, p: &mut Parser) -> Parsed {
        let program = p.base_program()?;
        Ok(program)
    }
}

impl Parser {
    pub(crate) fn objc_prefix(&mut self) -> Parsed<Option<Node>> {
        if !matches!(self.syntax.id, "objc" | "javascript" | "typescript") {
            return Ok(None);
        }
        if self.syntax.id == "objc" && self.accept("*") {
            return Ok(Some(
                Node::new("Dereference").with("operand", self.unary()?),
            ));
        }
        if self.is("++") || self.is("--") {
            let delta = if self.next_value()? == "++" {
                1.0
            } else {
                -1.0
            };
            return Ok(Some(
                Node::new("Update")
                    .with("operand", self.unary()?)
                    .with("delta", delta)
                    .with("prefix", true),
            ));
        }
        Ok(None)
    }

    pub(crate) fn objc_postfix(&mut self, operand: Node) -> Parsed {
        if matches!(self.syntax.id, "objc" | "javascript" | "typescript")
            && (self.is("++") || self.is("--"))
        {
            let delta = if self.next_value()? == "++" {
                1.0
            } else {
                -1.0
            };
            Ok(Node::new("Update")
                .with("operand", operand)
                .with("delta", delta)
                .with("prefix", false))
        } else {
            Ok(operand)
        }
    }
}

impl EmitterDialect for ObjectiveC {
    fn expression_in(&self, e: &mut Emitter, value: &Node, parent: f64) -> Result<String> {
        objpak_objc::expression(e, value, parent)
    }
    fn declaration(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        objpak_objc::declaration(e, statement)
    }
    fn main(&self, e: &mut Emitter, program: &Node) -> Result<()> {
        objpak_objc::main(e, program)
    }
}
