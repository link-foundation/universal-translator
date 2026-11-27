//! Rule layers. Each rule is a small, named function from tree to tree, so
//! callers can reorder, remove, replace or decorate any of them.
//!
//! "understanding" rules turn a parsed source program into the language
//! independent meta program; "meaning" rules run after type inference;
//! "context" rules adapt the program to its target (for example comments).

use std::collections::HashSet;
use std::sync::Arc;

use super::arrays::{expand_array_fills, raise_array_fills, recognize_arrays};
use super::common_library::{recognize_common_library, spell_common_library};
use super::documentation::recognize_documentation;
use super::for_each::{expand_for_each, raise_for_each};
use super::languages::{Blocks, ImmutableParameters, IntegerDivision, Syntax, language_syntax};
use super::lifting::counting_loops;
use super::names::{
    ascii_name, avoid_reserved, name_words, neutral_name, rename_declared, spell_name,
};
use super::numbers::{arithmetic_operator, slash_operator};
use super::questions::recognize_questions;
use super::versions::{split_version, versions_of, with_version};
use crate::meta::truth::raise_truth_functions;
use crate::meta::{Mode, Rule, Settings};
use crate::meta::{Node, binary, block, layout, rewrite, rewrite_opt, text, walk};

fn rule(name: &str, apply: impl Fn(Node, &Settings) -> Node + Send + Sync + 'static) -> Rule {
    Rule {
        name: name.to_owned(),
        apply: Arc::new(apply),
    }
}

/// The rules that turn a parsed source program into a meta program.
pub fn understanding_rules() -> Vec<Rule> {
    vec![
        rule("recognizeDocumentation", recognize_documentation),
        rule("recognizeSqlValues", super::sql_values::recognize),
        rule("recognizeObjpak", super::objpak::recognize_objpak),
        rule("findEntryPoint", |program, _| find_entry_point(program)),
        rule("recognizeQuestions", recognize_questions),
        rule("concatenationOperator", concatenation_operator),
        rule("integerDivisionCalls", integer_division_calls),
        rule("recognizeArrays", recognize_arrays),
        rule("recognizeCommonLibrary", |program, _| {
            recognize_common_library(program)
        }),
        rule("recognizePrint", recognize_print),
        rule("dropTextConversions", drop_text_conversions),
        rule("dropEmptyStatements", drop_empty_statements),
        rule("expandCompoundAssignment", |program, settings| {
            let syntax = language_syntax(&settings.from).ok();
            expand_compound_assignment(program, syntax.as_ref())
        }),
        rule("dropParameterCopies", |program, _| {
            drop_parameter_copies(program)
        }),
        rule("declareOnFirstAssignment", |program, _| {
            declare_on_first_assignment(program)
        }),
        rule("raiseCountingLoops", |program, _| {
            raise_counting_loops(program)
        }),
        rule("raiseArrayFills", |program, _| raise_array_fills(program)),
        rule("raiseForEach", |program, _| raise_for_each(program)),
        rule("raiseTruthValues", raise_truth_values),
        rule("inferMutability", |program, _| infer_mutability(program)),
        rule("dropSourceDetails", |program, _| {
            drop_source_details(program)
        }),
        rule("neutralNames", |program, _| neutral_names(program)),
    ]
}

/// The rules that run after type inference.
pub fn meaning_rules() -> Vec<Rule> {
    vec![
        rule(
            "raiseIntegerArithmetic",
            crate::meta::integer_arithmetic::raise,
        ),
        rule("concatenationToInterpolation", |program, _| {
            concatenation_to_interpolation(program)
        }),
        rule(
            "normalizeObjectiveCConditions",
            super::objpak::normalize_objc_conditions,
        ),
    ]
}

/// The rules that adapt a meta program to its target.
pub fn context_rules() -> Vec<Rule> {
    vec![
        rule("adaptComments", adapt_comments),
        rule("copyReassignedParameters", copy_reassigned_parameters),
        rule("expandArrayFills", expand_array_fills),
        rule("expandForEach", expand_for_each),
        rule("spellNames", spell_names),
        rule("spellCommonLibrary", spell_common_library),
    ]
}

// ---------------------------------------------------------------------------
// Understanding layer
// ---------------------------------------------------------------------------

/// `i = a; while (i < b) { ...; i += 1 }` is the counting loop `for i in a..b`
/// written at a lower level, as languages without a counting loop over a
/// computed range (R, for example) spell it. Raising it lets every language
/// write its own counting loop again.
pub fn raise_counting_loops(program: Node) -> Node {
    rewrite(program, |mut current| {
        if current.is("Block") {
            let statements = counting_loops(current.node_list("statements"));
            current.set("statements", statements);
        }
        current
    })
}

/// Perl writes true and false as 1 and 0.
pub fn raise_truth_values(program: Node, settings: &Settings) -> Node {
    let words = language_syntax(&settings.from)
        .ok()
        .and_then(|syntax| syntax.words);
    if words.is_some_and(|(truth, _)| truth == "1") {
        raise_truth_functions(program)
    } else {
        program
    }
}

fn flatten_classes(items: Vec<Node>) -> Vec<Node> {
    items
        .into_iter()
        .flat_map(|item| {
            if item.is("Class") {
                flatten_classes(item.node_list("items"))
            } else {
                vec![item]
            }
        })
        .collect()
}

/// "Program.square" for every function of a class of the program.
fn class_function_names(items: &[Node], owner: Option<&str>, names: &mut HashSet<String>) {
    for item in items {
        if item.is("Class") {
            class_function_names(&item.node_list("items"), item.str("name"), names);
        } else if let (Some(owner), true) = (owner, item.is("Function")) {
            names.insert(format!("{owner}.{}", item.str("name").unwrap_or_default()));
        }
    }
}

/// `Program.square(3)` calls a function of the program. The classes are
/// flattened, so the call names the plain function.
fn unqualify_class_calls(program: Node, items: &[Node]) -> Node {
    let mut qualified = HashSet::new();
    class_function_names(items, None, &mut qualified);
    if qualified.is_empty() {
        return program;
    }
    rewrite(program, |mut current| {
        let callee = current.str("callee").map(str::to_string);
        if let Some(callee) =
            callee.filter(|callee| current.is("Call") && qualified.contains(callee))
        {
            let last = callee.rsplit('.').next().unwrap_or_default().to_string();
            current.set("callee", last);
        }
        current
    })
}

fn is_call_to(statement: &Node, function_name: &str) -> bool {
    statement.is("Evaluate")
        && statement.node("expression").is_some_and(|expression| {
            expression.is("Call")
                && expression.str("callee") == Some(function_name)
                && expression.nodes("arguments").is_empty()
        })
}

fn is_python_main_guard(statement: &Node) -> bool {
    statement.is("If")
        && statement.node("condition").is_some_and(|condition| {
            condition.is("Binary")
                && condition
                    .node("left")
                    .is_some_and(|left| left.is_name("__name__"))
        })
}

/// Sort top-level items into file comments, imports, functions and
/// statements. Comments directly above a function belong to that function.
fn collect_items(items: Vec<Node>) -> Node {
    let mut comments = Vec::new();
    let mut imports = Vec::new();
    let mut functions = Vec::new();
    let mut statements = Vec::new();
    let mut pending: Vec<Node> = Vec::new();
    for item in items {
        if item.is("Comment") || item.is("Blank") {
            pending.push(item);
            continue;
        }
        if imports.len() + functions.len() + statements.len() == 0 {
            // Comments before the last empty line describe the file; the
            // ones after it (all of them without an empty line) describe
            // the first item.
            if let Some(split) = pending.iter().rposition(|trivia| trivia.is("Blank")) {
                let rest = pending.split_off(split + 1);
                comments.extend(pending.iter().filter(|node| node.is("Comment")).cloned());
                pending = rest;
            }
        }
        // An empty line after a function is kept only where the source has one.
        if let Some(previous) = functions.last_mut() {
            let previous: &mut Node = previous;
            if previous.get("blankAfter").is_none() {
                let blank = pending.iter().any(|trivia| trivia.is("Blank"));
                previous.set("blankAfter", blank);
            }
        }
        if item.is("Import") {
            // An import keeps no comments: the ones above it describe the file.
            comments.extend(pending.iter().filter(|node| node.is("Comment")).cloned());
            imports.push(item.str("text").unwrap_or_default().to_owned());
        } else if item.is("Function") {
            functions.push(crate::source_origins::attach_comments(
                item, "comments", &pending,
            ));
        } else {
            statements.append(&mut pending);
            statements.push(item);
        }
        pending.clear();
    }
    statements.append(&mut pending);
    crate::source_origins::attach_comments(
        Node::new("Program")
            .with("imports", imports)
            .with("functions", functions)
            .with("main", block(layout(statements))),
        "comments",
        &comments,
    )
}

fn is_exit_success(statement: Option<&Node>) -> bool {
    statement.is_some_and(|statement| {
        statement.is("Return")
            && statement
                .node("value")
                .is_some_and(|value| value.is_number(0.0))
    })
}

/// Collect functions, the entry point and file comments into a Program. The
/// body of `main` becomes the program's main block.
pub fn find_entry_point(source: Node) -> Node {
    let items = source.node_list("items");
    let mut program = unqualify_class_calls(collect_items(flatten_classes(items.clone())), &items);
    let mut functions = program.node_list("functions");
    let Some(index) = functions
        .iter()
        .position(|item| matches!(item.str("name"), Some("main" | "Main")))
    else {
        return program;
    };
    let entry = functions.remove(index);
    let entry_name = entry.str("name").unwrap_or_default();
    let main = program
        .node("main")
        .cloned()
        .unwrap_or_else(|| block(vec![]));
    let mut statements: Vec<Node> = main
        .node_list("statements")
        .into_iter()
        .filter(|statement| !is_call_to(statement, entry_name) && !is_python_main_guard(statement))
        .collect();
    if let Some(body) = entry.node("body") {
        statements.extend(body.node_list("statements"));
    }
    // `return 0;` at the end of C's main is the default exit status.
    if is_exit_success(statements.last()) {
        statements.pop();
    }
    program.set("functions", functions);
    program.set("main", block(statements));
    program.set("mainComments", entry.texts("comments"));
    crate::source_origins::attach_comment_origins(
        program,
        "mainComments",
        crate::source_origins::comment_origins(&entry, "comments"),
    )
}

const LINE_CALLS: [&str; 9] = [
    "console.log",
    "print",
    "puts",
    "System.Console.WriteLine",
    "Console.WriteLine",
    "System.out.println",
    "fmt.Println",
    "println",
    "Console.Out.WriteLine",
];

const TEXT_CALLS: [&str; 7] = [
    "System.Console.Write",
    "Console.Write",
    "System.out.print",
    "fmt.Print",
    "process.stdout.write",
    "sys.stdout.write",
    "io.write",
];

#[derive(Clone, Copy, PartialEq, Eq)]
enum FormatStyle {
    Percent,
    Braces,
}

fn format_call(callee: &str) -> Option<FormatStyle> {
    match callee {
        "printf" | "fmt.Printf" => Some(FormatStyle::Percent),
        "println!" | "print!" => Some(FormatStyle::Braces),
        _ => None,
    }
}

fn join_with_spaces(values: Vec<Node>) -> Node {
    join_with(values, &text(" "))
}

fn join_with(mut values: Vec<Node>, separator: &Node) -> Node {
    if values.len() == 1 {
        return values.remove(0);
    }
    let mut parts = Vec::new();
    for (index, value) in values.into_iter().enumerate() {
        if index > 0 {
            parts.push(separator.clone());
        }
        parts.push(value);
    }
    Node::new("Interpolation").with("parts", parts)
}

/// The length of the placeholder starting at `index`, if one does.
fn placeholder_length(format: &[char], index: usize, style: FormatStyle) -> Option<usize> {
    let at = |offset: usize| format.get(index + offset).copied();
    match style {
        FormatStyle::Percent => {
            if at(0) != Some('%') {
                return None;
            }
            let mut length = 1;
            while length < 3 && at(length) == Some('l') {
                length += 1;
            }
            if at(length) == Some('d') {
                return Some(length + 1);
            }
            if length == 1 && matches!(at(1), Some('i' | 's' | 'c' | 'v' | 't' | '%')) {
                return Some(2);
            }
            // A real: %f, %g, %e, %G, with a precision such as %.2f.
            let mut length = 1;
            if at(1) == Some('.') && at(2).is_some_and(|c| c.is_ascii_digit()) {
                length = 2;
                while at(length).is_some_and(|c| c.is_ascii_digit()) {
                    length += 1;
                }
            }
            if at(length) == Some('l') {
                length += 1;
            }
            matches!(at(length), Some('f' | 'g' | 'e' | 'G')).then_some(length + 1)
        }
        FormatStyle::Braces => match (at(0), at(1)) {
            (Some('{'), Some('{' | '}')) | (Some('}'), Some('}')) => Some(2),
            _ => None,
        },
    }
}

fn read_format(format: &str, values: &[Node], style: FormatStyle) -> Vec<Node> {
    let characters: Vec<char> = format.chars().collect();
    let mut parts = Vec::new();
    let mut literal = String::new();
    let mut next_value = values.iter();
    let mut index = 0;
    while index < characters.len() {
        let Some(length) = placeholder_length(&characters, index, style) else {
            literal.push(characters[index]);
            index += 1;
            continue;
        };
        if !literal.is_empty() {
            parts.push(text(std::mem::take(&mut literal)));
        }
        let placeholder: String = characters[index..index + length].iter().collect();
        match placeholder.as_str() {
            "%%" => parts.push(text("%")),
            "{{" => parts.push(text("{")),
            "}}" => parts.push(text("}")),
            _ => parts.extend(next_value.next().cloned()),
        }
        index += length;
    }
    if !literal.is_empty() {
        parts.push(text(literal));
    }
    parts
}

fn text_value(node: &Node) -> Option<&str> {
    if node.is("Text") {
        node.str("value")
    } else {
        None
    }
}

pub fn parts_to_value(parts: Vec<Node>) -> Node {
    let mut merged: Vec<Node> = Vec::new();
    for part in parts {
        if let (Some(value), Some(previous)) =
            (text_value(&part), merged.last().and_then(text_value))
        {
            let joined = format!("{previous}{value}");
            *merged.last_mut().expect("a previous part") = text(joined);
        } else if text_value(&part) != Some("") {
            merged.push(part);
        }
    }
    match merged.len() {
        0 => text(""),
        // A format with a single placeholder prints just that value.
        1 => merged.remove(0),
        _ => Node::new("Interpolation").with("parts", merged),
    }
}

fn without_trailing_newline(mut parts: Vec<Node>) -> (Vec<Node>, bool) {
    let stripped = parts
        .last()
        .and_then(text_value)
        .and_then(|value| value.strip_suffix('\n'))
        .map(str::to_owned);
    match stripped {
        Some(value) => {
            parts.pop();
            parts.push(text(value));
            (parts, true)
        }
        None => (parts, false),
    }
}

fn stream_parts(expression: &Node) -> Vec<Node> {
    if expression.is("Binary") && expression.str("operator") == Some("stream") {
        let mut parts = expression
            .node("left")
            .map(stream_parts)
            .unwrap_or_default();
        parts.extend(expression.node("right").cloned());
        return parts;
    }
    vec![expression.clone()]
}

fn print(value: Node, newline: bool) -> Node {
    Node::new("Print")
        .with("value", value)
        .with("newline", newline)
}

/// Whether an output procedure ends the line or writes text as it is.
#[derive(Clone, Copy, PartialEq, Eq)]
enum PrintKind {
    Line,
    Text,
}

/// Which kind of output procedure a call names, from the source language's
/// own output procedures where it lists them.
fn print_kind(callee: &str, syntax: Option<&Syntax>) -> Option<PrintKind> {
    if let Some(own) = syntax.and_then(|syntax| syntax.print_calls) {
        return if own.line.contains(&callee) {
            Some(PrintKind::Line)
        } else if own.text.contains(&callee) {
            Some(PrintKind::Text)
        } else {
            None
        };
    }
    if LINE_CALLS.contains(&callee) {
        Some(PrintKind::Line)
    } else if TEXT_CALLS.contains(&callee) || callee == "echo" {
        Some(PrintKind::Text)
    } else {
        None
    }
}

/// The parts of the printed values, with interpolations spread out.
fn spread_interpolations(values: Vec<Node>) -> Vec<Node> {
    values
        .into_iter()
        .flat_map(|value| {
            if value.is("Interpolation") {
                value.node_list("parts")
            } else {
                vec![value]
            }
        })
        .collect()
}

/// The value of the last named argument called one of `names`.
fn named_value<'a>(named: &'a [Node], names: [&str; 2]) -> Option<&'a Node> {
    named
        .iter()
        .rev()
        .find(|argument| {
            argument
                .str("name")
                .is_some_and(|name| names.contains(&name))
        })
        .and_then(|argument| argument.node("value"))
}

/// Python's `print(..., sep=, end=)` and Swift's `print(..., separator:,
/// terminator:)`: an empty end keeps the line open (`""` reads as an empty
/// interpolation where quotes interpolate), and any other end is printed
/// after the values, so `end="!"` is not lost.
fn print_line(values: Vec<Node>, named: &[Node]) -> Node {
    let joined = match (values.is_empty(), named_value(named, ["sep", "separator"])) {
        (true, _) => text(""),
        (false, Some(separator)) => join_with(values, separator),
        (false, None) => join_with_spaces(values),
    };
    let Some(end) = named_value(named, ["end", "terminator"]) else {
        return print(joined, true);
    };
    if text_value(end) == Some("") || (end.is("Interpolation") && end.node_list("parts").is_empty())
    {
        return print(joined, false);
    }
    let (parts, newline) =
        without_trailing_newline(spread_interpolations(vec![joined, end.clone()]));
    print(parts_to_value(parts), newline)
}

fn print_from_call(call: &Node, syntax: Option<&Syntax>) -> Option<Node> {
    let callee = call.str("callee").unwrap_or_default();
    let kind = print_kind(callee, syntax);
    let arguments = call.node_list("arguments");
    let (named, values): (Vec<Node>, Vec<Node>) = arguments
        .into_iter()
        .partition(|value| value.is("NamedArgument"));
    // D's writeln prints its arguments one after another, without spaces.
    let adjacent = syntax.and_then(|syntax| syntax.print_calls);
    if kind == Some(PrintKind::Line) && adjacent.is_some_and(|calls| calls.adjacent) {
        return Some(print(parts_to_value(spread_interpolations(values)), true));
    }
    if kind == Some(PrintKind::Line) {
        return Some(print_line(values, &named));
    }
    if kind == Some(PrintKind::Text) {
        let (parts, newline) = without_trailing_newline(spread_interpolations(values));
        return Some(print(parts_to_value(parts), newline));
    }
    let style = format_call(callee)?;
    let format = values.first().and_then(text_value)?;
    let (parts, newline) = without_trailing_newline(read_format(format, &values[1..], style));
    Some(print(
        parts_to_value(parts),
        newline || callee == "println!",
    ))
}

fn ends_with(node: Option<&Node>, suffix: &str) -> bool {
    node.is_some_and(|node| {
        node.is("Name") && node.str("name").is_some_and(|name| name.ends_with(suffix))
    })
}

/// Replace each known output procedure with the Print concept.
/// The statement an indentation language writes into an empty block
/// (Python's `pass`, Nim's `discard`) does nothing, so it is no statement of
/// the meta language. Without this rule `pass` read back as a variable.
pub fn drop_empty_statements(program: Node, settings: &Settings) -> Node {
    let Ok(syntax) = language_syntax(&settings.from) else {
        return program;
    };
    if syntax.blocks != Blocks::Indentation {
        return program;
    }
    let empty = syntax.empty_statement.unwrap_or("pass");
    rewrite_opt(program.clone(), |current| {
        let is_empty = current.is("Evaluate")
            && current.node("expression").is_some_and(|expression| {
                expression.is("Name") && expression.str("name") == Some(empty)
            });
        (!is_empty).then_some(current)
    })
    .unwrap_or(program)
}

pub fn recognize_print(program: Node, settings: &Settings) -> Node {
    let syntax = language_syntax(&settings.from).ok();
    rewrite(program, |current| {
        if !current.is("Evaluate") {
            return current;
        }
        let Some(expression) = current.node("expression") else {
            return current;
        };
        if expression.is("Call") {
            return print_from_call(expression, syntax.as_ref()).unwrap_or(current);
        }
        if expression.is("Binary") && expression.str("operator") == Some("stream") {
            let mut values = stream_parts(expression);
            let stream = values.remove(0);
            if ends_with(Some(&stream), "cout") {
                if ends_with(values.last(), "endl") {
                    values.pop();
                    values.push(text("\n"));
                }
                let (parts, newline) = without_trailing_newline(values);
                return print(parts_to_value(parts), newline);
            }
        }
        current
    })
}

/// `str(total)` printed or joined to a text converts only what printing and
/// interpolation already convert, so the conversion is dropped there.
pub fn drop_text_conversions(program: Node, settings: &Settings) -> Node {
    let Ok(syntax) = language_syntax(&settings.from) else {
        return program;
    };
    let conversions = syntax.text_conversions;
    if conversions.is_empty() {
        return program;
    }
    let is_conversion = |value: &Node| -> bool {
        value.is("Call")
            && value
                .str("callee")
                .is_some_and(|callee| conversions.contains(&callee))
            && value.node_list("arguments").len() == 1
    };
    let unwrap = |value: Node| -> Node {
        if is_conversion(&value) {
            return value.node_list("arguments").remove(0);
        }
        value
    };
    fn is_text(value: &Node) -> bool {
        value.is("Text")
            || value.is("Interpolation")
            || (value.is("Binary")
                && value.str("operator") == Some("add")
                && (value.node("left").is_some_and(is_text)
                    || value.node("right").is_some_and(is_text)))
    }
    // The parts of text joined with +: `"n is " + str(n) + ", half "` is the
    // text, n and the text again.
    fn parts_of(value: Node, unwrap: &dyn Fn(Node) -> Node) -> Vec<Node> {
        if value.is("Interpolation") {
            return value.node_list("parts");
        }
        if value.is("Binary") && value.str("operator") == Some("add") && is_text(&value) {
            let mut parts = Vec::new();
            for side in ["left", "right"] {
                if let Some(side) = value.node(side).cloned() {
                    parts.extend(parts_of(side, unwrap));
                }
            }
            return parts;
        }
        vec![unwrap(value)]
    }
    // `str(n) + str(n)` joins two texts: it is the interpolation of n and n,
    // not the sum n + n.
    let joined = |current: &Node| -> Node {
        let parts: Vec<Node> = ["left", "right"]
            .into_iter()
            .filter_map(|side| current.node(side).cloned())
            .flat_map(|value| parts_of(value, &unwrap))
            .collect();
        Node::new("Interpolation").with("parts", parts)
    };
    rewrite(program, |current| {
        if current.is("Print") {
            return match current.node("value").cloned() {
                Some(value) => current.with("value", unwrap(value)),
                None => current,
            };
        }
        if current.is("Interpolation") {
            let parts: Vec<Node> = current.node_list("parts").into_iter().map(unwrap).collect();
            return current.with("parts", parts);
        }
        let added = current.is("Binary") && current.str("operator") == Some("add");
        if added
            && (current.node("left").is_some_and(is_conversion)
                || current.node("right").is_some_and(is_conversion))
        {
            return joined(&current);
        }
        if added && is_text(&current) {
            let mut changed = current;
            for side in ["left", "right"] {
                if let Some(value) = changed.node(side).cloned() {
                    changed.set(side, unwrap(value));
                }
            }
            return changed;
        }
        current
    })
}

/// Map the function bodies and the main block of a program.
fn map_bodies(mut program: Node, mut change: impl FnMut(&Node, Node) -> Node) -> Node {
    let functions: Vec<Node> = program
        .node_list("functions")
        .into_iter()
        .map(|mut item| {
            let body = item.node("body").cloned().unwrap_or_else(|| block(vec![]));
            let body = change(&item, body);
            item.set("body", body);
            item
        })
        .collect();
    program.set("functions", functions);
    program
}

fn parameter_names(item: &Node) -> Vec<String> {
    item.nodes("parameters")
        .iter()
        .filter_map(|parameter| parameter.str("name").map(str::to_owned))
        .collect()
}

/// Add the names a tree reads to a set.
fn add_read_names(tree: &Node, names: &mut HashSet<String>) {
    walk(tree, |current| {
        if current.is("Name") {
            names.extend(current.str("name").map(str::to_owned));
        }
    });
}

/// Declares variables in one function body; the scope spans nested blocks.
/// `read` holds the names read so far: a variable read before its first
/// assignment comes from outside and is not declared there.
struct Declarer {
    scope: HashSet<String>,
    read: HashSet<String>,
}

impl Declarer {
    fn new(scope: HashSet<String>) -> Self {
        Declarer {
            scope,
            read: HashSet::new(),
        }
    }

    fn visit_block(&mut self, mut current: Node) -> Node {
        let statements: Vec<Node> = current
            .node_list("statements")
            .into_iter()
            .map(|statement| self.visit_statement(statement))
            .collect();
        current.set("statements", statements);
        current
    }

    fn visit_field(&mut self, statement: &mut Node, field: &str) {
        if let Some(body) = statement.node(field).cloned() {
            let visited = self.visit_block(body);
            statement.set(field, visited);
        }
    }

    fn read_field(&mut self, statement: &Node, field: &str) {
        if let Some(expression) = statement.node(field) {
            add_read_names(expression, &mut self.read);
        }
    }

    fn visit_statement(&mut self, mut statement: Node) -> Node {
        match statement.kind.as_str() {
            "If" => {
                self.read_field(&statement, "condition");
                self.visit_field(&mut statement, "then");
                if let Some(otherwise) = statement.node("otherwise").cloned() {
                    let visited = if otherwise.is("Block") {
                        self.visit_block(otherwise)
                    } else {
                        self.visit_statement(otherwise)
                    };
                    statement.set("otherwise", visited);
                }
                return statement;
            }
            "While" => {
                self.read_field(&statement, "condition");
                self.visit_field(&mut statement, "body");
                return statement;
            }
            "CountingLoop" => {
                self.read_field(&statement, "start");
                self.read_field(&statement, "end");
                if let Some(variable) = statement.str("variable") {
                    self.scope.insert(variable.to_owned());
                }
                self.visit_field(&mut statement, "body");
                return statement;
            }
            "ForEach" => {
                self.read_field(&statement, "array");
                if let Some(variable) = statement.str("variable") {
                    self.scope.insert(variable.to_owned());
                }
                self.visit_field(&mut statement, "body");
                return statement;
            }
            _ => {}
        }
        // The value is read before the variable is assigned.
        add_read_names(&statement, &mut self.read);
        let name = statement.str("name").unwrap_or_default().to_owned();
        if statement.is("Assignment")
            && statement.str("operator") == Some("=")
            && !self.scope.contains(&name)
            && !self.read.contains(&name)
        {
            self.scope.insert(name.clone());
            // A Python hint (`total: int = 0`) gives the declared type.
            return crate::source_origins::inherit(
                Node::new("Declaration")
                    .with("name", name)
                    .with_opt("type", statement.str("type"))
                    .with_opt("value", statement.node("value").cloned())
                    .with("mutable", true),
                &statement,
            );
        }
        if statement.is("Declaration") {
            self.scope.insert(name);
        }
        statement
    }
}

/// Languages without declarations (Python, Ruby, PHP) declare a variable by
/// assigning it for the first time. A variable read before its first
/// assignment (`x = x + 1`, or `if x > 0` above `x = 0`) is not declared
/// there: it comes from outside, as in a statement translated on its own.
pub fn declare_on_first_assignment(program: Node) -> Node {
    let mut program = map_bodies(program, |item, body| {
        Declarer::new(parameter_names(item).into_iter().collect()).visit_block(body)
    });
    if let Some(main) = program.node("main").cloned() {
        let main = Declarer::new(HashSet::new()).visit_block(main);
        program.set("main", main);
    }
    program
}

fn assigned_names(tree: &Node, kind: &str) -> HashSet<String> {
    let mut assigned = HashSet::new();
    walk(tree, |current| {
        if current.is(kind) {
            assigned.extend(current.str("name").map(str::to_owned));
        }
    });
    assigned
}

/// A variable is mutable exactly when the program assigns it again. An array
/// whose elements the program assigns is marked too: Rust, Swift and Nim
/// declare it like a mutable variable.
pub fn infer_mutability(program: Node) -> Node {
    let mut assigned = assigned_names(&program, "Assignment");
    let mut stored = assigned_names(&program, "IndexAssignment");
    walk(&program, |current| {
        if current.is("AssignmentExpression") {
            assigned.extend(current.str("name").map(str::to_owned));
        }
        if current.is("Update")
            && let Some(operand) = current.node("operand")
            && operand.is("Name")
        {
            assigned.insert(operand.str("name").unwrap_or_default().to_owned());
        }
        if current.is("SetInsert")
            && let Some(collection) = current.node("collection")
            && collection.is("Name")
        {
            stored.insert(collection.str("name").unwrap_or_default().to_owned());
        }
        if current.is("Call")
            && let Some((receiver, method)) =
                current.str("callee").unwrap_or_default().rsplit_once('.')
            && [
                "push", "pop", "shift", "unshift", "splice", "sort", "reverse", "append", "extend",
                "insert", "remove", "clear",
            ]
            .contains(&method)
        {
            stored.insert(receiver.to_owned());
        }
    });
    rewrite(program, |mut current| {
        if !current.is("Declaration") {
            return current;
        }
        let name = current.str("name").unwrap_or_default().to_owned();
        current.remove("elementsAssigned");
        if stored.contains(&name) {
            current.set("elementsAssigned", true);
        }
        current.with("mutable", assigned.contains(&name))
    })
}

pub fn drop_source_details(program: Node) -> Node {
    rewrite(program, |mut current| {
        if current.is("Return") && current.flag("implicit") == Some(true) {
            current.remove("implicit");
        }
        current
    })
}

fn compound_meaning(operator: &str, from: Option<&Syntax>) -> Option<&'static str> {
    match operator {
        "+=" => Some("add"),
        "-=" => Some("subtract"),
        "*=" => Some("multiply"),
        "/=" => Some(from.map_or("divide", slash_operator)),
        "//=" => Some(from.map_or("divide", |syntax| {
            arithmetic_operator(syntax, "//", "divide")
        })),
        "%=" => Some(from.map_or("remainder", |syntax| {
            arithmetic_operator(syntax, "%", "remainder")
        })),
        _ => None,
    }
}

/// `x += v` means `x = x + v`; the meta language keeps only the plain form.
/// Operators without a meaning (the parser produces none) stay as written.
/// `/=` divides like the `/` of the source language.
pub fn expand_compound_assignment(program: Node, from: Option<&Syntax>) -> Node {
    rewrite(program, |current| {
        if !current.is("Assignment") {
            return current;
        }
        let meaning = current
            .str("operator")
            .and_then(|operator| compound_meaning(operator, from));
        let Some(operator) = meaning else {
            return current;
        };
        let name = current.str("name").unwrap_or_default().to_owned();
        let mut value = Node::new("Binary")
            .with("operator", operator)
            .with("left", Node::new("Name").with("name", name.clone()));
        if operator == "floorDivide" && current.str("operator") == Some("/=") {
            value.set("slashDivision", true);
        }
        value.set_opt("right", current.node("value").cloned());
        Node::new("Assignment")
            .with("name", name)
            .with("operator", "=")
            .with("value", value)
    })
}

fn flatten_parts(parts: &[Option<&Node>]) -> Vec<Node> {
    parts
        .iter()
        .flatten()
        .flat_map(|part| {
            if part.is("Interpolation") {
                part.node_list("parts")
            } else {
                vec![(*part).clone()]
            }
        })
        .collect()
}

/// PHP's "." operator and R's `paste0(...)` join text: the same concept as
/// an interpolation.
pub fn concatenation_operator(program: Node, settings: &Settings) -> Node {
    let call = language_syntax(&settings.from)
        .ok()
        .and_then(|syntax| syntax.concatenate_call);
    rewrite(program, |current| {
        if current.is("Binary") && current.str("operator") == Some("concatenate") {
            return parts_to_value(flatten_parts(&[
                current.node("left"),
                current.node("right"),
            ]));
        }
        if current.is("Call") && call.is_some() && current.str("callee") == call {
            let arguments = current.nodes("arguments");
            let parts: Vec<Option<&Node>> = arguments.into_iter().map(Some).collect();
            return parts_to_value(flatten_parts(&parts));
        }
        current
    })
}

/// Languages without an integer division operator call a library procedure:
/// JavaScript writes `Math.trunc(a / b)`, Perl `int(a / b)`, PHP
/// `intdiv(a, b)`, Julia `div(a, b)` and Groovy `a.intdiv(b)`. Each means
/// the meta operator "divide". The language description names its spelling.
const INTEGER_DIVISION_SPELLINGS: [IntegerDivision; 4] = [
    IntegerDivision::Wrapper("Math.trunc"),
    IntegerDivision::Wrapper("~~"),
    IntegerDivision::Wrapper("int"),
    IntegerDivision::Call("intdiv"),
];

fn integer_division(call: &Node, spelling: IntegerDivision, operator: &str) -> Option<Node> {
    let callee = call.str("callee").unwrap_or_default();
    let arguments = call.node_list("arguments");
    let divide = |left: Node, right: Node| binary(operator, left, right);
    match (spelling, arguments.as_slice()) {
        (IntegerDivision::Wrapper(wrapper), [first])
            if callee == wrapper
                && first.is("Binary")
                && matches!(
                    first.str("operator"),
                    Some("divide" | "floorDivide" | "realDivide")
                ) =>
        {
            Some(first.clone().with("operator", operator))
        }
        (IntegerDivision::Call(own), [first, second]) if callee == own => {
            Some(divide(first.clone(), second.clone()))
        }
        (IntegerDivision::Method(method), [first, second])
            if callee.strip_prefix('.') == Some(method) =>
        {
            Some(divide(first.clone(), second.clone()))
        }
        // a.intdiv(b) with a named receiver reads as the callee "a.intdiv".
        (IntegerDivision::Method(method), [first]) => {
            let receiver = callee.strip_suffix(method)?.strip_suffix('.')?;
            Some(divide(
                Node::new("Name").with("name", receiver),
                first.clone(),
            ))
        }
        _ => None,
    }
}

/// The spellings of the language a program is read from, in every version
/// of it: Lua 5.1 writes `math.floor(a / b)` for Lua 5.3's `a // b`.
fn own_integer_divisions(from: &str) -> Vec<IntegerDivision> {
    let (id, _) = split_version(from);
    let Ok(syntax) = language_syntax(id) else {
        return Vec::new();
    };
    std::iter::once(syntax.integer_division)
        .chain(versions_of(id).into_iter().map(|version| {
            with_version(syntax.clone(), Some(version.version))
                .ok()
                .and_then(|syntax| syntax.integer_division)
        }))
        .flatten()
        .collect()
}

pub fn integer_division_calls(program: Node, settings: &Settings) -> Node {
    let own_operator =
        if crate::meta::integer_arithmetic::floor_division(split_version(&settings.from).0) {
            "floorDivide"
        } else {
            "divide"
        };
    let spellings = own_integer_divisions(&settings.from)
        .into_iter()
        .map(|spelling| (spelling, own_operator))
        .chain(
            INTEGER_DIVISION_SPELLINGS
                .into_iter()
                .map(|spelling| (spelling, "divide")),
        )
        .chain([(IntegerDivision::Wrapper("Math.floor"), "floorDivide")])
        .collect::<Vec<_>>();
    rewrite(program, |current| {
        if !current.is("Call") {
            return current;
        }
        spellings
            .iter()
            .find_map(|(spelling, operator)| integer_division(&current, *spelling, operator))
            .unwrap_or(current)
    })
}

/// The neutral name of the parameter that a copy named `name` is made from.
fn copy_name(name: &str) -> String {
    let mut words = vec!["initial".to_owned()];
    words.extend(name_words(name));
    words.join("-")
}

/// `let mut first = first;` at the start of a Rust, Kotlin or Swift function
/// only exists because parameters are immutable there, as does Scala's
/// `var first: Long = initialFirst`. Both are details of the source language
/// (see copyReassignedParameters), not part of the meaning: the parameter
/// takes the name of its copy.
pub fn drop_parameter_copies(mut program: Node) -> Node {
    let functions: Vec<Node> = program
        .node_list("functions")
        .into_iter()
        .map(|mut item| {
            let mut parameters = item.node_list("parameters");
            let mut body = item.node("body").cloned().unwrap_or_else(|| block(vec![]));
            let mut statements = body.node_list("statements");
            while let Some(index) = statements
                .first()
                .and_then(|statement| copied_parameter(statement, &parameters))
            {
                let copy = statements.remove(0);
                parameters[index].set("name", copy.str("name").unwrap_or_default());
            }
            body.set("statements", statements);
            item.set("parameters", parameters);
            item.set("body", body);
            item
        })
        .collect();
    program.set("functions", functions);
    program
}

/// The index of the parameter that a declaration copies, if it is a copy.
fn copied_parameter(statement: &Node, parameters: &[Node]) -> Option<usize> {
    if !statement.is("Declaration") {
        return None;
    }
    let value = statement.node("value").filter(|value| value.is("Name"))?;
    let source = value.str("name")?;
    let local = statement.str("name").unwrap_or_default();
    parameters.iter().position(|parameter| {
        let name = parameter.str("name").unwrap_or_default();
        name == source && (name == local || copy_name(local) == neutral_name(name))
    })
}

/// `greatest_common_divisor` and `greatestCommonDivisor` are one name.
pub fn neutral_names(program: Node) -> Node {
    rename_declared(program, |identifier, _| neutral_name(identifier))
}

// ---------------------------------------------------------------------------
// Meaning layer (after type inference)
// ---------------------------------------------------------------------------

/// `"Total: " + total` is text concatenation, which the meta language keeps
/// as one interpolation independent of the target's operator.
pub fn concatenation_to_interpolation(program: Node) -> Node {
    rewrite(program, |current| {
        let joins_text = current.is("Binary")
            && current.str("operator") == Some("add")
            && current.str("type") == Some("text");
        if !joins_text {
            return current;
        }
        let value = parts_to_value(flatten_parts(&[
            current.node("left"),
            current.node("right"),
        ]));
        // `"" + year` is the text of `year`: the name keeps its own type.
        if value.is("Text") || value.is("Interpolation") {
            value.with("type", "text")
        } else {
            Node::new("Interpolation")
                .with("parts", vec![value])
                .with("type", "text")
        }
    })
}

// ---------------------------------------------------------------------------
// Context layer: adapt comments to the target language.
// ---------------------------------------------------------------------------

fn is_word_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || character == '_'
}

/// Replace every occurrence of `pattern` whose surroundings pass `before`
/// (the character in front, if any) and `after` (the character behind).
fn replace_bounded(
    value: &str,
    pattern: &str,
    replacement: &str,
    before: impl Fn(Option<char>) -> bool,
    after: impl Fn(Option<char>) -> bool,
) -> String {
    let mut result = String::new();
    let mut rest = value;
    let mut previous = None;
    while let Some(index) = rest.find(pattern) {
        let in_front =
            rest[..index]
                .chars()
                .next_back()
                .or(if index == 0 { previous } else { None });
        let behind = rest[index + pattern.len()..].chars().next();
        if before(in_front) && after(behind) {
            result.push_str(&rest[..index]);
            result.push_str(replacement);
            previous = pattern.chars().next_back();
            rest = &rest[index + pattern.len()..];
        } else {
            let skip = index + rest[index..].chars().next().map_or(1, char::len_utf8);
            result.push_str(&rest[..skip]);
            previous = rest[..skip].chars().next_back();
            rest = &rest[skip..];
        }
    }
    result.push_str(rest);
    result
}

/// Rename the source language and its terms in a comment: "in C" becomes
/// "in C#", "function call" becomes "method call".
pub fn adapt_comment_text(comment: &str, source: &Syntax, target: &Syntax) -> String {
    let not_word = |character: Option<char>| !character.is_some_and(is_word_character);
    let mut result = replace_bounded(
        comment,
        &format!("in {}", source.label),
        &format!("in {}", target.label),
        not_word,
        |character| !character.is_some_and(|c| is_word_character(c) || c == '#' || c == '+'),
    );
    let pairs = [
        (source.terms.call, target.terms.call),
        (source.terms.routine, target.terms.routine),
    ];
    for (source_word, target_word) in pairs {
        if source_word != target_word {
            result = replace_bounded(&result, source_word, target_word, not_word, not_word);
        }
    }
    result
}

fn adapt_function_comments(program: &mut Node, adapt: impl Fn(&str) -> String) {
    let functions: Vec<Node> = program
        .node_list("functions")
        .into_iter()
        .map(|item| {
            let comments: Vec<String> = item.texts("comments").iter().map(|c| adapt(c)).collect();
            item.with("comments", comments)
        })
        .collect();
    program.set("functions", functions);
}

/// Change the text of every comment of a program: comment statements, the
/// comments before the program and its main function, and the comments of
/// each function.
pub fn map_comments(program: Node, mut change: impl FnMut(&str) -> String) -> Node {
    let mut adapted = rewrite(program, |current| {
        if !current.is("Comment") {
            return current;
        }
        let changed = change(current.str("text").unwrap_or_default());
        current.with("text", changed)
    });
    for key in ["comments", "mainComments"] {
        let texts: Vec<String> = adapted.texts(key).iter().map(|text| change(text)).collect();
        adapted.set(key, texts);
    }
    let functions: Vec<Node> = adapted
        .node_list("functions")
        .into_iter()
        .map(|item| {
            let comments: Vec<String> = item
                .texts("comments")
                .iter()
                .map(|text| change(text))
                .collect();
            item.with("comments", comments)
        })
        .collect();
    adapted.set("functions", functions);
    adapted
}

pub fn adapt_comments(program: Node, settings: &Settings) -> Node {
    if settings.mode == Mode::SameEffect {
        let mut stripped = rewrite_opt(program, |current| {
            (!current.is("Comment")).then_some(current)
        })
        .unwrap_or_else(|| Node::new("Program"));
        stripped.set("comments", Vec::<String>::new());
        stripped.set("mainComments", Vec::<String>::new());
        let functions: Vec<Node> = stripped
            .node_list("functions")
            .into_iter()
            .map(|item| item.with("comments", Vec::<String>::new()))
            .collect();
        stripped.set("functions", functions);
        return stripped;
    }
    if settings.mode == Mode::Literal || settings.from == settings.to {
        return program;
    }
    let (Ok(source), Ok(target)) = (
        language_syntax(&settings.from),
        language_syntax(&settings.to),
    ) else {
        return program;
    };
    let adapt = |value: &str| adapt_comment_text(value, &source, &target);
    let mut adapted = rewrite(program, |current| {
        if !current.is("Comment") {
            return current;
        }
        let changed = adapt(current.str("text").unwrap_or_default());
        current.with("text", changed)
    });
    let comments: Vec<String> = adapted.texts("comments").iter().map(|c| adapt(c)).collect();
    let main_comments: Vec<String> = adapted
        .texts("mainComments")
        .iter()
        .map(|c| adapt(c))
        .collect();
    adapted.set("comments", comments);
    adapted.set("mainComments", main_comments);
    adapt_function_comments(&mut adapted, adapt);
    adapted
}

/// Rust, Kotlin and Swift parameters cannot be reassigned. When a function
/// assigns a parameter, the target works on a mutable local copy instead.
///
/// Scala cannot declare a local with the name of a parameter, so there the
/// parameter itself is renamed: `def f(initialFirst: Long)` with
/// `var first: Long = initialFirst`.
pub fn copy_reassigned_parameters(mut program: Node, settings: &Settings) -> Node {
    let immutable = language_syntax(&settings.to).map_or(ImmutableParameters::No, |syntax| {
        syntax.immutable_parameters
    });
    if immutable == ImmutableParameters::No {
        return program;
    }
    let renamed = immutable == ImmutableParameters::Renamed;
    let functions: Vec<Node> = program
        .node_list("functions")
        .into_iter()
        .map(|mut item| {
            let body = item.node("body").cloned().unwrap_or_else(|| block(vec![]));
            let assigned = assigned_names(&body, "Assignment");
            let source = |name: &str| {
                if renamed && assigned.contains(name) {
                    copy_name(name)
                } else {
                    name.to_owned()
                }
            };
            let mut statements: Vec<Node> = item
                .nodes("parameters")
                .into_iter()
                .filter(|parameter| {
                    parameter
                        .str("name")
                        .is_some_and(|name| assigned.contains(name))
                })
                .map(|parameter| {
                    let name = parameter.str("name").unwrap_or_default();
                    let kind = parameter.str("type");
                    Node::new("Declaration")
                        .with("name", name)
                        .with_opt("type", kind)
                        .with(
                            "value",
                            Node::new("Name")
                                .with("name", source(name))
                                .with_opt("type", kind),
                        )
                        .with("mutable", true)
                })
                .collect();
            if statements.is_empty() {
                return item;
            }
            let parameters: Vec<Node> = item
                .node_list("parameters")
                .into_iter()
                .map(|mut parameter| {
                    let name = source(parameter.str("name").unwrap_or_default());
                    parameter.set("name", name);
                    parameter
                })
                .collect();
            statements.extend(body.node_list("statements"));
            item.set("parameters", parameters);
            item.set("body", block(statements));
            item
        })
        .collect();
    program.set("functions", functions);
    program
}

/// Spell every declared name in the target's naming convention.
pub fn spell_names(program: Node, settings: &Settings) -> Node {
    let Ok(syntax) = language_syntax(&settings.to) else {
        return program;
    };
    rename_declared(program, |identifier, role| {
        let spelled = spell_name(identifier, syntax.naming_convention(role));
        avoid_reserved(ascii_name(spelled, syntax.id, syntax.machine), syntax.id)
    })
}
