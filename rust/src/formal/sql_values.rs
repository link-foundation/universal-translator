//! Verified SQL value helpers preserve NULL propagation and WHERE truth.
use super::emitter::{Emitter, Result, field};
use super::languages::Syntax;
use super::objpak_reader::{LibrarySource, library_end, top_level};
use crate::meta::{GrammarError, Node, Settings, rewrite, sql_values, walk};
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

static RUNTIMES: LazyLock<HashMap<String, String>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../data/runtime/sql-values.json"))
        .expect("SQL runtime data")
});

static BETWEEN_METHODS: LazyLock<HashMap<String, String>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../data/runtime/sql-between.json"))
        .expect("SQL range runtime data")
});

static IN_METHODS: LazyLock<HashMap<String, String>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../data/runtime/sql-in.json"))
        .expect("SQL membership runtime data")
});

fn extended_runtime(id: &str, base: &str, membership: bool) -> String {
    let header_end = base.find('\n').expect("SQL runtime class header") + 1;
    let (header, body) = base.split_at(header_end);
    let in_method = if membership { &IN_METHODS[id] } else { "" };
    format!("{header}{}{in_method}{body}", BETWEEN_METHODS[id])
}

pub(crate) fn prepare_source(
    source: &str,
    syntax: &Syntax,
) -> (LibrarySource, Vec<String>, Vec<String>) {
    let mut library = LibrarySource {
        bindings: vec![],
        definitions: vec![],
    };
    let mut between_bindings = vec![];
    let mut in_bindings = vec![];
    let Some(runtime) = RUNTIMES.get(syntax.id) else {
        return (library, between_bindings, in_bindings);
    };
    let prefix = if syntax.id == "csharp" {
        "static class UtSqlValue"
    } else {
        "class UtSqlValue"
    };
    for (start, _) in source.match_indices(prefix) {
        let name_start = start + prefix.len() - "UtSqlValue".len();
        let name_end = source[name_start..]
            .find(|c: char| !c.is_ascii_alphanumeric() && c != '_')
            .map_or(source.len(), |n| name_start + n);
        let binding = &source[name_start..name_end];
        if !binding
            .strip_prefix("UtSqlValue")
            .is_some_and(|s| s.chars().all(|c| c == '_'))
            || !top_level(source, start, syntax)
        {
            continue;
        }
        let match_end = |definition: &str| {
            library_end(source, start, &definition.replace("$SQL$", binding), syntax)
        };
        let membership_end = match_end(&extended_runtime(syntax.id, runtime, true));
        let extended_end =
            membership_end.or_else(|| match_end(&extended_runtime(syntax.id, runtime, false)));
        let Some(end) = extended_end.or_else(|| match_end(runtime)) else {
            continue;
        };
        library.bindings.push(binding.into());
        if extended_end.is_some() {
            between_bindings.push(binding.into());
        }
        if membership_end.is_some() {
            in_bindings.push(binding.into());
        }
        library.definitions.push((start, end));
    }
    (library, between_bindings, in_bindings)
}

fn membership_node(args: &[&Node]) -> Option<Node> {
    let mut operands = args.iter().map(|argument| {
        if argument.is("Lambda") && argument.texts("parameters").is_empty() {
            argument.node("body").cloned()
        } else {
            None
        }
    });
    let value = operands.next()??;
    let choices = operands.collect::<Option<Vec<_>>>()?;
    Some(Node::new("SqlIn").with("value", value).with(
        "choices",
        Node::new("ArrayLiteral").with("elements", choices),
    ))
}

fn method_node(
    call: Node,
    bindings: &HashSet<String>,
    between_bindings: &HashSet<String>,
    in_bindings: &HashSet<String>,
) -> Node {
    if !call.is("Call") {
        return call;
    }
    let Some((receiver, method)) = call.str("callee").and_then(|c| c.rsplit_once('.')) else {
        return call;
    };
    if !bindings.contains(receiver) {
        return call;
    }
    let args = call.nodes("arguments");
    let result = match (method, args.as_slice()) {
        ("nullValue", []) => Some(Node::new("Null")),
        ("isTrue", [operand]) => Some(Node::new("SqlTruth").with("operand", (*operand).clone())),
        ("between", [value, lower, upper]) if between_bindings.contains(receiver) => Some(
            Node::new("SqlBetween")
                .with("value", (*value).clone())
                .with("lower", (*lower).clone())
                .with("upper", (*upper).clone()),
        ),
        ("inValues", args) if in_bindings.contains(receiver) => membership_node(args),
        ("unary", [operator, operand])
            if operator.is("Text") && operator.str("value").is_some_and(sql_values::unary) =>
        {
            Some(
                Node::new("SqlUnary")
                    .with("operator", operator.str("value").unwrap_or_default())
                    .with("operand", (*operand).clone()),
            )
        }
        ("binary", [operator, left, right])
            if operator.is("Text") && operator.str("value").is_some_and(sql_values::binary) =>
        {
            Some(
                Node::new("SqlBinary")
                    .with("operator", operator.str("value").unwrap_or_default())
                    .with("left", (*left).clone())
                    .with("right", (*right).clone()),
            )
        }
        _ => None,
    };
    result.map_or(call.clone(), |mut result| {
        result.origin = call.origin.clone();
        result
    })
}

pub(crate) fn validate_bindings(program: &Node) -> Result<()> {
    let recorded = program.texts("sqlValueBindings");
    let count = recorded.len();
    let bindings: HashSet<String> = recorded.into_iter().collect();
    if bindings.is_empty() {
        return Ok(());
    }
    let between_bindings = program.texts("sqlBetweenBindings").into_iter().collect();
    let in_bindings = program.texts("sqlInBindings").into_iter().collect();
    let mut invalid = bindings.len() != count;
    walk(program, |current| {
        if [
            "Declaration",
            "Assignment",
            "Function",
            "Parameter",
            "Catch",
            "Name",
        ]
        .contains(&current.kind.as_str())
            && bindings.contains(
                current
                    .str("name")
                    .unwrap_or_default()
                    .split('.')
                    .next()
                    .unwrap_or_default(),
            )
        {
            invalid = true;
        }
        if current
            .str("variable")
            .is_some_and(|v| bindings.contains(v))
        {
            invalid = true;
        }
        if current.is("Function")
            && current
                .nodes("parameters")
                .iter()
                .any(|p| p.str("name").is_some_and(|n| bindings.contains(n)))
        {
            invalid = true;
        }
        if current.is("Lambda")
            && current
                .texts("parameters")
                .iter()
                .any(|p| bindings.contains(p))
        {
            invalid = true;
        }
        if current.is("Call")
            && current
                .str("callee")
                .is_some_and(|c| bindings.contains(c.split('.').next().unwrap_or_default()))
            && method_node(current.clone(), &bindings, &between_bindings, &in_bindings).is("Call")
        {
            invalid = true;
        }
    });
    if invalid {
        Err(GrammarError::new(
            "SQL value library binding or call has no verified contract",
        ))
    } else {
        Ok(())
    }
}

pub(crate) fn recognize(mut program: Node, _: &Settings) -> Node {
    let mut bindings: HashSet<String> = program.texts("sqlValueBindings").into_iter().collect();
    if bindings.is_empty() {
        return program;
    }
    let between_bindings = program.texts("sqlBetweenBindings").into_iter().collect();
    let in_bindings = program.texts("sqlInBindings").into_iter().collect();
    program.remove("sqlValueBindings");
    program.remove("sqlBetweenBindings");
    program.remove("sqlInBindings");
    walk(&program, |current| {
        if [
            "Declaration",
            "Assignment",
            "Function",
            "Parameter",
            "Catch",
            "Name",
        ]
        .contains(&current.kind.as_str())
        {
            bindings.remove(current.str("name").unwrap_or_default());
        }
        if let Some(variable) = current.str("variable") {
            bindings.remove(variable);
        }
        if current.is("Function") {
            for p in current.nodes("parameters") {
                bindings.remove(p.str("name").unwrap_or_default());
            }
        }
        if current.is("Lambda") {
            for p in current.texts("parameters") {
                bindings.remove(&p);
            }
        }
    });
    super::query_writer::merge_pure_queries(rewrite(program, |current| {
        method_node(current, &bindings, &between_bindings, &in_bindings)
    }))
}

pub(crate) fn prepare_emitter(e: &mut Emitter, program: &Node) {
    let mut used = HashSet::new();
    walk(program, |current| {
        if let Some(name) = current.str("name") {
            used.insert(name.to_owned());
        }
        if let Some(variable) = current.str("variable") {
            used.insert(variable.to_owned());
        }
        if current.is("Call") {
            used.insert(
                current
                    .str("callee")
                    .unwrap_or_default()
                    .split('.')
                    .next()
                    .unwrap_or_default()
                    .to_owned(),
            );
        }
        if current.is("Function") {
            for p in current.nodes("parameters") {
                used.insert(p.str("name").unwrap_or_default().to_owned());
            }
        }
        if current.is("Lambda") {
            used.extend(current.texts("parameters"));
        }
    });
    e.sql_value_name = "UtSqlValue".into();
    while used.contains(&e.sql_value_name) {
        e.sql_value_name.push('_');
    }
}

fn operand(e: &mut Emitter, value: &Node) -> Result<String> {
    if value.is("Number")
        && value.str("type") == Some("real")
        && matches!(e.id(), "javascript" | "typescript")
    {
        Ok(super::numbers::real_text(
            value.number("value").unwrap_or_default(),
        ))
    } else {
        e.expression(value)
    }
}

fn in_arguments(e: &mut Emitter, expression: &Node) -> Result<Vec<String>> {
    let choices = field(expression, "choices")?;
    if !choices.is("ArrayLiteral") {
        return Err(GrammarError::new(
            "SQL IN requires a literal list of choices",
        ));
    }
    e.uses.insert("sql-in");
    let thunk = if e.id() == "python" {
        "lambda:"
    } else {
        "() =>"
    };
    std::iter::once(field(expression, "value")?)
        .chain(choices.nodes("elements"))
        .map(|value| Ok(format!("{thunk} {}", operand(e, value)?)))
        .collect()
}

pub(crate) fn expression(e: &mut Emitter, expression: &Node) -> Result<String> {
    if !RUNTIMES.contains_key(e.id()) {
        return Err(GrammarError::new(format!(
            "{} has no SQL value emitter",
            e.syntax.label
        )));
    }
    if e.id() == "javascript" && e.syntax.for_each.is_none() {
        return Err(GrammarError::new(
            "SQL values require ECMAScript 2015 classes",
        ));
    }
    e.uses.insert("sql-values");
    let operator = expression.str("operator").unwrap_or_default();
    let (method, args) = match expression.kind.as_str() {
        "Null" => ("nullValue", vec![]),
        "SqlTruth" => ("isTrue", vec![operand(e, field(expression, "operand")?)?]),
        "SqlBetween" => (
            "between",
            vec![
                operand(e, field(expression, "value")?)?,
                operand(e, field(expression, "lower")?)?,
                operand(e, field(expression, "upper")?)?,
            ],
        ),
        "SqlIn" => ("inValues", in_arguments(e, expression)?),
        "SqlUnary" if sql_values::unary(operator) => (
            "unary",
            vec![
                e.quote(operator),
                operand(e, field(expression, "operand")?)?,
            ],
        ),
        "SqlBinary" if sql_values::binary(operator) => (
            "binary",
            vec![
                e.quote(operator),
                operand(e, field(expression, "left")?)?,
                operand(e, field(expression, "right")?)?,
            ],
        ),
        _ => return Err(GrammarError::new("Unknown SQL value operation")),
    };
    Ok(format!(
        "{}.{method}({})",
        e.sql_value_name,
        args.join(", ")
    ))
}

pub(crate) fn prelude(e: &Emitter, lines: &mut Vec<String>) {
    if e.uses.contains("sql-values")
        && let Some(runtime) = RUNTIMES.get(e.id())
    {
        lines.extend(
            extended_runtime(e.id(), runtime, e.uses.contains("sql-in"))
                .replace("$SQL$", &e.sql_value_name)
                .trim_end()
                .lines()
                .map(str::to_owned),
        );
        lines.push(String::new());
    }
}
