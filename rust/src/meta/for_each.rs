//! The for-each loop of the meta language: ForEach { variable, array, body }.
//! Languages with a for-each syntax write it natively (the `for_each`
//! template of their description in formal/languages.rs). The others write the
//! counting loop over a fresh index whose body starts by reading the element,
//!
//! ```text
//!   for index in 0..len(a): x = a[index]; ...
//! ```
//!
//! and the rule that reads a program raises that loop back to a ForEach, so
//! that every language round-trips to the same meta program.

use std::collections::HashSet;

use super::tree::{Node, Value, block, name, number, rewrite, walk};

/// The names a function body and its parameters already use.
pub fn used_names(body: &Node, parameters: &[&Node]) -> HashSet<String> {
    let mut used: HashSet<String> = parameters
        .iter()
        .filter_map(|parameter| parameter.str("name").map(str::to_owned))
        .collect();
    walk(body, |current| {
        for key in ["name", "variable"] {
            used.extend(current.str(key).map(str::to_owned));
        }
    });
    used
}

/// A name for a loop index that is not in `used`.
pub fn fresh_name(used: &HashSet<String>) -> String {
    ["index", "position", "slot", "place"]
        .into_iter()
        .map(str::to_owned)
        .chain((2..=9).map(|count| format!("index-{count}")))
        .find(|candidate| !used.contains(candidate))
        .unwrap_or_else(|| "index-10".into())
}

fn mentions(tree: &Node, identifier: &str) -> bool {
    let mut found = false;
    walk(tree, |current| {
        if current.is_name(identifier) {
            found = true;
        }
    });
    found
}

/// Whether a tree assigns or declares the name, or stores into the array of
/// that name.
fn changes(tree: &Node, identifier: &str) -> bool {
    let mut found = false;
    walk(tree, |current| {
        if (current.is("Assignment") || current.is("Declaration") || current.is("IndexAssignment"))
            && current.str("name") == Some(identifier)
        {
            found = true;
        }
    });
    found
}

/// A loop that changes its own variable or the array it reads is written as
/// a counting loop everywhere: the loop variable is read-only in many
/// languages and the array may not change while it is being read.
pub fn is_plain(each: &Node) -> bool {
    let variable = each.str("variable").unwrap_or_default();
    let array = each
        .node("array")
        .and_then(|array| array.str("name"))
        .unwrap_or_default();
    let body = each.node("body").cloned().unwrap_or_else(|| block(vec![]));
    !changes(&body, variable) && !changes(&body, array)
}

/// The ForEach written out as a counting loop over the index.
fn lowered(each: &Node, index: &str, body: Node) -> Node {
    let variable = each.str("variable").unwrap_or_default();
    let array = each.node("array").cloned().unwrap_or_else(|| name(""));
    let original = each.node("body").cloned().unwrap_or_else(|| block(vec![]));
    let element = Node::new("Declaration")
        .with("name", variable)
        .with("type", "integer")
        .with(
            "value",
            Node::new("Index")
                .with("array", array.clone())
                .with("index", name(index)),
        )
        .with("mutable", changes(&original, variable));
    let mut statements = vec![element];
    statements.extend(body.node_list("statements"));
    Node::new("CountingLoop")
        .with("variable", index)
        .with("start", number(0.0))
        .with(
            "end",
            Node::new("Length")
                .with("array", array)
                .with("type", "integer"),
        )
        .with("body", block(statements))
}

fn expand(
    tree: Node,
    used: &HashSet<String>,
    around: &HashSet<String>,
    keep: &dyn Fn(&Node) -> bool,
) -> Node {
    let value = |item: Value, around: &HashSet<String>| match item {
        Value::Node(node) => Value::Node(expand(node, used, around, keep)),
        Value::List(items) => Value::List(
            items
                .into_iter()
                .map(|item| match item {
                    Value::Node(node) => Value::Node(expand(node, used, around, keep)),
                    other => other,
                })
                .collect(),
        ),
        other => other,
    };
    if tree.is("ForEach") && !keep(&tree) {
        let taken: HashSet<String> = used.union(around).cloned().collect();
        let index = fresh_name(&taken);
        let mut inner = around.clone();
        inner.insert(index.clone());
        let body = tree
            .node("body")
            .cloned()
            .map(|body| expand(body, used, &inner, keep))
            .unwrap_or_else(|| block(vec![]));
        return lowered(&tree, &index, body);
    }
    let mut tree = tree;
    let fields = std::mem::take(&mut tree.fields);
    for (key, item) in fields {
        tree.fields.insert(key, value(item, around));
    }
    tree
}

/// Every ForEach the `keep` test refuses becomes a counting loop. The index
/// differs from every name of the function and from the index of the loops
/// around it.
pub fn lower_for_each(mut program: Node, keep: &dyn Fn(&Node) -> bool) -> Node {
    let inside = |body: Node, parameters: &[&Node]| {
        let used = used_names(&body, parameters);
        expand(body, &used, &HashSet::new(), keep)
    };
    let functions: Vec<Node> = program
        .node_list("functions")
        .into_iter()
        .map(|item| {
            let parameters = item.node_list("parameters");
            let references: Vec<&Node> = parameters.iter().collect();
            let body = item.node("body").cloned().unwrap_or_else(|| block(vec![]));
            let lowered = inside(body, &references);
            item.with("body", lowered)
        })
        .collect();
    program.set("functions", functions);
    if let Some(main) = program.node("main").cloned() {
        let lowered = inside(main, &[]);
        program.set("main", lowered);
    }
    program
}

/// `for index in 0..len(a): x = a[index]; ...` where the index is used for
/// nothing else is the loop `for x in a`.
fn raised(counting: &Node) -> Option<Node> {
    let variable = counting.str("variable")?;
    let end = counting.node("end")?;
    let array = end.node("array").filter(|_| end.is("Length"))?;
    let statements = counting.node("body")?.node_list("statements");
    let (first, rest) = statements.split_first()?;
    let reads = first.node("value")?;
    if !counting.node("start")?.is_number(0.0)
        || !first.is("Declaration")
        || !reads.is("Index")
        || reads.node("array")?.str("name") != array.str("name")
        || !reads.node("index")?.is_name(variable)
    {
        return None;
    }
    let remaining = block(rest.to_vec());
    if mentions(&remaining, variable) || changes(&remaining, array.str("name")?) {
        return None;
    }
    Some(
        Node::new("ForEach")
            .with("variable", first.str("name")?)
            .with("array", array.clone())
            .with("body", remaining),
    )
}

pub fn raise_for_each(program: Node) -> Node {
    rewrite(program, |current| {
        if !current.is("CountingLoop") {
            return current;
        }
        raised(&current).unwrap_or(current)
    })
}
