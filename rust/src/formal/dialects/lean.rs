//! Lean 4: every function is a `partial def` whose body is a do block. A
//! function that returns a value runs in the identity monad (`Id.run do`),
//! so it computes without output; a procedure and main run in `IO`, where
//! prints happen. Variables are `let` (or `let mut` when they change) with
//! their type, a counting loop is `for i in (a : Int)...<b do`, and
//! functions call each other by juxtaposition: `f a (b + 1)`. Integers are
//! Int, so division and remainder truncate with Int.tdiv and Int.tmod, and
//! an array index becomes a natural number with Int.toNat.

use super::shared::{comment_node, default_value};
use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Format, Result, field};
use crate::formal::lexer::TokenType;
use crate::formal::parser::{Parsed, Parser};
use crate::meta::{GrammarError, Node, block, later_calls, name};

pub(crate) struct Lean;

/// Words that end an application: `if f x then`, `for i in ... do`.
const KEYWORDS: [&str; 14] = [
    "then", "else", "do", "in", "with", "if", "let", "mut", "return", "for", "while", "fun", "def",
    "partial",
];

/// Marks `()`, the argument of a function without parameters.
const UNIT_ARGUMENT: &str = "Unit";

fn empty() -> Node {
    Node::new("Statements").with("statements", Vec::<Node>::new())
}

/// The meta type of a Lean type spelling.
fn meta_type(spelled: &str) -> String {
    match spelled {
        "Int" => "integer",
        "String" => "text",
        "Bool" => "boolean",
        "Unit" | "IO Unit" => "nothing",
        "Array Int" => "array",
        other => other,
    }
    .to_owned()
}

// ---- reading ----

/// The words of a type up to the symbol that ends it.
fn type_until(p: &mut Parser, stop: &str) -> Parsed<String> {
    let mut words = Vec::new();
    while !p.is(stop) && p.kind(0) != TokenType::End {
        words.push(p.next_value()?);
    }
    Ok(meta_type(&words.join(" ")))
}

/// partial def name (a : Int) (b : Int) : Int := Id.run do <block>
fn definition(p: &mut Parser) -> Parsed {
    p.accept("partial");
    p.expect("def")?;
    let function_name = p.expect_name()?;
    let mut parameters = Vec::new();
    while p.accept("(") {
        let parameter = p.expect_name()?;
        p.expect(":")?;
        let kind = type_until(p, ")")?;
        p.expect(")")?;
        // (_ : Unit) stands for no parameters.
        if parameter != "_" {
            parameters.push(
                Node::new("Parameter")
                    .with("name", parameter)
                    .with("type", kind),
            );
        }
    }
    p.expect(":")?;
    let return_type = type_until(p, ":=")?;
    p.expect(":=")?;
    if p.accept("Id") {
        p.expect(".")?;
        p.expect("run")?;
    }
    p.expect("do")?;
    let mut statements = indented_block(p)?.node_list("statements");
    // `return default` only satisfies Lean after a last statement that does
    // not return.
    if statements.last().is_some_and(|last| {
        last.is("Return")
            && last
                .node("value")
                .and_then(|value| value.str("name"))
                .is_some_and(|value| value == "default")
    }) {
        statements.pop();
    }
    Ok(Node::new("Function")
        .with("name", function_name)
        .with("parameters", parameters)
        .with("returnType", return_type)
        .with("body", block(statements)))
}

/// The statements indented below the line that opens a block.
fn indented_block(p: &mut Parser) -> Parsed {
    p.skip_newlines();
    let token = p.next()?;
    if token.kind != TokenType::Indent {
        return Err(GrammarError::syntax(
            "Expected an indented block",
            p.current().line,
        ));
    }
    let statements = p.items(&|p| matches!(p.kind(0), TokenType::Dedent | TokenType::End))?;
    p.next()?;
    Ok(block(statements))
}

fn is_statement_end(p: &Parser) -> bool {
    matches!(
        p.kind(0),
        TokenType::Newline | TokenType::Dedent | TokenType::End
    )
}

/// let x : Int := v, let mut x : Int := v and let _ := f x.
fn let_statement(p: &mut Parser) -> Parsed {
    p.next()?;
    let mutable = p.accept("mut");
    let variable = p.expect_name()?;
    let kind = if p.accept(":") {
        Some(type_until(p, ":=")?)
    } else {
        None
    };
    p.expect(":=")?;
    let value = p.expression()?;
    p.end_statement()?;
    if variable == "_" {
        return Ok(Node::new("Evaluate").with("expression", value));
    }
    Ok(Node::new("Declaration")
        .with("name", variable)
        .with_opt("type", kind)
        .with("value", value)
        .with("mutable", mutable))
}

/// x := v, and x := x.set! i v, which changes one element.
fn assignment(p: &mut Parser) -> Parsed {
    let variable = p.next_value()?;
    p.next()?;
    let value = p.expression()?;
    p.end_statement()?;
    if value.is("Call") && value.str("callee") == Some(&format!("{variable}.set!")) {
        let mut arguments = value.node_list("arguments").into_iter();
        let index = arguments.next().unwrap_or(Node::new("Number"));
        let element = arguments.next().unwrap_or(Node::new("Number"));
        return Ok(Node::new("IndexAssignment")
            .with("name", variable)
            .with("index", index)
            .with("value", element));
    }
    Ok(Node::new("Assignment")
        .with("name", variable)
        .with("operator", "=")
        .with("value", value))
}

/// if c then <block> else if d then <block> else <block>
fn if_statement(p: &mut Parser) -> Parsed {
    p.next()?;
    let condition = p.expression()?;
    p.expect("then")?;
    let then = indented_block(p)?;
    let mut otherwise = None;
    if p.accept("else") {
        otherwise = Some(if p.is("if") {
            if_statement(p)?
        } else {
            indented_block(p)?
        });
    }
    Ok(Node::new("If")
        .with("condition", condition)
        .with("then", then)
        .with_opt("otherwise", otherwise))
}

/// for i in (a : Int)...<b do <block>
fn for_statement(p: &mut Parser) -> Parsed {
    p.next()?;
    let variable = p.expect_name()?;
    p.expect("in")?;
    p.expect("(")?;
    let start = p.expression()?;
    p.expect(":")?;
    p.expect_name()?;
    p.expect(")")?;
    p.expect("...<")?;
    let end = p.expression()?;
    p.expect("do")?;
    Ok(Node::new("CountingLoop")
        .with("variable", variable)
        .with("start", start)
        .with("end", end)
        .with("body", indented_block(p)?))
}

/// Whether the next token starts an argument of an application.
fn starts_atom(p: &Parser) -> bool {
    match p.kind(0) {
        TokenType::Number | TokenType::Text => true,
        TokenType::Name => !KEYWORDS.contains(&p.value(0)),
        _ => p.is("(") || (p.is("#") && p.is_at("[", 1)),
    }
}

/// The library functions the emitter writes for meta operations.
fn application(callee: String, values: Vec<Node>) -> Node {
    let mut values = values.into_iter();
    let first = values.next().unwrap_or(Node::new("Number"));
    let binary = |operator: &str, left: Node, right: Option<Node>| {
        Node::new("Binary")
            .with("operator", operator)
            .with("left", left)
            .with("right", right.unwrap_or(Node::new("Number")))
    };
    match callee.as_str() {
        "Int.tdiv" => binary("divide", first, values.next()),
        "Int.tmod" => binary("remainder", first, values.next()),
        "Int.toNat" => first,
        "Int.ofNat" => match first
            .str("name")
            .and_then(|array| array.strip_suffix(".size"))
        {
            Some(array) if first.is("Name") => Node::new("Length").with("array", name(array)),
            _ => first,
        },
        "Array.replicate" => Node::new("NewArray")
            .with("length", first)
            .with("fill", values.next().unwrap_or(Node::new("Number"))),
        _ => Node::new("Call").with("callee", callee).with(
            "arguments",
            std::iter::once(first).chain(values).collect::<Vec<_>>(),
        ),
    }
}

/// A literal, a parenthesized expression (perhaps with a type), an array
/// #[a, b], or a dotted name with an optional index a[i]!.
fn atom(p: &mut Parser) -> Parsed {
    if p.accept("(") {
        if p.accept(")") {
            return Ok(Node::new(UNIT_ARGUMENT));
        }
        let inner = p.expression()?;
        if p.accept(":") {
            type_until(p, ")")?;
        }
        p.expect(")")?;
        return Ok(inner);
    }
    if p.is("#") && p.is_at("[", 1) {
        p.position += 2;
        return p.array_literal("]");
    }
    if p.kind(0) != TokenType::Name {
        return p.base_primary();
    }
    if p.is("true") || p.is("false") {
        return Ok(Node::new("Boolean").with("value", p.next_value()? == "true"));
    }
    let mut written = p.next_value()?;
    while p.is(".") && p.kind(1) == TokenType::Name {
        p.next()?;
        written = format!("{written}.{}", p.next_value()?);
    }
    if p.accept("[") {
        let index = p.expression()?;
        p.expect("]")?;
        p.expect("!")?;
        return Ok(Node::new("Index")
            .with("array", name(written))
            .with("index", index));
    }
    Ok(name(written))
}

impl ParserDialect for Lean {
    fn item(&self, p: &mut Parser) -> Parsed {
        if p.kind(0) == TokenType::Comment {
            let token = p.next()?;
            return Ok(comment_node(&token));
        }
        if p.accept("import") {
            let mut words = Vec::new();
            while p.kind(0) == TokenType::Name || p.is(".") {
                words.push(p.next_value()?);
            }
            return Ok(Node::new("Import").with("text", format!("import {}", words.concat())));
        }
        // `mutual ... end` only lets functions call each other.
        if p.is("mutual") || p.is("end") {
            p.next()?;
            return Ok(empty());
        }
        if p.is("partial") || p.is("def") {
            return definition(p);
        }
        p.statement()
    }

    fn statement(&self, p: &mut Parser) -> Parsed {
        if p.is("let") {
            return let_statement(p);
        }
        if p.kind(0) == TokenType::Name && p.is_at(":=", 1) {
            return assignment(p);
        }
        if p.is("if") {
            return if_statement(p);
        }
        if p.accept("while") {
            let condition = p.expression()?;
            p.expect("do")?;
            return Ok(Node::new("While")
                .with("condition", condition)
                .with("body", indented_block(p)?));
        }
        if p.is("for") {
            return for_statement(p);
        }
        if p.accept("return") {
            let value = if is_statement_end(p) {
                None
            } else {
                Some(p.expression()?)
            };
            p.end_statement()?;
            return Ok(Node::new("Return").with_opt("value", value));
        }
        if p.is("IO") && p.is_at(".", 1) {
            let printer = p.value(2).to_owned();
            if printer == "println" || printer == "print" {
                p.position += 3;
                let value = atom(p)?;
                p.end_statement()?;
                return Ok(Node::new("Print")
                    .with("value", value)
                    .with("newline", printer == "println"));
            }
        }
        // `pure ()` is an empty block.
        if p.is("pure") && p.is_at("(", 1) && p.is_at(")", 2) {
            p.position += 3;
            p.end_statement()?;
            return Ok(empty());
        }
        let expression = p.expression()?;
        p.end_statement()?;
        Ok(Node::new("Evaluate").with("expression", expression))
    }

    /// f a b: a name applied to the atoms after it.
    fn primary(&self, p: &mut Parser) -> Parsed {
        let head = atom(p)?;
        if !head.is("Name") || !starts_atom(p) {
            return Ok(head);
        }
        let mut values = Vec::new();
        while starts_atom(p) {
            let value = atom(p)?;
            if !value.is(UNIT_ARGUMENT) {
                values.push(value);
            }
        }
        let callee = head.str("name").unwrap_or_default().to_owned();
        if values.is_empty() {
            return Ok(Node::new("Call")
                .with("callee", callee)
                .with("arguments", Vec::<Node>::new()));
        }
        Ok(application(callee, values))
    }
}

// ---- writing ----

/// Whether the functions form one mutual group.
#[derive(Default)]
struct Writing {
    mutual: bool,
}

fn indented(e: &mut Emitter, body: &Node) -> Result<()> {
    e.depth += 1;
    let result = e.body(body);
    e.depth -= 1;
    result
}

fn applied(written: String, parent: f64) -> String {
    if parent > 6.0 {
        format!("({written})")
    } else {
        written
    }
}

/// An array index is a natural number.
fn natural(e: &mut Emitter, index: &Node, parent: f64) -> Result<String> {
    if index.is("Number") && index.number("value").is_some_and(|value| value >= 0.0) {
        return e.expression(index);
    }
    let written = format!("Int.toNat {}", e.expression_in(index, 8.0)?);
    Ok(applied(written, parent))
}

/// Applications bind tighter than every operator, but not than `!` and `-`,
/// and an argument that is not a single word is parenthesized.
fn call(e: &mut Emitter, callee: &str, values: &[&Node], parent: f64) -> Result<String> {
    let written = if values.is_empty() {
        "()".to_owned()
    } else {
        values
            .iter()
            .map(|value| e.expression_in(value, 8.0))
            .collect::<Result<Vec<_>>>()?
            .join(" ")
    };
    Ok(applied(format!("{callee} {written}"), parent))
}

fn is_procedure(item: &Node) -> bool {
    item.str("returnType").is_none_or(|kind| kind == "nothing")
}

/// A variable that changes, or whose elements change, is `let mut`.
fn declaration(e: &mut Emitter, statement: &Node) -> Result<String> {
    let variable = statement.str("name").unwrap_or_default();
    let value = statement.node("value");
    let array = value.is_some_and(|value| value.is("ArrayLiteral") || value.is("NewArray"));
    let kind = if array {
        "array"
    } else {
        statement.str("type").unwrap_or("integer")
    };
    let initial = match value {
        Some(value) => e.expression(value)?,
        None => e.expression(&default_value(kind))?,
    };
    let changes =
        statement.flag("mutable") == Some(true) || statement.flag("elementsAssigned") == Some(true);
    Ok(format!(
        "let {}{variable} : {} := {initial}",
        if changes { "mut " } else { "" },
        e.type_name(kind)
    ))
}

fn if_chain(e: &mut Emitter, statement: &Node) -> Result<()> {
    let condition = e.expression(field(statement, "condition")?)?;
    e.line(&format!("if {condition} then"));
    indented(e, field(statement, "then")?)?;
    let mut rest = statement.node("otherwise");
    while let Some(next) = rest.filter(|next| next.is("If")) {
        let condition = e.expression(field(next, "condition")?)?;
        e.line(&format!("else if {condition} then"));
        indented(e, field(next, "then")?)?;
        rest = next.node("otherwise");
    }
    if let Some(last) = rest.filter(|last| !last.nodes("statements").is_empty()) {
        e.line("else");
        indented(e, last)?;
    }
    Ok(())
}

impl EmitterDialect for Lean {
    fn expression_in(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        match expression.kind.as_str() {
            "Call" => call(
                e,
                expression.str("callee").unwrap_or_default(),
                &expression.nodes("arguments"),
                parent,
            ),
            "ArrayLiteral" => Ok(format!(
                "#[{}]",
                expression
                    .nodes("elements")
                    .iter()
                    .map(|element| e.expression(element))
                    .collect::<Result<Vec<_>>>()?
                    .join(", ")
            )),
            "NewArray" => {
                let length = natural(e, field(expression, "length")?, 8.0)?;
                let fill = e.expression_in(field(expression, "fill")?, 8.0)?;
                Ok(applied(format!("Array.replicate {length} {fill}"), parent))
            }
            "Index" => {
                let array = field(expression, "array")?.str("name").unwrap_or_default();
                let index = natural(e, field(expression, "index")?, 0.0)?;
                Ok(format!("{array}[{index}]!"))
            }
            "Length" => {
                let array = field(expression, "array")?.str("name").unwrap_or_default();
                Ok(applied(format!("Int.ofNat {array}.size"), parent))
            }
            _ => e.base_expression_in(expression, parent),
        }
    }

    fn binary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        let spelled = match expression.str("operator") {
            Some("divide") => "Int.tdiv",
            Some("remainder") => "Int.tmod",
            _ => return e.base_binary(expression, parent),
        };
        let left = field(expression, "left")?;
        let right = field(expression, "right")?;
        call(e, spelled, &[left, right], parent)
    }

    /// s!"text {value}": a brace in the text is escaped.
    fn interpolation(&self, e: &mut Emitter, parts: &[Node]) -> Result<String> {
        let mut written = String::new();
        for part in parts {
            if part.is("Text") {
                let value = e.escape(part.str("value").unwrap_or_default(), Format::None);
                written.push_str(&value.replace('{', "\\{"));
            } else {
                written.push_str(&format!("{{{}}}", e.expression(part)?));
            }
        }
        Ok(format!("s!\"{written}\""))
    }

    fn statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        match statement.kind.as_str() {
            "Print" => {
                let printer = if statement.flag("newline") == Some(true) {
                    "println"
                } else {
                    "print"
                };
                let value = e.expression_in(field(statement, "value")?, 8.0)?;
                e.line(&format!("IO.{printer} {value}"));
            }
            "Evaluate" => {
                // A value nobody reads is bound to _.
                let expression = field(statement, "expression")?;
                let written = e.expression(expression)?;
                if expression.str("type").is_some_and(|kind| kind != "nothing") {
                    e.line(&format!("let _ := {written}"));
                } else {
                    e.line(&written);
                }
            }
            "Return" => {
                let line = match statement.node("value") {
                    Some(value) => format!("return {}", e.expression(value)?),
                    None => "return".to_owned(),
                };
                e.line(&line);
            }
            "Declaration" => {
                let line = declaration(e, statement)?;
                e.line(&line);
            }
            "Assignment" => {
                let variable = statement.str("name").unwrap_or_default();
                let value = e.expression(field(statement, "value")?)?;
                e.line(&format!("{variable} := {value}"));
            }
            "IndexAssignment" => {
                let array = statement.str("name").unwrap_or_default();
                let index = natural(e, field(statement, "index")?, 8.0)?;
                let value = e.expression_in(field(statement, "value")?, 8.0)?;
                e.line(&format!("{array} := {array}.set! {index} {value}"));
            }
            "If" => if_chain(e, statement)?,
            "While" => {
                let condition = e.expression(field(statement, "condition")?)?;
                e.line(&format!("while {condition} do"));
                indented(e, field(statement, "body")?)?;
            }
            "CountingLoop" => {
                let variable = statement.str("variable").unwrap_or_default();
                let start = e.expression(field(statement, "start")?)?;
                let end = e.expression(field(statement, "end")?)?;
                e.line(&format!("for {variable} in ({start} : Int)...<{end} do"));
                indented(e, field(statement, "body")?)?;
            }
            _ => e.base_statement(statement)?,
        }
        Ok(())
    }

    fn signature(&self, e: &mut Emitter, item: &Node) -> String {
        let parameters = item.nodes("parameters");
        let list = if parameters.is_empty() {
            "(_ : Unit)".to_owned()
        } else {
            parameters
                .iter()
                .map(|parameter| {
                    let kind = e.type_name(parameter.str("type").unwrap_or_default());
                    format!("({} : {kind})", parameter.str("name").unwrap_or_default())
                })
                .collect::<Vec<_>>()
                .join(" ")
        };
        let function_name = item.str("name").unwrap_or_default();
        if is_procedure(item) {
            format!("partial def {function_name} {list} : IO Unit := do")
        } else {
            let returns = e.type_name(item.str("returnType").unwrap_or_default());
            format!("partial def {function_name} {list} : {returns} := Id.run do")
        }
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for comment in item.texts("comments") {
            e.comment(&comment);
        }
        let signature = e.signature(item);
        e.line(&signature);
        let body = field(item, "body")?;
        indented(e, body)?;
        // A value function whose last statement does not return still needs
        // a value at its end.
        let returns = body
            .nodes("statements")
            .last()
            .is_some_and(|last| last.is("Return"));
        if !is_procedure(item) && !returns {
            e.depth += 1;
            e.line("return default");
            e.depth -= 1;
        }
        Ok(())
    }

    /// Functions that call a function defined after them are one mutual
    /// group.
    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        e.unit = "  ";
        e.state::<Writing>().mutual = !later_calls(&program.node_list("functions")).is_empty();
        e.base_program(program)
    }

    fn main(&self, e: &mut Emitter, program: &Node) -> Result<()> {
        if e.state::<Writing>().mutual {
            // The group opens above the first function and its comments and
            // closes after the last function, before the blank line.
            e.lines.insert(0, "mutual".to_owned());
            let last = e.lines.len() - 1;
            e.lines.insert(last, "end".to_owned());
        }
        for comment in program.texts("mainComments") {
            e.comment(&comment);
        }
        e.line("def main : IO Unit := do");
        indented(e, field(program, "main")?)
    }
}
