//! Zig: functions write their result type after the parameters, output goes
//! through a buffered writer that main opens on standard output, and a
//! counting loop is a while loop with a continue expression. Integer
//! division and remainder are the builtins @divTrunc and @rem, and a value
//! the program does not use is discarded with `_ =`.

use std::collections::{HashSet, VecDeque};

use super::{EmitterDialect, ParserDialect};
use crate::grammar::GrammarError;
use crate::grammar::array_spellings::is_array_declaration;
use crate::grammar::emitter::{Emitter, Format, Result, field};
use crate::grammar::lexer::{Token, TokenType, decode_escapes};
use crate::grammar::meta::{Node, add, block, number, text, walk};
use crate::grammar::parser::{Parsed, Parser, source_type};

pub(crate) struct Zig;

/// main opens the writer that every print uses; these lines are layout, not
/// part of the program.
const WRITER_SETUP: [&str; 4] = [
    "var buffer: [4096]u8 = undefined;",
    "var writer = std.Io.File.stdout().writer(init.io, &buffer);",
    "out = &writer.interface;",
    "defer out.flush() catch {};",
];
const WRITER_NAMES: [&str; 3] = ["out", "buffer", "writer"];

fn placeholder(kind: Option<&str>) -> &'static str {
    match kind {
        Some("integer") => "{d}",
        Some("text") => "{s}",
        Some("boolean") => "{}",
        _ => "{any}",
    }
}

fn builtin(name: &str) -> Option<&'static str> {
    match name {
        "divTrunc" => Some("divide"),
        "rem" => Some("remainder"),
        _ => None,
    }
}

/// The parts of a print format: {d}, {s} and {} take the next value, and {{
/// and }} are braces.
fn format_parts(format: &str, values: Vec<Node>) -> Vec<Node> {
    let mut values = VecDeque::from(values);
    let mut parts = Vec::new();
    let mut literal = String::new();
    let mut rest = format;
    while let Some(character) = rest.chars().next() {
        if rest.starts_with("{{") || rest.starts_with("}}") {
            literal.push(character);
            rest = &rest[2..];
            continue;
        }
        if character == '{' {
            let letters = rest[1..]
                .chars()
                .take_while(char::is_ascii_lowercase)
                .count();
            if rest[1 + letters..].starts_with('}') {
                if !literal.is_empty() {
                    parts.push(text(std::mem::take(&mut literal)));
                }
                parts.extend(values.pop_front());
                rest = &rest[letters + 2..];
                continue;
            }
        }
        literal.push(character);
        rest = &rest[character.len_utf8()..];
    }
    if !literal.is_empty() {
        parts.push(text(literal));
    }
    parts
}

/// Whether a statement reads or writes the variable.
fn mentions(statement: &Node, variable: &str) -> bool {
    let mut found = false;
    walk(statement, |current| {
        found |= (current.is("Name") || current.is("Assignment") || current.is("Declaration"))
            && current.str("name") == Some(variable);
    });
    found
}

fn is_setting(statement: &Node) -> bool {
    statement.is("Assignment") || statement.is("Declaration")
}

/// Whether the statements read the variable before they set it again.
fn read_later(statements: &[Node], variable: &str) -> bool {
    for statement in statements {
        let value = statement.node("value").cloned().unwrap_or(number(0.0));
        if is_setting(statement)
            && statement.str("name") == Some(variable)
            && statement.str("operator") != Some("+=")
            && !mentions(&value, variable)
        {
            return false;
        }
        if mentions(statement, variable) {
            return true;
        }
    }
    false
}

/// `var i: i64 = a;` followed by `while (i < b) : (i += 1)` counts when i is
/// not read after the loop.
fn is_counting(start: Option<&Node>, condition: &Node, update: &Node, rest: &[Node]) -> bool {
    let Some(start) = start else {
        return false;
    };
    let name = update.str("name").unwrap_or_default();
    let step = update.node("value");
    is_setting(start)
        && start.str("name") == Some(name)
        && start.str("operator").unwrap_or("=") == "="
        && matches!(condition.str("operator"), Some("less" | "lessOrEqual"))
        && condition
            .node("left")
            .is_some_and(|left| left.is("Name") && left.str("name") == Some(name))
        && update.str("operator") == Some("+=")
        && step.is_some_and(|step| step.is("Number") && step.number("value") == Some(1.0))
        && !read_later(rest, name)
}

/// Every other loop with a continue expression runs it at the end of its
/// body.
fn join_loops(items: Vec<Node>) -> Vec<Node> {
    let mut joined: Vec<Node> = Vec::new();
    for (index, item) in items.iter().enumerate() {
        let (Some(update), Some(condition), Some(body)) = (
            item.node("update"),
            item.node("condition"),
            item.node("body"),
        ) else {
            joined.push(item.clone());
            continue;
        };
        if !item.is("While") {
            joined.push(item.clone());
            continue;
        }
        if !is_counting(joined.last(), condition, update, &items[index + 1..]) {
            let mut statements = body.node_list("statements");
            statements.push(update.clone());
            joined.push(
                Node::new("While")
                    .with("condition", condition.clone())
                    .with("body", block(statements)),
            );
            continue;
        }
        let start = joined
            .pop()
            .expect("a counting loop starts after a declaration");
        let right = condition.node("right").cloned().unwrap_or(number(0.0));
        let end = if condition.str("operator") == Some("less") {
            right
        } else {
            add(right, number(1.0))
        };
        joined.push(
            Node::new("CountingLoop")
                .with("variable", update.str("name").unwrap_or_default())
                .with_opt("start", start.node("value").cloned())
                .with("end", end)
                .with("body", body.clone()),
        );
    }
    joined
}

// ---- reading ----

impl ParserDialect for Zig {
    fn items(&self, p: &mut Parser, done: &dyn Fn(&Parser) -> bool) -> Parsed<Vec<Node>> {
        Ok(join_loops(p.base_items(done)?))
    }

    fn item(&self, p: &mut Parser) -> Parsed {
        if is_writer_setup(p) {
            rest_of_line(p)?;
            return Ok(Node::new("Statements").with("statements", Vec::<Node>::new()));
        }
        // const std = @import("std");
        if p.is("const") && p.is_at("=", 2) && p.is_at("@", 3) {
            let tokens = rest_of_line(p)?;
            let words: Vec<&str> = tokens.iter().map(|token| token.value.as_str()).collect();
            return Ok(Node::new("Import").with("text", words.join(" ")));
        }
        if p.is("pub") || p.is("fn") {
            return p.function_definition();
        }
        p.base_item()
    }

    /// [pub] fn name(a: i64, b: i64) i64 { ... }
    fn function_definition(&self, p: &mut Parser) -> Parsed {
        p.accept("pub");
        p.expect("fn")?;
        let name = p.expect_name()?;
        let parameters = p.parameter_list()?;
        let return_type = p.type_expression()?;
        let body = p.block()?;
        // main receives the process only to open the writer.
        let parameters = if name == "main" {
            Vec::new()
        } else {
            parameters
        };
        Ok(Node::new("Function")
            .with("name", name)
            .with("parameters", parameters)
            .with_opt("returnType", return_type)
            .with("body", body))
    }

    /// i64, bool, []const u8 and void, as the language table spells them.
    fn type_expression(&self, p: &mut Parser) -> Parsed<Option<String>> {
        let mut words = Vec::new();
        while !["{", "=", ",", ")", ";"].contains(&p.current().value.as_str())
            && !matches!(p.kind(0), TokenType::Newline | TokenType::End)
        {
            words.push(p.next()?.value);
        }
        let spelled = words.concat();
        if let Some(types) = p.syntax.types {
            let found = [
                ("integer", types.integer),
                ("text", types.text),
                ("boolean", types.boolean),
                ("nothing", types.nothing),
            ]
            .into_iter()
            .find(|(_, written)| written.split_whitespace().collect::<String>() == spelled);
            if let Some((meta, _)) = found {
                return Ok(Some(meta.to_owned()));
            }
        }
        Ok(source_type(&words.join(" ")))
    }

    fn statement(&self, p: &mut Parser) -> Parsed {
        // `_ = f(x);` drops a result, and `_ = x;` marks an unused parameter.
        if p.is("_") && p.is_at("=", 1) {
            p.position += 2;
            let expression = p.expression()?;
            p.end_statement()?;
            return Ok(if expression.is("Name") {
                Node::new("Statements").with("statements", Vec::<Node>::new())
            } else {
                Node::new("Evaluate").with("expression", expression)
            });
        }
        if p.is("out") && p.is_at(".", 1) && p.is_at("print", 2) {
            return print_statement(p);
        }
        if p.is_at("page_allocator", 7) && p.is_at("alloc", 9) {
            return allocation(p);
        }
        p.base_statement()
    }

    /// while (condition) : (i += 1) { ... }
    fn while_statement(&self, p: &mut Parser) -> Parsed {
        p.position += 1;
        p.expect("(")?;
        let condition = p.expression()?;
        p.expect(")")?;
        let mut update = None;
        if p.accept(":") {
            p.expect("(")?;
            let step = p.for_update()?;
            update = Some(
                Node::new("Assignment")
                    .with("name", step.name)
                    .with("operator", step.operator)
                    .with("value", step.value),
            );
            p.expect(")")?;
        }
        Ok(Node::new("While")
            .with("condition", condition)
            .with_opt("update", update)
            .with("body", p.block()?))
    }

    /// @divTrunc(a, b) and @rem(a, b). @intCast(x) and @as(i64, x) only
    /// change the integer type, and .{ a, b } is an array literal.
    fn primary(&self, p: &mut Parser) -> Parsed {
        if p.is("@") && p.is_at("intCast", 1) && p.is_at("(", 2) {
            p.position += 3;
            let value = p.expression()?;
            p.expect(")")?;
            return Ok(value);
        }
        if p.is("@") && p.is_at("as", 1) && p.is_at("(", 2) {
            p.position += 3;
            p.expect_name()?;
            p.expect(",")?;
            let value = p.expression()?;
            p.expect(")")?;
            return Ok(value);
        }
        if p.is(".") && p.is_at("{", 1) {
            p.position += 2;
            return p.array_literal("}");
        }
        let operator = builtin(&p.peek(1).value);
        let Some(operator) = operator.filter(|_| p.is("@") && p.is_at("(", 2)) else {
            return p.base_primary();
        };
        p.position += 3;
        let left = p.expression()?;
        p.expect(",")?;
        let right = p.expression()?;
        p.expect(")")?;
        Ok(Node::new("Binary")
            .with("operator", operator)
            .with("left", left)
            .with("right", right))
    }
}

/// const a = std.heap.page_allocator.alloc(i64, @intCast(n)) catch
/// unreachable; and the lines after it that free the array and fill it with
/// @memset(a, v): the array of n values v.
fn allocation(p: &mut Parser) -> Parsed {
    p.position += 1;
    let variable = p.expect_name()?;
    p.position += 9;
    p.expect_name()?;
    p.expect(",")?;
    let length = p.expression()?;
    for word in [")", "catch", "unreachable"] {
        p.expect(word)?;
    }
    p.end_statement()?;
    let mut fill = number(0.0);
    let skip_lines = |p: &mut Parser| {
        while p.kind(0) == TokenType::Newline {
            p.position += 1;
        }
    };
    skip_lines(p);
    if p.is("defer") && p.is_at("std", 1) {
        rest_of_line(p)?;
        skip_lines(p);
    }
    if p.is("@") && p.is_at("memset", 1) && p.is_at(&variable, 3) {
        p.position += 5;
        fill = p.expression()?;
        p.expect(")")?;
        p.end_statement()?;
    }
    Ok(Node::new("Declaration")
        .with("name", variable)
        .with("type", "array")
        .with(
            "value",
            Node::new("NewArray")
                .with("length", length)
                .with("fill", fill),
        ))
}

/// The tokens up to the end of the line.
fn rest_of_line(p: &mut Parser) -> Parsed<Vec<Token>> {
    let mut tokens = Vec::new();
    while !matches!(p.kind(0), TokenType::Newline | TokenType::End) {
        tokens.push(p.next()?);
    }
    Ok(tokens)
}

/// `var out ...`, `out = ...` and `defer ...` open and close the writer.
fn is_writer_setup(p: &Parser) -> bool {
    p.is("defer")
        || (p.is("out") && p.is_at("=", 1))
        || ((p.is("var") || p.is("const")) && WRITER_NAMES.contains(&p.peek(1).value.as_str()))
}

/// The values of `.{ a, b }`.
fn tuple(p: &mut Parser) -> Parsed<Vec<Node>> {
    p.expect(".")?;
    p.expect("{")?;
    let mut values = Vec::new();
    while !p.accept("}") {
        values.push(p.expression()?);
        p.accept(",");
    }
    Ok(values)
}

/// out.print("format\n", .{ values }) catch {};
fn print_statement(p: &mut Parser) -> Parsed {
    p.position += 3;
    p.expect("(")?;
    let format = p.next()?;
    if format.kind != TokenType::Text {
        return Err(GrammarError::syntax("A format must be text", format.line));
    }
    p.expect(",")?;
    let values = tuple(p)?;
    for word in [")", "catch", "{", "}"] {
        p.expect(word)?;
    }
    p.end_statement()?;
    let written = decode_escapes(&format.value);
    let newline = written.ends_with('\n');
    let written = if newline {
        &written[..written.len() - 1]
    } else {
        &written
    };
    let mut parts = format_parts(written, values);
    let value = if parts.len() > 1 {
        Node::new("Interpolation").with("parts", parts)
    } else if parts.is_empty() {
        text("")
    } else {
        parts.remove(0)
    };
    Ok(Node::new("Print")
        .with("value", value)
        .with("newline", newline))
}

// ---- writing ----

/// Arrays of n values live as long as the function, in pages of memory.
const ALLOCATOR: &str = "std.heap.page_allocator";

/// An array of values is a Zig array of their count; an array of n values
/// is allocated, freed when the function ends and filled.
fn array_declaration(e: &mut Emitter, statement: &Node) -> Result<String> {
    let name = statement.str("name").unwrap_or_default();
    let value = field(statement, "value")?;
    if let Some(scope) = e.state::<Writing>().scopes.last_mut() {
        scope.insert(name.to_owned());
    }
    if value.is("NewArray") {
        let length = e.expression(field(value, "length")?)?;
        e.line(&format!(
            "const {name} = {ALLOCATOR}.alloc(i64, @intCast({length})) catch unreachable;"
        ));
        e.line(&format!("defer {ALLOCATOR}.free({name});"));
        return Ok(format!(
            "@memset({name}, {});",
            e.expression(field(value, "fill")?)?
        ));
    }
    let changes =
        statement.flag("mutable") == Some(true) || statement.flag("elementsAssigned") == Some(true);
    let count = value.nodes("elements").len();
    Ok(format!(
        "{} {name}: [{count}]i64 = {};",
        if changes { "var" } else { "const" },
        e.expression(value)?
    ))
}

/// Whether the program prints, and the names declared in each open block, so
/// that a variable two loops share is declared once.
#[derive(Default)]
struct Writing {
    writes: bool,
    scopes: Vec<HashSet<String>>,
}

impl EmitterDialect for Zig {
    fn body(&self, e: &mut Emitter, block: &Node) -> Result<()> {
        e.state::<Writing>().scopes.push(HashSet::new());
        let result = e.base_body(block);
        e.state::<Writing>().scopes.pop();
        result
    }

    /// Zig always puts conditions in parentheses.
    fn condition(&self, e: &mut Emitter, expression: &Node) -> Result<String> {
        Ok(format!("({})", e.expression(expression)?))
    }

    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let parts = if value.is("Interpolation") {
            value.node_list("parts")
        } else {
            vec![value.clone()]
        };
        let mut values = Vec::new();
        let mut format = String::new();
        for part in &parts {
            if part.is("Text") {
                format.push_str(&e.escape(part.str("value").unwrap_or_default(), Format::Braces));
            } else {
                values.push(e.expression(part)?);
                format.push_str(placeholder(part.str("type")));
            }
        }
        let tuple = if values.len() > 1 {
            format!(".{{ {} }}", values.join(", "))
        } else {
            format!(".{{{}}}", values.join(","))
        };
        let end = if statement.flag("newline") == Some(true) {
            "\\n"
        } else {
            ""
        };
        Ok(format!("out.print(\"{format}{end}\", {tuple}) catch {{}};"))
    }

    fn statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        // A result the program does not use is discarded explicitly.
        if statement.is("Evaluate") {
            let expression = field(statement, "expression")?;
            if expression.str("type").is_some_and(|kind| kind != "nothing") {
                let written = e.expression(expression)?;
                e.line(&format!("_ = {written};"));
                return Ok(());
            }
        }
        if is_array_declaration(statement) {
            let written = array_declaration(e, statement)?;
            e.line(&written);
            return Ok(());
        }
        e.base_statement(statement)
    }

    fn declaration(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let name = statement.str("name").unwrap_or_default();
        let initial = match statement.node("value") {
            Some(value) => e.expression(value)?,
            None => e.expression(&number(0.0))?,
        };
        let state = e.state::<Writing>();
        if state.scopes.iter().any(|scope| scope.contains(name)) {
            return Ok(format!("{name} = {initial};"));
        }
        if let Some(scope) = state.scopes.last_mut() {
            scope.insert(name.to_owned());
        }
        let keyword = if statement.flag("mutable") == Some(true) {
            "var"
        } else {
            "const"
        };
        let kind = e.type_name(statement.str("type").unwrap_or("integer"));
        Ok(format!("{keyword} {name}: {kind} = {initial};"))
    }

    /// Signed integers have no %= operator.
    fn assignment(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        if value.str("operator") == Some("remainder") {
            let name = statement.str("name").unwrap_or_default();
            return Ok(format!("{name} = {};", e.expression(value)?));
        }
        e.base_assignment(statement)
    }

    fn counting_loop(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let variable = statement.str("variable").unwrap_or_default();
        e.statement(
            &Node::new("Declaration")
                .with("name", variable)
                .with_opt("value", statement.node("start").cloned())
                .with("mutable", true),
        )?;
        // `i <= 10` reads better than `i < 11`, and `i < count` better than
        // `i <= count - 1`.
        let end = field(statement, "end")?;
        let last = add(end.clone(), number(-1.0));
        let condition = if last.is("Binary") {
            format!("{variable} < {}", e.expression_in(end, 5.0)?)
        } else {
            format!("{variable} <= {}", e.expression_in(&last, 5.0)?)
        };
        e.open_block(&format!("while ({condition}) : ({variable} += 1)"));
        e.body(field(statement, "body")?)?;
        e.close_block();
        Ok(())
    }

    fn binary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        if expression.str("operator") != Some("remainder") {
            return e.base_binary(expression, parent);
        }
        let left = e.expression(field(expression, "left")?)?;
        let right = e.expression(field(expression, "right")?)?;
        Ok(format!("@rem({left}, {right})"))
    }

    fn signature(&self, e: &mut Emitter, item: &Node) -> String {
        let list = item
            .nodes("parameters")
            .iter()
            .map(|parameter| {
                let kind = e.type_name(parameter.str("type").unwrap_or_default());
                format!("{}: {kind}", parameter.str("name").unwrap_or_default())
            })
            .collect::<Vec<_>>()
            .join(", ");
        let returns = e.type_name(item.str("returnType").unwrap_or("nothing"));
        format!(
            "fn {}({list}) {returns}",
            item.str("name").unwrap_or_default()
        )
    }

    /// Zig rejects a parameter that is never read, so it is discarded.
    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for comment in item.texts("comments") {
            e.comment(&comment);
        }
        let signature = e.signature(item);
        e.open_block(&signature);
        let body = field(item, "body")?;
        for parameter in item.nodes("parameters") {
            let name = parameter.str("name").unwrap_or_default();
            if !body
                .nodes("statements")
                .iter()
                .any(|part| mentions(part, name))
            {
                e.line(&format!("_ = {name};"));
            }
        }
        e.body(body)?;
        e.close_block();
        Ok(())
    }

    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        let mut writes = false;
        walk(program, |current| writes |= current.is("Print"));
        e.state::<Writing>().writes = writes;
        e.base_program(program)
    }

    fn main(&self, e: &mut Emitter, program: &Node) -> Result<()> {
        for comment in program.texts("mainComments") {
            e.comment(&comment);
        }
        let writes = e.state::<Writing>().writes;
        e.open_block(if writes {
            "pub fn main(init: std.process.Init) void"
        } else {
            "pub fn main() void"
        });
        if writes {
            for line in WRITER_SETUP {
                e.line(line);
            }
            e.line("");
        }
        e.body(field(program, "main")?)?;
        e.close_block();
        Ok(())
    }

    fn prelude(&self, e: &mut Emitter, program: &Node) -> Vec<String> {
        let mut lines: Vec<String> = if e.state::<Writing>().writes {
            vec![
                "const std = @import(\"std\");".to_owned(),
                String::new(),
                "var out: *std.Io.Writer = undefined;".to_owned(),
            ]
        } else {
            Vec::new()
        };
        lines.extend(program.texts("libraryImports"));
        if !lines.is_empty() {
            lines.push(String::new());
        }
        lines
    }
}
