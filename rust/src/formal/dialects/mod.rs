//! Languages whose statements and program layout follow a grammar of their
//! own (Pascal, Fortran, Ada, Visual Basic, Bash, MATLAB, Zig, Lean, Rocq).
//! Each dialect overrides some steps of the shared parser and emitter and
//! keeps their expressions, names and token helpers; a step it does not
//! override, or calls back as `base_...`, behaves as in every other language.

mod ada;
mod bash;
mod fortran;
mod lean;
mod matlab;
mod pascal;
mod rocq;
pub(crate) mod shared;
mod vb;
mod zig;

pub(crate) use rocq::{comparison as rocq_comparison, not_equal as rocq_not_equal};
pub(crate) use shared::declared_variables;

use super::emitter::{Emitter, Result};
use super::lexer::Token;
use super::parser::{Parsed, Parser};
use crate::meta::Node;

/// The writing steps a dialect can replace.
pub(crate) trait EmitterDialect: Sync {
    fn terminator(&self, e: &Emitter) -> &'static str {
        e.base_terminator()
    }

    fn variable(&self, e: &Emitter, identifier: &str) -> String {
        e.base_variable(identifier)
    }

    fn quote(&self, e: &Emitter, value: &str) -> String {
        e.base_quote(value)
    }

    fn unary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        e.base_unary(expression, parent)
    }

    fn expression_in(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        e.base_expression_in(expression, parent)
    }

    fn binary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        e.base_binary(expression, parent)
    }

    fn interpolation(&self, e: &mut Emitter, parts: &[Node]) -> Result<String> {
        e.base_interpolation(parts)
    }

    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        e.base_print(statement)
    }

    fn return_statement(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        e.base_return_statement(statement)
    }

    fn condition(&self, e: &mut Emitter, expression: &Node) -> Result<String> {
        e.base_condition(expression)
    }

    fn body(&self, e: &mut Emitter, block: &Node) -> Result<()> {
        e.base_body(block)
    }

    fn statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        e.base_statement(statement)
    }

    fn declaration(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        e.base_declaration(statement)
    }

    fn assignment(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        e.base_assignment(statement)
    }

    fn if_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        e.base_if_statement(statement)
    }

    fn while_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        e.base_while_statement(statement)
    }

    fn counting_loop(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        e.base_counting_loop(statement)
    }

    fn signature(&self, e: &mut Emitter, item: &Node) -> String {
        e.base_signature(item)
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        e.base_function_definition(item)
    }

    fn forward_declaration(&self, e: &mut Emitter, item: &Node) -> String {
        e.base_forward_declaration(item)
    }

    fn main(&self, e: &mut Emitter, program: &Node) -> Result<()> {
        e.base_main(program)
    }

    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        e.base_program(program)
    }

    fn prelude(&self, e: &mut Emitter, program: &Node) -> Vec<String> {
        e.base_prelude(program)
    }
}

/// The reading steps a dialect can replace.
pub(crate) trait ParserDialect: Sync {
    /// The tokens as the shared parser should see them.
    fn tokens(&self, tokens: Vec<Token>) -> Vec<Token> {
        tokens
    }

    fn program(&self, p: &mut Parser) -> Parsed {
        p.base_program()
    }

    fn items(&self, p: &mut Parser, done: &dyn Fn(&Parser) -> bool) -> Parsed<Vec<Node>> {
        p.base_items(done)
    }

    fn item(&self, p: &mut Parser) -> Parsed {
        p.base_item()
    }

    fn function_definition(&self, p: &mut Parser) -> Parsed {
        p.base_function_definition()
    }

    fn type_expression(&self, p: &mut Parser) -> Parsed<Option<String>> {
        p.base_type_expression()
    }

    fn statement(&self, p: &mut Parser) -> Parsed {
        p.base_statement()
    }

    fn while_statement(&self, p: &mut Parser) -> Parsed {
        p.base_while_statement()
    }

    fn primary(&self, p: &mut Parser) -> Parsed {
        p.base_primary()
    }
}

/// The shared grammar, unchanged.
struct Plain;

impl EmitterDialect for Plain {}
impl ParserDialect for Plain {}

/// The emitter steps of a language.
pub(crate) fn emitter_dialect(language: &str) -> &'static dyn EmitterDialect {
    match language {
        "ada" => &ada::Ada,
        "bash" => &bash::Bash,
        "fortran" => &fortran::Fortran,
        "lean" => &lean::Lean,
        "matlab" => &matlab::Matlab,
        "pascal" => &pascal::Pascal,
        "rocq" => &rocq::Rocq,
        "vb" => &vb::VisualBasic,
        "zig" => &zig::Zig,
        _ => &Plain,
    }
}

/// The parser steps of a language.
pub(crate) fn parser_dialect(language: &str) -> &'static dyn ParserDialect {
    match language {
        "ada" => &ada::Ada,
        "bash" => &bash::Bash,
        "fortran" => &fortran::Fortran,
        "lean" => &lean::Lean,
        "matlab" => &matlab::Matlab,
        "pascal" => &pascal::Pascal,
        "rocq" => &rocq::Rocq,
        "vb" => &vb::VisualBasic,
        "zig" => &zig::Zig,
        _ => &Plain,
    }
}
