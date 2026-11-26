//! The standard library of the meta language.
//!
//! Writing a line of text or asking for the length of an array is no part
//! of the meta language itself: it is a call to a procedure that every
//! target provides under its own name (`console.log`, `print`, `puts`,
//! `printf`, `System.out.println`, `len`, `.length`, ...). The general form
//! of such a statement is a call:
//!
//! ```text
//! Evaluate { expression: Call { callee: "print-line", library: "standard",
//!                               arguments: [value] } }
//! ```
//!
//! The translator works on the specialised concepts (`Print`, `Length`),
//! whose fields the emitters and the context rules know; [`generalize`]
//! writes a tree in the general form and [`specialize`] reads it back, so a
//! meta program written with plain calls to the standard library
//! translates to every language. The JavaScript twin is
//! js/src/meta/library.js.

use super::tree::{Node, Value, rewrite};

/// The name of the standard library in the `library` field of a call.
pub const STANDARD_LIBRARY: &str = "standard";

/// A procedure of the standard library and the concept it stands for.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Procedure {
    pub name: &'static str,
    pub concept: &'static str,
    pub parameters: &'static [&'static str],
    /// The value of the concept's `newline` field, for printing.
    pub newline: Option<bool>,
    /// Called for its effect, as a statement.
    pub statement: bool,
}

/// The procedures of the standard library.
pub const STANDARD_PROCEDURES: [Procedure; 3] = [
    Procedure {
        name: "print-line",
        concept: "Print",
        parameters: &["value"],
        newline: Some(true),
        statement: true,
    },
    Procedure {
        name: "print",
        concept: "Print",
        parameters: &["value"],
        newline: Some(false),
        statement: true,
    },
    Procedure {
        name: "length",
        concept: "Length",
        parameters: &["array"],
        newline: None,
        statement: false,
    },
];

fn library_call(callee: &str, argument: Option<Value>, mut call: Node) -> Node {
    call.kind = "Call".to_owned();
    call.set("callee", callee);
    call.set("library", STANDARD_LIBRARY);
    call.set("arguments", Value::List(argument.into_iter().collect()));
    call
}

fn general_node(mut tree: Node) -> Node {
    match tree.kind.as_str() {
        "Print" => {
            let callee = if tree.flag("newline") == Some(true) {
                "print-line"
            } else {
                "print"
            };
            let value = tree.remove("value");
            tree.remove("newline");
            tree.kind = "Evaluate".to_owned();
            let call = library_call(callee, value, Node::new("Call"));
            tree.with("expression", call)
        }
        "Length" => {
            let array = tree.remove("array");
            library_call("length", array, tree)
        }
        _ => tree,
    }
}

/// The procedure of the standard library a call names, when it takes the
/// arguments the procedure needs.
fn procedure_of(call: Option<&Node>) -> Option<&'static Procedure> {
    let call = call.filter(|it| it.is("Call") && it.str("library") == Some(STANDARD_LIBRARY))?;
    let procedure = STANDARD_PROCEDURES
        .iter()
        .find(|it| Some(it.name) == call.str("callee"))?;
    let count = call
        .get("arguments")
        .and_then(Value::as_list)
        .map_or(0, <[Value]>::len);
    (count == procedure.parameters.len()).then_some(procedure)
}

fn concept(procedure: &Procedure, call: &Node, mut rest: Node) -> Node {
    rest.kind = procedure.concept.to_owned();
    let arguments = call
        .get("arguments")
        .and_then(Value::as_list)
        .unwrap_or(&[]);
    for (parameter, argument) in procedure.parameters.iter().zip(arguments) {
        rest.set(parameter, argument.clone());
    }
    if let Some(newline) = procedure.newline {
        rest.set("newline", newline);
    }
    rest
}

fn special_node(mut tree: Node) -> Node {
    if tree.is("Evaluate")
        && let Some(procedure) = procedure_of(tree.node("expression"))
        && procedure.statement
        && let Some(Value::Node(call)) = tree.remove("expression")
    {
        return concept(procedure, &call, tree);
    }
    if let Some(procedure) = procedure_of(Some(&tree))
        && !procedure.statement
    {
        let call = tree.clone();
        for field in ["callee", "library", "arguments"] {
            tree.remove(field);
        }
        return concept(procedure, &call, tree);
    }
    tree
}

/// Concepts -> calls to the standard library.
pub fn generalize(tree: Node) -> Node {
    rewrite(tree, general_node)
}

/// Calls to the standard library -> concepts.
pub fn specialize(tree: Node) -> Node {
    rewrite(tree, special_node)
}
