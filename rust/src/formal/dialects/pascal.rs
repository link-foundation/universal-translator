//! Pascal (Free Pascal): a program heading, procedures and functions with
//! their own var sections, and a main block between begin and end.

use super::shared::declared_variables;
use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Result, field};
use crate::formal::lexer::TokenType;
use crate::formal::parser::{Parsed, Parser};
use crate::meta::{Node, add, block, number};

pub(crate) struct Pascal;

/// Pascal binds "and" like "*" and "or" like "+", above the comparisons, so
/// a comparison inside a logical operation keeps its parentheses.
fn level(operator: &str) -> f64 {
    match operator {
        "equal" | "notEqual" | "less" | "lessOrEqual" | "greater" | "greaterOrEqual" => 1.0,
        "or" | "add" | "subtract" => 2.0,
        "and" | "multiply" | "divide" | "remainder" => 3.0,
        _ => f64::NAN,
    }
}

fn spelling(operator: &str) -> &str {
    match operator {
        "equal" => "=",
        "notEqual" => "<>",
        "less" => "<",
        "lessOrEqual" => "<=",
        "greater" => ">",
        "greaterOrEqual" => ">=",
        "add" => "+",
        "subtract" => "-",
        "multiply" => "*",
        "divide" => "div",
        "remainder" => "mod",
        other => other,
    }
}

// ---- reading ----

impl ParserDialect for Pascal {
    fn program(&self, p: &mut Parser) -> Parsed {
        let mut items = Vec::new();
        p.gather_comments(&mut items);
        p.expect("program")?;
        p.skip_line();
        p.skip_lines();
        while p.kind(0) != TokenType::End {
            p.gather_comments(&mut items);
            p.skip_lines();
            if p.accept("uses") {
                let unit = p.expect_name()?;
                items.push(Node::new("Import").with("text", format!("uses {unit}")));
            } else if p.is("function") || p.is("procedure") {
                if let Some(routine) = routine(p)? {
                    items.push(routine);
                }
            } else if p.is("var") {
                skip_variables(p);
            } else if p.accept("begin") {
                items.extend(p.statements_until(&|p| p.is("end"))?);
                p.expect("end")?;
                p.expect(".")?;
                break;
            } else if p.kind(0) != TokenType::End {
                p.statement()?;
            }
        }
        Ok(Node::new("SourceProgram")
            .with("language", p.syntax.id)
            .with("items", items))
    }

    /// Statements: if, while, for, Exit, assignments and procedure calls.
    fn statement(&self, p: &mut Parser) -> Parsed {
        if p.accept("if") {
            return pascal_if(p);
        }
        if p.accept("while") {
            let condition = p.expression()?;
            p.expect("do")?;
            return Ok(Node::new("While")
                .with("condition", condition)
                .with("body", branch(p)?));
        }
        if p.accept("for") {
            return pascal_for(p);
        }
        if p.accept("exit") {
            let mut value = None;
            if p.accept("(") {
                if !p.is(")") {
                    value = Some(p.expression()?);
                }
                p.expect(")")?;
            }
            return Ok(Node::new("Return").with_opt("value", value));
        }
        if let Some(close) = p.is_element_assignment() {
            return p.element_assignment(close);
        }
        if p.kind(0) == TokenType::Name && p.is_at(":=", 1) {
            let name = p.next()?.value;
            p.position += 1;
            return Ok(Node::new("Assignment")
                .with("name", name)
                .with("operator", "=")
                .with("value", p.expression()?));
        }
        let expression = Parser::called(p.expression()?);
        Ok(Node::new("Evaluate").with("expression", expression))
    }
}

/// for I := First to Last do: the meta loop stops before its end.
fn pascal_for(p: &mut Parser) -> Parsed {
    let variable = p.expect_name()?;
    p.expect(":=")?;
    let start = p.expression()?;
    p.expect("to")?;
    let last = p.expression()?;
    p.expect("do")?;
    let body = branch(p)?;
    Ok(Node::new("CountingLoop")
        .with("variable", variable)
        .with("start", start)
        .with("end", add(last, number(1.0)))
        .with("body", body))
}

fn pascal_if(p: &mut Parser) -> Parsed {
    let condition = p.expression()?;
    p.expect("then")?;
    let then = branch(p)?;
    let mut offset = 0;
    while p.kind(offset) == TokenType::Newline {
        offset += 1;
    }
    let found = Node::new("If")
        .with("condition", condition)
        .with("then", then);
    if !p.is_at("else", offset) {
        return Ok(found);
    }
    p.position += offset + 1;
    let otherwise = if p.accept("if") {
        pascal_if(p)?
    } else {
        branch(p)?
    };
    Ok(found.with("otherwise", otherwise))
}

/// A compound statement between begin and end, or a single statement.
fn branch(p: &mut Parser) -> Parsed {
    p.skip_lines();
    if !p.accept("begin") {
        return Ok(block(vec![p.statement()?]));
    }
    let statements = p.statements_until(&|p| p.is("end"))?;
    p.expect("end")?;
    Ok(block(statements))
}

/// Variables are declared again by their first assignment.
fn skip_variables(p: &mut Parser) {
    p.position += 1;
    while !["begin", "function", "procedure", "var"]
        .iter()
        .any(|word| p.is(word))
        && p.kind(0) != TokenType::End
    {
        p.position += 1;
    }
}

/// function Name(A, B: Int64; C: String): Int64; ... begin ... end;
/// A heading followed by `forward;` only announces a later definition.
fn routine(p: &mut Parser) -> Parsed<Option<Node>> {
    let is_function = p.next()?.value.eq_ignore_ascii_case("function");
    let name = p.expect_name()?;
    let mut parameters = Vec::new();
    if p.accept("(") {
        while !p.is(")") {
            let mut names = vec![p.expect_name()?];
            while p.accept(",") {
                names.push(p.expect_name()?);
            }
            p.expect(":")?;
            let spelled = p.expect_name()?;
            let kind = p.type_of(&spelled);
            for parameter in names {
                parameters.push(
                    Node::new("Parameter")
                        .with("name", parameter)
                        .with_opt("type", kind),
                );
            }
            if !p.accept(";") {
                break;
            }
        }
        p.expect(")")?;
    }
    let return_type = if is_function {
        p.expect(":")?;
        let spelled = p.expect_name()?;
        p.type_of(&spelled)
    } else {
        Some("nothing")
    };
    p.expect(";")?;
    p.skip_lines();
    if p.accept("forward") {
        return Ok(None);
    }
    while p.is("var") {
        skip_variables(p);
    }
    p.expect("begin")?;
    let body = p.statements_until(&|p| p.is("end"))?;
    p.expect("end")?;
    Ok(Some(
        Node::new("Function")
            .with("name", name)
            .with("parameters", parameters)
            .with_opt("returnType", return_type)
            .with("body", block(body)),
    ))
}

// ---- writing ----

impl EmitterDialect for Pascal {
    fn terminator(&self, _: &Emitter) -> &'static str {
        ";"
    }

    fn quote(&self, _: &Emitter, value: &str) -> String {
        format!("'{}'", value.replace('\'', "''"))
    }

    /// Operands of "or" are parenthesized like in the other languages, so
    /// `(A and B) or C` reads the same everywhere.
    fn binary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        let operator = expression.str("operator").unwrap_or_default();
        let level = level(operator);
        let inner = if operator == "or" {
            self::level("and") + 1.0
        } else {
            level
        };
        let left = e.expression_in(field(expression, "left")?, inner)?;
        let right = e.expression_in(field(expression, "right")?, inner.max(level + 1.0))?;
        let result = format!("{left} {} {right}", spelling(operator));
        Ok(if level < parent {
            format!("({result})")
        } else {
            result
        })
    }

    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let parts = if value.is("Interpolation") {
            value.node_list("parts")
        } else {
            vec![value.clone()]
        };
        let written = parts
            .iter()
            .map(|part| e.expression(part))
            .collect::<Result<Vec<_>>>()?
            .join(", ");
        let call = if statement.flag("newline") == Some(true) {
            "WriteLn"
        } else {
            "Write"
        };
        Ok(format!("{call}({written});"))
    }

    fn return_statement(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        Ok(match statement.node("value") {
            Some(value) => format!("Exit({});", e.expression(value)?),
            None => "Exit;".to_owned(),
        })
    }

    fn declaration(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let name = statement.str("name").unwrap_or_default();
        let value = match statement.node("value") {
            Some(value) => e.expression(value)?,
            None => e.expression(&number(0.0))?,
        };
        Ok(format!("{name} := {value};"))
    }

    fn if_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("if {condition} then"));
        let mut current = statement;
        while let Some(chained) = current.node("otherwise").filter(|node| node.is("If")) {
            compound(e, field(current, "then")?, "")?;
            current = chained;
            let condition = e.expression(field(current, "condition")?)?;
            e.line(&format!("else if {condition} then"));
        }
        if let Some(otherwise) = current.node("otherwise") {
            compound(e, field(current, "then")?, "")?;
            e.line("else");
            compound(e, otherwise, ";")
        } else {
            compound(e, field(current, "then")?, ";")
        }
    }

    fn while_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("while {condition} do"));
        compound(e, field(statement, "body")?, ";")
    }

    fn counting_loop(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let variable = statement.str("variable").unwrap_or_default();
        let end = field(statement, "end")?.clone();
        let last = e.expression(&add(end, number(-1.0)))?;
        let start = e.expression(field(statement, "start")?)?;
        e.line(&format!("for {variable} := {start} to {last} do"));
        compound(e, field(statement, "body")?, ";")
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for text in item.texts("comments") {
            e.comment(&text);
        }
        let heading = heading(e, item);
        e.line(&heading);
        variables(e, field(item, "body")?);
        compound(e, field(item, "body")?, ";")
    }

    fn forward_declaration(&self, e: &mut Emitter, item: &Node) -> String {
        format!("{} forward;", heading(e, item))
    }

    fn main(&self, e: &mut Emitter, program: &Node) -> Result<()> {
        variables(e, field(program, "main")?);
        if e.lines.last().is_some_and(|line| !line.is_empty()) {
            e.line("");
        }
        e.line("begin");
        e.depth += 1;
        for text in program.texts("mainComments") {
            e.comment(&text);
        }
        e.body(field(program, "main")?)?;
        e.depth -= 1;
        e.line("end.");
        Ok(())
    }
}

/// begin ... end, with the text that follows end (";", "." or nothing).
fn compound(e: &mut Emitter, statements: &Node, after: &str) -> Result<()> {
    e.line("begin");
    e.depth += 1;
    e.body(statements)?;
    e.depth -= 1;
    e.line(&format!("end{after}"));
    Ok(())
}

/// var
///     Name: Int64;
fn variables(e: &mut Emitter, body: &Node) {
    let variables = declared_variables(body, true);
    if variables.is_empty() {
        return;
    }
    e.line("var");
    e.depth += 1;
    for (variable, kind) in variables {
        let written = e.type_name(&kind);
        e.line(&format!("{variable}: {written};"));
    }
    e.depth -= 1;
}

fn heading(e: &mut Emitter, item: &Node) -> String {
    let name = item.str("name").unwrap_or_default();
    let parameters = item
        .nodes("parameters")
        .iter()
        .map(|parameter| {
            let kind = e.type_name(parameter.str("type").unwrap_or_default());
            format!("{}: {kind}", parameter.str("name").unwrap_or_default())
        })
        .collect::<Vec<_>>()
        .join("; ");
    let list = if parameters.is_empty() {
        String::new()
    } else {
        format!("({parameters})")
    };
    match item.str("returnType").unwrap_or_default() {
        "nothing" => format!("procedure {name}{list};"),
        returns => format!("function {name}{list}: {};", e.type_name(returns)),
    }
}
