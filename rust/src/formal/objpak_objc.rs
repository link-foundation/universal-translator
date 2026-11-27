//! Objective-C uses the original Objpak String/Set/OrdCltn operations.
use super::emitter::{Emitter, Result, field};
use crate::meta::Node;
use std::collections::HashSet;

#[derive(Default)]
pub(crate) struct State {
    pub arguments: bool,
    pub count: String,
    pub values: String,
    pub text_objects: HashSet<String>,
}

pub(crate) fn expression(e: &mut Emitter, value: &Node, parent: f64) -> Result<String> {
    match value.kind.as_str() {
        "Name"
            if e.state::<State>()
                .text_objects
                .contains(value.str("name").unwrap_or_default()) =>
        {
            Ok(format!(
                "[{} str]",
                e.variable(value.str("name").unwrap_or_default())
            ))
        }
        "Length" if value.node("array").and_then(|a| a.str("type")) == Some("array<text>") => {
            Ok(format!("[{} size]", e.expression(field(value, "array")?)?))
        }
        "Index" if value.node("array").and_then(|a| a.str("type")) == Some("array<text>") => {
            Ok(format!(
                "[[{} at:{}] str]",
                e.expression(field(value, "array")?)?,
                e.expression(field(value, "index")?)?
            ))
        }
        _ => e.base_expression_in(value, parent),
    }
}

pub(crate) fn declaration(e: &mut Emitter, statement: &Node) -> Result<String> {
    if matches!(statement.str("type"), Some("set<text>" | "array<text>")) {
        return Ok(format!(
            "id {} = {};",
            e.variable(statement.str("name").unwrap_or_default()),
            e.expression(field(statement, "value")?)?
        ));
    }
    e.base_declaration(statement)
}

pub(crate) fn main(e: &mut Emitter, program: &Node) -> Result<()> {
    let state = e.state::<State>();
    let header = if state.arguments {
        format!("int main(int {}, char **{})", state.count, state.values)
    } else {
        "int main(void)".to_owned()
    };
    e.comments(program, "mainComments");
    e.open_block(&header);
    e.body(field(program, "main")?)?;
    // POC compiles as C89, where falling off main has no defined exit status.
    e.line("return 0;");
    e.close_block();
    Ok(())
}

pub(crate) fn for_each(e: &mut Emitter, statement: &Node) -> Result<()> {
    let variable = statement.str("variable").unwrap_or_default();
    let array = e.expression(field(statement, "array")?)?;
    e.line(&format!("[{array} do:{{ :{} |", e.variable(variable)));
    e.depth += 1;
    let previous = e.state::<State>().text_objects.clone();
    e.state::<State>().text_objects.insert(variable.to_owned());
    let result = e.body(field(statement, "body")?);
    e.state::<State>().text_objects = previous;
    e.depth -= 1;
    e.line("}];");
    result
}
