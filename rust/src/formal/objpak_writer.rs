//! Render process arguments, numeric updates and the modeled Objpak set policy.
use super::emitter::{Emitter, Result, field};
use super::objpak_runtime;
use crate::meta::{GrammarError, Node, walk};
use std::collections::HashSet;

pub(crate) fn prepare(e: &mut Emitter, program: &Node) {
    let mut used = HashSet::new();
    walk(program, |current| {
        for key in ["name", "variable"] {
            if let Some(value) = current.str(key) {
                used.insert(value.to_owned());
            }
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
    });
    if e.syntax.id == "objc" {
        let mut count = "utNativeCount".to_owned();
        while used.contains(&count) {
            count.push('_');
        }
        let mut values = "utNativeArgs".to_owned();
        while used.contains(&values) {
            values.push('_');
        }
        let mut arguments = false;
        walk(program, |current| {
            if current.is("ProcessArguments") {
                arguments = true;
            }
        });
        let state = e.state::<super::objpak_objc::State>();
        state.count = count;
        state.values = values;
        state.arguments = arguments;
    }
    e.objpak_name = "UtObjpakSet".into();
    while used.contains(&e.objpak_name) {
        e.objpak_name.push('_');
    }
}

fn runtime(language: &str) -> Option<&'static str> {
    match language {
        "objc" => Some(objpak_runtime::OBJC),
        "python" => Some(objpak_runtime::PYTHON),
        "javascript" => Some(objpak_runtime::JAVASCRIPT),
        "rust" => Some(objpak_runtime::RUST),
        _ => None,
    }
}

pub(crate) fn expression(e: &mut Emitter, expression: &Node) -> Result<String> {
    match expression.kind.as_str() {
        "ProcessArguments" => {
            let include = expression.flag("includeProgram").unwrap_or(false);
            if e.syntax.id == "objc" {
                e.uses.insert("objpak-set");
                let state = e.state::<super::objpak_objc::State>();
                let (count, values) = (state.count.clone(), state.values.clone());
                return Ok(format!(
                    "{}({count}, {values}, {})",
                    e.objpak_name,
                    u8::from(include)
                ));
            }
            Ok(match e.id() {
                "python" => {
                    e.uses.insert("sys");
                    if include { "sys.argv" } else { "sys.argv[1:]" }.into()
                }
                "javascript" => format!("process.argv.slice({})", if include { 1 } else { 2 }),
                "rust" => format!(
                    "std::env::args(){}.collect::<Vec<String>>()",
                    if include { "" } else { ".skip(1)" }
                ),
                _ => {
                    return Err(GrammarError::new(
                        "Target has no command-line argument emitter",
                    ));
                }
            })
        }
        "Update" => {
            let operand = field(expression, "operand")?;
            if !operand.is("Name") {
                return Err(GrammarError::new(
                    "Update expressions require a numeric variable",
                ));
            }
            let variable = e.variable(operand.str("name").unwrap_or_default());
            let operator = match expression.number("delta") {
                Some(1.0) => "+",
                Some(-1.0) => "-",
                _ => return Err(GrammarError::new("Update expressions require a unit step")),
            };
            let prefix = expression.flag("prefix").unwrap_or(false);
            Ok(match e.id() {
                "python" => {
                    if matches!(e.syntax.version, Some("2" | "3.5")) {
                        return Err(GrammarError::new(
                            "Update expressions require Python 3.8 assignment expressions",
                        ));
                    }
                    let updated = format!("({variable} := {variable} {operator} 1)");
                    if prefix {
                        updated
                    } else {
                        format!("({updated} {} 1)", if operator == "+" { "-" } else { "+" })
                    }
                }
                "rust" => {
                    if prefix {
                        format!("{{ {variable} {operator}= 1; {variable} }}")
                    } else {
                        let previous = if variable == "previous" {
                            "previous_"
                        } else {
                            "previous"
                        };
                        format!(
                            "{{ let {previous} = {variable}; {variable} {operator}= 1; {previous} }}"
                        )
                    }
                }
                "c" | "cpp" | "csharp" | "java" | "javascript" | "typescript" => {
                    let step = operator.repeat(2);
                    if prefix {
                        format!("({step}{variable})")
                    } else {
                        format!("({variable}{step})")
                    }
                }
                _ => return Err(GrammarError::new("Target has no update expression emitter")),
            })
        }
        "SetLiteral" => {
            if expression.str("order") != Some("objpak-string")
                || !expression.nodes("elements").is_empty()
            {
                return Err(GrammarError::new(
                    "Objpak set emission requires an empty string set",
                ));
            }
            if e.syntax.id == "objc" {
                e.uses.insert("objpak");
                return Ok("[Set new]".into());
            }
            if runtime(e.id()).is_none() {
                return Err(GrammarError::new("Target has no Objpak set emitter"));
            }
            if e.id() == "javascript" && e.syntax.for_each.is_none() {
                return Err(GrammarError::new(
                    "Objpak set emission requires ECMAScript 2015",
                ));
            }
            e.uses.insert("objpak-set");
            Ok(match e.id() {
                "rust" => format!("{}::new()", e.objpak_name),
                "python" => format!("{}()", e.objpak_name),
                _ => format!("new {}()", e.objpak_name),
            })
        }
        "SetInsert" => {
            let collection = e.expression(field(expression, "collection")?)?;
            let value = e.expression(field(expression, "value")?)?;
            if e.syntax.id == "objc" {
                e.uses.insert("objpak");
                return Ok(format!("[{collection} add:[String str:{value}]]"));
            }
            Ok(format!(
                "{collection}.add({})",
                if e.id() == "rust" {
                    format!("({value}).to_owned()")
                } else {
                    value
                }
            ))
        }
        _ => Err(GrammarError::new("Unknown Objpak operation")),
    }
}

pub(crate) fn prelude(e: &Emitter, lines: &mut Vec<String>) {
    if e.syntax.id == "objc" && (e.uses.contains("objpak") || e.uses.contains("objpak-set")) {
        lines.extend(["#include <objpak.h>".into(), String::new()]);
    }
    if e.uses.contains("objpak-set")
        && let Some(runtime) = runtime(e.syntax.id)
    {
        lines.extend(
            runtime
                .replace("$SET$", &e.objpak_name)
                .trim_end()
                .lines()
                .map(str::to_owned),
        );
        lines.push(String::new());
    }
}
