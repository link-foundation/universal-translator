//! Emitter: renders a typed meta program in a target language. Every
//! language-specific spelling comes from the language descriptions or from
//! the small tables below; the structure of the output follows the meta tree.

use std::collections::HashSet;

use super::GrammarError;
use super::languages::{Blocks, EntryPoint, IntegerDivision, Syntax, language_syntax};
use super::meta::{Node, add, block, format_number, number, text};

/// Binding strength of a meta operator; unknown operators have none, which
/// compares as never tighter or looser (NaN).
fn precedence(operator: &str) -> f64 {
    match operator {
        "or" => 1.0,
        "and" => 2.0,
        "equal" | "notEqual" => 3.0,
        "less" | "lessOrEqual" | "greater" | "greaterOrEqual" => 4.0,
        "add" | "subtract" => 5.0,
        "multiply" | "divide" | "remainder" => 6.0,
        _ => f64::NAN,
    }
}

fn symbol(operator: &str) -> &str {
    match operator {
        "add" => "+",
        "subtract" => "-",
        "multiply" => "*",
        "divide" => "/",
        "remainder" => "%",
        "less" => "<",
        "lessOrEqual" => "<=",
        "greater" => ">",
        "greaterOrEqual" => ">=",
        "equal" => "==",
        "notEqual" => "!=",
        other => other,
    }
}

fn compound_operator(operator: &str) -> Option<&'static str> {
    match operator {
        "add" => Some("+="),
        "subtract" => Some("-="),
        "multiply" => Some("*="),
        "divide" => Some("/="),
        "remainder" => Some("%="),
        _ => None,
    }
}

/// How format strings mark escaped characters.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Format {
    None,
    Percent,
    Braces,
    /// Scala's `s"..."` writes a literal `$` as `$$`.
    Dollar,
}

/// Languages that embed expressions in a double-quoted literal between two
/// delimiters: the prefix that marks such a literal, the delimiters and the
/// escaping of literal text.
fn embedding(id: &str) -> Option<(&'static str, &'static str, &'static str, Format)> {
    Some(match id {
        "python" => ("f", "{", "}", Format::Braces),
        "csharp" => ("$", "{", "}", Format::Braces),
        "ruby" => ("", "#{", "}", Format::None),
        "kotlin" | "dart" | "groovy" => ("", "${", "}", Format::None),
        "scala" => ("s", "${", "}", Format::Dollar),
        "julia" => ("", "$(", ")", Format::None),
        "swift" => ("", "\\(", ")", Format::None),
        _ => return None,
    })
}

/// Adjacent literal parts joined into one.
fn merge_texts(parts: &[Node]) -> Vec<Node> {
    let mut merged: Vec<Node> = Vec::new();
    for part in parts {
        if part.is("Text")
            && let Some(last) = merged.last_mut()
            && last.is("Text")
        {
            let joined = format!(
                "{}{}",
                last.str("value").unwrap_or_default(),
                part.str("value").unwrap_or_default()
            );
            *last = text(joined);
            continue;
        }
        merged.push(part.clone());
    }
    merged
}

/// Whether a counting range is two numbers counting up.
fn is_literal_range(start: &Node, end: &Node) -> bool {
    match (start.number("value"), end.number("value")) {
        (Some(first), Some(last)) => start.is("Number") && end.is("Number") && first < last,
        _ => false,
    }
}

type Result<T> = std::result::Result<T, GrammarError>;

struct Emitter {
    syntax: Syntax,
    unit: &'static str,
    lines: Vec<String>,
    depth: usize,
    uses: HashSet<&'static str>,
}

fn field<'a>(node: &'a Node, key: &str) -> Result<&'a Node> {
    node.node(key)
        .ok_or_else(|| GrammarError::new(format!("{} has no {key}", node.kind)))
}

impl Emitter {
    fn new(syntax: Syntax) -> Self {
        let unit = if syntax.id == "go" { "\t" } else { "    " };
        Emitter {
            syntax,
            unit,
            lines: Vec::new(),
            depth: 0,
            uses: HashSet::new(),
        }
    }

    fn id(&self) -> &'static str {
        self.syntax.id
    }

    fn line(&mut self, content: &str) {
        if content.is_empty() {
            self.lines.push(String::new());
        } else {
            self.lines
                .push(format!("{}{content}", self.unit.repeat(self.depth)));
        }
    }

    fn terminator(&self) -> &'static str {
        if matches!(
            self.id(),
            "python"
                | "ruby"
                | "lua"
                | "go"
                | "kotlin"
                | "swift"
                | "scala"
                | "julia"
                | "r"
                | "groovy"
        ) {
            ""
        } else {
            ";"
        }
    }

    // ---- names, types, literals ----
    fn variable(&self, identifier: &str) -> String {
        match self.syntax.variable_sigil {
            Some(sigil) => format!("{sigil}{identifier}"),
            None => identifier.to_owned(),
        }
    }

    fn type_name(&mut self, meta: &str) -> String {
        if meta == "text" && self.id() == "cpp" {
            self.uses.insert("string");
        }
        if meta == "boolean" && self.id() == "c" {
            self.uses.insert("stdbool");
        }
        let Some(types) = self.syntax.types else {
            return String::new();
        };
        match meta {
            "text" => types.text,
            "boolean" => types.boolean,
            "nothing" => types.nothing,
            _ => types.integer,
        }
        .to_owned()
    }

    fn escape(&self, value: &str, format: Format) -> String {
        let mut result = value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
            .replace('\t', "\\t")
            .replace('\r', "\\r");
        // Characters that would start an embedded variable, such as $ in PHP.
        for sigil in self.syntax.escape_sigils {
            result = result.replace(sigil, &format!("\\{sigil}"));
        }
        if self.id() == "ruby" {
            result = result.replace("#{", "\\#{");
        }
        match format {
            Format::Percent => result.replace('%', "%%"),
            Format::Braces => result.replace('{', "{{").replace('}', "}}"),
            Format::Dollar => result.replace('$', "$$"),
            Format::None => result,
        }
    }

    fn quote(&self, value: &str) -> String {
        format!("\"{}\"", self.escape(value, Format::None))
    }

    // ---- expressions ----
    fn unary(&mut self, expression: &Node, parent: f64) -> Result<String> {
        let operator = if expression.str("operator") == Some("not") {
            self.syntax.operators.not
        } else {
            "-"
        };
        let spaced = if operator
            .chars()
            .last()
            .is_some_and(|c| c.is_ascii_alphanumeric() || c == '_')
        {
            format!("{operator} ")
        } else {
            operator.to_owned()
        };
        let operand = self.expression_in(field(expression, "operand")?, 7.0)?;
        let result = format!("{spaced}{operand}");
        Ok(if parent > 7.0 {
            format!("({result})")
        } else {
            result
        })
    }

    fn expression(&mut self, expression: &Node) -> Result<String> {
        self.expression_in(expression, 0.0)
    }

    fn expression_in(&mut self, expression: &Node, parent: f64) -> Result<String> {
        match expression.kind.as_str() {
            "Number" => {
                let value = expression.number("value").unwrap_or(0.0);
                // R needs a suffix to keep integers integral: 1L.
                let suffix = if value.fract() == 0.0 {
                    self.syntax.number_suffix.unwrap_or_default()
                } else {
                    ""
                };
                let shown = format!("{}{suffix}", format_number(value));
                Ok(if value < 0.0 && parent > 6.0 {
                    format!("({shown})")
                } else {
                    shown
                })
            }
            "Text" => Ok(self.quote(expression.str("value").unwrap_or_default())),
            "Boolean" => {
                let value = expression.flag("value").unwrap_or(false);
                Ok(match self.syntax.words {
                    Some((yes, no)) => if value { yes } else { no }.to_owned(),
                    None => value.to_string(),
                })
            }
            "Name" => Ok(self.variable(expression.str("name").unwrap_or_default())),
            "Interpolation" => {
                let parts = expression.node_list("parts");
                self.interpolation(&parts)
            }
            "Call" => {
                let arguments = expression
                    .nodes("arguments")
                    .into_iter()
                    .map(|argument| self.expression(argument))
                    .collect::<Result<Vec<_>>>()?;
                Ok(format!(
                    "{}({})",
                    expression.str("callee").unwrap_or_default(),
                    arguments.join(", ")
                ))
            }
            "Unary" => self.unary(expression, parent),
            "Binary" => self.binary(expression, parent),
            kind => Err(GrammarError::new(format!(
                "Cannot emit {kind} as an expression"
            ))),
        }
    }

    fn binary(&mut self, expression: &Node, parent: f64) -> Result<String> {
        let operator = expression.str("operator").unwrap_or_default();
        let level = precedence(operator);
        let left_node = field(expression, "left")?;
        let right_node = field(expression, "right")?;
        // R's %% and %/% bind tighter than * and /, so their operands that are
        // themselves operations keep parentheses.
        let tight = self.id() == "r" && matches!(operator, "divide" | "remainder");
        // `a && b || c` keeps its meaning without parentheses, but readers (and
        // C compilers with -Wparentheses) expect them around the inner "and".
        let inner = if operator == "or" {
            precedence("and") + 1.0
        } else {
            level
        };
        let left = self.expression_in(left_node, if tight { 7.0 } else { inner })?;
        let right =
            self.expression_in(right_node, if tight { 7.0 } else { inner.max(level + 1.0) })?;
        let result = if operator == "divide" {
            if let Some(integer) = self.syntax.operators.integer_divide {
                format!("{left} {integer} {right}")
            } else if let Some(spelling) = self.syntax.integer_division {
                return Ok(match spelling {
                    IntegerDivision::Wrapper(wrapper) => format!(
                        "{wrapper}({} / {})",
                        self.expression(left_node)?,
                        self.expression(right_node)?
                    ),
                    IntegerDivision::Call(call) => format!(
                        "{call}({}, {})",
                        self.expression(left_node)?,
                        self.expression(right_node)?
                    ),
                    IntegerDivision::Method(method) => format!(
                        "{}.{method}({})",
                        self.expression_in(left_node, 8.0)?,
                        self.expression(right_node)?
                    ),
                });
            } else {
                format!("{left} / {right}")
            }
        } else {
            let spelled = self
                .syntax
                .operator(operator)
                .unwrap_or_else(|| symbol(operator));
            format!("{left} {spelled} {right}")
        };
        Ok(if level < parent {
            format!("({result})")
        } else {
            result
        })
    }

    /// Render an interpolation where literal parts are escaped and computed
    /// parts sit between `open` and `close`.
    fn render(
        &mut self,
        parts: &[Node],
        open: &str,
        close: &str,
        format: Format,
    ) -> Result<String> {
        let mut out = String::from("\"");
        for part in parts {
            if part.is("Text") {
                out.push_str(&self.escape(part.str("value").unwrap_or_default(), format));
            } else {
                out.push_str(open);
                out.push_str(&self.expression(part)?);
                out.push_str(close);
            }
        }
        out.push('"');
        Ok(out)
    }

    fn joined(&mut self, parts: &[Node], separator: &str) -> Result<String> {
        let pieces = parts
            .iter()
            .map(|part| {
                if part.is("Text") {
                    Ok(self.quote(part.str("value").unwrap_or_default()))
                } else {
                    self.expression_in(part, 6.0)
                }
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(pieces.join(separator))
    }

    /// Text built from literal and computed parts, outside of output calls.
    fn interpolation(&mut self, parts: &[Node]) -> Result<String> {
        if let Some((prefix, open, close, format)) = embedding(self.id()) {
            return Ok(format!(
                "{prefix}{}",
                self.render(parts, open, close, format)?
            ));
        }
        match self.id() {
            "javascript" | "typescript" => {
                let mut out = String::from("`");
                for part in parts {
                    if part.is("Text") {
                        let value = part.str("value").unwrap_or_default();
                        out.push_str(
                            &value
                                .replace('\\', "\\\\")
                                .replace('`', "\\`")
                                .replace("${", "\\${")
                                .replace('\n', "\\n"),
                        );
                    } else {
                        out.push_str(&format!("${{{}}}", self.expression(part)?));
                    }
                }
                out.push('`');
                Ok(out)
            }
            "r" => {
                let pieces = parts
                    .iter()
                    .map(|part| self.expression(part))
                    .collect::<Result<Vec<_>>>()?;
                Ok(format!("paste0({})", pieces.join(", ")))
            }
            // PHP and Perl interpolate only variables, so computed parts are
            // concatenated.
            "php" | "perl" => self.joined(parts, " . "),
            "rust" => Ok(format!(
                "format!({})",
                self.format_arguments(parts, Format::Braces)?
            )),
            "go" => {
                self.uses.insert("fmt");
                Ok(format!(
                    "fmt.Sprintf({})",
                    self.format_arguments(parts, Format::Percent)?
                ))
            }
            "lua" => self.joined(parts, " .. "),
            "cpp" => {
                self.uses.insert("string");
                let pieces = parts
                    .iter()
                    .enumerate()
                    .map(|(index, part)| {
                        if part.is("Text") {
                            let quoted = self.quote(part.str("value").unwrap_or_default());
                            Ok(if index == 0 {
                                format!("std::string({quoted})")
                            } else {
                                quoted
                            })
                        } else if part.str("type") == Some("text") {
                            self.expression_in(part, 6.0)
                        } else {
                            Ok(format!("std::to_string({})", self.expression(part)?))
                        }
                    })
                    .collect::<Result<Vec<_>>>()?;
                Ok(pieces.join(" + "))
            }
            "java" => {
                let joined = self.joined(parts, " + ")?;
                Ok(if parts.first().is_some_and(|part| part.is("Text")) {
                    joined
                } else if joined.is_empty() {
                    "\"\"".to_owned()
                } else {
                    format!("\"\" + {joined}")
                })
            }
            _ => Err(GrammarError::new(format!(
                "{} has no text interpolation in this translator",
                self.syntax.label
            ))),
        }
    }

    /// "format string", value, value  — for printf-like and format!-like calls.
    fn format_arguments(&mut self, parts: &[Node], style: Format) -> Result<String> {
        let mut format = String::new();
        let mut values = Vec::new();
        for part in parts {
            if part.is("Text") {
                format.push_str(&self.escape(part.str("value").unwrap_or_default(), style));
                continue;
            }
            if style == Format::Braces {
                format.push_str("{}");
            } else {
                format.push_str(match part.str("type") {
                    Some("text") => "%s",
                    Some("boolean") if self.id() == "go" => "%t",
                    _ => "%d",
                });
            }
        }
        for part in parts.iter().filter(|part| !part.is("Text")) {
            values.push(self.expression(part)?);
        }
        let mut all = vec![format!("\"{format}\"")];
        all.extend(values);
        Ok(all.join(", "))
    }

    // ---- statements ----
    fn print(&mut self, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let newline = statement.flag("newline").unwrap_or(false);
        let parts = if value.is("Interpolation") {
            value.node_list("parts")
        } else {
            vec![value.clone()]
        };
        let mut line_parts = parts.clone();
        if newline {
            line_parts.push(text("\n"));
        }
        let pick = |yes: &'static str, no: &'static str| if newline { yes } else { no };
        Ok(match self.id() {
            "javascript" | "typescript" => {
                let single = self.expression(value)?;
                if newline {
                    format!("console.log({single});")
                } else if value.str("type") == Some("text") {
                    format!("process.stdout.write({single});")
                } else {
                    format!("process.stdout.write(String({single}));")
                }
            }
            "python" => {
                let single = self.expression(value)?;
                if newline {
                    format!("print({single})")
                } else {
                    format!("print({single}, end=\"\")")
                }
            }
            "ruby" => format!("{} {}", pick("puts", "print"), self.expression(value)?),
            "lua" => format!("{}({})", pick("print", "io.write"), self.expression(value)?),
            "php" => format!("echo {};", self.interpolation_or_text(&line_parts)?),
            "c" => {
                self.uses.insert("stdio");
                format!(
                    "printf({});",
                    self.format_arguments(&line_parts, Format::Percent)?
                )
            }
            "cpp" => {
                self.uses.insert("iostream");
                let pieces = parts
                    .iter()
                    .map(|part| self.expression_in(part, 6.0))
                    .collect::<Result<Vec<_>>>()?;
                format!(
                    "std::cout << {}{};",
                    pieces.join(" << "),
                    pick(" << std::endl", "")
                )
            }
            "go" => {
                self.uses.insert("fmt");
                if parts.len() == 1 {
                    format!(
                        "fmt.{}({})",
                        pick("Println", "Print"),
                        self.expression(value)?
                    )
                } else {
                    format!(
                        "fmt.Printf({})",
                        self.format_arguments(&line_parts, Format::Percent)?
                    )
                }
            }
            "rust" => format!(
                "{}({});",
                pick("println!", "print!"),
                self.format_arguments(&parts, Format::Braces)?
            ),
            "csharp" => format!(
                "System.Console.{}({});",
                pick("WriteLine", "Write"),
                self.expression(value)?
            ),
            "java" => format!(
                "System.out.{}({});",
                pick("println", "print"),
                self.expression(value)?
            ),
            "kotlin" | "scala" | "groovy" | "julia" => {
                format!("{}({})", pick("println", "print"), self.expression(value)?)
            }
            "perl" => format!("print {};", self.interpolation_or_text(&line_parts)?),
            "dart" => {
                let single = self.expression(value)?;
                if newline {
                    format!("print({single});")
                } else {
                    self.uses.insert("dart:io");
                    format!("stdout.write({single});")
                }
            }
            "r" => {
                let pieces = merge_texts(&line_parts)
                    .iter()
                    .map(|part| self.expression(part))
                    .collect::<Result<Vec<_>>>()?;
                format!("cat({}, sep = \"\")", pieces.join(", "))
            }
            "swift" => {
                let single = self.expression(value)?;
                if newline {
                    format!("print({single})")
                } else {
                    format!("print({single}, terminator: \"\")")
                }
            }
            _ => {
                return Err(GrammarError::new(format!(
                    "No output procedure for {}",
                    self.syntax.label
                )));
            }
        })
    }

    fn interpolation_or_text(&mut self, parts: &[Node]) -> Result<String> {
        let merged = merge_texts(parts);
        if merged.len() == 1 && merged[0].is("Text") {
            Ok(self.quote(merged[0].str("value").unwrap_or_default()))
        } else {
            self.interpolation(&merged)
        }
    }

    fn return_statement(&mut self, statement: &Node) -> Result<String> {
        let end = self.terminator();
        Ok(match statement.node("value") {
            // R's return is a function: a bare `return` would not leave.
            Some(value) if self.id() == "r" => format!("return({})", self.expression(value)?),
            Some(value) => format!("return {}{end}", self.expression(value)?),
            None if self.id() == "r" => "return(invisible())".to_owned(),
            None => format!("return{end}"),
        })
    }

    fn comment(&mut self, text: &str) {
        if matches!(self.id(), "c" | "csharp") {
            self.line(&format!("/* {text} */"));
        } else {
            self.line(&format!("{} {text}", self.syntax.line_comment));
        }
    }

    fn condition(&mut self, expression: &Node) -> Result<String> {
        let value = self.expression(expression)?;
        Ok(
            if matches!(
                self.id(),
                "c" | "cpp"
                    | "csharp"
                    | "java"
                    | "javascript"
                    | "typescript"
                    | "kotlin"
                    | "php"
                    | "perl"
                    | "dart"
                    | "scala"
                    | "r"
                    | "groovy"
            ) {
                format!("({value})")
            } else {
                value
            },
        )
    }

    fn open_block(&mut self, header: &str) {
        match self.syntax.blocks {
            Blocks::Braces => self.line(&format!("{header} {{")),
            Blocks::Indentation => self.line(&format!("{header}:")),
            Blocks::End => self.line(header),
        }
        self.depth += 1;
    }

    fn close_block(&mut self) {
        self.depth -= 1;
        match self.syntax.blocks {
            Blocks::Braces => self.line("}"),
            Blocks::End => self.line("end"),
            Blocks::Indentation => {}
        }
    }

    fn body(&mut self, block: &Node) -> Result<()> {
        let statements = block.nodes("statements");
        if statements.is_empty() && self.syntax.blocks == Blocks::Indentation {
            self.line("pass");
        }
        for statement in statements {
            self.statement(statement)?;
        }
        Ok(())
    }

    fn statement(&mut self, statement: &Node) -> Result<()> {
        let end = self.terminator();
        match statement.kind.as_str() {
            "Comment" => self.comment(statement.str("text").unwrap_or_default()),
            "Print" => {
                let line = self.print(statement)?;
                self.line(&line);
            }
            "Evaluate" => {
                let line = format!("{}{end}", self.expression(field(statement, "expression")?)?);
                self.line(&line);
            }
            "Return" => {
                let line = self.return_statement(statement)?;
                self.line(&line);
            }
            "Declaration" => {
                let line = self.declaration(statement)?;
                self.line(&line);
            }
            "Assignment" => {
                let line = self.assignment(statement)?;
                self.line(&line);
            }
            "If" => self.if_statement(statement)?,
            "While" => self.while_statement(statement)?,
            "CountingLoop" => self.counting_loop(statement)?,
            kind => {
                return Err(GrammarError::new(format!(
                    "Cannot emit {kind} as a statement"
                )));
            }
        }
        Ok(())
    }

    fn declaration(&mut self, statement: &Node) -> Result<String> {
        let initial = match statement.node("value") {
            Some(value) => self.expression(value)?,
            None => self.expression(&number(0.0))?,
        };
        let name = statement.str("name").unwrap_or_default();
        let kind = statement.str("type").unwrap_or_default();
        let mutable = statement.flag("mutable").unwrap_or(false);
        Ok(match self.id() {
            "javascript" | "typescript" => {
                format!(
                    "{} {name} = {initial};",
                    if mutable { "let" } else { "const" }
                )
            }
            "python" | "ruby" => format!("{name} = {initial}"),
            "php" => format!("${name} = {initial};"),
            "lua" => format!("local {name} = {initial}"),
            "go" => format!("{name} := {initial}"),
            "rust" => format!(
                "let {}{name}{} = {initial};",
                if mutable { "mut " } else { "" },
                if kind == "integer" { ": i64" } else { "" }
            ),
            "kotlin" => format!(
                "{} {name} = {initial}{}",
                if mutable { "var" } else { "val" },
                self.terminator()
            ),
            "swift" => format!("{} {name} = {initial}", if mutable { "var" } else { "let" }),
            "julia" => format!("{name} = {initial}"),
            "perl" => format!("my {} = {initial};", self.variable(name)),
            "dart" => format!(
                "{} {name} = {initial};",
                if mutable { "var" } else { "final" }
            ),
            "scala" => format!(
                "{} {name}: {} = {initial}",
                if mutable { "var" } else { "val" },
                self.type_name(kind)
            ),
            "r" => format!("{name} <- {initial}"),
            _ => format!(
                "{} {name} = {initial}{}",
                self.type_name(kind),
                self.terminator()
            ),
        })
    }

    /// The meta language only knows `x = value`; `x = x + 1` is written back
    /// as `x += 1` in every language that has compound assignment.
    fn assignment(&mut self, statement: &Node) -> Result<String> {
        let identifier = statement.str("name").unwrap_or_default();
        let target = self.variable(identifier);
        let value = field(statement, "value")?;
        let compound = value.str("operator").and_then(compound_operator);
        // Languages that spell integer division as a call or a wrapper, or with
        // an operator of its own, would lose the truncation with `/=`.
        let plain_division = value.str("operator") != Some("divide")
            || (self.syntax.integer_division.is_none()
                && self.syntax.operators.integer_divide.is_none());
        if let Some(compound) = compound
            && plain_division
            && self.syntax.compound_assignment
            && value.is("Binary")
            && value
                .node("left")
                .is_some_and(|left| left.is_name(identifier))
        {
            let right = self.expression(field(value, "right")?)?;
            return Ok(format!("{target} {compound} {right}{}", self.terminator()));
        }
        Ok(format!(
            "{target} {} {}{}",
            self.syntax.assignment.unwrap_or("="),
            self.expression(value)?,
            self.terminator()
        ))
    }

    fn if_statement(&mut self, statement: &Node) -> Result<()> {
        let then = if self.id() == "lua" { " then" } else { "" };
        let condition = self.condition(field(statement, "condition")?)?;
        self.open_block(&format!("if {condition}{then}"));
        self.body(field(statement, "then")?)?;
        let mut otherwise = statement.node("otherwise");
        // else-if chains stay flat in every language.
        while let Some(chained) = otherwise.filter(|node| node.is("If")) {
            self.depth -= 1;
            let header = self.else_if_header(field(chained, "condition")?)?;
            self.line(&header);
            self.depth += 1;
            self.body(field(chained, "then")?)?;
            otherwise = chained.node("otherwise");
        }
        if let Some(otherwise) = otherwise {
            self.depth -= 1;
            self.line(match self.syntax.blocks {
                Blocks::Braces => "} else {",
                Blocks::Indentation => "else:",
                Blocks::End => "else",
            });
            self.depth += 1;
            self.body(otherwise)?;
        }
        self.close_block();
        Ok(())
    }

    fn else_if_header(&mut self, expression: &Node) -> Result<String> {
        let condition = self.condition(expression)?;
        Ok(if self.syntax.blocks == Blocks::Braces {
            format!(
                "}} {} {condition} {{",
                self.syntax.braced_else_if.unwrap_or("else if")
            )
        } else if self.id() == "python" {
            format!("elif {condition}:")
        } else if self.id() == "lua" {
            format!("elseif {condition} then")
        } else {
            format!("{} {condition}", self.syntax.else_if.unwrap_or("undefined"))
        })
    }

    fn while_statement(&mut self, statement: &Node) -> Result<()> {
        let condition = self.condition(field(statement, "condition")?)?;
        let header = match self.id() {
            "go" => format!("for {condition}"),
            "lua" => format!("while {condition} do"),
            _ => format!("while {condition}"),
        };
        self.open_block(&header);
        self.body(field(statement, "body")?)?;
        self.close_block();
        Ok(())
    }

    fn counting_loop(&mut self, statement: &Node) -> Result<()> {
        let identifier = statement.str("variable").unwrap_or_default();
        let start = field(statement, "start")?;
        let end = field(statement, "end")?;
        if self.id() == "r" && !is_literal_range(start, end) {
            return self.counting_while(statement);
        }
        let from = self.expression(start)?;
        let last = self.expression_in(&add(end.clone(), number(-1.0)), 5.0)?;
        let to = self.expression_in(end, 5.0)?;
        let target = self.variable(identifier);
        let c_style = |keyword: &str| {
            format!("for ({keyword} {identifier} = {from}; {identifier} < {to}; {identifier}++)")
        };
        let header = match self.id() {
            "c" | "cpp" | "csharp" | "java" => c_style("int"),
            "javascript" | "typescript" => c_style("let"),
            "php" => format!("for ({target} = {from}; {target} < {to}; {target}++)"),
            "go" => format!("for {identifier} := {from}; {identifier} < {to}; {identifier}++"),
            "python" => {
                let limit = self.expression(end)?;
                if start.is_number(0.0) {
                    format!("for {identifier} in range({limit})")
                } else {
                    format!("for {identifier} in range({from}, {limit})")
                }
            }
            "ruby" => format!("for {identifier} in {from}...{to}"),
            "lua" => {
                let last = self.expression(&add(end.clone(), number(-1.0)))?;
                format!("for {identifier} = {from}, {last} do")
            }
            "rust" => format!("for {identifier} in {from}..{to}"),
            "kotlin" => format!("for ({identifier} in {from} until {to})"),
            "swift" => format!("for {identifier} in {from}..<{to}"),
            "perl" => format!("for my {target} ({from} .. {last})"),
            "dart" => {
                format!("for (var {identifier} = {from}; {identifier} < {to}; {identifier}++)")
            }
            // A Long start makes the range Long, so a Long end fits.
            "scala" => {
                let first = if start.is("Number") {
                    format!("{from}{}", self.syntax.long_suffix.unwrap_or_default())
                } else {
                    from
                };
                format!("for ({identifier} <- {first} until {to})")
            }
            "julia" => format!("for {identifier} in {from}:{last}"),
            "r" => format!("for ({identifier} in {from}:{last})"),
            "groovy" => format!("for ({identifier} in {from}..<{to})"),
            _ => "undefined".to_owned(),
        };
        self.open_block(&header);
        self.body(field(statement, "body")?)?;
        self.close_block();
        Ok(())
    }

    /// R's a:b counts down when b < a, so a range that may be empty becomes
    /// a while loop.
    fn counting_while(&mut self, statement: &Node) -> Result<()> {
        let identifier = statement.str("variable").unwrap_or_default();
        let start = field(statement, "start")?.clone();
        let end = field(statement, "end")?.clone();
        let counter = Node::new("Name").with("name", identifier);
        self.statement(
            &Node::new("Declaration")
                .with("name", identifier)
                .with("value", start)
                .with("mutable", true),
        )?;
        let mut statements = field(statement, "body")?.node_list("statements");
        statements.push(
            Node::new("Assignment")
                .with("name", identifier)
                .with("operator", "=")
                .with("value", add(counter.clone(), number(1.0))),
        );
        self.while_statement(
            &Node::new("While")
                .with(
                    "condition",
                    Node::new("Binary")
                        .with("operator", "less")
                        .with("left", counter)
                        .with("right", end),
                )
                .with("body", block(statements)),
        )
    }

    // ---- functions and program ----
    fn signature(&mut self, item: &Node) -> String {
        let name = item.str("name").unwrap_or_default();
        let parameters: Vec<(String, String)> = item
            .nodes("parameters")
            .iter()
            .map(|parameter| {
                (
                    parameter.str("name").unwrap_or_default().to_owned(),
                    parameter.str("type").unwrap_or_default().to_owned(),
                )
            })
            .collect();
        let typed = |emitter: &mut Self, render: &dyn Fn(&str, &str) -> String| {
            parameters
                .iter()
                .map(|(id, kind)| render(id, &emitter.type_name(kind)))
                .collect::<Vec<_>>()
                .join(", ")
        };
        let names = parameters
            .iter()
            .map(|(id, _)| id.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        let return_type = item.str("returnType").unwrap_or_default().to_owned();
        let returns = self.type_name(&return_type);
        let after = |emitter: &mut Self, arrow: &str| {
            if return_type == "nothing" {
                String::new()
            } else {
                format!("{arrow}{}", emitter.type_name(&return_type))
            }
        };
        match self.id() {
            "javascript" => format!("function {name}({names})"),
            "typescript" => format!(
                "function {name}({}): {returns}",
                typed(self, &|id, kind| format!("{id}: {kind}"))
            ),
            "python" | "ruby" => format!("def {name}({names})"),
            "lua" => format!("local function {name}({names})"),
            "php" => format!(
                "function {name}({})",
                typed(self, &|id, _| format!("${id}"))
            ),
            "go" => {
                let list = typed(self, &|id, kind| format!("{id} {kind}"));
                format!("func {name}({list}){}", after(self, " "))
            }
            "rust" => {
                let list = typed(self, &|id, kind| format!("{id}: {kind}"));
                format!("fn {name}({list}){}", after(self, " -> "))
            }
            "kotlin" => {
                let list = typed(self, &|id, kind| format!("{id}: {kind}"));
                format!("fun {name}({list}){}", after(self, ": "))
            }
            "swift" => {
                let list = typed(self, &|id, kind| format!("_ {id}: {kind}"));
                format!("func {name}({list}){}", after(self, " -> "))
            }
            "perl" => format!("sub {name}"),
            "scala" => format!(
                "def {name}({}): {returns} =",
                typed(self, &|id, kind| format!("{id}: {kind}"))
            ),
            "julia" => format!("function {name}({names})"),
            "r" => format!("{name} <- function({names})"),
            "csharp" | "java" => format!(
                "static {returns} {name}({})",
                typed(self, &|id, kind| format!("{kind} {id}"))
            ),
            _ => format!(
                "{returns} {name}({})",
                typed(self, &|id, kind| format!("{kind} {id}"))
            ),
        }
    }

    fn function_definition(&mut self, item: &Node) -> Result<()> {
        for text in item.texts("comments") {
            self.comment(&text);
        }
        let signature = self.signature(item);
        self.open_block(&signature);
        // Perl receives its arguments in @_.
        let parameters = item.nodes("parameters");
        if self.syntax.unpacked_parameters && !parameters.is_empty() {
            let names = parameters
                .iter()
                .map(|parameter| self.variable(parameter.str("name").unwrap_or_default()))
                .collect::<Vec<_>>();
            self.line(&format!("my ({}) = @_;", names.join(", ")));
        }
        self.body(field(item, "body")?)?;
        self.close_block();
        Ok(())
    }

    fn main_header(&self) -> Option<&'static str> {
        match self.id() {
            "c" => Some("int main(void)"),
            "cpp" => Some("int main()"),
            "go" => Some("func main()"),
            "rust" => Some("fn main()"),
            "kotlin" => Some("fun main()"),
            "csharp" => Some("static void Main()"),
            "java" => Some("public static void main(String[] args)"),
            "dart" => Some("void main()"),
            "scala" => Some("def main(args: Array[String]): Unit ="),
            "julia" => Some("function main()"),
            _ => None,
        }
    }

    fn program(mut self, program: &Node) -> Result<String> {
        let inside_class = self.syntax.entry_point == EntryPoint::ClassMethod;
        if inside_class {
            let container = self.syntax.container.unwrap_or(if self.id() == "csharp" {
                "class Program"
            } else {
                "class Main"
            });
            self.open_block(container);
        }
        for item in program.nodes("functions") {
            self.function_definition(item)?;
            self.line("");
        }
        for text in program.texts("mainComments") {
            self.comment(&text);
        }
        let main = field(program, "main")?;
        if let Some(header) = self.main_header() {
            self.open_block(header);
            self.body(main)?;
            self.close_block();
            // Julia calls its main function itself.
            if let Some(call) = self.syntax.call_main {
                self.line("");
                self.line(call);
            }
        } else {
            self.body(main)?;
        }
        if inside_class {
            self.close_block();
        }
        while self.lines.last().is_some_and(String::is_empty) {
            self.lines.pop();
        }
        let body = std::mem::take(&mut self.lines);
        // File comments come first, except where a header must open the file.
        if self.id() == "php" {
            self.lines.push("<?php".into());
            self.lines.push(String::new());
        }
        let comments = program.texts("comments");
        for text in &comments {
            self.comment(text);
        }
        if !comments.is_empty() {
            self.line("");
        }
        let mut all = std::mem::take(&mut self.lines);
        all.extend(self.prelude(program));
        all.extend(body);
        Ok(format!("{}\n", all.join("\n")))
    }

    fn prelude(&self, program: &Node) -> Vec<String> {
        let mut lines: Vec<String> = Vec::new();
        if self.id() == "go" {
            lines.push("package main".into());
            lines.push(String::new());
        }
        lines.extend(self.syntax.prelude.iter().map(|line| (*line).to_owned()));
        if self.uses.contains("dart:io") {
            lines.push("import 'dart:io';".into());
        }
        lines.extend(program.texts("libraryImports"));
        for (used, line) in [
            ("stdbool", "#include <stdbool.h>"),
            ("stdio", "#include <stdio.h>"),
            ("iostream", "#include <iostream>"),
            ("string", "#include <string>"),
            ("fmt", "import \"fmt\""),
        ] {
            if self.uses.contains(used) {
                lines.push(line.into());
            }
        }
        if lines.last().is_some_and(|line| !line.is_empty()) {
            lines.push(String::new());
        }
        lines
    }
}

/// Render a typed, adapted meta program in a language.
pub fn emit_program(program: &Node, language: &str) -> Result<String> {
    Emitter::new(language_syntax(language)?).program(program)
}
