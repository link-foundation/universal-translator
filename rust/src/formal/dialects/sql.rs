//! SQL selection clauses preserve scoped row expressions.
use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Result, field};
use crate::formal::lexer::TokenType;
use crate::formal::parser::{Parsed, Parser};
use crate::meta::queries::{query, row_members};
use crate::meta::{GrammarError, Node, name};

pub(super) struct Sql;

// SQL's NOT binds below comparisons and above AND, including when it
// begins the right operand of another operation.
const OPERATORS: &[(&str, &str, usize)] = &[
    ("or", "or", 1),
    ("and", "and", 2),
    ("=", "equal", 4),
    ("==", "equal", 4),
    ("<>", "notEqual", 4),
    ("!=", "notEqual", 4),
    ("<", "less", 5),
    ("<=", "lessOrEqual", 5),
    (">", "greater", 5),
    (">=", "greaterOrEqual", 5),
    ("+", "add", 6),
    ("-", "subtract", 6),
    ("*", "multiply", 7),
    ("/", "divide", 7),
    ("%", "remainder", 7),
];

fn real_expression(part: &Node) -> bool {
    part.str("type") == Some("real")
        || part.str("operator") == Some("realDivide")
        || (part.is("SqlUnary")
            && part.str("operator") == Some("negate")
            && part.node("operand").is_some_and(real_expression))
        || (part.is("SqlBinary")
            && matches!(
                part.str("operator"),
                Some("add" | "subtract" | "multiply" | "remainder")
            )
            && (part.node("left").is_some_and(real_expression)
                || part.node("right").is_some_and(real_expression)))
}

fn expression(p: &mut Parser, minimum: usize) -> Parsed {
    let mut left = if p.accept("not") {
        Node::new("SqlUnary")
            .with("operator", "not")
            .with("operand", expression(p, 3)?)
    } else if p.accept("-") {
        let operand = expression(p, 8)?;
        if operand.is("Number") {
            let value = -operand.number("value").unwrap_or_default();
            operand.with("value", value)
        } else {
            Node::new("SqlUnary")
                .with("operator", "negate")
                .with("operand", operand)
        }
    } else {
        p.postfix()?
    };
    loop {
        if minimum <= 4 && p.accept("is") {
            let operator = if p.accept("not") { "isNot" } else { "is" };
            let right = expression(p, 5)?;
            left = if right.is("Boolean") {
                Node::new("SqlUnary")
                    .with(
                        "operator",
                        format!(
                            "{operator}{}",
                            if right.flag("value") == Some(true) {
                                "True"
                            } else {
                                "False"
                            }
                        ),
                    )
                    .with("operand", left)
            } else {
                Node::new("SqlBinary")
                    .with("operator", operator)
                    .with("left", left)
                    .with("right", right)
            };
            continue;
        }
        let Some(&(_, operator, level)) = OPERATORS.iter().find(|(spelling, _, _)| p.is(spelling))
        else {
            return Ok(left);
        };
        if level < minimum {
            return Ok(left);
        }
        p.position += 1;
        let right = expression(p, level + 1)?;
        let operator =
            if operator == "divide" && (real_expression(&left) || real_expression(&right)) {
                "realDivide"
            } else {
                operator
            };
        left = Node::new("SqlBinary")
            .with("operator", operator)
            .with("left", left)
            .with("right", right);
    }
}

fn identifier(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}
fn table(value: &str) -> String {
    value
        .split('.')
        .map(identifier)
        .collect::<Vec<_>>()
        .join(".")
}

impl ParserDialect for Sql {
    fn expression(&self, p: &mut Parser) -> Parsed {
        expression(p, 0)
    }

    fn item(&self, p: &mut Parser) -> Parsed {
        if p.kind(0) == TokenType::Comment {
            return p.base_item();
        }
        p.expect("select")?;
        let projection = if p.accept("*") {
            None
        } else {
            Some(p.expression()?)
        };
        p.expect("from")?;
        let source = p.postfix()?;
        let variable = if p.accept("as") {
            p.expect_name()?
        } else {
            "row".into()
        };
        let condition = if p.accept("where") {
            Some(p.expression()?)
        } else {
            None
        };
        p.end_statement()?;
        Ok(Node::new("Evaluate").with(
            "expression",
            query(
                source,
                &variable,
                projection.map_or_else(|| name(&variable), |p| row_members(p, &variable, true)),
                condition.map(|c| {
                    Node::new("SqlTruth").with("operand", row_members(c, &variable, true))
                }),
                true,
            ),
        ))
    }

    fn primary(&self, p: &mut Parser) -> Parsed {
        if p.current().quote == Some('"') {
            return Ok(name(p.next_value()?));
        }
        if p.accept("null") {
            return Ok(Node::new("Null"));
        }
        p.base_primary()
    }
}

impl EmitterDialect for Sql {
    fn unary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        if expression.str("operator") == Some("not") {
            Ok(format!(
                "(NOT ({}))",
                e.expression(field(expression, "operand")?)?
            ))
        } else {
            e.base_unary(expression, parent)
        }
    }

    fn quote(&self, _e: &Emitter, value: &str) -> String {
        format!("'{}'", value.replace('\'', "''"))
    }

    fn expression_in(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        match expression.kind.as_str() {
            "Null" => return Ok("NULL".into()),
            "SqlTruth" => {
                return Ok(format!(
                    "({}) IS TRUE",
                    e.expression(field(expression, "operand")?)?
                ));
            }
            "SqlUnary" => {
                let truth = match expression.str("operator") {
                    Some("isTrue") => Some("IS TRUE"),
                    Some("isFalse") => Some("IS FALSE"),
                    Some("isNotTrue") => Some("IS NOT TRUE"),
                    Some("isNotFalse") => Some("IS NOT FALSE"),
                    _ => None,
                };
                if let Some(truth) = truth {
                    return Ok(format!(
                        "({} {truth})",
                        e.expression(field(expression, "operand")?)?
                    ));
                }
                let operator = match expression.str("operator") {
                    Some("not") => "NOT ",
                    Some("negate") => "-",
                    _ => return Err(GrammarError::new("Unknown SQL unary operation")),
                };
                return Ok(format!(
                    "({operator}({}))",
                    e.expression(field(expression, "operand")?)?
                ));
            }
            "SqlBinary" => {
                let operator = expression.str("operator").unwrap_or_default();
                if matches!(operator, "is" | "isNot") {
                    let not = if operator == "isNot" { " NOT" } else { "" };
                    return Ok(format!(
                        "({} IS{not} {})",
                        e.expression(field(expression, "left")?)?,
                        e.expression(field(expression, "right")?)?
                    ));
                }
                let mut binary = expression.clone();
                binary.kind = "Binary".into();
                if operator == "realDivide" {
                    binary.set("operator", "divide");
                }
                return Ok(format!("({})", e.base_binary(&binary, 0.0)?));
            }
            _ => {}
        }
        if expression.is("Name") {
            return Ok(table(expression.str("name").unwrap_or_default()));
        }
        if expression.is("Index")
            && field(expression, "index")?.is("Text")
            && field(expression, "array")?.is("Name")
        {
            return Ok(format!(
                "{}.{}",
                identifier(field(expression, "array")?.str("name").unwrap_or_default()),
                identifier(field(expression, "index")?.str("value").unwrap_or_default())
            ));
        }
        if !expression.is("Query") {
            return e.base_expression_in(expression, parent);
        }
        if expression.flag("eager") == Some(false) {
            return Err(GrammarError::new(
                "SQL selection execution cannot preserve a deferred iterator",
            ));
        }
        let source = field(expression, "source")?;
        let relation = if source.is("Name") {
            table(source.str("name").unwrap_or_default())
        } else {
            format!("({})", e.expression(source)?)
        };
        let variable = expression.str("variable").unwrap_or_default();
        let projection = field(expression, "projection")?;
        let selected = if projection.is("Name") && projection.str("name") == Some(variable) {
            "*".into()
        } else {
            e.expression(projection)?
        };
        let condition = field(expression, "condition")?;
        let filter = if condition.is("Boolean") && condition.flag("value") == Some(true) {
            String::new()
        } else {
            format!(
                " WHERE {}",
                e.expression(if condition.is("SqlTruth") {
                    field(condition, "operand")?
                } else {
                    condition
                })?
            )
        };
        Ok(format!(
            "SELECT {selected} FROM {relation} AS {}{filter}",
            identifier(variable)
        ))
    }

    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        let main = field(program, "main")?;
        if !program.nodes("functions").is_empty()
            || main.nodes("statements").iter().any(|item| {
                !["Comment", "Blank"].contains(&item.kind.as_str())
                    && !(item.is("Evaluate")
                        && item.node("expression").is_some_and(|p| p.is("Query")))
            })
        {
            return Err(GrammarError::new("SQL requires selection queries"));
        }
        e.comments(program, "comments");
        for item in main.nodes("statements") {
            e.statement(item)?;
        }
        Ok(if e.lines.is_empty() {
            String::new()
        } else {
            format!("{}\n", e.lines.join("\n"))
        })
    }
}
