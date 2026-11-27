//! Type inference for the meta language. Statically typed targets need a
//! type for every variable, parameter and result; untyped sources do not
//! write them down, so the types are derived from literals, operators,
//! declarations and call sites. Meta types: integer, real, text, boolean,
//! nothing, and array (a fixed-length array of integers). A variable that
//! is given a real after an integer start is a real variable.

use std::collections::{HashMap, HashSet};

use super::tree::{Node, Value, walk};

type Scope = HashMap<String, String>;

/// What is known about a function: its parameter types and result type.
#[derive(Clone, Debug, Default)]
struct Signature {
    parameters: Vec<Option<String>>,
    return_type: Option<String>,
    /// The result type the source writes down.
    declared: Option<String>,
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
        "Number" => Some(number_type(expression).into()),
        "RecordConstruction" => Some("record".into()),
        "RecordFieldRead" => expression.str("type").map(str::to_owned),
        "Text" | "Interpolation" => Some("text".into()),
        "Boolean" => Some("boolean".into()),
        "Null" | "SqlBinary" | "SqlUnary" => Some("object".into()),
        "SqlTruth" => Some("boolean".into()),
        "Question" if matches!(expression.str("aspect"), Some("documentation" | "source")) => {
            Some("text".into())
        }
        "Name" => scope.get(expression.str("name")?).cloned(),
        "AssignmentExpression" | "ExpressionSequence" => expression
            .node("value")
            .and_then(|v| expression_type(v, scope, signatures)),
        "Query" => {
            let local = query_scope(expression, scope, signatures);
            let element = expression
                .node("projection")
                .and_then(|p| expression_type(p, &local, signatures))
                .unwrap_or_else(|| "object".into());
            let container = if expression.flag("eager").unwrap_or(true) {
                "array"
            } else {
                "sequence"
            };
            Some(format!("{container}<{element}>"))
        }
        "Unary" => Some(if expression.str("operator") == Some("not") {
            "boolean".into()
        } else if expression
            .node("operand")
            .and_then(|operand| expression_type(operand, scope, signatures))
            .as_deref()
            == Some("real")
        {
            "real".into()
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
            let is_real = |value: &Option<String>| value.as_deref() == Some("real");
            if operator == "add" && (is_text(&left) || is_text(&right)) {
                Some("text".into())
            } else if operator == "realDivide"
                || is_real(&left)
                || is_real(&right)
                || (operator == "power"
                    && expression.node("right").is_some_and(|right| {
                        !right.is("Number")
                            || right.number("value").is_some_and(|value| value < 0.0)
                    }))
            {
                Some("real".into())
            } else {
                Some("integer".into())
            }
        }
        "Call" => signatures
            .get(expression.str("callee")?)
            .and_then(|signature| signature.return_type.clone()),
        "ArrayLiteral" | "NewArray" => Some("array".into()),
        "Length" => Some("integer".into()),
        "ProcessArguments" => Some("array<text>".into()),
        "SetLiteral" => Some("set<text>".into()),
        "SetInsert" => expression
            .node("collection")
            .and_then(|c| expression_type(c, scope, signatures)),
        "Update" => expression
            .node("operand")
            .and_then(|o| expression_type(o, scope, signatures))
            .or_else(|| Some("integer".into())),
        "Index" => Some(
            expression
                .node("array")
                .and_then(|a| expression_type(a, scope, signatures))
                .and_then(|a| collection_element(&a).map(str::to_owned))
                .unwrap_or_else(|| "integer".into()),
        ),
        _ => None,
    }
}

fn query_scope(expression: &Node, scope: &Scope, signatures: &Signatures) -> Scope {
    let source = expression
        .node("source")
        .and_then(|s| expression_type(s, scope, signatures));
    let element = source
        .as_deref()
        .and_then(|s| {
            s.strip_prefix("array<")
                .or_else(|| s.strip_prefix("sequence<"))
        })
        .and_then(|s| s.strip_suffix('>'));
    let mut local = scope.clone();
    local.insert(
        expression.str("variable").unwrap_or_default().into(),
        element
            .unwrap_or(if source.as_deref() == Some("array") {
                "integer"
            } else {
                "object"
            })
            .into(),
    );
    local
}

fn collection_element(kind: &str) -> Option<&str> {
    kind.strip_prefix("array<")
        .or_else(|| kind.strip_prefix("sequence<"))
        .or_else(|| kind.strip_prefix("set<"))
        .and_then(|k| k.strip_suffix('>'))
}

fn number_type(expression: &Node) -> &'static str {
    let value = expression.number("value").unwrap_or(0.0);
    if expression.str("type") == Some("real") || value.fract() != 0.0 {
        "real"
    } else {
        "integer"
    }
}

/// A division with a real operand is a true division (C's `7.0 / 2`).
fn annotate(mut expression: Node, scope: &Scope, signatures: &Signatures) -> Node {
    fn child(value: Value, scope: &Scope, signatures: &Signatures) -> Value {
        match value {
            Value::Node(node) => Value::Node(annotate(node, scope, signatures)),
            Value::List(items) => Value::List(
                items
                    .into_iter()
                    .map(|item| child(item, scope, signatures))
                    .collect(),
            ),
            other => other,
        }
    }
    let local = if expression.is("Query") {
        Some(query_scope(&expression, scope, signatures))
    } else if expression.is("Lambda") {
        let mut local = scope.clone();
        for parameter in expression.texts("parameters") {
            local.remove(&parameter);
        }
        Some(local)
    } else {
        None
    };
    let local = local.as_ref().unwrap_or(scope);
    expression.fields = std::mem::take(&mut expression.fields)
        .into_iter()
        .map(|(key, value)| {
            let value = child(
                value,
                if key == "source" { scope } else { local },
                signatures,
            );
            (key, value)
        })
        .collect();
    let slash_division = expression.flag("slashDivision").unwrap_or(false);
    expression.remove("slashDivision");
    let current = expression;
    match expression_type(&current, scope, signatures) {
        Some(kind) => {
            let divides = current.is("Binary")
                && (current.str("operator") == Some("divide")
                    || (current.str("operator") == Some("floorDivide") && slash_division));
            let real = kind == "real";
            let typed = current.with("type", kind);
            if divides && real {
                typed.with("operator", "realDivide")
            } else {
                typed
            }
        }
        None => current,
    }
}

/// An integer literal stored in a real variable is a real literal (0 is 0.0).
fn stored(statement: &mut Node, kind: Option<&str>) {
    let literal = statement
        .node("value")
        .is_some_and(|value| value.is("Number") && value.str("type") == Some("integer"));
    if kind == Some("real")
        && literal
        && let Some(Value::Node(value)) = statement.fields.remove("value")
    {
        statement.set("value", value.with("type", "real"));
    }
}

/// The variables whose type the source writes down.
fn declared_names(body: &Node) -> HashSet<String> {
    let mut names = HashSet::new();
    walk(body, |current| {
        if current.is("Declaration")
            && known(current.str("type")).is_some()
            && let Some(name) = current.str("name")
        {
            names.insert(name.to_owned());
        }
    });
    names
}

/// The result type of a function: the declared one, otherwise the type of
/// its returned values, a real where one of them is real.
fn return_type(signature: &Signature, returns: Vec<String>) -> Option<String> {
    if signature.declared.is_some() {
        return signature.declared.clone();
    }
    let values: Vec<String> = returns
        .into_iter()
        .filter(|kind| kind != "nothing")
        .collect();
    if values.iter().any(|kind| kind == "real") {
        return Some("real".into());
    }
    signature
        .return_type
        .clone()
        .or_else(|| values.into_iter().next())
}

/// The variables of a function (or of main) that are given a real, and the
/// ones whose type the source writes down.
#[derive(Default)]
struct Reals {
    given: HashSet<String>,
    declared: HashSet<String>,
}

fn known(kind: Option<&str>) -> Option<String> {
    kind.map(str::to_owned)
}

struct Context<'a> {
    signatures: &'a Signatures,
    returns: &'a mut Vec<String>,
    reals: &'a mut Reals,
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
                let name = statement.str("name").unwrap_or_default().to_owned();
                let kind = if kind == "integer"
                    && self.reals.given.contains(&name)
                    && !self.reals.declared.contains(&name)
                {
                    "real".into()
                } else {
                    kind
                };
                stored(&mut statement, Some(&kind));
                if statement.str("name").is_some() {
                    scope.insert(name, kind.clone());
                }
                statement.with("type", kind)
            }
            "Assignment" => {
                self.typed(&mut statement, "value", scope);
                let name = statement.str("name").unwrap_or_default().to_owned();
                let real = statement
                    .node("value")
                    .is_some_and(|value| value.str("type") == Some("real"));
                if real && scope.get(&name).map(String::as_str) == Some("integer") {
                    self.reals.given.insert(name.clone());
                }
                stored(&mut statement, scope.get(&name).map(String::as_str));
                statement
            }
            "Print" | "Throw" => {
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
            "Try" => {
                self.block_field(&mut statement, "body", scope);
                let handlers: Vec<Node> = statement
                    .node_list("handlers")
                    .into_iter()
                    .map(|mut handler| {
                        let mut inner = scope.clone();
                        if let Some(name) = handler.str("name") {
                            inner.insert(
                                name.to_owned(),
                                handler.str("type").unwrap_or("integer").to_owned(),
                            );
                        }
                        self.block_field(&mut handler, "body", &inner);
                        handler
                    })
                    .collect();
                statement.set("handlers", handlers);
                self.block_field(&mut statement, "success", scope);
                self.block_field(&mut statement, "finalizer", scope);
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
            "ForEach" => {
                let mut inner = scope.clone();
                self.typed(&mut statement, "array", scope);
                let kind = statement
                    .node("array")
                    .and_then(|a| a.str("type"))
                    .and_then(collection_element)
                    .unwrap_or("integer")
                    .to_owned();
                if let Some(variable) = statement.str("variable") {
                    inner.insert(variable.to_owned(), kind.clone());
                }
                statement.set("type", kind);
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
        "ForEach" => &["array", "body"],
        "Declaration" | "Assignment" | "Return" | "Print" => &["value"],
        "Evaluate" => &["expression"],
        "Question" => &["subject"],
        "Query" => &["source", "condition", "projection"],
        "Lambda" => &["body"],
        "PropertyAssignment" => &["object", "value"],
        "While" => &["condition", "body"],
        "Binary" | "SqlBinary" => &["left", "right"],
        "Unary" | "SqlUnary" | "SqlTruth" => &["operand"],
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
                declared: known(item.str("returnType")),
            };
            (item.str("name").unwrap_or_default().to_owned(), signature)
        })
        .collect();
    // The variables of each function that are given a real.
    let mut reals: HashMap<String, Reals> = program
        .nodes("functions")
        .iter()
        .map(|item| {
            let body = item
                .node("body")
                .cloned()
                .unwrap_or_else(|| Node::new("Block"));
            (
                format!("function {}", item.str("name").unwrap_or_default()),
                Reals {
                    given: HashSet::new(),
                    declared: declared_names(&body),
                },
            )
        })
        .collect();
    let mut main_reals = Reals {
        given: HashSet::new(),
        declared: program.node("main").map(declared_names).unwrap_or_default(),
    };
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
            let owner = reals.entry(format!("function {name}")).or_default();
            let body = Context {
                signatures: &signatures,
                returns: &mut returns,
                reals: owner,
            }
            .block(body, &scope);
            if let Some(signature) = signatures.get_mut(&name) {
                signature.return_type = return_type(signature, returns);
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
            reals: &mut main_reals,
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
