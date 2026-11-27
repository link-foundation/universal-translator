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

fn expression(p: &mut Parser, minimum: usize) -> Parsed {
    let mut left = if p.accept("not") {
        Node::new("Unary")
            .with("operator", "not")
            .with("operand", expression(p, 3)?)
    } else if p.accept("-") {
        let operand = expression(p, 8)?;
        if operand.is("Number") {
            let value = -operand.number("value").unwrap_or_default();
            operand.with("value", value)
        } else {
            Node::new("Unary")
                .with("operator", "negate")
                .with("operand", operand)
        }
    } else {
        p.postfix()?
    };
    loop {
        let Some(&(_, operator, level)) = OPERATORS.iter().find(|(spelling, _, _)| p.is(spelling))
        else {
            return Ok(left);
        };
        if level < minimum {
            return Ok(left);
        }
        p.position += 1;
        left = Node::new("Binary")
            .with("operator", operator)
            .with("left", left)
            .with("right", expression(p, level + 1)?);
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
                condition.map(|c| row_members(c, &variable, true)),
                true,
            ),
        ))
    }

    fn primary(&self, p: &mut Parser) -> Parsed {
        if p.current().quote == Some('"') {
            return Ok(name(p.next_value()?));
        }
        if p.is("null") {
            return Err(GrammarError::syntax(
                "SQL NULL expressions require three-valued logic",
                p.current().line,
            ));
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
            format!(" WHERE {}", e.expression(condition)?)
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
