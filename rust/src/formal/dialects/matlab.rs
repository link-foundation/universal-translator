//! MATLAB and GNU Octave: a script whose functions come first (Octave
//! defines them as the script runs, so `1;` keeps the file a script), and
//! whose output goes through fprintf with a format. A function returns by
//! setting its output variable and leaving with `return`. Numbers are
//! doubles: fix(a / b) divides and rem(a, b) is the remainder.

use std::collections::VecDeque;

use super::shared::each_statement;
use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Result, field, spaced_after};
use crate::formal::lexer::TokenType;
use crate::formal::parser::{Parsed, Parser};
use crate::meta::GrammarError;
use crate::meta::{Node, add, block, number, text};

pub(crate) struct Matlab;

/// The output variable of every function that returns a value.
const RESULT: &str = "result";

/// The output variable of the function being read.
#[derive(Default)]
struct Output {
    name: Option<String>,
}

/// The parts of a format and its values: %d and %s take the next value.
fn format_parts(format: &str, values: Vec<Node>) -> Vec<Node> {
    let mut values = VecDeque::from(values);
    let mut parts = Vec::new();
    let mut literal = String::new();
    let mut chars = format.chars().peekable();
    while let Some(character) = chars.next() {
        match (character, chars.peek().copied()) {
            ('%', Some('%')) => {
                chars.next();
                literal.push('%');
            }
            ('%', Some('d' | 's')) => {
                chars.next();
                if !literal.is_empty() {
                    parts.push(text(std::mem::take(&mut literal)));
                }
                parts.extend(values.pop_front());
            }
            ('\\', Some(escaped)) => {
                chars.next();
                match escaped {
                    'n' => literal.push('\n'),
                    't' => literal.push('\t'),
                    'r' => literal.push('\r'),
                    '\\' => literal.push('\\'),
                    other => {
                        literal.push('\\');
                        literal.push(other);
                    }
                }
            }
            _ => literal.push(character),
        }
    }
    if !literal.is_empty() {
        parts.push(text(literal));
    }
    parts
}

/// Text in one piece is plain text.
fn merged(value: Node) -> Node {
    if !value.is("Interpolation") {
        return value;
    }
    let parts = value.nodes("parts");
    if parts.iter().all(|part| part.is("Text")) {
        let joined: String = parts
            .iter()
            .map(|part| part.str("value").unwrap_or_default())
            .collect();
        return text(joined);
    }
    value
}

// ---- reading ----

impl ParserDialect for Matlab {
    /// `1;`, functions, then the statements of the script; source(...)
    /// loads the common library.
    fn program(&self, p: &mut Parser) -> Parsed {
        let mut items = Vec::new();
        while p.kind(0) != TokenType::End {
            p.gather_comments(&mut items);
            if p.kind(0) == TokenType::End {
                break;
            }
            if p.kind(0) == TokenType::Number && p.is_at(";", 1) {
                p.position += 1;
            } else if p.is("source") && p.is_at("(", 1) {
                let start = p.position;
                p.skip_line();
                let used: Vec<&str> = p.tokens[start..p.position]
                    .iter()
                    .map(|token| token.value.as_str())
                    .collect();
                items.push(Node::new("Import").with("text", used.join(" ")));
            } else if p.accept("function") {
                items.push(p.function_definition()?);
            } else {
                items.push(p.statement()?);
            }
            p.skip_lines_keeping(&mut items);
        }
        Ok(Node::new("SourceProgram")
            .with("language", p.syntax.id)
            .with("items", items))
    }

    /// function output = name(a, b) ... end, or function name(a, b) ... end.
    fn function_definition(&self, p: &mut Parser) -> Parsed {
        let output = if p.is_at("=", 1) {
            Some(p.next()?.value)
        } else {
            None
        };
        if output.is_some() {
            p.expect("=")?;
        }
        p.state::<Output>().name = output;
        let name = p.expect_name()?;
        let mut parameters = Vec::new();
        if p.accept("(") {
            while !p.accept(")") {
                parameters.push(Node::new("Parameter").with("name", p.expect_name()?));
                p.accept(",");
            }
        }
        let body = until_end(p)?;
        p.state::<Output>().name = None;
        Ok(Node::new("Function")
            .with("name", name)
            .with("parameters", parameters)
            .with("body", body))
    }

    /// Statements: if, while, for, fprintf, return, assignments and calls.
    fn statement(&self, p: &mut Parser) -> Parsed {
        if p.accept("if") {
            return matlab_if(p);
        }
        if p.accept("while") {
            let condition = p.expression()?;
            return Ok(Node::new("While")
                .with("condition", condition)
                .with("body", until_end(p)?));
        }
        if p.accept("for") {
            return matlab_for(p);
        }
        if p.accept("return") {
            return Ok(Node::new("Return"));
        }
        if p.is("fprintf") || p.is("disp") {
            return output(p);
        }
        if let Some(close) = p.is_element_assignment() {
            return p.element_assignment(close);
        }
        if p.kind(0) == TokenType::Name && p.is_at("=", 1) {
            let name = p.next()?.value;
            p.position += 1;
            let value = p.expression()?;
            // A function returns by setting its output variable and leaving.
            if p.state::<Output>().name.as_deref() == Some(name.as_str()) {
                p.skip_lines();
                p.accept("return");
                return Ok(Node::new("Return").with("value", value));
            }
            return Ok(Node::new("Assignment")
                .with("name", name)
                .with("operator", "=")
                .with("value", value));
        }
        let expression = Parser::called(p.expression()?);
        Ok(Node::new("Evaluate").with("expression", expression))
    }

    /// rem(a, b) is the remainder and sprintf(format, ...) is text.
    fn primary(&self, p: &mut Parser) -> Parsed {
        if p.is("rem") && p.is_at("(", 1) {
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
        if p.is("sprintf") && p.is_at("(", 1) {
            p.position += 2;
            let (format, values) = formatted(p)?;
            let parts = format_parts(&format, values);
            return Ok(merged(Node::new("Interpolation").with("parts", parts)));
        }
        p.base_primary()
    }
}

/// fprintf('format\n', values) and disp(value).
fn output(p: &mut Parser) -> Parsed {
    let callee = p.next()?.value;
    p.expect("(")?;
    if callee == "disp" {
        let value = p.expression()?;
        p.expect(")")?;
        return Ok(Node::new("Print")
            .with("value", value)
            .with("newline", true));
    }
    let (format, values) = formatted(p)?;
    let newline = format.ends_with("\\n");
    let format = if newline {
        &format[..format.len() - 2]
    } else {
        &format
    };
    let mut parts = format_parts(format, values);
    let value = if parts.len() > 1 || parts.first().is_some_and(|part| part.is("Text")) {
        Node::new("Interpolation").with("parts", parts)
    } else if parts.is_empty() {
        text("")
    } else {
        parts.remove(0)
    };
    Ok(Node::new("Print")
        .with("value", merged(value))
        .with("newline", newline))
}

/// The format (as written) and the values of fprintf or sprintf, after the
/// opening bracket.
fn formatted(p: &mut Parser) -> Parsed<(String, Vec<Node>)> {
    let format = p.next()?;
    if format.kind != TokenType::Text {
        return Err(GrammarError::syntax("A format must be text", format.line));
    }
    let mut values = Vec::new();
    while p.accept(",") {
        values.push(p.expression()?);
    }
    p.expect(")")?;
    Ok((format.value, values))
}

/// for name = first:last ... end: the meta loop stops before its end.
fn matlab_for(p: &mut Parser) -> Parsed {
    let variable = p.expect_name()?;
    p.expect("=")?;
    let start = p.expression()?;
    p.expect(":")?;
    let last = p.expression()?;
    Ok(Node::new("CountingLoop")
        .with("variable", variable)
        .with("start", start)
        .with("end", add(last, number(1.0)))
        .with("body", until_end(p)?))
}

fn until_end(p: &mut Parser) -> Parsed {
    let statements = p.statements_until(&|p| p.is("end"))?;
    p.expect("end")?;
    Ok(block(statements))
}

/// if ... elseif ... else ... end: the chain shares one `end`.
fn matlab_if(p: &mut Parser) -> Parsed {
    let condition = p.expression()?;
    let then = block(p.statements_until(&|p| p.is("elseif") || p.is("else") || p.is("end"))?);
    let found = Node::new("If")
        .with("condition", condition)
        .with("then", then);
    if p.accept("elseif") {
        return Ok(found.with("otherwise", matlab_if(p)?));
    }
    if p.accept("else") {
        return Ok(found.with("otherwise", until_end(p)?));
    }
    p.expect("end")?;
    Ok(found)
}

// ---- writing ----

/// Text in a format: % and \ are doubled, a line end is \n.
fn format_text(value: &str) -> String {
    value
        .replace('\'', "''")
        .replace('%', "%%")
        .replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\t', "\\t")
        .replace('\r', "\\r")
}

/// 'format', values: text is written into the format, values take %s when
/// they are text and %d otherwise.
fn format(e: &mut Emitter, parts: &[Node], ending: &str) -> Result<String> {
    let mut values = Vec::new();
    let mut pieces = String::new();
    for part in parts {
        if part.is("Text") {
            pieces.push_str(&format_text(part.str("value").unwrap_or_default()));
        } else {
            values.push(e.expression(part)?);
            pieces.push_str(if part.str("type") == Some("text") {
                "%s"
            } else {
                "%d"
            });
        }
    }
    let mut all = vec![format!("'{pieces}{ending}'")];
    all.extend(values);
    Ok(all.join(", "))
}

impl EmitterDialect for Matlab {
    /// Single quotes keep backslashes; text with a line end is a format.
    fn quote(&self, _: &Emitter, value: &str) -> String {
        if value.contains(['\n', '\t', '\r']) {
            return format!("sprintf('{}')", format_text(value));
        }
        format!("'{}'", value.replace('\'', "''"))
    }

    fn interpolation(&self, e: &mut Emitter, parts: &[Node]) -> Result<String> {
        Ok(format!("sprintf({})", format(e, parts, "")?))
    }

    fn binary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        if expression.str("operator") != Some("remainder") {
            return e.base_binary(expression, parent);
        }
        let left = e.expression(field(expression, "left")?)?;
        let right = e.expression(field(expression, "right")?)?;
        Ok(format!("rem({left}, {right})"))
    }

    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let parts = if value.is("Interpolation") {
            value.node_list("parts")
        } else {
            vec![value.clone()]
        };
        let ending = if statement.flag("newline") == Some(true) {
            "\\n"
        } else {
            ""
        };
        Ok(format!("fprintf({});", format(e, &parts, ending)?))
    }

    fn return_statement(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        if let Some(value) = statement.node("value") {
            let value = e.expression(value)?;
            e.line(&format!("{RESULT} = {value};"));
        }
        Ok("return;".to_owned())
    }

    fn declaration(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let name = statement.str("name").unwrap_or_default();
        let value = match statement.node("value") {
            Some(value) => e.expression(value)?,
            None => e.expression(&number(0.0))?,
        };
        Ok(format!("{name} = {value};"))
    }

    fn if_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("if {condition}"));
        let mut current = statement;
        indented(e, field(current, "then")?)?;
        while let Some(chained) = current.node("otherwise").filter(|node| node.is("If")) {
            current = chained;
            let condition = e.expression(field(current, "condition")?)?;
            e.line(&format!("elseif {condition}"));
            indented(e, field(current, "then")?)?;
        }
        if let Some(otherwise) = current.node("otherwise") {
            e.line("else");
            indented(e, otherwise)?;
        }
        e.line("end");
        Ok(())
    }

    fn while_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("while {condition}"));
        indented(e, field(statement, "body")?)?;
        e.line("end");
        Ok(())
    }

    fn counting_loop(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let variable = statement.str("variable").unwrap_or_default();
        let end = field(statement, "end")?.clone();
        let last = e.expression(&add(end, number(-1.0)))?;
        let start = e.expression(field(statement, "start")?)?;
        e.line(&format!("for {variable} = {start}:{last}"));
        indented(e, field(statement, "body")?)?;
        e.line("end");
        Ok(())
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for comment in item.texts("comments") {
            e.comment(&comment);
        }
        let body = field(item, "body")?;
        let mut returns = false;
        each_statement(body, &mut |statement| {
            returns |= statement.is("Return") && statement.node("value").is_some();
        });
        let list = item
            .nodes("parameters")
            .iter()
            .map(|parameter| parameter.str("name").unwrap_or_default())
            .collect::<Vec<_>>()
            .join(", ");
        let output = if returns {
            format!("{RESULT} = ")
        } else {
            String::new()
        };
        let name = item.str("name").unwrap_or_default();
        e.line(&format!("function {output}{name}({list})"));
        indented(e, body)?;
        e.line("end");
        Ok(())
    }

    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        let comments = program.texts("comments");
        for comment in &comments {
            e.comment(comment);
        }
        if !comments.is_empty() {
            e.line("");
        }
        // A file whose first statement defines a function is a function file.
        e.line("1;");
        for line in program.texts("libraryImports") {
            e.line(&line);
        }
        let functions = program.nodes("functions");
        for (index, item) in functions.iter().enumerate() {
            if index == 0 || spaced_after(&functions, index - 1) {
                e.line("");
            }
            e.function_definition(item)?;
        }
        e.line("");
        for comment in program.texts("mainComments") {
            e.comment(&comment);
        }
        e.body(field(program, "main")?)?;
        Ok(format!("{}\n", e.lines.join("\n")))
    }
}

fn indented(e: &mut Emitter, body: &Node) -> Result<()> {
    e.depth += 1;
    e.body(body)?;
    e.depth -= 1;
    Ok(())
}
