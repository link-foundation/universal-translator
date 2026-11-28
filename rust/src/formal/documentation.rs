//! Runtime documentation is distinct from comments and follows its source edition.
use super::emitter::Emitter;
use crate::meta::{GrammarError, Node, Settings};

pub(crate) fn clean_documentation(value: &str) -> String {
    let expanded: Vec<String> = value
        .split('\n')
        .map(|line| {
            let mut result = String::new();
            let mut column = 0;
            for character in line.chars() {
                if character == '\t' {
                    let width = 8 - column % 8;
                    result.push_str(&" ".repeat(width));
                    column += width;
                } else {
                    result.push(character);
                    column = if character == '\r' { 0 } else { column + 1 };
                }
            }
            result
        })
        .collect();
    let margin = expanded
        .iter()
        .skip(1)
        .filter(|line| line.bytes().any(|character| character != b' '))
        .map(|line| line.len() - line.trim_start_matches(' ').len())
        .min()
        .unwrap_or(0);
    expanded
        .iter()
        .enumerate()
        .map(|(index, line)| {
            let spaces = line.len() - line.trim_start_matches(' ').len();
            &line[if index == 0 {
                spaces
            } else {
                spaces.min(margin)
            }..]
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn modern_docstrings(from: &str) -> bool {
    let Some((_, version)) = from.split_once('@') else {
        return true;
    };
    let mut parts = version.split('.');
    let Some(major) = parts.next().and_then(|part| part.parse::<u32>().ok()) else {
        return true;
    };
    let minor = parts.next().and_then(|part| part.parse::<u32>().ok());
    major > 3 || major == 3 && minor.is_none_or(|minor| minor >= 13)
}

fn python_documentation(mut item: Node, modern: bool) -> Node {
    if !item.is("Function") {
        return item;
    }
    let Some(body) = item.node("body") else {
        return item;
    };
    let mut body = body.clone();
    let mut statements = body.node_list("statements");
    let first = statements
        .iter()
        .position(|statement| !matches!(statement.kind.as_str(), "Comment" | "Blank"));
    if let Some(first) = first
        && statements[first].is("Evaluate")
        && let Some(value) = statements[first]
            .node("expression")
            .filter(|value| value.is("Text"))
    {
        let mut documentation = value.clone();
        if modern {
            documentation.set(
                "value",
                clean_documentation(value.str("value").unwrap_or_default()),
            );
        }
        item.set("documentation", documentation);
        statements.remove(first);
        body.set("statements", statements);
        item.set("body", body);
    }
    item
}

fn adjacent_documentation(previous: &Node, item: &Node) -> bool {
    previous.is("Function")
        && item.is("PropertyAssignment")
        && item.str("property") == Some("__doc__")
        && item.node("value").is_some_and(|value| value.is("Text"))
        && item
            .node("object")
            .is_some_and(|object| object.is("Name") && object.str("name") == previous.str("name"))
}

pub(crate) fn recognize_documentation(mut source: Node, settings: &Settings) -> Node {
    let language = settings.from.split('@').next().unwrap_or_default();
    let python = language == "python";
    if !python && !matches!(language, "javascript" | "typescript") {
        return source;
    }
    let mut items: Vec<Node> = Vec::new();
    for item in source.node_list("items") {
        if let Some(previous) = items.last_mut()
            && adjacent_documentation(previous, &item)
        {
            previous.set("documentation", item.node("value").unwrap().clone());
        } else {
            items.push(if python {
                python_documentation(item, modern_docstrings(&settings.from))
            } else {
                item
            });
        }
    }
    source.set("items", items);
    source
}

pub(crate) fn write_assignment(emitter: &mut Emitter, item: &Node) -> Result<(), GrammarError> {
    let Some(documentation) = item.node("documentation") else {
        return Ok(());
    };
    let value = documentation.str("value").unwrap_or_default();
    let python = emitter.id() == "python";
    if (python && clean_documentation(value) != value)
        || matches!(emitter.id(), "javascript" | "typescript")
    {
        let written = emitter.expression(documentation)?;
        let end = if python { "" } else { ";" };
        emitter.line(&format!(
            "{}.__doc__ = {written}{end}",
            emitter.variable(item.str("name").unwrap_or_default())
        ));
    }
    Ok(())
}
