//! Type inference for the meta language. Statically typed targets need a
//! type for every variable, parameter and result; untyped sources do not
//! write them down, so the types are derived from literals, operators,
//! declarations and call sites. Meta types: integer, text, boolean, nothing,
//! and array (a fixed-length array of integers).

use std::collections::HashMap;

use super::meta::{Node, Value, rewrite};

type Scope = HashMap<String, String>;

/// What is known about a function: its parameter types and result type.
#[derive(Clone, Debug, Default)]
struct Signature {
    parameters: Vec<Option<String>>,
    return_type: Option<String>,
}

type Signatures = HashMap<String, Signature>;

fn is_comparison(operator: &str) -> bool {
    matches!(
        operator,
        "equal" | "notEqual" | "less" | "lessOrEqual" | "greater" | "greaterOrEqual" | "and" | "or"
    )
}

fn expression_type(expression: &Node, scope: &Scope, signatures: &Signatures) -> Option<String> {
    match expression.kind.as_str() {
        "Number" => Some("integer".into()),
        "Text" | "Interpolation" => Some("text".into()),
        "Boolean" => Some("boolean".into()),
        "Name" => scope.get(expression.str("name")?).cloned(),
        "Unary" => Some(if expression.str("operator") == Some("not") {
            "boolean".into()
        } else {
            "integer".into()
        }),
        "Binary" => {
            let operator = expression.str("operator").unwrap_or_default();
            if is_comparison(operator) {
                return Some("boolean".into());
            }
            let side = |key: &str| {
                expression
                    .node(key)
                    .and_then(|node| expression_type(node, scope, signatures))
            };
            let (left, right) = (side("left"), side("right"));
            let is_text = |value: &Option<String>| value.as_deref() == Some("text");
            if operator == "add" && (is_text(&left) || is_text(&right)) {
                Some("text".into())
            } else {
                Some("integer".into())
            }
        }
        "Call" => signatures
            .get(expression.str("callee")?)
            .and_then(|signature| signature.return_type.clone()),
        "ArrayLiteral" | "NewArray" => Some("array".into()),
        "Index" | "Length" => Some("integer".into()),
        _ => None,
    }
}

fn annotate(expression: Node, scope: &Scope, signatures: &Signatures) -> Node {
    rewrite(expression, |current| {
        match expression_type(&current, scope, signatures) {
            Some(kind) => current.with("type", kind),
            None => current,
        }
    })
}

fn known(kind: Option<&str>) -> Option<String> {
    kind.filter(|kind| !kind.starts_with("source:"))
        .map(str::to_owned)
}

struct Context<'a> {
    signatures: &'a Signatures,
    returns: &'a mut Vec<String>,
}

impl Context<'_> {
    fn typed(&self, node: &mut Node, key: &str, scope: &Scope) {
        if let Some(Value::Node(expression)) = node.fields.remove(key) {
            node.set(key, annotate(expression, scope, self.signatures));
        }
    }

    fn block(&mut self, body: Node, scope: &Scope) -> Node {
        let mut local = scope.clone();
        let statements: Vec<Node> = body
            .node_list("statements")
            .into_iter()
            .map(|statement| self.statement(statement, &mut local))
            .collect();
        body.with("statements", statements)
    }

    fn block_field(&mut self, node: &mut Node, key: &str, scope: &Scope) {
        if let Some(Value::Node(body)) = node.fields.remove(key) {
            let typed = self.block(body, scope);
            node.set(key, typed);
        }
    }

    fn statement(&mut self, mut statement: Node, scope: &mut Scope) -> Node {
        match statement.kind.as_str() {
            "Declaration" => {
                self.typed(&mut statement, "value", scope);
                let kind = known(statement.str("type"))
                    .or_else(|| {
                        statement
                            .node("value")
                            .and_then(|value| value.str("type"))
                            .map(str::to_owned)
                    })
                    .unwrap_or_else(|| "integer".into());
                if let Some(name) = statement.str("name") {
                    scope.insert(name.to_owned(), kind.clone());
                }
                statement.with("type", kind)
            }
            "Assignment" | "Print" => {
                self.typed(&mut statement, "value", scope);
                statement
            }
            "IndexAssignment" => {
                self.typed(&mut statement, "index", scope);
                self.typed(&mut statement, "value", scope);
                statement
            }
            "Evaluate" => {
                self.typed(&mut statement, "expression", scope);
                statement
            }
            "Return" => {
                self.typed(&mut statement, "value", scope);
                let kind = statement
                    .node("value")
                    .and_then(|value| value.str("type"))
                    .unwrap_or("nothing");
                self.returns.push(kind.to_owned());
                statement
            }
            "If" => {
                self.typed(&mut statement, "condition", scope);
                self.block_field(&mut statement, "then", scope);
                match statement.fields.remove("otherwise") {
                    Some(Value::Node(otherwise)) if otherwise.is("If") => {
                        let typed = self.statement(otherwise, scope);
                        statement.set("otherwise", typed);
                    }
                    Some(Value::Node(otherwise)) => {
                        let typed = self.block(otherwise, scope);
                        statement.set("otherwise", typed);
                    }
                    Some(other) => {
                        statement.fields.insert("otherwise".into(), other);
                    }
                    None => {}
                }
                statement
            }
            "While" => {
                self.typed(&mut statement, "condition", scope);
                self.block_field(&mut statement, "body", scope);
                statement
            }
            "CountingLoop" => {
                let mut inner = scope.clone();
                if let Some(variable) = statement.str("variable") {
                    inner.insert(variable.to_owned(), "integer".into());
                }
                self.typed(&mut statement, "start", scope);
                self.typed(&mut statement, "end", scope);
                self.block_field(&mut statement, "body", &inner);
                statement
            }
            _ => statement,
        }
    }
}

/// The node fields of each kind, in the order the parser creates them; the
/// first call site that tells a parameter type wins, so the order matters.
fn child_order(kind: &str) -> &'static [&'static str] {
    match kind {
        "Program" => &["functions", "main"],
        "Function" => &["parameters", "body"],
        "If" => &["condition", "then", "otherwise"],
        "CountingLoop" => &["start", "end", "body"],
        "Declaration" | "Assignment" | "Return" | "Print" => &["value"],
        "Evaluate" => &["expression"],
        "While" => &["condition", "body"],
        "Binary" => &["left", "right"],
        "Unary" => &["operand"],
        "Call" => &["arguments"],
        "IndexAssignment" => &["index", "value"],
        "ArrayLiteral" => &["elements"],
        "NewArray" => &["length", "fill"],
        "Index" => &["array", "index"],
        "Length" => &["array"],
        "Interpolation" => &["parts"],
        "Block" => &["statements"],
        _ => &[],
    }
}

fn ordered_walk(node: &Node, visit: &mut dyn FnMut(&Node)) {
    fn value(item: &Value, visit: &mut dyn FnMut(&Node)) {
        match item {
            Value::Node(node) => ordered_walk(node, visit),
            Value::List(items) => items.iter().for_each(|item| value(item, visit)),
            _ => {}
        }
    }
    let order = child_order(&node.kind);
    for key in order {
        if let Some(item) = node.get(key) {
            value(item, visit);
        }
    }
    for (key, item) in &node.fields {
        if !order.contains(&key.as_str()) {
            value(item, visit);
        }
    }
    visit(node);
}

/// Parameter types come from the first call site that tells them.
fn call_site_types(
    program: &Node,
    signatures: &Signatures,
) -> HashMap<String, Vec<Option<String>>> {
    let mut found: HashMap<String, Vec<Option<String>>> = HashMap::new();
    ordered_walk(program, &mut |current| {
        if !current.is("Call") {
            return;
        }
        let Some(callee) = current.str("callee") else {
            return;
        };
        if !signatures.contains_key(callee) {
            return;
        }
        let types = found.entry(callee.to_owned()).or_default();
        for (index, argument) in current.nodes("arguments").into_iter().enumerate() {
            if types.len() <= index {
                types.resize(index + 1, None);
            }
            if types[index].is_none() {
                types[index] = argument.str("type").map(str::to_owned);
            }
        }
    });
    found
}

/// Annotate expressions, declarations, parameters and function results with
/// meta types.
pub fn infer_types(program: Node) -> Node {
    let mut signatures: Signatures = program
        .nodes("functions")
        .iter()
        .map(|item| {
            let signature = Signature {
                parameters: item
                    .nodes("parameters")
                    .iter()
                    .map(|parameter| known(parameter.str("type")))
                    .collect(),
                return_type: known(item.str("returnType")),
            };
            (item.str("name").unwrap_or_default().to_owned(), signature)
        })
        .collect();
    let mut current = program;
    // Recursive functions need a few rounds before every type settles.
    for _ in 0..4 {
        let mut functions = Vec::new();
        for item in current.node_list("functions") {
            let name = item.str("name").unwrap_or_default().to_owned();
            let signature = signatures.get(&name).cloned().unwrap_or_default();
            let scope: Scope = item
                .nodes("parameters")
                .iter()
                .enumerate()
                .map(|(index, parameter)| {
                    let kind = signature
                        .parameters
                        .get(index)
                        .cloned()
                        .flatten()
                        .unwrap_or_else(|| "integer".into());
                    (parameter.str("name").unwrap_or_default().to_owned(), kind)
                })
                .collect();
            let mut returns = Vec::new();
            let body = item
                .node("body")
                .cloned()
                .unwrap_or_else(|| Node::new("Block"));
            let body = Context {
                signatures: &signatures,
                returns: &mut returns,
            }
            .block(body, &scope);
            if let Some(signature) = signatures.get_mut(&name)
                && signature.return_type.is_none()
            {
                signature.return_type = returns.into_iter().find(|kind| kind != "nothing");
            }
            functions.push(item.with("body", body));
        }
        let main = current
            .node("main")
            .cloned()
            .unwrap_or_else(|| Node::new("Block"));
        let mut ignored = Vec::new();
        let main = Context {
            signatures: &signatures,
            returns: &mut ignored,
        }
        .block(main, &Scope::new());
        current.set("functions", functions);
        current.set("main", main);
        for (callee, types) in call_site_types(&current, &signatures) {
            if let Some(signature) = signatures.get_mut(&callee) {
                for (index, slot) in signature.parameters.iter_mut().enumerate() {
                    if slot.is_none() {
                        *slot = types.get(index).cloned().flatten();
                    }
                }
            }
        }
    }
    let functions: Vec<Node> = current
        .node_list("functions")
        .into_iter()
        .map(|item| {
            let signature = signatures
                .get(item.str("name").unwrap_or_default())
                .cloned()
                .unwrap_or_default();
            let parameters: Vec<Node> = item
                .node_list("parameters")
                .into_iter()
                .enumerate()
                .map(|(index, parameter)| {
                    let kind = signature
                        .parameters
                        .get(index)
                        .cloned()
                        .flatten()
                        .unwrap_or_else(|| "integer".into());
                    parameter.with("type", kind)
                })
                .collect();
            item.with(
                "returnType",
                signature.return_type.unwrap_or_else(|| "nothing".into()),
            )
            .with("parameters", parameters)
        })
        .collect();
    current.with("functions", functions)
}
