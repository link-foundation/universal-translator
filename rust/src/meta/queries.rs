//! Selection meaning is independent of query syntax and evaluation strategy.
use super::{Node, Value, name, text};

/// Visit free references without capturing a nested query or lambda binder.
pub(crate) fn rewrite_free(
    mut expression: Node,
    variable: &str,
    visit: &mut dyn FnMut(Node) -> Node,
) -> Node {
    fn child(value: Value, variable: &str, visit: &mut dyn FnMut(Node) -> Node) -> Value {
        match value {
            Value::Node(node) => Value::Node(rewrite_free(node, variable, visit)),
            Value::List(items) => Value::List(
                items
                    .into_iter()
                    .map(|item| child(item, variable, visit))
                    .collect(),
            ),
            other => other,
        }
    }
    let shadowed = expression.is("Query") && expression.str("variable") == Some(variable);
    let lambda =
        expression.is("Lambda") && expression.texts("parameters").iter().any(|p| p == variable);
    expression.fields = std::mem::take(&mut expression.fields)
        .into_iter()
        .map(|(key, value)| {
            let value = if (shadowed && key != "source") || (lambda && key == "body") {
                value
            } else {
                child(value, variable, visit)
            };
            (key, value)
        })
        .collect();
    let origin = expression.origin.clone();
    let mut result = visit(expression);
    if result.origin.is_none() {
        result.origin = origin;
    }
    result
}

pub(crate) const KEYS: [&str; 4] = [
    "answer-query",
    "question-query",
    "answer-deferred-query",
    "question-deferred-query",
];

pub(crate) fn key(eager: bool, question: bool) -> &'static str {
    KEYS[usize::from(question) + if eager { 0 } else { 2 }]
}

pub(crate) fn query(
    source: Node,
    variable: &str,
    projection: Node,
    condition: Option<Node>,
    eager: bool,
) -> Node {
    Node::new("Query")
        .with("source", source)
        .with("variable", variable)
        .with("projection", projection)
        .with(
            "condition",
            condition.unwrap_or_else(|| Node::new("Boolean").with("value", true)),
        )
        .with("eager", eager)
}

/// A range variable owns its row fields; a member is not part of its name.
pub(crate) fn row_members(expression: Node, variable: &str) -> Node {
    let prefix = format!("{variable}.");
    rewrite_free(expression, variable, &mut |current| {
        let Some(identifier) = current.str("name").filter(|_| current.is("Name")) else {
            return current;
        };
        match identifier.strip_prefix(&prefix) {
            Some(field) => Node::new("Index")
                .with("array", name(variable))
                .with("index", text(field)),
            None => current,
        }
    })
}
