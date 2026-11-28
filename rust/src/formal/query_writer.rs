//! Query emitters compose ordinary expressions, keeping deferred evaluation.
use super::emitter::{Emitter, Result, field};
use crate::meta::queries::rewrite_free;
use crate::meta::{GrammarError, Node, name, rewrite, walk};
use std::collections::HashSet;

fn pure(expression: &Node) -> bool {
    let mut result = true;
    walk(expression, |current| {
        if ![
            "Number",
            "Text",
            "Boolean",
            "Name",
            "Index",
            "Binary",
            "Unary",
            "ArrayLiteral",
            "Null",
            "SqlBinary",
            "SqlUnary",
            "SqlTruth",
        ]
        .contains(&current.kind.as_str())
        {
            result = false;
        }
    });
    result
}

pub(crate) fn merge_pure_queries(program: Node) -> Node {
    rewrite(program, |current| {
        let Some(inner) = current.node("source") else {
            return current;
        };
        if !current.is("Query")
            || !inner.is("Query")
            || inner.flag("eager") != Some(true)
            || current.flag("eager") != Some(true)
            || !current
                .node("condition")
                .is_some_and(|c| c.is("Boolean") && c.flag("value") == Some(true))
            || !inner
                .node("projection")
                .is_some_and(|p| p.is_name(inner.str("variable").unwrap_or_default()))
            || !inner.node("condition").is_some_and(pure)
            || !current.node("projection").is_some_and(pure)
        {
            return current;
        }
        let variable = current.str("variable").unwrap_or_default();
        let range = inner.str("variable").unwrap_or_default().to_owned();
        let (Some(projection), Some(source), Some(condition)) = (
            current.node("projection"),
            inner.node("source"),
            inner.node("condition"),
        ) else {
            return current;
        };
        let projection = rewrite_free(projection.clone(), variable, &mut |part| {
            if part.is_name(variable) {
                name(&range)
            } else {
                part
            }
        });
        let source = source.clone();
        let condition = condition.clone();
        current
            .with("source", source)
            .with("variable", range)
            .with("condition", condition)
            .with("projection", projection)
    })
}

pub(crate) fn csharp_query_names(program: Node) -> Node {
    let mut used = HashSet::new();
    let mut occupied = HashSet::new();
    let mut has_query = false;
    walk(&program, |current| {
        if let Some(name) = current.str("name") {
            occupied.insert(name.to_owned());
        }
        if current.is("Call") {
            occupied.insert(
                current
                    .str("callee")
                    .unwrap_or_default()
                    .split('.')
                    .next()
                    .unwrap_or_default()
                    .to_owned(),
            );
        }
        if ["Declaration", "Parameter", "Catch"].contains(&current.kind.as_str()) {
            used.insert(current.str("name").unwrap_or_default().to_owned());
        }
        if ["ForEach", "CountingLoop"].contains(&current.kind.as_str()) {
            used.insert(current.str("variable").unwrap_or_default().to_owned());
        }
        if current.is("Query") {
            has_query = true;
            occupied.insert(current.str("variable").unwrap_or_default().to_owned());
        }
        if current.is("Function") {
            for p in current.nodes("parameters") {
                used.insert(p.str("name").unwrap_or_default().to_owned());
            }
        }
    });
    if !has_query {
        return program;
    }
    rewrite(program, |mut current| {
        if !current.is("Query") {
            return current;
        }
        let variable = current.str("variable").unwrap_or_default().to_owned();
        if let Some(source) = current.node("source") {
            walk(source, |item| {
                if item.is_name(&variable) {
                    used.insert(variable.clone());
                }
            });
        }
        let mut fresh = variable.clone();
        let mut suffix = 2;
        while used.contains(&fresh) {
            fresh = format!("{variable}Query{suffix}");
            while occupied.contains(&fresh) {
                fresh.push('_');
            }
            suffix += 1;
        }
        used.insert(fresh.clone());
        occupied.insert(fresh.clone());
        if fresh != variable {
            for key in ["condition", "projection"] {
                if let Some(value) = current.node(key).cloned() {
                    current.set(
                        key,
                        rewrite_free(value, &variable, &mut |item| {
                            if item.is_name(&variable) {
                                name(&fresh)
                            } else if item.is("Call")
                                && item.str("callee").is_some_and(|c| {
                                    c == variable || c.starts_with(&format!("{variable}."))
                                })
                            {
                                let callee = format!(
                                    "{fresh}{}",
                                    &item.str("callee").unwrap_or_default()[variable.len()..]
                                );
                                item.with("callee", callee)
                            } else {
                                item
                            }
                        }),
                    );
                }
            }
            current.set("variable", fresh);
        }
        current
    })
}

pub(crate) fn type_name(e: &mut Emitter, meta: &str) -> Option<String> {
    if !["csharp", "typescript"].contains(&e.id()) {
        return None;
    }
    if meta == "object" {
        return Some(
            if e.id() == "csharp" {
                "object"
            } else {
                "unknown"
            }
            .into(),
        );
    }
    let (container, element) = meta.split_once('<')?;
    if !["array", "sequence"].contains(&container) {
        return None;
    }
    let element = e.type_name(element.strip_suffix('>')?);
    Some(if container == "array" {
        format!("{element}[]")
    } else if e.id() == "csharp" {
        format!("System.Collections.Generic.IEnumerable<{element}>")
    } else {
        format!("Iterable<{element}>")
    })
}

pub(crate) fn write_query(e: &mut Emitter, expression: &Node) -> Result<String> {
    let row = e.variable(expression.str("variable").unwrap_or_default());
    let source = field(expression, "source")?;
    let from = if e.id() == "csharp" && source.is("ArrayLiteral") {
        if source.nodes("elements").is_empty() {
            "new int[0]".into()
        } else {
            format!("new[] {}", e.expression(source)?)
        }
    } else {
        e.expression(source)?
    };
    let projection = field(expression, "projection")?;
    let mut selected = e.expression(projection)?;
    if e.id() == "csharp" && projection.is("ArrayLiteral") {
        selected = format!("new object[] {selected}");
    }
    let condition = field(expression, "condition")?;
    let filtered = !(condition.is("Boolean") && condition.flag("value") == Some(true));
    let predicate = if filtered {
        e.expression(condition)?
    } else {
        String::new()
    };
    let eager = expression.flag("eager").unwrap_or(true);
    match e.id() {
        "python" => {
            let filter = if filtered {
                format!(" if {predicate}")
            } else {
                String::new()
            };
            let body = format!("{selected} for {row} in {from}{filter}");
            Ok(if eager {
                format!("[{body}]")
            } else {
                format!("({body})")
            })
        }
        "javascript" | "typescript" => {
            if e.id() == "javascript" && e.syntax.for_each.is_none() {
                return Err(GrammarError::new(
                    "Query emission requires ECMAScript 2015 arrow functions",
                ));
            }
            if !eager {
                return Err(GrammarError::new(
                    "Deferred query emission requires a lazy iterator",
                ));
            }
            let filter = if filtered {
                format!(".filter({row} => {predicate})")
            } else {
                String::new()
            };
            Ok(format!("({from}){filter}.map({row} => {selected})"))
        }
        "csharp" => {
            e.uses.insert("System.Linq");
            let filter = if filtered {
                format!(" where {predicate}")
            } else {
                String::new()
            };
            Ok(format!(
                "(from {row} in {from}{filter} select {selected}){}",
                if eager {
                    ".ToArray()"
                } else {
                    ".AsEnumerable()"
                }
            ))
        }
        _ => Err(GrammarError::new(format!(
            "{} has no query emitter",
            e.syntax.label
        ))),
    }
}

pub(crate) fn write_lambda(e: &mut Emitter, expression: &Node) -> Result<String> {
    if !["javascript", "typescript"].contains(&e.id()) {
        return Err(GrammarError::new(format!(
            "{} has no lambda emitter",
            e.syntax.label
        )));
    }
    let parameters = expression
        .texts("parameters")
        .iter()
        .map(|p| e.variable(p))
        .collect::<Vec<_>>()
        .join(", ");
    Ok(format!(
        "({parameters}) => {}",
        e.expression(field(expression, "body")?)?
    ))
}
