//! SQL selection clauses preserve scoped row expressions.
use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Result, field};
use crate::formal::lexer::TokenType;
use crate::formal::parser::{Parsed, Parser};
use crate::meta::queries::query;
use crate::meta::{GrammarError, Node, name, rewrite, text};

pub(super) struct Sql;

// In SQLite, NOT binds below comparisons, BETWEEN and IN and above AND,
// including when it begins the right operand of another operation.
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

fn in_choices(p: &mut Parser) -> Parsed {
    p.expect("(")?;
    let mut choices = Vec::new();
    if !p.accept(")") {
        loop {
            choices.push(expression(p, 0)?);
            if !p.accept(",") {
                break;
            }
        }
        p.expect(")")?;
    }
    Ok(Node::new("ArrayLiteral").with("elements", choices))
}

fn negate_if(value: Node, negated: bool) -> Node {
    if negated {
        Node::new("SqlUnary")
            .with("operator", "not")
            .with("operand", value)
    } else {
        value
    }
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
        if minimum <= 4 {
            let negated = p.is("not") && (p.is_at("between", 1) || p.is_at("in", 1));
            if negated {
                p.position += 1;
            }
            if p.accept("between") {
                let lower = expression(p, 4)?;
                p.expect("and")?;
                let upper = expression(p, 5)?;
                let range = Node::new("SqlBetween")
                    .with("value", left)
                    .with("lower", lower)
                    .with("upper", upper);
                left = negate_if(range, negated);
                continue;
            }
            if p.accept("in") {
                let membership = Node::new("SqlIn")
                    .with("value", left)
                    .with("choices", in_choices(p)?);
                left = negate_if(membership, negated);
                continue;
            }
        }
        if minimum <= 4 && p.accept("is") {
            let negate = p.accept("not");
            let distinct = p.accept("distinct");
            if distinct {
                p.expect("from")?;
            }
            let operator = if negate != distinct { "isNot" } else { "is" };
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

fn identifier_parts(reference: &Node) -> Vec<String> {
    if reference.fields.contains_key("parts") {
        reference.texts("parts")
    } else {
        vec![reference.str("name").unwrap_or_default().into()]
    }
}

fn bind_columns(
    expression: Node,
    variable: &str,
    qualifiers: &[Vec<String>],
    line: usize,
) -> Parsed {
    let mut invalid = None;
    let bound = rewrite(expression, |current| {
        if !current.is("Name") {
            return current;
        }
        let mut parts = identifier_parts(&current);
        let field = parts.pop().unwrap_or_default();
        if !parts.is_empty()
            && !qualifiers.iter().any(|candidate| {
                candidate.len() == parts.len()
                    && candidate
                        .iter()
                        .zip(&parts)
                        .all(|(part, other)| part.eq_ignore_ascii_case(other))
            })
        {
            invalid.get_or_insert_with(|| parts.join("."));
        }
        Node::new("Index")
            .with("array", name(variable))
            .with("index", text(&field))
    });
    if let Some(qualifier) = invalid {
        return Err(GrammarError::syntax(
            format!("Unknown SQL column qualifier {qualifier}"),
            line,
        ));
    }
    Ok(bound)
}

fn range_variable(alias: Option<&str>) -> &str {
    alias
        .filter(|alias| {
            let mut bytes = alias.bytes();
            bytes
                .next()
                .is_some_and(|first| first.is_ascii_alphabetic() || first == b'_')
                && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        })
        .unwrap_or("row")
}

fn projection_list(p: &mut Parser) -> Parsed {
    let first = p.expression()?;
    if !p.accept(",") {
        return Ok(first);
    }
    let mut elements = vec![first];
    loop {
        elements.push(p.expression()?);
        if !p.accept(",") {
            break;
        }
    }
    Ok(Node::new("ArrayLiteral").with("elements", elements))
}

fn write_projection(e: &mut Emitter, projection: &Node, variable: &str) -> Result<String> {
    if projection.is_name(variable) {
        return Ok("*".into());
    }
    if projection.is("ArrayLiteral") {
        let elements = projection.nodes("elements");
        if elements.len() < 2 {
            return Err(GrammarError::new(
                "SQL row projections require at least two values",
            ));
        }
        if elements
            .iter()
            .any(|element| element.is("ArrayLiteral") || element.is_name(variable))
        {
            return Err(GrammarError::new(
                "SQL row projection fields must be scalar",
            ));
        }
        let values = elements
            .iter()
            .map(|element| e.expression(element))
            .collect::<Result<Vec<_>>>()?;
        return Ok(values.join(", "));
    }
    e.expression(projection)
}

impl ParserDialect for Sql {
    fn expression(&self, p: &mut Parser) -> Parsed {
        expression(p, 0)
    }

    fn item(&self, p: &mut Parser) -> Parsed {
        if p.kind(0) == TokenType::Comment {
            return p.base_item();
        }
        let line = p.current().line;
        p.expect("select")?;
        let projection = if p.accept("*") {
            None
        } else {
            Some(projection_list(p)?)
        };
        p.expect("from")?;
        let mut source = p.postfix()?;
        if !source.is("Name") {
            return Err(GrammarError::syntax("Expected a named SQL relation", line));
        }
        let alias = if p.accept("as") {
            Some(p.expect_name()?)
        } else {
            None
        };
        let variable = range_variable(alias.as_deref());
        let parts = identifier_parts(&source);
        let qualifiers = alias.as_ref().map_or_else(
            || {
                vec![
                    parts.clone(),
                    vec![parts.last().cloned().unwrap_or_default()],
                ]
            },
            |alias| vec![vec![alias.clone()]],
        );
        if source.fields.contains_key("parts") {
            source.kind = "SqlRelation".into();
            source.remove("name");
        }
        let bind = |node| bind_columns(node, variable, &qualifiers, line);
        let condition = if p.accept("where") {
            Some(Node::new("SqlTruth").with("operand", bind(p.expression()?)?))
        } else {
            None
        };
        let projection = projection
            .map(bind)
            .transpose()?
            .unwrap_or_else(|| name(variable));
        p.end_statement()?;
        Ok(Node::new("Evaluate").with(
            "expression",
            query(source, variable, projection, condition, true),
        ))
    }

    fn primary(&self, p: &mut Parser) -> Parsed {
        if p.accept("null") {
            return Ok(Node::new("Null"));
        }
        if p.kind(0) == TokenType::Name && !p.is("true") && !p.is("false") {
            let mut parts = vec![p.expect_name()?];
            while p.accept(".") {
                parts.push(p.expect_name()?);
            }
            return Ok(if parts.len() > 1 || parts[0].contains('.') {
                name(parts.join(".")).with("parts", parts)
            } else {
                name(&parts[0])
            });
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
            "SqlRelation" => {
                return Ok(expression
                    .texts("parts")
                    .iter()
                    .map(|part| identifier(part))
                    .collect::<Vec<_>>()
                    .join("."));
            }
            "SqlTruth" => {
                return Ok(format!(
                    "({}) IS TRUE",
                    e.expression(field(expression, "operand")?)?
                ));
            }
            "SqlBetween" => {
                return Ok(format!(
                    "({} BETWEEN {} AND {})",
                    e.expression(field(expression, "value")?)?,
                    e.expression(field(expression, "lower")?)?,
                    e.expression(field(expression, "upper")?)?
                ));
            }
            "SqlIn" => {
                let choices = field(expression, "choices")?;
                if !choices.is("ArrayLiteral") {
                    return Err(GrammarError::new(
                        "SQL IN requires a literal list of choices",
                    ));
                }
                let values = choices
                    .nodes("elements")
                    .iter()
                    .map(|choice| e.expression(choice))
                    .collect::<Result<Vec<_>>>()?;
                return Ok(format!(
                    "({} IN ({}))",
                    e.expression(field(expression, "value")?)?,
                    values.join(", ")
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
        let relation = match source.kind.as_str() {
            "Name" => table(source.str("name").unwrap_or_default()),
            "SqlRelation" => e.expression(source)?,
            _ => format!("({})", e.expression(source)?),
        };
        let variable = expression.str("variable").unwrap_or_default();
        let projection = field(expression, "projection")?;
        let selected = write_projection(e, projection, variable)?;
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
