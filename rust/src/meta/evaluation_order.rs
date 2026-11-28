//! Standard C-family sequencing, with guarded recognition of private temporaries.
use super::{Node, Settings, name, number, rewrite, walk};
use std::collections::{HashMap, HashSet};
const PREFIX: &str = "ut-evaluation";
fn temporary_name(name: &str) -> bool {
    name.strip_prefix(PREFIX).is_some_and(|suffix| {
        !suffix.is_empty() && suffix.bytes().all(|byte| byte.is_ascii_digit())
    })
}
fn operands(item: &Node) -> Vec<Node> {
    if item.is("Call") {
        return item.node_list("arguments");
    }
    if item.is("Binary") && !matches!(item.str("operator"), Some("and" | "or")) {
        return ["left", "right"]
            .iter()
            .filter_map(|k| item.node(k).cloned())
            .collect();
    }
    vec![]
}
fn with_operands(mut item: Node, values: Vec<Node>) -> Node {
    if item.is("Call") {
        item.set("arguments", values);
    } else {
        item.set("left", values[0].clone());
        item.set("right", values[1].clone());
    }
    item
}
fn effectful(item: &Node) -> bool {
    let mut found = false;
    walk(item, |node| {
        found |= matches!(
            node.kind.as_str(),
            "Call" | "Update" | "SetInsert" | "AssignmentExpression"
        );
    });
    found
}
struct Lower {
    used: HashSet<String>,
    index: usize,
}
impl Lower {
    fn fresh(&mut self) -> String {
        loop {
            self.index += 1;
            let name = format!("{PREFIX}{}", self.index);
            if !self.used.contains(&format!("{PREFIX}-{}", self.index))
                && self.used.insert(name.clone())
            {
                return name;
            }
        }
    }
    fn body(&mut self, body: Node) -> Node {
        let mut declarations = vec![];
        let mut lowered = rewrite(body, |item| {
            let values = operands(&item);
            if values
                .iter()
                .filter(|value| !matches!(value.kind.as_str(), "Number" | "Boolean" | "Text"))
                .count()
                < 2
                || !values.iter().all(|value| {
                    matches!(
                        value.str("type"),
                        Some("integer" | "real" | "boolean" | "text")
                    )
                })
                || !values.iter().any(effectful)
            {
                return item;
            }
            let mut steps = vec![];
            let mut references = vec![];
            for value in values {
                let kind = value.str("type").expect("typed scalar");
                let identifier = self.fresh();
                let initial = match kind {
                    "text" => Node::new("Text").with("value", ""),
                    "boolean" => Node::new("Boolean").with("value", false),
                    _ => number(0.0),
                }
                .with("type", kind);
                let mut declaration = Node::new("Declaration")
                    .with("name", identifier.clone())
                    .with("type", kind)
                    .with("value", initial)
                    .with("mutable", true);
                declaration.origin = value.origin.clone();
                declarations.push(declaration);
                references.push(name(&identifier).with("type", kind));
                let mut step = Node::new("AssignmentExpression")
                    .with("name", identifier)
                    .with("type", kind)
                    .with("value", value.clone());
                step.origin = value.origin.clone();
                steps.push(step);
            }
            let kind = item.str("type").map(str::to_owned);
            let mut sequence = Node::new("ExpressionSequence")
                .with("steps", steps)
                .with("value", with_operands(item, references));
            if let Some(kind) = kind {
                sequence.set("type", kind);
            }
            sequence
        });
        declarations.extend(lowered.node_list("statements"));
        lowered.set("statements", declarations);
        lowered
    }
}
pub(crate) fn lower(mut program: Node, settings: &Settings) -> Node {
    if settings.from != "python" || !matches!(settings.to.as_str(), "c" | "cpp" | "objc") {
        return program;
    }
    let mut used = HashSet::new();
    walk(&program, |item| {
        for key in ["name", "callee", "variable"] {
            if let Some(name) = item.str(key) {
                used.insert(name.to_owned());
            }
        }
        for parameter in item.node_list("parameters") {
            if let Some(name) = parameter.str("name") {
                used.insert(name.to_owned());
            }
        }
    });
    let mut lower = Lower { used, index: 0 };
    program.set(
        "main",
        lower.body(program.node("main").expect("main").clone()),
    );
    let functions = program
        .node_list("functions")
        .into_iter()
        .map(|mut f| {
            f.set("body", lower.body(f.node("body").expect("body").clone()));
            f
        })
        .collect::<Vec<_>>();
    program.set("functions", functions);
    program
}
fn add(map: &mut HashMap<String, usize>, identifier: &str) {
    *map.entry(identifier.to_owned()).or_default() += 1;
}
fn raise_body(body: Node) -> Node {
    let mut declared = HashMap::new();
    let mut reads = HashMap::new();
    let mut writes = HashMap::new();
    for item in body.node_list("statements") {
        if item.is("Declaration")
            && let (Some(name), Some(kind)) = (item.str("name"), item.str("type"))
            && temporary_name(name)
            && item.node("value").is_some_and(|v| {
                (v.is("Number") && v.number("value") == Some(0.0))
                    || (v.is("Boolean") && v.flag("value") == Some(false))
                    || (v.is("Text") && v.str("value") == Some(""))
            })
        {
            declared.insert(name.to_owned(), kind.to_owned());
        }
    }
    walk(&body, |item| {
        let name = item.str("name").unwrap_or_default();
        if item.is("Name") {
            add(&mut reads, name);
        }
        if matches!(
            item.kind.as_str(),
            "Assignment" | "AssignmentExpression" | "Declaration" | "IndexAssignment" | "Catch"
        ) {
            add(&mut writes, name);
        }
        if item.is("Call") {
            add(&mut reads, item.str("callee").unwrap_or_default());
        }
        if let Some(variable) = item.str("variable") {
            add(&mut reads, variable);
        }
    });
    let mut removed = HashSet::new();
    let mut raised = rewrite(body, |item| {
        if !item.is("ExpressionSequence") {
            return item;
        }
        let value = item.node("value").expect("value");
        let values = operands(value);
        let steps = item.node_list("steps");
        if values.len() != steps.len()
            || values.len() < 2
            || !steps.iter().zip(&values).all(|(s, v)| {
                let name = s.str("name").unwrap_or_default();
                s.is("AssignmentExpression")
                    && v.is("Name")
                    && v.str("name") == Some(name)
                    && s.node("value")
                        .and_then(|value| value.str("type"))
                        .is_some_and(|kind| {
                            declared
                                .get(name)
                                .is_some_and(|declaration| declaration == kind)
                        })
                    && writes.get(name) == Some(&2)
                    && reads.get(name) == Some(&1)
            })
        {
            return item;
        }
        for step in &steps {
            removed.insert(step.str("name").unwrap_or_default().to_owned());
        }
        with_operands(
            value.clone(),
            steps
                .iter()
                .map(|s| s.node("value").expect("value").clone())
                .collect(),
        )
    });
    let statements = raised
        .node_list("statements")
        .into_iter()
        .filter(|s| !s.is("Declaration") || !removed.contains(s.str("name").unwrap_or_default()))
        .collect::<Vec<_>>();
    raised.set("statements", statements);
    raised
}
pub(crate) fn raise(mut program: Node) -> Node {
    program.set(
        "main",
        raise_body(program.node("main").expect("main").clone()),
    );
    let functions = program
        .node_list("functions")
        .into_iter()
        .map(|mut f| {
            f.set("body", raise_body(f.node("body").expect("body").clone()));
            f
        })
        .collect::<Vec<_>>();
    program.set("functions", functions);
    program
}
