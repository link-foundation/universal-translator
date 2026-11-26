//! Meta language tree: the language-independent representation that every
//! parser produces and every emitter consumes. Node kinds use full words.
//!
//! ```text
//!   Program        { comments, imports, functions, main, mainComments }
//!   Function       { name, parameters: [Parameter], returnType, body, comments }
//!   Parameter      { name, type }
//!   Block          { statements }
//!   Declaration    { name, type, value, mutable }
//!   Assignment     { name, operator, value }
//!   If             { condition, then, otherwise }
//!   While          { condition, body }
//!   CountingLoop   { variable, start, end (exclusive), body }
//!   ForEach        { variable, array, body }   the body runs once for each
//!                  element of the array, with the variable holding it
//!   Return         { value }
//!   Print          { value, newline }
//!   Evaluate       { expression }
//!   Comment        { text, trailing?, block? }   trailing: the spaces between
//!                  the code and a comment on the same line; block: written
//!                  as a block comment
//!   Blank          { lines }           empty lines between two statements
//!   Number         { value }            Text { value }    Boolean { value }
//!   Name           { name }             Interpolation { parts }
//!   Binary         { operator, left, right }
//!   Unary          { operator, operand }
//!   Call           { callee, arguments }
//!   ArrayLiteral   { elements }         NewArray { length, fill }
//!   Index          { array, index }     Length { array }
//!   IndexAssignment { name, index, value }
//! ```
//!
//! Arrays hold integers and have a fixed length. A program creates one only
//! as the value of a declaration (ArrayLiteral or NewArray, every element
//! equal to `fill`); `array` and the array of Length are always a Name.
//! Indexes count from 0: languages that count from 1 add 1 when they write
//! an index and subtract it when they read one. The meta type is "array".
//! The array of a ForEach is a Name too; the loop variable has the type of
//! the elements, and languages without a for-each loop write a CountingLoop
//! over a fresh index whose body starts with `variable = array[index]`.
//!
//! Binary operators: add, subtract, multiply, divide, remainder, equal,
//! notEqual, less, lessOrEqual, greater, greaterOrEqual, and, or.
//! Unary operators: negate, not.
//!
//! A node is a kind plus named fields, so rules can rewrite any concept with
//! one generic traversal. A field that is not set is simply absent.

use std::collections::BTreeMap;

/// One field value of a meta node.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Bool(bool),
    Number(f64),
    Text(String),
    List(Vec<Value>),
    Node(Node),
}

/// A meta tree node: its kind and its fields.
#[derive(Clone, Debug, PartialEq)]
pub struct Node {
    pub kind: String,
    pub fields: BTreeMap<String, Value>,
}

impl From<Node> for Value {
    fn from(node: Node) -> Self {
        Value::Node(node)
    }
}

impl From<&str> for Value {
    fn from(text: &str) -> Self {
        Value::Text(text.to_owned())
    }
}

impl From<String> for Value {
    fn from(text: String) -> Self {
        Value::Text(text)
    }
}

impl From<bool> for Value {
    fn from(value: bool) -> Self {
        Value::Bool(value)
    }
}

impl From<f64> for Value {
    fn from(value: f64) -> Self {
        Value::Number(value)
    }
}

impl From<Vec<Node>> for Value {
    fn from(nodes: Vec<Node>) -> Self {
        Value::List(nodes.into_iter().map(Value::Node).collect())
    }
}

impl From<Vec<String>> for Value {
    fn from(texts: Vec<String>) -> Self {
        Value::List(texts.into_iter().map(Value::Text).collect())
    }
}

impl Value {
    pub fn as_node(&self) -> Option<&Node> {
        match self {
            Value::Node(node) => Some(node),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::Text(text) => Some(text),
            _ => None,
        }
    }

    pub fn as_list(&self) -> Option<&[Value]> {
        match self {
            Value::List(items) => Some(items),
            _ => None,
        }
    }
}

impl Node {
    pub fn new(kind: &str) -> Self {
        Node {
            kind: kind.to_owned(),
            fields: BTreeMap::new(),
        }
    }

    /// The node with one more field.
    pub fn with(mut self, key: &str, value: impl Into<Value>) -> Self {
        self.set(key, value);
        self
    }

    /// The node with a field that is set only when `value` is present.
    pub fn with_opt<V: Into<Value>>(mut self, key: &str, value: Option<V>) -> Self {
        self.set_opt(key, value);
        self
    }

    pub fn set(&mut self, key: &str, value: impl Into<Value>) {
        self.fields.insert(key.to_owned(), value.into());
    }

    pub fn set_opt<V: Into<Value>>(&mut self, key: &str, value: Option<V>) {
        match value {
            Some(value) => self.set(key, value),
            None => {
                self.fields.remove(key);
            }
        }
    }

    pub fn remove(&mut self, key: &str) -> Option<Value> {
        self.fields.remove(key)
    }

    pub fn is(&self, kind: &str) -> bool {
        self.kind == kind
    }

    pub fn get(&self, key: &str) -> Option<&Value> {
        self.fields.get(key)
    }

    /// A child node field.
    pub fn node(&self, key: &str) -> Option<&Node> {
        self.get(key).and_then(Value::as_node)
    }

    /// A text field such as `name`, `operator` or `type`.
    pub fn str(&self, key: &str) -> Option<&str> {
        self.get(key).and_then(Value::as_str)
    }

    pub fn number(&self, key: &str) -> Option<f64> {
        match self.get(key) {
            Some(Value::Number(value)) => Some(*value),
            _ => None,
        }
    }

    pub fn flag(&self, key: &str) -> Option<bool> {
        match self.get(key) {
            Some(Value::Bool(value)) => Some(*value),
            _ => None,
        }
    }

    /// The nodes of a list field (empty when absent).
    pub fn nodes(&self, key: &str) -> Vec<&Node> {
        self.get(key)
            .and_then(Value::as_list)
            .map(|items| items.iter().filter_map(Value::as_node).collect())
            .unwrap_or_default()
    }

    /// The texts of a list field (empty when absent).
    pub fn texts(&self, key: &str) -> Vec<String> {
        self.get(key)
            .and_then(Value::as_list)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Owned copies of the nodes of a list field.
    pub fn node_list(&self, key: &str) -> Vec<Node> {
        self.nodes(key).into_iter().cloned().collect()
    }

    /// Whether this is a Number node holding `value`.
    pub fn is_number(&self, value: f64) -> bool {
        self.is("Number") && self.number("value") == Some(value)
    }

    /// Whether this is a Name node spelling `identifier`.
    pub fn is_name(&self, identifier: &str) -> bool {
        self.is("Name") && self.str("name") == Some(identifier)
    }
}

pub fn block(statements: Vec<Node>) -> Node {
    Node::new("Block").with("statements", statements)
}

/// Concrete syntax: empty lines only stand between two statements of a
/// block, and two runs of them in a row merge.
pub fn layout(statements: Vec<Node>) -> Vec<Node> {
    let mut kept: Vec<Node> = Vec::new();
    for statement in statements {
        if statement.is("Blank") && kept.last().is_none_or(|last| last.is("Blank")) {
            continue;
        }
        kept.push(statement);
    }
    while kept.last().is_some_and(|last| last.is("Blank")) {
        kept.pop();
    }
    kept
}

pub fn number(value: f64) -> Node {
    Node::new("Number").with("value", value)
}

pub fn text(value: impl Into<String>) -> Node {
    Node::new("Text").with("value", value.into())
}

pub fn name(identifier: impl Into<String>) -> Node {
    Node::new("Name").with("name", identifier.into())
}

pub fn binary(operator: &str, left: Node, right: Node) -> Node {
    Node::new("Binary")
        .with("operator", operator)
        .with("left", left)
        .with("right", right)
}

/// `left + right`, folding constants and undoing `x - n + n`.
pub fn add(left: Node, right: Node) -> Node {
    let right_number = if right.is("Number") {
        right.number("value")
    } else {
        None
    };
    if let (true, Some(r)) = (left.is("Number"), right_number) {
        return number(left.number("value").unwrap_or(0.0) + r);
    }
    match right_number {
        Some(0.0) => return left,
        Some(r) if r < 0.0 => return subtract(left, number(-r)),
        _ => {}
    }
    if let Some(r) = right_number
        && undoes(&left, "subtract", r)
    {
        return left.node("left").cloned().unwrap_or(left);
    }
    binary("add", left, right)
}

/// `left - right`, folding constants and undoing `x + n - n`.
pub fn subtract(left: Node, right: Node) -> Node {
    let right_number = if right.is("Number") {
        right.number("value")
    } else {
        None
    };
    if let (true, Some(r)) = (left.is("Number"), right_number) {
        return number(left.number("value").unwrap_or(0.0) - r);
    }
    if let Some(r) = right_number
        && undoes(&left, "add", r)
    {
        return left.node("left").cloned().unwrap_or(left);
    }
    binary("subtract", left, right)
}

/// Whether `left` is `x <operator> value` for the number `value`.
fn undoes(left: &Node, operator: &str, value: f64) -> bool {
    left.is("Binary")
        && left.str("operator") == Some(operator)
        && left
            .node("right")
            .is_some_and(|right| right.is_number(value))
}

fn rewrite_value<F>(value: Value, visit: &mut F) -> Option<Value>
where
    F: FnMut(Node) -> Option<Node>,
{
    match value {
        Value::Node(node) => rewrite_node(node, visit).map(Value::Node),
        Value::List(items) => Some(Value::List(
            items
                .into_iter()
                .filter_map(|item| rewrite_value(item, visit))
                .collect(),
        )),
        other => Some(other),
    }
}

fn rewrite_node<F>(mut tree: Node, visit: &mut F) -> Option<Node>
where
    F: FnMut(Node) -> Option<Node>,
{
    let fields = std::mem::take(&mut tree.fields);
    for (key, value) in fields {
        if let Some(value) = rewrite_value(value, visit) {
            tree.fields.insert(key, value);
        }
    }
    visit(tree)
}

/// Visit every node of a tree, children first, replacing each node with the
/// value returned by `visit`. Returning `None` removes the node (from a list,
/// or the field that held it). Rules use this to rewrite one concept at a time.
pub fn rewrite_opt<F>(tree: Node, mut visit: F) -> Option<Node>
where
    F: FnMut(Node) -> Option<Node>,
{
    rewrite_node(tree, &mut visit)
}

/// [`rewrite_opt`] for visitors that always keep a node.
pub fn rewrite<F>(tree: Node, mut visit: F) -> Node
where
    F: FnMut(Node) -> Node,
{
    rewrite_node(tree, &mut |node| Some(visit(node))).expect("visitor keeps every node")
}

/// Visit every node without changing the tree.
pub fn walk<F>(tree: &Node, mut visit: F)
where
    F: FnMut(&Node),
{
    fn visit_value<F: FnMut(&Node)>(value: &Value, visit: &mut F) {
        match value {
            Value::Node(node) => visit_node(node, visit),
            Value::List(items) => items.iter().for_each(|item| visit_value(item, visit)),
            _ => {}
        }
    }
    fn visit_node<F: FnMut(&Node)>(node: &Node, visit: &mut F) {
        node.fields
            .values()
            .for_each(|value| visit_value(value, visit));
        visit(node);
    }
    visit_node(tree, &mut visit);
}

/// The functions that an earlier function calls before their own definition,
/// which languages such as C must announce with a prototype.
pub fn later_calls(functions: &[Node]) -> Vec<Node> {
    let mut defined = std::collections::HashSet::new();
    let mut announced = std::collections::HashSet::new();
    for item in functions {
        defined.insert(item.str("name").unwrap_or_default().to_owned());
        if let Some(body) = item.node("body") {
            walk(body, |current| {
                if current.is("Call") {
                    let callee = current.str("callee").unwrap_or_default();
                    if !defined.contains(callee) {
                        announced.insert(callee.to_owned());
                    }
                }
            });
        }
    }
    functions
        .iter()
        .filter(|item| announced.contains(item.str("name").unwrap_or_default()))
        .cloned()
        .collect()
}

/// Fields that do not change behaviour: types that an untyped language cannot
/// express, comments, imports and mutability.
const IGNORED_KEYS: [&str; 9] = [
    "type",
    "returnType",
    "comments",
    "mainComments",
    "imports",
    "mutable",
    "elementsAssigned",
    "blankAfter",
    "imprecision",
];

/// The meaning of a program, without details that do not change behaviour:
/// comments and empty lines, imports, inferred types and mutability.
pub fn essence(tree: &Node) -> Node {
    fn strip(value: Value) -> Value {
        match value {
            Value::Node(node) => Value::Node(strip_node(node)),
            Value::List(items) => Value::List(items.into_iter().map(strip).collect()),
            other => other,
        }
    }
    fn strip_node(mut node: Node) -> Node {
        node.fields
            .retain(|key, _| !IGNORED_KEYS.contains(&key.as_str()));
        node.fields = std::mem::take(&mut node.fields)
            .into_iter()
            .map(|(key, value)| (key, strip(value)))
            .collect();
        node
    }
    let without_comments = rewrite_opt(tree.clone(), |node| {
        (!node.is("Comment") && !node.is("Blank")).then_some(node)
    })
    .unwrap_or_else(|| Node::new("Comment"));
    strip_node(without_comments)
}

/// JSON spelling of a value, used in difference reports.
pub fn to_json(value: Option<&Value>) -> String {
    match value {
        None => "undefined".into(),
        Some(Value::Bool(flag)) => flag.to_string(),
        Some(Value::Number(value)) => format_number(*value),
        Some(Value::Text(text)) => json_string(text),
        Some(Value::List(items)) => format!(
            "[{}]",
            items
                .iter()
                .map(|item| to_json(Some(item)))
                .collect::<Vec<_>>()
                .join(",")
        ),
        Some(Value::Node(node)) => {
            let mut parts = vec![format!("\"kind\":{}", json_string(&node.kind))];
            parts.extend(
                node.fields
                    .iter()
                    .map(|(key, value)| format!("{}:{}", json_string(key), to_json(Some(value)))),
            );
            format!("{{{}}}", parts.join(","))
        }
    }
}

fn json_string(text: &str) -> String {
    let mut result = String::from("\"");
    for character in text.chars() {
        match character {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            c if (c as u32) < 0x20 => result.push_str(&format!("\\u{:04x}", c as u32)),
            c => result.push(c),
        }
    }
    result.push('"');
    result
}

/// A number spelled the way JavaScript's `String(number)` spells it for the
/// values programs use: integers without a fraction, `0` for negative zero.
pub fn format_number(value: f64) -> String {
    if value == 0.0 {
        "0".into()
    } else if value.fract() == 0.0 && value.abs() < 1e21 {
        format!("{value:.0}")
    } else {
        value.to_string()
    }
}

fn difference(a: Option<&Value>, b: Option<&Value>, path: &str) -> Option<String> {
    let report = || {
        let shown = if path.is_empty() { "/" } else { path };
        Some(format!("{shown}: {} != {}", to_json(a), to_json(b)))
    };
    match (a, b) {
        (None, None) => None,
        (Some(Value::Node(left)), Some(Value::Node(right))) => {
            if left.kind != right.kind {
                return difference(
                    Some(&Value::Text(left.kind.clone())),
                    Some(&Value::Text(right.kind.clone())),
                    &format!("{path}/kind"),
                );
            }
            let mut keys: Vec<&String> = left.fields.keys().collect();
            keys.extend(
                right
                    .fields
                    .keys()
                    .filter(|key| !left.fields.contains_key(*key)),
            );
            keys.into_iter().find_map(|key| {
                difference(
                    left.fields.get(key),
                    right.fields.get(key),
                    &format!("{path}/{key}"),
                )
            })
        }
        (Some(Value::List(left)), Some(Value::List(right))) => (0..left.len().max(right.len()))
            .find_map(|index| {
                difference(
                    left.get(index),
                    right.get(index),
                    &format!("{path}/{index}"),
                )
            }),
        (Some(left), Some(right)) if left == right => None,
        _ => report(),
    }
}

/// The first path where two programs differ in meaning, or `None`.
pub fn meaning_difference(left: &Node, right: &Node) -> Option<String> {
    difference(
        Some(&Value::Node(essence(left))),
        Some(&Value::Node(essence(right))),
        "",
    )
}

pub fn same_meaning(left: &Node, right: &Node) -> bool {
    meaning_difference(left, right).is_none()
}
