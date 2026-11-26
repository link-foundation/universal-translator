//! Ada (GNAT): a main procedure whose declarative part holds the
//! subprograms and variables, and whose statements follow begin.

use super::shared::{comment_node, declared_variables};
use super::{EmitterDialect, ParserDialect};
use crate::formal::arrays::offset;
use crate::formal::emitter::{Emitter, Result, field, spaced_after};
use crate::formal::lexer::{Token, TokenType};
use crate::formal::parser::{Parsed, Parser};
use crate::meta::{Node, add, block, later_calls, number, text, walk};

pub(crate) struct Ada;

/// The output procedures of Ada.Text_IO and of an Integer_IO instance.
fn is_output(word: &str) -> bool {
    ["put", "put_line", "new_line"]
        .iter()
        .any(|output| output.eq_ignore_ascii_case(word))
}

// ---- reading ----

impl ParserDialect for Ada {
    /// "and then" and "or else" are single operators.
    fn tokens(&self, tokens: Vec<Token>) -> Vec<Token> {
        let mut merged: Vec<Token> = Vec::with_capacity(tokens.len());
        for token in tokens {
            let word = token.value.to_ascii_lowercase();
            if let Some(previous) = merged.last_mut() {
                let before = previous.value.to_ascii_lowercase();
                if token.kind == TokenType::Name
                    && ((before == "and" && word == "then") || (before == "or" && word == "else"))
                {
                    previous.value = format!("{before} {word}");
                    continue;
                }
            }
            merged.push(token);
        }
        merged
    }

    fn program(&self, p: &mut Parser) -> Parsed {
        let mut items = Vec::new();
        p.gather_comments(&mut items);
        while p.is("with") || p.is("use") {
            p.skip_line();
            p.skip_lines();
            p.gather_comments(&mut items);
        }
        p.expect("procedure")?;
        p.expect_name()?;
        p.expect("is")?;
        while !p.accept("begin") {
            p.gather_comments(&mut items);
            p.skip_lines();
            if p.is("function") || p.is("procedure") {
                if let Some(routine) = routine(p)? {
                    items.push(routine);
                }
            } else if !p.is("begin") {
                skip_declaration(p)?;
            }
        }
        items.extend(statements(p, &|p| p.is("end"))?);
        p.expect("end")?;
        p.skip_line();
        p.skip_lines();
        Ok(Node::new("SourceProgram")
            .with("language", p.syntax.id)
            .with("items", items))
    }

    /// Statements: if, while, for, return, null, assignments, calls and
    /// output.
    fn statement(&self, p: &mut Parser) -> Parsed {
        if p.accept("if") {
            return ada_if(p);
        }
        if p.accept("while") {
            let condition = p.expression()?;
            return Ok(Node::new("While")
                .with("condition", condition)
                .with("body", loop_body(p)?));
        }
        if p.accept("for") {
            return ada_for(p);
        }
        if p.accept("return") {
            let value = if p.is(";") {
                None
            } else {
                Some(p.expression()?)
            };
            return Ok(Node::new("Return").with_opt("value", value));
        }
        if is_output(&p.current().value) {
            return output(p);
        }
        if p.accept("declare") {
            return declare_block(p);
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

    /// Numbers'Length.
    fn primary(&self, p: &mut Parser) -> Parsed {
        let value = p.base_primary()?;
        if value.is("Name") && p.is("'") && p.is_at("length", 1) {
            p.position += 2;
            return Ok(Node::new("Length").with("array", value));
        }
        Ok(value)
    }
}

/// declare Name : Integer_Array (0 .. Last) := ...; begin ... end; holds
/// arrays and the statements after them, which the meta program lists in
/// the same block.
fn declare_block(p: &mut Parser) -> Parsed {
    let mut found = Vec::new();
    p.skip_lines();
    while !p.accept("begin") {
        let variable = p.expect_name()?;
        p.expect(":")?;
        p.accept("constant");
        p.expect_name()?;
        p.expect("(")?;
        p.expression()?;
        p.expect("..")?;
        let last = p.expression()?;
        p.expect(")")?;
        p.expect(":=")?;
        let value = aggregate(p, offset(last, 1))?;
        found.push(
            Node::new("Declaration")
                .with("name", variable)
                .with("type", "array")
                .with("value", value),
        );
        p.expect(";")?;
        p.skip_lines();
    }
    found.extend(statements(p, &|p| p.is("end"))?);
    p.expect("end")?;
    Ok(Node::new("Sequence").with("statements", found))
}

/// [others => V] is the array of n values V; [A, B] and [0 => A] list the
/// values. Ada 2022 writes array aggregates in square brackets; the older
/// parentheses are read too.
fn aggregate(p: &mut Parser, length: Node) -> Parsed {
    let close = if p.accept("[") {
        "]"
    } else {
        p.expect("(")?;
        ")"
    };
    if p.accept("others") {
        p.expect("=>")?;
        let fill = p.expression()?;
        p.expect(close)?;
        return Ok(
            if length.is("Number") && length.number("value") == Some(0.0) {
                Node::new("ArrayLiteral").with("elements", Vec::<Node>::new())
            } else {
                Node::new("NewArray")
                    .with("length", length)
                    .with("fill", fill)
            },
        );
    }
    if p.kind(0) == TokenType::Number && p.is_at("=>", 1) {
        p.position += 2;
    }
    p.array_literal(close)
}

/// Statements up to the word that ends the block; `null;` stands for a
/// block without statements.
fn statements(p: &mut Parser, done: &dyn Fn(&Parser) -> bool) -> Parsed<Vec<Node>> {
    let mut found = Vec::new();
    p.skip_lines();
    loop {
        while p.accept("null") {
            p.skip_lines();
        }
        if done(p) || p.kind(0) == TokenType::End {
            return Ok(found);
        }
        if p.kind(0) == TokenType::Comment {
            let comment = p.next()?;
            found.push(comment_node(&comment));
        } else {
            let statement = p.statement()?;
            if statement.is("Sequence") {
                found.extend(statement.node_list("statements"));
            } else {
                found.push(statement);
            }
        }
        p.skip_lines_keeping(&mut found);
    }
}

/// Put (A, 0); Put (": "); Put_Line (B); on one line print one line.
fn output(p: &mut Parser) -> Parsed {
    let mut parts = Vec::new();
    while is_output(&p.current().value) {
        let word = p.next()?.value.to_ascii_lowercase();
        if word == "new_line" {
            p.accept(";");
            return Ok(print(parts, true));
        }
        p.expect("(")?;
        parts.push(p.expression()?);
        // The width of an integer, or the layout of a real.
        while p.accept(",") {
            p.expression()?;
        }
        p.expect(")")?;
        p.accept(";");
        if word == "put_line" {
            return Ok(print(parts, true));
        }
    }
    Ok(print(parts, false))
}

fn print(mut parts: Vec<Node>, newline: bool) -> Node {
    let value = match parts.len() {
        0 => text(""),
        1 => parts.remove(0),
        _ => Node::new("Interpolation")
            .with("parts", parts)
            .with("type", "text"),
    };
    Node::new("Print")
        .with("value", value)
        .with("newline", newline)
}

/// for I in T range First .. Last loop: the meta loop stops before its end.
fn ada_for(p: &mut Parser) -> Parsed {
    let variable = p.expect_name()?;
    p.expect("in")?;
    if p.is_at("range", 1) {
        p.position += 2;
    }
    let start = p.expression()?;
    p.expect("..")?;
    let last = p.expression()?;
    Ok(Node::new("CountingLoop")
        .with("variable", variable)
        .with("start", start)
        .with("end", add(last, number(1.0)))
        .with("body", loop_body(p)?))
}

fn loop_body(p: &mut Parser) -> Parsed {
    p.expect("loop")?;
    let body = statements(p, &|p| p.is("end"))?;
    p.expect("end")?;
    p.expect("loop")?;
    Ok(block(body))
}

/// if ... then ... elsif ... then ... else ... end if;
fn ada_if(p: &mut Parser) -> Parsed {
    let condition = p.expression()?;
    p.expect("then")?;
    let then = block(statements(p, &|p| {
        p.is("elsif") || p.is("else") || p.is("end")
    })?);
    let found = Node::new("If")
        .with("condition", condition)
        .with("then", then);
    if p.accept("elsif") {
        return Ok(found.with("otherwise", ada_if(p)?));
    }
    let mut otherwise = None;
    if p.accept("else") {
        otherwise = Some(block(statements(p, &|p| p.is("end"))?));
    }
    p.expect("end")?;
    p.expect("if")?;
    Ok(found.with_opt("otherwise", otherwise))
}

/// A variable, a package instance or a use clause, up to its semicolon.
fn skip_declaration(p: &mut Parser) -> Parsed<()> {
    while !p.accept(";") {
        p.next()?;
    }
    Ok(())
}

/// function Name (A, B : T; C : T) return T is ... begin ... end Name;
/// A heading that ends with a semicolon only announces the body.
fn routine(p: &mut Parser) -> Parsed<Option<Node>> {
    let is_function = p.next()?.value.eq_ignore_ascii_case("function");
    let name = p.expect_name()?;
    let mut parameters: Vec<(String, Option<&'static str>)> = Vec::new();
    if p.accept("(") {
        while !p.is(")") {
            let mut names = vec![p.expect_name()?];
            while p.accept(",") {
                names.push(p.expect_name()?);
            }
            p.expect(":")?;
            p.accept("in");
            let spelled = p.expect_name()?;
            let kind = p.type_of(&spelled);
            parameters.extend(names.into_iter().map(|parameter| (parameter, kind)));
            if !p.accept(";") {
                break;
            }
        }
        p.expect(")")?;
    }
    let return_type = if is_function {
        p.expect("return")?;
        let spelled = p.expect_name()?;
        p.type_of(&spelled)
    } else {
        Some("nothing")
    };
    if p.accept(";") {
        return Ok(None);
    }
    p.expect("is")?;
    p.skip_lines();
    while !p.accept("begin") {
        skip_declaration(p)?;
        p.skip_lines();
    }
    let mut body = statements(p, &|p| p.is("end"))?;
    p.expect("end")?;
    p.skip_line();
    // `Number := Initial_Number;` first declares the copy of a parameter.
    for statement in &mut body {
        let copied = statement.is("Assignment")
            && statement.node("value").is_some_and(|value| {
                value.is("Name")
                    && parameters
                        .iter()
                        .any(|(source, _)| Some(source.as_str()) == value.str("name"))
            });
        if !copied {
            break;
        }
        let copy = statement.str("name").unwrap_or_default().to_owned();
        let value = statement.node("value").cloned();
        *statement = Node::new("Declaration")
            .with("name", copy)
            .with_opt("value", value)
            .with("mutable", true);
    }
    let parameters: Vec<Node> = parameters
        .into_iter()
        .map(|(parameter, kind)| {
            Node::new("Parameter")
                .with("name", parameter)
                .with_opt("type", kind)
        })
        .collect();
    Ok(Some(
        Node::new("Function")
            .with("name", name)
            .with("parameters", parameters)
            .with_opt("returnType", return_type)
            .with("body", block(body)),
    ))
}

// ---- writing ----

impl EmitterDialect for Ada {
    fn quote(&self, _: &Emitter, value: &str) -> String {
        format!("\"{}\"", value.replace('"', "\"\""))
    }

    /// Ada writes a space between a subprogram and its arguments, and calls
    /// a subprogram without parameters by its name alone.
    fn expression_in(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        if !expression.is("Call") {
            return e.base_expression_in(expression, parent);
        }
        let values = expression
            .nodes("arguments")
            .into_iter()
            .map(|value| e.expression(value))
            .collect::<Result<Vec<_>>>()?;
        let callee = expression.str("callee").unwrap_or_default();
        Ok(if values.is_empty() {
            callee.to_owned()
        } else {
            format!("{callee} ({})", values.join(", "))
        })
    }

    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let newline = statement.flag("newline") == Some(true);
        let parts = if value.is("Interpolation") {
            value.node_list("parts")
        } else {
            vec![value.clone()]
        };
        if newline && parts.len() == 1 && parts[0].is("Text") {
            e.uses.insert("text_io");
            return Ok(if parts[0].str("value") == Some("") {
                "New_Line;".to_owned()
            } else {
                format!("Put_Line ({});", e.expression(&parts[0])?)
            });
        }
        let count = parts.len();
        Ok(parts
            .iter()
            .enumerate()
            .map(|(index, part)| put(e, part, newline && index == count - 1))
            .collect::<Result<Vec<_>>>()?
            .join(" "))
    }

    /// An array is declared, with its bounds, in a declare block that holds
    /// the statements after it.
    fn body(&self, e: &mut Emitter, block: &Node) -> Result<()> {
        let all = block.node_list("statements");
        if all.is_empty() {
            e.line("null;");
        }
        let Some(first) = all.iter().position(is_array_declaration) else {
            return e.base_body(block);
        };
        let part = |statements: &[Node]| block.clone().with("statements", statements.to_vec());
        e.base_body(&part(&all[..first]))?;
        let mut last = first;
        while last < all.len() && is_array_declaration(&all[last]) {
            last += 1;
        }
        e.line("declare");
        e.depth += 1;
        for statement in &all[first..last] {
            let name = statement.str("name").unwrap_or_default();
            let constant = !changes(&all[last..], name);
            let written = array_declaration(e, statement, constant)?;
            e.line(&written);
        }
        e.depth -= 1;
        e.line("begin");
        indented(e, &part(&all[last..]))?;
        e.line("end;");
        Ok(())
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
        indented(e, field(current, "then")?)?;
        while let Some(chained) = current.node("otherwise").filter(|node| node.is("If")) {
            current = chained;
            let condition = e.expression(field(current, "condition")?)?;
            e.line(&format!("elsif {condition} then"));
            indented(e, field(current, "then")?)?;
        }
        if let Some(otherwise) = current.node("otherwise") {
            e.line("else");
            indented(e, otherwise)?;
        }
        e.line("end if;");
        Ok(())
    }

    fn while_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("while {condition} loop"));
        indented(e, field(statement, "body")?)?;
        e.line("end loop;");
        Ok(())
    }

    /// The loop declares its own variable, of the type its range names
    /// (literal bounds alone would make it an Integer).
    fn counting_loop(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let variable = statement.str("variable").unwrap_or_default();
        let end = field(statement, "end")?.clone();
        let last = e.expression(&add(end, number(-1.0)))?;
        let kind = e.type_name("integer");
        let start = e.expression(field(statement, "start")?)?;
        e.line(&format!(
            "for {variable} in {kind} range {start} .. {last} loop"
        ));
        indented(e, field(statement, "body")?)?;
        e.line("end loop;");
        Ok(())
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for text in item.texts("comments") {
            e.comment(&text);
        }
        let heading = heading(e, item);
        e.line(&format!("{heading} is"));
        e.depth += 1;
        variables(e, field(item, "body")?);
        e.depth -= 1;
        e.line("begin");
        indented(e, field(item, "body")?)?;
        e.line(&format!("end {};", item.str("name").unwrap_or_default()));
        Ok(())
    }

    /// The subprograms come first, announced by their specifications when
    /// an earlier one calls them, then the variables of the main procedure.
    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        e.depth = 1;
        let functions = program.node_list("functions");
        let mut announced: Vec<String> = later_calls(&functions)
            .iter()
            .map(|item| format!("    {};", heading(e, item)))
            .collect();
        if !announced.is_empty() {
            announced.push(String::new());
        }
        for (index, item) in functions.iter().enumerate() {
            e.function_definition(item)?;
            if spaced_after(&functions, index) {
                e.line("");
            }
        }
        let main = field(program, "main")?;
        if variables(e, main) > 0 {
            e.line("");
        }
        e.depth = 0;
        e.line("begin");
        e.depth = 1;
        for text in program.texts("mainComments") {
            e.comment(&text);
        }
        e.body(main)?;
        e.depth = 0;
        e.line("end Main;");
        let body = std::mem::take(&mut e.lines);
        let comments = program.texts("comments");
        for text in &comments {
            e.comment(text);
        }
        if !comments.is_empty() {
            e.line("");
        }
        prelude(e, program);
        let mut all = std::mem::take(&mut e.lines);
        all.extend(announced);
        all.extend(body);
        Ok(all.render(e.syntax.id))
    }
}

/// Integers are written by an Integer_IO instance, without padding.
fn put(e: &mut Emitter, part: &Node, last: bool) -> Result<String> {
    let value = e.expression(part)?;
    e.uses.insert("text_io");
    if part.is("Text") || part.str("type") == Some("text") {
        let call = if last { "Put_Line" } else { "Put" };
        return Ok(format!("{call} ({value});"));
    }
    if part.str("type") == Some("real") {
        e.uses.insert("float_io");
        let written = format!("Put ({value}, 0, 6, 0);");
        return Ok(if last {
            format!("{written} New_Line;")
        } else {
            written
        });
    }
    e.uses.insert("integer_io");
    let written = if part.str("type") == Some("boolean") {
        format!("Put (Boolean'Image ({value}));")
    } else {
        format!("Put ({value}, 0);")
    };
    Ok(if last {
        format!("{written} New_Line;")
    } else {
        written
    })
}

fn indented(e: &mut Emitter, body: &Node) -> Result<()> {
    e.depth += 1;
    e.body(body)?;
    e.depth -= 1;
    Ok(())
}

fn is_array_declaration(statement: &Node) -> bool {
    statement.is("Declaration")
        && (statement.str("type") == Some("array")
            || statement
                .node("value")
                .is_some_and(|value| value.is("ArrayLiteral") || value.is("NewArray")))
}

/// Whether a statement after an array's declaration stores into it. GNAT
/// (-gnatwk) wants an array that nothing stores into to be constant.
fn changes(statements: &[Node], name: &str) -> bool {
    let mut found = false;
    let tree = Node::new("Block").with("statements", statements.to_vec());
    walk(&tree, |current| {
        if (current.is("IndexAssignment") || current.is("Assignment"))
            && current.str("name") == Some(name)
        {
            found = true;
        }
    });
    found
}

/// Name : Integer_Array (0 .. Last) := [others => V], or the values.
fn array_declaration(e: &mut Emitter, statement: &Node, constant: bool) -> Result<String> {
    e.uses.insert("array");
    let name = statement.str("name").unwrap_or_default();
    let value = field(statement, "value")?;
    let elements = value.node_list("elements");
    let length = if value.is("NewArray") {
        field(value, "length")?.clone()
    } else {
        number(elements.len() as f64)
    };
    let bounds = format!("0 .. {}", e.expression(&offset(length, -1))?);
    let values = if value.is("NewArray") || elements.is_empty() {
        let fill = value.node("fill").cloned().unwrap_or_else(|| number(0.0));
        format!("[others => {}]", e.expression(&fill)?)
    } else {
        let written = elements
            .iter()
            .map(|element| e.expression(element))
            .collect::<Result<Vec<_>>>()?;
        if written.len() == 1 {
            format!("[0 => {}]", written[0])
        } else {
            format!("[{}]", written.join(", "))
        }
    };
    let kind = if constant {
        "constant Integer_Array"
    } else {
        "Integer_Array"
    };
    Ok(format!("{name} : {kind} ({bounds}) := {values};"))
}

/// Name : Long_Long_Integer;
fn variables(e: &mut Emitter, body: &Node) -> usize {
    let variables: Vec<_> = declared_variables(body, false)
        .into_iter()
        .filter(|(_, kind)| kind != "array")
        .collect();
    for (variable, kind) in &variables {
        let written = e.type_name(kind);
        e.line(&format!("{variable} : {written};"));
    }
    variables.len()
}

fn heading(e: &mut Emitter, item: &Node) -> String {
    let name = item.str("name").unwrap_or_default();
    let parameters = item
        .nodes("parameters")
        .iter()
        .map(|parameter| {
            let kind = e.type_name(parameter.str("type").unwrap_or_default());
            format!("{} : {kind}", parameter.str("name").unwrap_or_default())
        })
        .collect::<Vec<_>>()
        .join("; ");
    let list = if parameters.is_empty() {
        String::new()
    } else {
        format!(" ({parameters})")
    };
    match item.str("returnType").unwrap_or_default() {
        "nothing" => format!("procedure {name}{list}"),
        returns => {
            let returns = e.type_name(returns);
            format!("function {name}{list} return {returns}")
        }
    }
}

/// with clauses, the main procedure and the Integer_IO instance.
fn prelude(e: &mut Emitter, program: &Node) {
    let mut units = Vec::new();
    if e.uses.contains("text_io") {
        units.push("Ada.Text_IO".to_owned());
    }
    units.extend(program.texts("libraryImports"));
    for unit in &units {
        e.line(&format!("with {unit}; use {unit};"));
    }
    if !units.is_empty() {
        e.line("");
    }
    e.line("procedure Main is");
    if e.uses.contains("integer_io") {
        e.line("    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;");
        e.line("");
    }
    // Reals are written with six digits after the point, like C's %f.
    if e.uses.contains("float_io") {
        e.line("    package Real_IO is new Float_IO (Long_Float); use Real_IO;");
        e.line("");
    }
    if e.uses.contains("array") {
        e.line(
            "    type Integer_Array is array (Long_Long_Integer range <>) of Long_Long_Integer;",
        );
        e.line("");
    }
}
