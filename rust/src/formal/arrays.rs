//! Arrays of integers in the meta language (see meta.rs): the rules that read
//! each language's array spellings into ArrayLiteral, NewArray, Index and
//! Length, and the rules that move between NewArray and the fill loop that
//! languages without a filled array constructor write instead.

use std::collections::HashSet;

use super::languages::{ArrayFill, Syntax, language_syntax};
use crate::meta::Settings;
use crate::meta::for_each::{fresh_name, used_names};
use crate::meta::{Node, block, essence, name, number, rewrite, walk};

/// `index + delta` with the constants folded, so that adding 1 for a
/// language that counts from 1 and subtracting it again gives back the
/// original index: `a[i] <-> a[i + 1]`, `a[i + 1] <-> a[i + 2]`,
/// `a[i - 1] <-> a[i]`.
pub fn offset(expression: Node, delta: i64) -> Node {
    if delta == 0 {
        return expression;
    }
    if expression.is("Number") {
        return number(expression.number("value").unwrap_or(0.0) + delta as f64);
    }
    if expression.is("Binary") {
        let operator = expression.str("operator").unwrap_or_default();
        let right = expression.node("right").and_then(|right| {
            if right.is("Number") {
                right.number("value")
            } else {
                None
            }
        });
        if let Some(value) = right
            && (operator == "add" || operator == "subtract")
            && value > 0.0
        {
            let current = if operator == "add" { value } else { -value };
            let left = expression
                .node("left")
                .cloned()
                .unwrap_or_else(|| number(0.0));
            return offset(left, current as i64 + delta);
        }
    }
    Node::new("Binary")
        .with("operator", if delta > 0 { "add" } else { "subtract" })
        .with("left", expression)
        .with("right", number(delta.unsigned_abs() as f64))
}

/// The index of the first element: 0, or 1 in Lua, Julia, R, Fortran and
/// MATLAB.
pub fn array_base(syntax: &Syntax) -> i64 {
    syntax.array_base
}

pub fn is_array_value(value: Option<&Node>) -> bool {
    value.is_some_and(|value| value.is("ArrayLiteral") || value.is("NewArray"))
}

fn same_expression(left: &Node, right: &Node) -> bool {
    essence(left) == essence(right)
}

pub fn mentions(tree: &Node, identifier: &str) -> bool {
    let mut found = false;
    walk(tree, |current| {
        if current.is_name(identifier) {
            found = true;
        }
    });
    found
}

// ---------------------------------------------------------------------------
// Reading: library spellings of the array concepts
// ---------------------------------------------------------------------------

fn call(expression: &Node, callee: &str, count: Option<usize>) -> bool {
    expression.is("Call")
        && expression.str("callee") == Some(callee)
        && count.is_none_or(|count| expression.nodes("arguments").len() == count)
}

fn argument(expression: &Node, index: usize) -> Node {
    expression.node_list("arguments").swap_remove(index)
}

fn new_array(length: Node, fill: Node) -> Node {
    Node::new("NewArray")
        .with("length", length)
        .with("fill", fill)
}

fn array_literal(elements: Vec<Node>) -> Node {
    Node::new("ArrayLiteral").with("elements", elements)
}

/// How a language creates an array with a call: the meta node, or `None`
/// when the expression is something else.
fn construct(language: &str, expression: &Node) -> Option<Node> {
    let arguments = expression.nodes("arguments");
    let filled = |callee: &str, length: usize, fill: usize| {
        call(expression, callee, Some(2))
            .then(|| new_array(argument(expression, length), argument(expression, fill)))
    };
    match language {
        "javascript" | "typescript" => {
            let made = arguments.first()?;
            (call(expression, ".fill", Some(2)) && call(made, "new Array", Some(1)))
                .then(|| new_array(argument(made, 0), argument(expression, 1)))
        }
        "python" | "groovy" => {
            let left = expression.node("left")?;
            (expression.is("Binary")
                && expression.str("operator") == Some("multiply")
                && left.is("ArrayLiteral")
                && left.nodes("elements").len() == 1)
                .then(|| {
                    new_array(
                        expression.node("right").cloned()?,
                        left.node_list("elements").swap_remove(0),
                    )
                    .into()
                })
                .flatten()
        }
        "ruby" => filled("Array.new", 0, 1),
        "php" => (call(expression, "array_fill", Some(3)) && arguments[0].is_number(0.0))
            .then(|| new_array(argument(expression, 1), argument(expression, 2))),
        "go" => (call(expression, "make", Some(2)) && arguments[0].is("ArrayType"))
            .then(|| new_array(argument(expression, 1), number(0.0))),
        "kotlin" => call(expression, "intArrayOf", None)
            .then(|| array_literal(expression.node_list("arguments"))),
        "dart" => filled("List.filled", 0, 1),
        "scala" => call(expression, "Array", None)
            .then(|| array_literal(expression.node_list("arguments"))),
        "julia" => filled("fill", 1, 0),
        "r" => {
            if call(expression, "c", None) {
                return Some(array_literal(expression.node_list("arguments")));
            }
            filled("rep", 1, 0)
        }
        "nim" => filled("newSeqWith", 0, 1),
        "fortran" => (call(expression, "spread", Some(3)) && arguments[1].is_number(1.0))
            .then(|| new_array(argument(expression, 2), argument(expression, 0))),
        // Pascal: SetLength(a, n) gives a the length n, filled with zeros.
        "pascal" => {
            let made = expression.node("expression")?;
            let made_arguments = made.nodes("arguments");
            (expression.is("Evaluate")
                && made.is("Call")
                && made.str("callee")?.to_lowercase() == "setlength"
                && made_arguments.len() == 2
                && made_arguments[0].is("Name"))
            .then(|| {
                Node::new("Assignment")
                    .with("name", made_arguments[0].str("name").unwrap_or_default())
                    .with("operator", "=")
                    .with("value", new_array(argument(made, 1), number(0.0)))
            })
        }
        "matlab" => (call(expression, "repmat", Some(3)) && arguments[1].is_number(1.0))
            .then(|| new_array(argument(expression, 2), argument(expression, 0))),
        _ => None,
    }
}

/// Calls that return the length of the array they are given.
const LENGTH_CALLS: [&str; 5] = ["len", "length", "count", "numel", "scalar"];
/// Properties and methods that return the length of their receiver.
const LENGTH_MEMBERS: [&str; 5] = ["length", "Length", "size", "count", "len"];

/// The names a program declares with an array value or type, or indexes (a
/// fragment may use an array it does not declare).
fn array_names(program: &Node) -> HashSet<String> {
    let mut names = HashSet::new();
    walk(program, |current| {
        if (current.is("Declaration") || current.is("Assignment"))
            && (is_array_value(current.node("value")) || current.str("type") == Some("array"))
        {
            names.extend(current.str("name").map(str::to_owned));
        }
        if let Some(array) = current.node("array").filter(|_| current.is("Index"))
            && array.is("Name")
        {
            names.extend(array.str("name").map(str::to_owned));
        }
        if current.is("IndexAssignment") {
            names.extend(current.str("name").map(str::to_owned));
        }
        // Fortran: size(a, kind=8) only measures arrays.
        let arguments = current.nodes("arguments");
        if current.is("Call")
            && current.str("callee") == Some("size")
            && arguments.get(1).is_some_and(|it| it.is("NamedArgument"))
            && let Some(first) = arguments.first().filter(|it| it.is("Name"))
        {
            names.extend(first.str("name").map(str::to_owned));
        }
    });
    names
}

/// The array a member spelling such as `a.length` or `a.len()` names.
fn member_array(spelling: &str, arrays: &HashSet<String>) -> Option<String> {
    let dot = spelling.rfind('.')?;
    let owner = &spelling[..dot];
    (dot > 0 && arrays.contains(owner) && LENGTH_MEMBERS.contains(&&spelling[dot + 1..]))
        .then(|| owner.to_owned())
}

fn length(owner: String) -> Node {
    Node::new("Length").with("array", name(owner))
}

fn length_of(expression: &Node, arrays: &HashSet<String>) -> Option<Node> {
    if expression.is("Name") {
        return member_array(expression.str("name")?, arrays).map(length);
    }
    if !expression.is("Call") {
        return None;
    }
    let arguments = expression.nodes("arguments");
    let callee = expression.str("callee")?;
    let Some(first) = arguments.first() else {
        return member_array(callee, arrays).map(length);
    };
    // Fortran asks for the size as an integer(8): size(a, kind=8).
    let known = LENGTH_CALLS.contains(&callee.to_lowercase().as_str())
        || (callee == "size"
            && arguments
                .get(1)
                .is_some_and(|second| second.is("NamedArgument")));
    let owner = first.str("name").filter(|_| first.is("Name"))?;
    (known && arrays.contains(owner)).then(|| length(owner.to_owned()))
}

/// C: sizeof a / sizeof a[0].
fn size_of_length(expression: &Node) -> Option<Node> {
    let left = expression.node("left")?.node("operand")?;
    let right = expression.node("right")?.node("operand")?;
    (expression.is("Binary")
        && expression.str("operator") == Some("divide")
        && expression.node("left")?.is("SizeOf")
        && expression.node("right")?.is("SizeOf")
        && left.is("Name")
        && right.is("Index")
        && right.node("array")?.str("name") == left.str("name"))
    .then(|| Node::new("Length").with("array", left.clone()))
}

/// Read every array spelling of the source language into the meta nodes.
/// Constructors come first, so that the names they declare are known when
/// `a.length` or, where parentheses index (Scala, MATLAB, Fortran, Visual
/// Basic, Ada), `a(i)` is read.
pub fn recognize_arrays(program: Node, settings: &Settings) -> Node {
    let Ok(syntax) = language_syntax(&settings.from) else {
        return program;
    };
    let language = syntax.family.unwrap_or(syntax.id);
    let functions: HashSet<String> = program
        .nodes("functions")
        .iter()
        .filter_map(|item| item.str("name").map(str::to_owned))
        .collect();
    let constructed = rewrite(program, |current| {
        construct(language, &current).unwrap_or(current)
    });
    let arrays = array_names(&constructed);
    let base = array_base(&syntax);
    rewrite(constructed, |current| {
        // Scala indexes with an Int: a(i.toInt).
        if current.is("Name")
            && let Some(owner) = current
                .str("name")
                .and_then(|name| name.strip_suffix(".toInt"))
        {
            return name(owner);
        }
        if current.is("Method") && current.str("name") == Some("toInt") {
            return current.node("receiver").cloned().unwrap_or(current);
        }
        if let Some(length) = length_of(&current, &arrays).or_else(|| size_of_length(&current)) {
            return length;
        }
        let callee = current.str("callee").unwrap_or_default();
        if current.is("Call")
            && arrays.contains(callee)
            && !functions.contains(callee)
            && current.nodes("arguments").len() == 1
        {
            return Node::new("Index")
                .with("array", name(callee))
                .with("index", offset(argument(&current, 0), -base));
        }
        current
    })
}

// ---------------------------------------------------------------------------
// Fill loops
// ---------------------------------------------------------------------------

/// The loop `for i in 0..n: a[i] = v` right after `a = NewArray(n, 0)` (or
/// after `a = []` where an array grows as it is filled) is the array
/// `NewArray(n, v)` written at a lower level.
fn filled_array(declaration: Option<&Node>, loop_: &Node) -> Option<Node> {
    let declaration = declaration?;
    let created = declaration.node("value")?;
    let empty = created.is("ArrayLiteral") && created.nodes("elements").is_empty();
    let zero =
        created.is("NewArray") && created.node("fill").is_some_and(|fill| fill.is_number(0.0));
    let statements = loop_.node("body").map(|body| body.nodes("statements"));
    if !declaration.is("Declaration")
        || !(empty || zero)
        || !loop_.is("CountingLoop")
        || !loop_
            .node("start")
            .is_some_and(|start| start.is_number(0.0))
        || statements
            .as_ref()
            .is_none_or(|statements| statements.len() != 1)
    {
        return None;
    }
    let store = statements?[0];
    let array = declaration.str("name")?;
    let variable = loop_.str("variable")?;
    let end = loop_.node("end")?;
    let ends = |end: &Node| {
        (end.is("Length") && end.node("array").and_then(|array| array.str("name")) == Some(array))
            || (zero
                && created
                    .node("length")
                    .is_some_and(|length| same_expression(end, length)))
            || (empty && !mentions(end, array))
    };
    let index = store.node("index")?;
    let value = store.node("value")?;
    if !store.is("IndexAssignment")
        || store.str("name") != Some(array)
        || !index.is_name(variable)
        || mentions(value, variable)
        || mentions(value, array)
        || !ends(end)
    {
        return None;
    }
    let length = if zero {
        created.node("length")?.clone()
    } else {
        end.clone()
    };
    Some(
        declaration
            .clone()
            .with("value", new_array(length, value.clone())),
    )
}

pub fn raise_array_fills(program: Node) -> Node {
    rewrite(program, |mut current| {
        if !current.is("Block") {
            return current;
        }
        let mut statements: Vec<Node> = Vec::new();
        for statement in current.node_list("statements") {
            match filled_array(statements.last(), &statement) {
                Some(filled) => *statements.last_mut().expect("a declaration") = filled,
                None => statements.push(statement),
            }
        }
        current.set("statements", statements);
        current
    })
}

fn call_free(expression: &Node) -> bool {
    let mut free = true;
    walk(expression, |current| {
        if current.is("Call") {
            free = false;
        }
    });
    free
}

/// Languages without a filled array constructor (C, Java, Go, Pascal, Lua,
/// Bash and others, as `array_fill` in languages.rs says) create the array
/// and fill it with a counting loop.
pub fn expand_array_fills(mut program: Node, settings: &Settings) -> Node {
    let Some(style) = language_syntax(&settings.to)
        .ok()
        .and_then(|syntax| syntax.array_fill)
    else {
        return program;
    };
    let expand = |body: Node, parameters: &[&Node]| {
        let mut variable: Option<String> = None;
        let original = body.clone();
        rewrite(body, |mut current| {
            if !current.is("Block") {
                return current;
            }
            let mut statements = Vec::new();
            for statement in current.node_list("statements") {
                let created = statement
                    .node("value")
                    .filter(|_| statement.is("Declaration"))
                    .filter(|value| value.is("NewArray"))
                    .cloned();
                let Some(created) = created.filter(|created| {
                    style != ArrayFill::NonZero
                        || !created.node("fill").is_some_and(|fill| fill.is_number(0.0))
                }) else {
                    statements.push(statement);
                    continue;
                };
                let variable = variable
                    .get_or_insert_with(|| fresh_name(&used_names(&original, parameters)))
                    .clone();
                let empty = style == ArrayFill::Empty;
                let length = created
                    .node("length")
                    .cloned()
                    .unwrap_or_else(|| number(0.0));
                let fill = created.node("fill").cloned().unwrap_or_else(|| number(0.0));
                let array = statement.str("name").unwrap_or_default().to_owned();
                let value = if empty {
                    array_literal(Vec::new()).with("type", "array")
                } else {
                    created.clone().with("fill", number(0.0))
                };
                let end = if empty || call_free(&length) {
                    length
                } else {
                    Node::new("Length")
                        .with("array", name(array.clone()))
                        .with("type", "integer")
                };
                let store = Node::new("IndexAssignment")
                    .with("name", array)
                    .with("index", name(variable.clone()))
                    .with("value", fill);
                let loop_ = Node::new("CountingLoop")
                    .with("variable", variable)
                    .with("start", number(0.0))
                    .with("end", end)
                    .with("body", block(vec![store]));
                statements.push(statement.with("value", value));
                statements.push(loop_);
            }
            current.set("statements", statements);
            current
        })
    };
    let functions: Vec<Node> = program
        .node_list("functions")
        .into_iter()
        .map(|item| {
            let parameters = item.node_list("parameters");
            let references: Vec<&Node> = parameters.iter().collect();
            let body = item
                .node("body")
                .cloned()
                .unwrap_or_else(|| block(Vec::new()));
            let expanded = expand(body, &references);
            item.with("body", expanded)
        })
        .collect();
    program.set("functions", functions);
    if let Some(main) = program.node("main").cloned() {
        let expanded = expand(main, &[]);
        program.set("main", expanded);
    }
    program
}
