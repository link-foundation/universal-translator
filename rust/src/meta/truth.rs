//! Languages without a boolean type (Perl, and machine code) return truth
//! values as the integers 0 and 1. A function reads as returning a boolean
//! when every value it returns is 0, 1 or a truth value and every call to it
//! is used as a condition. Its literal returns then become false and true.

use std::collections::{HashMap, HashSet};

use super::tree::{Node, rewrite, walk};

const COMPARISONS: [&str; 6] = [
    "equal",
    "notEqual",
    "less",
    "lessOrEqual",
    "greater",
    "greaterOrEqual",
];

fn is_number(expression: Option<&Node>, values: &[f64]) -> bool {
    expression.is_some_and(|value| {
        value.is("Number")
            && value
                .number("value")
                .is_some_and(|number| values.contains(&number))
    })
}

fn is_logical(expression: &Node) -> bool {
    expression.is("Binary") && matches!(expression.str("operator"), Some("and" | "or"))
}

fn is_truth_value(expression: &Node, truth_functions: &HashSet<String>) -> bool {
    let operator = expression.str("operator").unwrap_or_default();
    match expression.kind.as_str() {
        "Boolean" => true,
        "Unary" => operator == "not",
        "Call" => truth_functions.contains(callee(expression)),
        "Binary" => COMPARISONS.contains(&operator) || is_logical(expression),
        _ => false,
    }
}

fn callee(call: &Node) -> &str {
    call.str("callee").unwrap_or_default()
}

/// `call != 0` and `call == 0` test a truth value written as an integer.
fn zero_test(expression: &Node) -> Option<&Node> {
    let tests = expression.is("Binary")
        && matches!(expression.str("operator"), Some("equal" | "notEqual"))
        && is_number(expression.node("right"), &[0.0]);
    expression
        .node("left")
        .filter(|left| tests && left.is("Call"))
}

/// Functions called somewhere other than as a condition.
fn used_otherwise(program: &Node) -> HashSet<String> {
    let mut as_condition: HashMap<String, usize> = HashMap::new();
    let mut all: HashMap<String, usize> = HashMap::new();
    let mut condition = |expression: Option<&Node>| {
        let Some(expression) = expression else {
            return;
        };
        let call = if expression.is("Call") {
            Some(expression)
        } else {
            zero_test(expression)
        };
        if let Some(call) = call {
            *as_condition.entry(callee(call).to_owned()).or_default() += 1;
        }
    };
    walk(program, |current| {
        if current.is("Call") {
            *all.entry(callee(current).to_owned()).or_default() += 1;
        }
        if current.is("If") || current.is("While") {
            condition(current.node("condition"));
        }
        if current.is("Unary") && current.str("operator") == Some("not") {
            condition(current.node("operand"));
        }
        if is_logical(current) {
            condition(current.node("left"));
            condition(current.node("right"));
        }
    });
    all.into_iter()
        .filter(|(name, total)| as_condition.get(name) != Some(total))
        .map(|(name, _)| name)
        .collect()
}

/// Every returned value is 0, 1 or a truth value; a function nobody calls
/// must also return at least one truth value besides 0 and 1.
fn returns_bits_or_truth(body: &Node, truth_functions: &HashSet<String>, called: bool) -> bool {
    let mut values = 0;
    let mut all = true;
    let mut truth = false;
    walk(body, |current| {
        if current.is("Return") {
            values += 1;
            let value = current.node("value");
            let is_truth = value.is_some_and(|value| is_truth_value(value, truth_functions));
            truth |= is_truth;
            all &= is_truth || is_number(value, &[0.0, 1.0]);
        }
    });
    values > 0 && all && (called || truth)
}

pub fn raise_truth_functions(program: Node) -> Node {
    let functions = program.node_list("functions");
    let otherwise = used_otherwise(&program);
    let mut called = HashSet::new();
    walk(&program, |current| {
        if current.is("Call") {
            called.insert(callee(current).to_owned());
        }
    });
    let candidates: Vec<&Node> = functions
        .iter()
        .filter(|item| {
            let name = item.str("name").unwrap_or_default();
            !otherwise.contains(name)
                && matches!(item.str("returnType"), None | Some("integer" | "boolean"))
        })
        .collect();
    // A function may return the result of another truth function, so the set
    // shrinks until every member returns only bits and truth values.
    let mut truth_functions: HashSet<String> = candidates
        .iter()
        .map(|item| item.str("name").unwrap_or_default().to_owned())
        .collect();
    loop {
        let kept: HashSet<String> = candidates
            .iter()
            .map(|item| (item.str("name").unwrap_or_default(), item))
            .filter(|(name, item)| {
                truth_functions.contains(*name)
                    && returns_bits_or_truth(
                        item.node("body").unwrap_or(item),
                        &truth_functions,
                        called.contains(*name),
                    )
            })
            .map(|(name, _)| name.to_owned())
            .collect();
        if kept.len() == truth_functions.len() {
            break;
        }
        truth_functions = kept;
    }
    if truth_functions.is_empty() {
        return program;
    }
    let raised: Vec<Node> = functions
        .into_iter()
        .map(|mut item| {
            if !truth_functions.contains(item.str("name").unwrap_or_default()) {
                return item;
            }
            if let Some(body) = item.node("body").cloned() {
                item.set("body", rewrite(body, raise_return));
            }
            if item.str("returnType").is_some() {
                item.set("returnType", "boolean");
            }
            item
        })
        .collect();
    let mut program = program;
    program.set("functions", raised);
    rewrite(program, |current| {
        let Some(call) = zero_test(&current) else {
            return current;
        };
        if !truth_functions.contains(callee(call)) {
            return current;
        }
        let call = call.clone();
        if current.str("operator") == Some("notEqual") {
            call
        } else {
            Node::new("Unary")
                .with("operator", "not")
                .with("operand", call)
        }
    })
}

fn raise_return(mut current: Node) -> Node {
    if current.is("Return") && is_number(current.node("value"), &[0.0, 1.0]) {
        let value = current
            .node("value")
            .and_then(|value| value.number("value"));
        current.set(
            "value",
            Node::new("Boolean").with("value", value == Some(1.0)),
        );
    }
    current
}
