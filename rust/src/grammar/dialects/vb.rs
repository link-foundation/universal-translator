//! Visual Basic .NET: a module whose functions and subs end with End
//! Function and End Sub, and whose Sub Main is the entry point.

use super::shared::default_value;
use super::{EmitterDialect, ParserDialect};
use crate::grammar::arrays::offset;
use crate::grammar::emitter::{Emitter, Result, field};
use crate::grammar::lexer::TokenType;
use crate::grammar::meta::{Node, add, block, number};
use crate::grammar::parser::{Parsed, Parser};

pub(crate) struct VisualBasic;

/// Words before a procedure that do not change what it means.
const MODIFIERS: [&str; 4] = ["private", "public", "shared", "friend"];

/// The operators Visual Basic binds at different levels: * and / above \,
/// and \ above Mod.
fn multiplicative(operator: Option<&str>) -> bool {
    matches!(operator, Some("multiply" | "divide" | "remainder"))
}

// ---- reading ----

impl ParserDialect for VisualBasic {
    /// Imports, then a module of procedures; Sub Main is the entry point.
    fn program(&self, p: &mut Parser) -> Parsed {
        let mut items = Vec::new();
        p.gather_comments(&mut items);
        while p.is("imports") || p.is("option") {
            p.skip_line();
            p.gather_comments(&mut items);
        }
        p.expect("module")?;
        p.skip_line();
        p.gather_comments(&mut items);
        while !p.is("end") {
            items.push(procedure(p)?);
            p.gather_comments(&mut items);
        }
        p.expect("end")?;
        p.expect("module")?;
        p.gather_comments(&mut items);
        Ok(Node::new("SourceProgram")
            .with("language", p.syntax.id)
            .with("items", items))
    }

    /// Statements: Dim, If, While, For, Return, assignments and calls.
    fn statement(&self, p: &mut Parser) -> Parsed {
        if p.accept("dim") {
            return dim(p);
        }
        if p.accept("if") {
            return vb_if(p);
        }
        if p.accept("while") {
            let condition = p.expression()?;
            return Ok(Node::new("While")
                .with("condition", condition)
                .with("body", until(p, "while")?));
        }
        if p.accept("for") {
            return vb_for(p);
        }
        if p.accept("return") {
            let value = if matches!(p.kind(0), TokenType::Newline | TokenType::End) {
                None
            } else {
                Some(p.expression()?)
            };
            return Ok(Node::new("Return").with_opt("value", value));
        }
        if let Some(close) = p.is_element_assignment() {
            return p.element_assignment(close);
        }
        if p.kind(0) == TokenType::Name
            && let Some(assignment) = assignment(p)?
        {
            return Ok(assignment);
        }
        let expression = Parser::called(p.expression()?);
        Ok(Node::new("Evaluate").with("expression", expression))
    }
}

/// name = value, name += value, and name \= value for integer division.
fn assignment(p: &mut Parser) -> Parsed<Option<Node>> {
    if p.is_at("\\", 1) && p.is_at("=", 2) {
        let name = p.next()?.value;
        p.position += 2;
        let right = p.expression()?;
        return Ok(Some(
            Node::new("Assignment")
                .with("name", name.clone())
                .with("operator", "=")
                .with(
                    "value",
                    Node::new("Binary")
                        .with("operator", "divide")
                        .with("left", Node::new("Name").with("name", name))
                        .with("right", right),
                ),
        ));
    }
    let Some(operator) = ["=", "+=", "-=", "*="]
        .into_iter()
        .find(|symbol| p.is_at(symbol, 1))
    else {
        return Ok(None);
    };
    let name = p.next()?.value;
    p.position += 1;
    Ok(Some(
        Node::new("Assignment")
            .with("name", name)
            .with("operator", operator)
            .with("value", p.expression()?),
    ))
}

/// Dim name As Type = value: the type is kept when the value is missing.
///
/// Dim name(last) As Long is an array of zeros up to the index last, and
/// Dim name As Long() = {...} an array of the values.
fn dim(p: &mut Parser) -> Parsed {
    let name = p.expect_name()?;
    if p.accept("(") {
        let last = p.expression()?;
        p.expect(")")?;
        p.expect("as")?;
        p.expect_name()?;
        return Ok(Node::new("Declaration")
            .with("name", name)
            .with("type", "array")
            .with(
                "value",
                Node::new("NewArray")
                    .with("length", offset(last, 1))
                    .with("fill", number(0.0)),
            )
            .with("mutable", true));
    }
    let mut kind = Some("integer");
    if p.accept("as") {
        let spelled = p.expect_name()?;
        kind = p.type_of(&spelled);
        if p.accept("(") {
            p.expect(")")?;
            kind = None;
        }
    }
    let value = if p.accept("=") {
        Some(p.expression()?)
    } else {
        kind.map(default_value)
    };
    Ok(Node::new("Declaration")
        .with("name", name)
        .with_opt("value", value)
        .with("mutable", true))
}

/// For I As Long = First To Last ... Next: the meta loop stops before its
/// end.
fn vb_for(p: &mut Parser) -> Parsed {
    let variable = p.expect_name()?;
    if p.accept("as") {
        p.expect_name()?;
    }
    p.expect("=")?;
    let start = p.expression()?;
    p.expect("to")?;
    let last = p.expression()?;
    let body = block(p.statements_until(&|p| p.is("next"))?);
    p.expect("next")?;
    if p.kind(0) == TokenType::Name {
        p.position += 1;
    }
    Ok(Node::new("CountingLoop")
        .with("variable", variable)
        .with("start", start)
        .with("end", add(last, number(1.0)))
        .with("body", body))
}

/// The statements of a block up to End While, End If, End Sub, ...
fn until(p: &mut Parser, word: &str) -> Parsed {
    let statements = p.statements_until(&|p| p.is("end"))?;
    p.expect("end")?;
    p.expect(word)?;
    Ok(block(statements))
}

/// If ... Then ... ElseIf ... Then ... Else ... End If
fn vb_if(p: &mut Parser) -> Parsed {
    let condition = p.expression()?;
    p.expect("then")?;
    let then = block(p.statements_until(&|p| p.is("elseif") || p.is("else") || p.is("end"))?);
    let found = Node::new("If")
        .with("condition", condition)
        .with("then", then);
    if p.accept("elseif") {
        return Ok(found.with("otherwise", vb_if(p)?));
    }
    if p.accept("else") {
        return Ok(found.with("otherwise", until(p, "if")?));
    }
    p.expect("end")?;
    p.expect("if")?;
    Ok(found)
}

/// Function Name(a As Long, b As Long) As Long ... End Function, or
/// Sub Name(...) ... End Sub.
fn procedure(p: &mut Parser) -> Parsed {
    while MODIFIERS.iter().any(|word| p.is(word)) {
        p.position += 1;
    }
    let kind = p.next()?.value.to_ascii_lowercase();
    let name = p.expect_name()?;
    let mut parameters = Vec::new();
    p.expect("(")?;
    while !p.accept(")") {
        p.accept("byval");
        let parameter = p.expect_name()?;
        p.expect("as")?;
        let spelled = p.expect_name()?;
        parameters.push(
            Node::new("Parameter")
                .with("name", parameter)
                .with_opt("type", p.type_of(&spelled)),
        );
        p.accept(",");
    }
    let return_type = if kind == "function" && p.accept("as") {
        let spelled = p.expect_name()?;
        p.type_of(&spelled)
    } else {
        Some("nothing")
    };
    Ok(Node::new("Function")
        .with("name", name)
        .with("parameters", parameters)
        .with_opt("returnType", return_type)
        .with("body", until(p, &kind)?))
}

// ---- writing ----

impl EmitterDialect for VisualBasic {
    fn terminator(&self, _: &Emitter) -> &'static str {
        ""
    }

    /// Text has no escapes: a quote is doubled and a line end is joined in.
    fn quote(&self, _: &Emitter, value: &str) -> String {
        value
            .split('\n')
            .map(|line| format!("\"{}\"", line.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" & vbLf & ")
    }

    fn interpolation(&self, e: &mut Emitter, parts: &[Node]) -> Result<String> {
        let mut pieces = String::new();
        for part in parts {
            if part.is("Text") {
                let value = part.str("value").unwrap_or_default();
                pieces.push_str(
                    &value
                        .replace('"', "\"\"")
                        .replace('{', "{{")
                        .replace('}', "}}"),
                );
            } else {
                pieces.push_str(&format!("{{{}}}", e.expression(part)?));
            }
        }
        Ok(format!("$\"{pieces}\""))
    }

    /// A multiplicative operand with another operator keeps its parentheses.
    fn binary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        let operator = expression.str("operator");
        if !multiplicative(operator) {
            return e.base_binary(expression, parent);
        }
        let grouped = |side: &Node| {
            if side.is("Binary")
                && multiplicative(side.str("operator"))
                && side.str("operator") != operator
            {
                Node::new("Grouped").with("expression", side.clone())
            } else {
                side.clone()
            }
        };
        let mut regrouped = expression.clone();
        regrouped.set("left", grouped(field(expression, "left")?));
        regrouped.set("right", grouped(field(expression, "right")?));
        e.base_binary(&regrouped, parent)
    }

    fn expression_in(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        if expression.is("Grouped") {
            return Ok(format!(
                "({})",
                e.expression(field(expression, "expression")?)?
            ));
        }
        e.base_expression_in(expression, parent)
    }

    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let newline = statement.flag("newline") == Some(true);
        let procedure = if newline {
            "Console.WriteLine"
        } else {
            "Console.Write"
        };
        let empty = value.is("Text") && value.str("value") == Some("") && newline;
        let written = if empty {
            String::new()
        } else {
            e.expression(value)?
        };
        Ok(format!("{procedure}({written})"))
    }

    fn return_statement(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        Ok(match statement.node("value") {
            Some(value) => format!("Return {}", e.expression(value)?),
            None => "Return".to_owned(),
        })
    }

    fn declaration(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let name = statement.str("name").unwrap_or_default();
        let kind = statement.str("type").unwrap_or("integer");
        let initial = match statement.node("value") {
            Some(value) => e.expression(value)?,
            None => e.expression(&default_value(kind))?,
        };
        let written = e.type_name(kind);
        Ok(format!("Dim {name} As {written} = {initial}"))
    }

    fn if_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("If {condition} Then"));
        let mut current = statement;
        indented(e, field(current, "then")?)?;
        while let Some(chained) = current.node("otherwise").filter(|node| node.is("If")) {
            current = chained;
            let condition = e.expression(field(current, "condition")?)?;
            e.line(&format!("ElseIf {condition} Then"));
            indented(e, field(current, "then")?)?;
        }
        if let Some(otherwise) = current.node("otherwise") {
            e.line("Else");
            indented(e, otherwise)?;
        }
        e.line("End If");
        Ok(())
    }

    fn while_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("While {condition}"));
        indented(e, field(statement, "body")?)?;
        e.line("End While");
        Ok(())
    }

    fn counting_loop(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let variable = statement.str("variable").unwrap_or_default();
        let end = field(statement, "end")?.clone();
        let last = e.expression(&add(end, number(-1.0)))?;
        let kind = e.type_name("integer");
        let start = e.expression(field(statement, "start")?)?;
        e.line(&format!("For {variable} As {kind} = {start} To {last}"));
        indented(e, field(statement, "body")?)?;
        e.line("Next");
        Ok(())
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for text in item.texts("comments") {
            e.comment(&text);
        }
        let parameters = item
            .nodes("parameters")
            .iter()
            .map(|parameter| {
                let kind = e.type_name(parameter.str("type").unwrap_or_default());
                format!("{} As {kind}", parameter.str("name").unwrap_or_default())
            })
            .collect::<Vec<_>>()
            .join(", ");
        let returns = item.str("returnType").unwrap_or_default();
        let kind = if returns == "nothing" {
            "Sub"
        } else {
            "Function"
        };
        let returns = if kind == "Sub" {
            String::new()
        } else {
            format!(" As {}", e.type_name(returns))
        };
        let name = item.str("name").unwrap_or_default();
        e.line(&format!("{kind} {name}({parameters}){returns}"));
        indented(e, field(item, "body")?)?;
        e.line(&format!("End {kind}"));
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
        e.line("Module Program");
        e.depth = 1;
        for item in program.nodes("functions") {
            e.function_definition(item)?;
            e.line("");
        }
        for text in program.texts("mainComments") {
            e.comment(&text);
        }
        e.line("Sub Main()");
        indented(e, field(program, "main")?)?;
        e.line("End Sub");
        e.depth = 0;
        e.line("End Module");
        Ok(format!("{}\n", e.lines.join("\n")))
    }
}

fn indented(e: &mut Emitter, body: &Node) -> Result<()> {
    e.depth += 1;
    e.body(body)?;
    e.depth -= 1;
    Ok(())
}
