//! Fortran (free form, Fortran 2018): a main program whose variables are
//! declared before its statements, and procedures after `contains`.

use std::collections::HashMap;

use super::shared::declared_variables;
use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Result, field, spaced_after};
use crate::formal::lexer::TokenType;
use crate::formal::parser::{Parsed, Parser};
use crate::meta::{Node, add, block, format_number, number};

pub(crate) struct Fortran;

/// The meta type of a declaration's first word.
fn type_word(word: &str) -> Option<&'static str> {
    match word.to_ascii_lowercase().as_str() {
        "integer" => Some("integer"),
        "logical" => Some("boolean"),
        "character" => Some("text"),
        _ => None,
    }
}

const FORMAT: &str = "'(*(g0))'";

/// The result variable of the function being read or written.
#[derive(Default)]
struct Result_ {
    name: Option<String>,
}

// ---- reading ----

impl ParserDialect for Fortran {
    fn program(&self, p: &mut Parser) -> Parsed {
        let mut items = Vec::new();
        p.gather_comments(&mut items);
        p.expect("program")?;
        p.skip_line();
        specification(p, &mut items)?;
        items.extend(p.statements_until(&|p| p.is("contains") || p.is("end"))?);
        if p.accept("contains") {
            p.gather_comments(&mut items);
            while !p.is("end") {
                items.push(procedure(p)?);
                p.gather_comments(&mut items);
            }
        }
        p.expect("end")?;
        p.skip_line();
        p.skip_lines();
        Ok(Node::new("SourceProgram")
            .with("language", p.syntax.id)
            .with("items", items))
    }

    /// Statements: if, do while, counted do, print, write, call and
    /// assignments.
    fn statement(&self, p: &mut Parser) -> Parsed {
        if p.accept("if") {
            return fortran_if(p);
        }
        if p.accept("do") {
            return fortran_do(p);
        }
        if p.accept("print") {
            p.position += 1;
            return output(p, "print");
        }
        if p.accept("write") {
            p.expect("(")?;
            while !p.accept(")") {
                p.next()?;
            }
            return output(p, "write");
        }
        if p.accept("call") {
            let expression = Parser::called(p.expression()?);
            return Ok(Node::new("Evaluate").with("expression", expression));
        }
        if p.accept("return") {
            return Ok(Node::new("Return"));
        }
        if let Some(close) = p.is_element_assignment() {
            return p.element_assignment(close);
        }
        let name = p.expect_name()?;
        p.expect("=")?;
        let value = p.expression()?;
        // A function returns by setting its result variable and leaving.
        let result = p.state::<Result_>().name.clone();
        if result.is_some_and(|result| result.eq_ignore_ascii_case(&name)) {
            p.skip_lines();
            p.accept("return");
            return Ok(Node::new("Return").with("value", value));
        }
        Ok(Node::new("Assignment")
            .with("name", name)
            .with("operator", "=")
            .with("value", value))
    }

    /// mod(a, b) is the remainder, and logical constants are dotted words.
    fn primary(&self, p: &mut Parser) -> Parsed {
        let token = p.current().clone();
        let lower = token.value.to_ascii_lowercase();
        if token.kind == TokenType::Symbol && (lower == ".true." || lower == ".false.") {
            p.position += 1;
            return Ok(Node::new("Boolean").with("value", lower == ".true."));
        }
        if p.is("mod") && p.is_at("(", 1) {
            p.position += 2;
            let left = p.expression()?;
            p.expect(",")?;
            let right = p.expression()?;
            p.expect(")")?;
            return Ok(Node::new("Binary")
                .with("operator", "remainder")
                .with("left", left)
                .with("right", right));
        }
        p.base_primary()
    }
}

/// print '(*(g0))', a, b and write (...) a, b print their items one after
/// another.
fn output(p: &mut Parser, callee: &str) -> Parsed {
    let mut values = Vec::new();
    if callee == "write" && p.kind(0) != TokenType::Newline {
        values.push(p.expression()?);
    }
    while p.accept(",") {
        values.push(p.expression()?);
    }
    Ok(Node::new("Evaluate").with(
        "expression",
        Node::new("Call")
            .with("callee", callee)
            .with("arguments", values),
    ))
}

/// do while (condition) or do i = first, last: the meta loop stops before
/// its end.
fn fortran_do(p: &mut Parser) -> Parsed {
    if p.accept("while") {
        let condition = p.expression()?;
        return Ok(Node::new("While")
            .with("condition", condition)
            .with("body", until(p, "do")?));
    }
    let variable = p.expect_name()?;
    p.expect("=")?;
    let start = p.expression()?;
    p.expect(",")?;
    let last = p.expression()?;
    let body = until(p, "do")?;
    Ok(Node::new("CountingLoop")
        .with("variable", variable)
        .with("start", start)
        .with("end", add(last, number(1.0)))
        .with("body", body))
}

/// The statements of a block up to `end do` or `end if`.
fn until(p: &mut Parser, word: &str) -> Parsed {
    let statements = p.statements_until(&|p| p.is("end"))?;
    p.expect("end")?;
    p.expect(word)?;
    Ok(block(statements))
}

/// if (...) then ... else if (...) then ... else ... end if: the chain
/// shares a single `end if`.
fn fortran_if(p: &mut Parser) -> Parsed {
    let condition = p.expression()?;
    p.expect("then")?;
    let then = block(p.statements_until(&|p| p.is("else") || p.is("end"))?);
    let found = Node::new("If")
        .with("condition", condition)
        .with("then", then);
    if !p.accept("else") {
        p.expect("end")?;
        p.expect("if")?;
        return Ok(found);
    }
    if p.accept("if") {
        return Ok(found.with("otherwise", fortran_if(p)?));
    }
    Ok(found.with("otherwise", until(p, "if")?))
}

/// use, implicit none and declarations, which the first assignments declare
/// again; the types of dummy arguments are returned.
fn specification(p: &mut Parser, items: &mut Vec<Node>) -> Parsed<HashMap<String, &'static str>> {
    let mut types = HashMap::new();
    loop {
        p.skip_lines();
        if p.accept("use") {
            let module = p.expect_name()?;
            items.push(Node::new("Import").with("text", format!("use {module}")));
        } else if p.is("implicit") {
            p.skip_line();
        } else if line_has(p, "::") {
            let kind = type_word(&p.next()?.value);
            while !p.accept("::") {
                p.position += 1;
            }
            loop {
                let name = p.expect_name()?.to_ascii_lowercase();
                if let Some(kind) = kind {
                    types.insert(name, kind);
                }
                if !p.accept(",") {
                    break;
                }
            }
        } else {
            return Ok(types);
        }
    }
}

fn line_has(p: &Parser, symbol: &str) -> bool {
    let mut offset = 0;
    while p.kind(offset) != TokenType::Newline {
        if p.kind(offset) == TokenType::End {
            return false;
        }
        if p.is_at(symbol, offset) {
            return true;
        }
        offset += 1;
    }
    false
}

/// recursive integer(8) function name(a, b) result(name_result) or
/// recursive subroutine name(a, b), up to end function or end subroutine.
fn procedure(p: &mut Parser) -> Parsed {
    let mut return_type = "nothing";
    while !p.is("function") && !p.is("subroutine") {
        let word = p.next()?.value;
        return_type = type_word(&word).unwrap_or(return_type);
    }
    let kind = p.next()?.value.to_ascii_lowercase();
    let name = p.expect_name()?;
    let mut names = Vec::new();
    if p.accept("(") {
        while !p.accept(")") {
            names.push(p.expect_name()?);
            p.accept(",");
        }
    }
    let mut result = name.clone();
    if p.accept("result") {
        p.expect("(")?;
        result = p.expect_name()?;
        p.expect(")")?;
    }
    p.state::<Result_>().name = Some(result);
    let types = specification(p, &mut Vec::new())?;
    let body = p.statements_until(&|p| p.is("end"))?;
    p.expect("end")?;
    p.expect(&kind)?;
    p.skip_line();
    p.state::<Result_>().name = None;
    let parameters: Vec<Node> = names
        .into_iter()
        .map(|parameter| {
            let kind = types
                .get(&parameter.to_ascii_lowercase())
                .copied()
                .unwrap_or("integer");
            Node::new("Parameter")
                .with("name", parameter)
                .with("type", kind)
        })
        .collect();
    let returns = types
        .get(&name.to_ascii_lowercase())
        .copied()
        .unwrap_or(return_type);
    Ok(Node::new("Function")
        .with("name", name)
        .with("parameters", parameters)
        .with("returnType", returns)
        .with("body", block(body)))
}

// ---- writing ----

/// Declared types: deferred-length text is allocated by its assignment.
fn declared_type(kind: &str) -> &'static str {
    match kind {
        "boolean" => "logical",
        "text" => "character(len=:), allocatable",
        // An array is allocated by its first assignment.
        "array" => "integer(8), allocatable, dimension(:)",
        _ => "integer(8)",
    }
}

impl EmitterDialect for Fortran {
    fn terminator(&self, _: &Emitter) -> &'static str {
        ""
    }

    fn quote(&self, _: &Emitter, value: &str) -> String {
        format!("'{}'", value.replace('\'', "''"))
    }

    fn unary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        if expression.str("operator") != Some("not") {
            return e.base_unary(expression, parent);
        }
        let operand = e.expression_in(field(expression, "operand")?, 7.0)?;
        let result = format!(".not. {operand}");
        Ok(if parent > 7.0 {
            format!("({result})")
        } else {
            result
        })
    }

    fn binary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        if expression.str("operator") != Some("remainder") {
            return e.base_binary(expression, parent);
        }
        let left = argument(e, field(expression, "left")?)?;
        let right = argument(e, field(expression, "right")?)?;
        Ok(format!("mod({left}, {right})"))
    }

    fn expression_in(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        if !expression.is("Call") {
            return e.base_expression_in(expression, parent);
        }
        let values = expression
            .nodes("arguments")
            .into_iter()
            .map(|value| argument(e, value))
            .collect::<Result<Vec<_>>>()?;
        Ok(format!(
            "{}({})",
            expression.str("callee").unwrap_or_default(),
            values.join(", ")
        ))
    }

    /// print and write print their items one after another.
    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let parts = if value.is("Interpolation") {
            value.node_list("parts")
        } else {
            vec![value.clone()]
        };
        let items = parts
            .iter()
            .map(|part| e.expression(part))
            .collect::<Result<Vec<_>>>()?
            .join(", ");
        Ok(if statement.flag("newline") == Some(true) {
            format!("print {FORMAT}, {items}")
        } else {
            format!("write (*, {FORMAT}, advance='no') {items}")
        })
    }

    fn statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        if statement.is("Evaluate") {
            let call = e.expression(field(statement, "expression")?)?;
            e.line(&format!("call {call}"));
            return Ok(());
        }
        e.base_statement(statement)
    }

    /// A function returns by setting its result variable.
    fn return_statement(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        if let Some(value) = statement.node("value") {
            let value = e.expression(value)?;
            let result = e.state::<Result_>().name.clone().unwrap_or_default();
            e.line(&format!("{result} = {value}"));
        }
        Ok("return".to_owned())
    }

    fn declaration(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let name = statement.str("name").unwrap_or_default();
        let value = match statement.node("value") {
            Some(value) => e.expression(value)?,
            None => e.expression(&number(0.0))?,
        };
        Ok(format!("{name} = {value}"))
    }

    fn if_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("if ({condition}) then"));
        let mut current = statement;
        indented(e, field(current, "then")?)?;
        while let Some(chained) = current.node("otherwise").filter(|node| node.is("If")) {
            current = chained;
            let condition = e.expression(field(current, "condition")?)?;
            e.line(&format!("else if ({condition}) then"));
            indented(e, field(current, "then")?)?;
        }
        if let Some(otherwise) = current.node("otherwise") {
            e.line("else");
            indented(e, otherwise)?;
        }
        e.line("end if");
        Ok(())
    }

    fn while_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("do while ({condition})"));
        indented(e, field(statement, "body")?)?;
        e.line("end do");
        Ok(())
    }

    fn counting_loop(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let variable = statement.str("variable").unwrap_or_default();
        let end = field(statement, "end")?.clone();
        let last = e.expression(&add(end, number(-1.0)))?;
        let start = e.expression(field(statement, "start")?)?;
        e.line(&format!("do {variable} = {start}, {last}"));
        indented(e, field(statement, "body")?)?;
        e.line("end do");
        Ok(())
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for text in item.texts("comments") {
            e.comment(&text);
        }
        let name = item.str("name").unwrap_or_default();
        let parameters = item.nodes("parameters");
        let names: Vec<String> = parameters
            .iter()
            .map(|parameter| parameter.str("name").unwrap_or_default().to_owned())
            .collect();
        let returns = item.str("returnType").unwrap_or_default();
        let subroutine = returns == "nothing";
        let kind = if subroutine { "subroutine" } else { "function" };
        // Deferred-length text cannot be named before `function`.
        let prefix = if subroutine || returns == "text" {
            String::new()
        } else {
            format!("{} ", declared_type(returns))
        };
        let result_name = format!("{name}_result");
        e.state::<Result_>().name = Some(result_name.clone());
        let result = if subroutine {
            String::new()
        } else {
            format!(" result({result_name})")
        };
        e.line(&format!(
            "recursive {prefix}{kind} {name}({}){result}",
            names.join(", ")
        ));
        e.depth += 1;
        for parameter in &parameters {
            let parameter_name = parameter.str("name").unwrap_or_default();
            let line = if parameter.str("type") == Some("text") {
                format!("character(len=*), intent(in) :: {parameter_name}")
            } else {
                let kind = declared_type(parameter.str("type").unwrap_or_default());
                format!("{kind}, value :: {parameter_name}")
            };
            e.line(&line);
        }
        if returns == "text" {
            e.line(&format!("{} :: {result_name}", declared_type("text")));
        }
        if parameters.len() + variables(e, field(item, "body")?, &names) > 0 {
            e.line("");
        }
        e.body(field(item, "body")?)?;
        e.depth -= 1;
        e.line(&format!("end {kind} {name}"));
        Ok(())
    }

    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        let comments = program.texts("comments");
        for text in &comments {
            e.comment(text);
        }
        if !comments.is_empty() {
            e.line("");
        }
        e.line("program main");
        e.depth += 1;
        for text in program.texts("libraryImports") {
            e.line(&text);
        }
        e.line("implicit none");
        variables(e, field(program, "main")?, &[]);
        e.line("");
        for text in program.texts("mainComments") {
            e.comment(&text);
        }
        e.body(field(program, "main")?)?;
        let functions = program.nodes("functions");
        if !functions.is_empty() {
            e.depth -= 1;
            e.line("");
            e.line("contains");
            e.depth += 1;
            for (index, item) in functions.iter().enumerate() {
                if index == 0 || spaced_after(&functions, index - 1) {
                    e.line("");
                }
                e.function_definition(item)?;
            }
        }
        e.depth -= 1;
        e.line("end program main");
        Ok(format!("{}\n", e.lines.join("\n")))
    }
}

/// Literal arguments are written with the kind of the integer(8) arguments
/// they are passed to.
fn argument(e: &mut Emitter, value: &Node) -> Result<String> {
    match value.number("value") {
        Some(number) if value.is("Number") && number.fract() == 0.0 => {
            Ok(format!("{}_8", format_number(number)))
        }
        _ => e.expression(value),
    }
}

fn indented(e: &mut Emitter, body: &Node) -> Result<()> {
    e.depth += 1;
    e.body(body)?;
    e.depth -= 1;
    Ok(())
}

/// integer(8) :: name, one declaration per variable.
fn variables(e: &mut Emitter, body: &Node, known: &[String]) -> usize {
    let lines: Vec<String> = declared_variables(body, true)
        .into_iter()
        .filter(|(variable, _)| !known.contains(variable))
        .map(|(variable, kind)| format!("{} :: {variable}", declared_type(&kind)))
        .collect();
    for line in &lines {
        e.line(line);
    }
    lines.len()
}
