//! Introspection questions keep their aspect and subject across readers.
use std::collections::{HashMap, HashSet};

use super::emitter::Emitter;
use crate::meta::{GrammarError, Node, Settings, name, rewrite, walk};

fn bindings(tree: &Node, initial: impl IntoIterator<Item = String>) -> HashSet<String> {
    let mut names: HashSet<_> = initial.into_iter().collect();
    walk(tree, |current| {
        let key = match current.kind.as_str() {
            "Declaration" | "Assignment" | "Catch" => "name",
            "ForEach" | "CountingLoop" => "variable",
            _ => return,
        };
        if let Some(value) = current.str(key) {
            names.insert(value.to_owned());
        }
    });
    names
}

fn imported_bindings(imports: &[String]) -> HashMap<String, String> {
    let mut bindings = HashMap::new();
    for line in imports {
        let (module, members) = if let Some(rest) = line.strip_prefix("from ") {
            let Some((module, members)) = rest.split_once(" import ") else {
                continue;
            };
            (Some(module), members)
        } else if let Some(members) = line.strip_prefix("import ") {
            (None, members)
        } else {
            continue;
        };
        for member in members.split(',') {
            let (original, alias) = member
                .trim()
                .split_once(" as ")
                .map_or((member.trim(), None), |(original, alias)| {
                    (original, Some(alias))
                });
            let local = alias.unwrap_or_else(|| original.split('.').next().unwrap_or(original));
            let qualified = module.map_or_else(
                || original.to_owned(),
                |module| format!("{module}.{original}"),
            );
            bindings.insert(local.to_owned(), qualified);
        }
    }
    bindings
}

fn question(aspect: &str, subject: Node) -> Node {
    Node::new("Question")
        .with("aspect", aspect)
        .with("subject", subject)
}

fn property_subject(current: &Node, property: &str) -> Option<Node> {
    if current.is("Name") {
        return current
            .str("name")?
            .strip_suffix(&format!(".{property}"))
            .map(name);
    }
    if current.is("Method") && current.str("name") == Some(property) {
        return current.node("receiver").cloned();
    }
    None
}

fn python_question(current: Node, shadowed: &HashSet<String>, readers: &HashSet<String>) -> Node {
    if let Some(subject) = property_subject(&current, "__doc__") {
        return question("documentation", subject);
    }
    if !current.is("Call") {
        return current;
    }
    let args = current.nodes("arguments");
    let callee = current.str("callee").unwrap_or_default();
    if args.len() == 1 {
        if callee == "type" && !shadowed.contains("type") {
            return question("type", args[0].clone());
        }
        if readers.contains(callee) {
            return question("source", args[0].clone());
        }
    }
    if callee == ".run_line_magic"
        && !shadowed.contains("get_ipython")
        && args.len() == 3
        && args[0].is("Call")
        && args[0].str("callee") == Some("get_ipython")
        && args[0].nodes("arguments").is_empty()
        && args[1].is("Text")
        && args[1].str("value") == Some("pinfo2")
        && args[2].is("Text")
        && args[2].str("value").is_some_and(valid_subject)
    {
        return question("details", name(args[2].str("value").unwrap()));
    }
    current
}

fn valid_subject(value: &str) -> bool {
    value.split('.').all(|part| {
        !part.is_empty()
            && part.chars().enumerate().all(|(at, c)| {
                c == '_'
                    || if at == 0 {
                        c.is_alphabetic()
                    } else {
                        c.is_alphanumeric()
                    }
            })
    })
}

fn javascript_question(current: Node, shadowed: &HashSet<String>) -> Node {
    if let Some(subject) = property_subject(&current, "__doc__") {
        return question("documentation", subject);
    }
    if current.is("Call")
        && current.str("callee") == Some("Function.prototype.toString.call")
        && current.nodes("arguments").len() == 1
        && !shadowed.contains("Function")
    {
        return question("source", current.nodes("arguments")[0].clone());
    }
    if current.is("Method")
        && current.str("name") == Some("constructor")
        && !shadowed.contains("Object")
        && let Some(receiver) = current.node("receiver")
        && receiver.is("Call")
        && receiver.str("callee") == Some("Object.getPrototypeOf")
        && receiver.nodes("arguments").len() == 1
    {
        return question("type", receiver.nodes("arguments")[0].clone());
    }
    current
}

pub(crate) fn recognize_questions(mut program: Node, settings: &Settings) -> Node {
    let language = settings.from.split('@').next().unwrap_or_default();
    let python = language == "python";
    if !python && !matches!(language, "javascript" | "typescript") {
        return program;
    }
    let functions = program.node_list("functions");
    let global = bindings(
        program.node("main").unwrap(),
        functions
            .iter()
            .filter_map(|item| item.str("name").map(str::to_owned)),
    );
    let imports = imported_bindings(&program.texts("imports"));
    let apply = |tree, shadowed: HashSet<String>| {
        let readers = imports
            .iter()
            .filter(|(local, _)| !shadowed.contains(*local))
            .filter_map(|(local, qualified)| match qualified.as_str() {
                "inspect" => Some(format!("{local}.getsource")),
                "inspect.getsource" => Some(local.clone()),
                _ => None,
            })
            .collect();
        let builtin_shadowed = shadowed.iter().chain(imports.keys()).cloned().collect();
        rewrite(tree, |current| {
            if python {
                python_question(current, &builtin_shadowed, &readers)
            } else {
                javascript_question(current, &shadowed)
            }
        })
    };
    let functions: Vec<Node> = functions
        .into_iter()
        .map(|mut item| {
            let body = item.node("body").unwrap();
            let shadowed = bindings(
                body,
                global.iter().cloned().chain(
                    item.nodes("parameters")
                        .iter()
                        .filter_map(|parameter| parameter.str("name").map(str::to_owned)),
                ),
            );
            item.set("body", apply(body.clone(), shadowed));
            item
        })
        .collect();
    program.set("functions", functions);
    program.set("main", apply(program.node("main").unwrap().clone(), global));
    program
}

pub(crate) fn write_question(
    emitter: &mut Emitter,
    expression: &Node,
) -> Result<String, GrammarError> {
    let aspect = expression.str("aspect").unwrap_or_default();
    let subject = expression
        .node("subject")
        .ok_or_else(|| GrammarError::new("A question requires a subject"))?;
    let value = emitter.expression(subject)?;
    match (emitter.id(), aspect) {
        ("python", "type") => Ok(format!("type({value})")),
        ("python" | "javascript" | "typescript", "documentation") => {
            Ok(format!("({value}).__doc__"))
        }
        ("python", "source") => {
            emitter.uses.insert("inspect");
            Ok(format!("inspect.getsource({value})"))
        }
        ("python", "details") if subject.is("Name") && valid_subject(&value) => Ok(format!(
            "get_ipython().run_line_magic(\"pinfo2\", {})",
            emitter.quote(&value)
        )),
        ("javascript" | "typescript", "type") => {
            Ok(format!("Object.getPrototypeOf({value}).constructor"))
        }
        ("javascript" | "typescript", "source") => {
            Ok(format!("Function.prototype.toString.call({value})"))
        }
        _ => Err(GrammarError::new(format!(
            "Cannot emit a {aspect} question in {}",
            emitter.id()
        ))),
    }
}
