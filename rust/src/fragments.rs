//! Fragments: a whole program, definitions, or statements, read and written
//! on their own.
//!
//! A fragment must be complete: a function ends with its closing, a block
//! statement with its end, and a single line statement is a whole
//! statement.
//!
//! Reading needs no grammar of its own. The source language writes its own
//! program shape around a marker (a main block holding a marker comment, or
//! a final function announced by a marker comment), the fragment replaces
//! the marker, and the whole text is parsed like any program. Writing works
//! the same way backwards: the target writes a program whose statements or
//! functions lie between two marker comments, and the text between the
//! markers is the fragment.

use std::fmt;

use regex::Regex;

use crate::formal::dialects::declared_variables;
use crate::formal::{emitter, languages};
use crate::meta::{GrammarError, Node, block, later_calls, number, same_meaning, types};
use crate::natural;
use crate::translator::{Options, Translator};

/// What a fragment holds.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FragmentKind {
    /// A whole program, with its main function or procedure where the
    /// language has one.
    Program,
    /// Function definitions only.
    Functions,
    /// Type definitions, optionally accompanied by functions.
    Definitions,
    /// Statements only.
    Statements,
}

impl FragmentKind {
    /// The kinds in the order a fragment is tried.
    pub const ALL: [FragmentKind; 4] = [
        FragmentKind::Program,
        FragmentKind::Functions,
        FragmentKind::Definitions,
        FragmentKind::Statements,
    ];

    /// The public name of the fragment kind.
    pub fn as_str(self) -> &'static str {
        match self {
            FragmentKind::Program => "program",
            FragmentKind::Functions => "functions",
            FragmentKind::Definitions => "definitions",
            FragmentKind::Statements => "statements",
        }
    }
}

impl fmt::Display for FragmentKind {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// A fragment read into the meta language.
#[derive(Clone, Debug, PartialEq)]
pub struct Fragment {
    pub kind: FragmentKind,
    /// The meta program of the fragment.
    pub program: Node,
}

const MARKER: &str = "universal-translator-fragment";
const START_MARKER: &str = "universal-translator-fragment-start";
const END_MARKER: &str = "universal-translator-fragment-end";

/// A variable that the declarations wrapper declares, to find where the
/// language writes its declarations.
const MARKER_VARIABLE: &str = "fragmentVariable";

/// The ways a fragment is wrapped into a program of its source language.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Wrapping {
    Functions,
    Statements,
    /// Statements with their declarations above them (Pascal's var block).
    Declarations,
}

fn comment(text: &str) -> Node {
    Node::new("Comment").with("text", text)
}

fn program(functions: Vec<Node>, statements: Vec<Node>, comments: Vec<String>) -> Node {
    Node::new("Program")
        .with("comments", comments)
        .with("imports", Vec::<Node>::new())
        .with("functions", functions)
        .with("main", block(statements))
}

/// A function that closes the wrapper: the fragment's functions stand
/// before it, and the marker comment above it shows where they go.
fn closing_function(comments: Vec<String>) -> Node {
    let function = Node::new("Function")
        .with("name", "fragmentEnd")
        .with("parameters", Vec::<Node>::new())
        .with("returnType", "integer")
        .with(
            "body",
            block(vec![Node::new("Return").with("value", number(0.0))]),
        )
        .with("comments", comments);
    types::infer_types(program(vec![function], Vec::new(), Vec::new())).node_list("functions")[0]
        .clone()
}

fn leading_space(line: &str) -> String {
    line.chars()
        .take_while(|character| character.is_whitespace())
        .collect()
}

/// Lines without their common indentation and without blank lines around.
fn dedent(lines: &[String]) -> Vec<String> {
    let first = lines.iter().position(|line| !line.trim().is_empty());
    let last = lines.iter().rposition(|line| !line.trim().is_empty());
    let (Some(first), Some(last)) = (first, last) else {
        return Vec::new();
    };
    let trimmed = &lines[first..=last];
    let common = trimmed
        .iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| leading_space(line).chars().count())
        .min()
        .unwrap_or(0);
    trimmed
        .iter()
        .map(|line| {
            if line.trim().is_empty() {
                String::new()
            } else {
                line.chars().skip(common).collect()
            }
        })
        .collect()
}

fn source_lines(source: &str) -> Vec<String> {
    source
        .replace("\r\n", "\n")
        .trim_end_matches('\n')
        .split('\n')
        .map(str::to_owned)
        .collect()
}

fn marker_line(lines: &[String], text: &str) -> Option<usize> {
    lines.iter().position(|line| line.contains(text))
}

/// The source language's program around a marker.
struct Wrapper {
    lines: Vec<String>,
    at: usize,
    /// The line that declares the variable apart from its first value.
    declaration: Option<usize>,
}

/// The source language's program around a marker, and where the fragment
/// goes: statements replace the marker line, functions stand above it. The
/// declarations wrapper also declares a variable; where the language writes
/// declarations apart from the statements (Pascal, Fortran, Ada), the
/// fragment's declarations go below that declaration.
fn wrapper(from: &str, wrapping: Wrapping) -> Result<Wrapper, GrammarError> {
    let shape = match wrapping {
        Wrapping::Statements => program(Vec::new(), vec![comment(MARKER)], Vec::new()),
        Wrapping::Declarations => types::infer_types(program(
            Vec::new(),
            vec![
                Node::new("Declaration")
                    .with("name", MARKER_VARIABLE)
                    .with("value", number(0.0))
                    .with("mutable", true),
                comment(MARKER),
            ],
            Vec::new(),
        )),
        Wrapping::Functions => program(
            vec![closing_function(vec![MARKER.to_owned()])],
            Vec::new(),
            Vec::new(),
        ),
    };
    let lines = source_lines(&emitter::emit_program(&shape, from)?);
    let at = marker_line(&lines, MARKER)
        .ok_or_else(|| GrammarError::new(format!("{from} cannot read fragments")))?;
    let declared: Vec<usize> = lines[..at]
        .iter()
        .enumerate()
        .filter(|(_, line)| line.contains(MARKER_VARIABLE))
        .map(|(index, _)| index)
        .collect();
    Ok(Wrapper {
        lines,
        at,
        declaration: if declared.len() > 1 {
            Some(declared[0])
        } else {
            None
        },
    })
}

/// A line of a wrapped fragment and the fragment line it comes from.
#[derive(Clone)]
struct Line {
    text: String,
    origin: Option<usize>,
}

fn indented(lines: &[Line], indent: &str) -> Vec<Line> {
    lines
        .iter()
        .map(|line| Line {
            text: if line.text.is_empty() {
                String::new()
            } else {
                format!("{indent}{}", line.text)
            },
            origin: line.origin,
        })
        .collect()
}

fn own(lines: &[String]) -> Vec<Line> {
    lines
        .iter()
        .map(|text| Line {
            text: text.clone(),
            origin: None,
        })
        .collect()
}

/// A wrapped fragment and, for each of its lines, the fragment line it
/// comes from.
struct Wrapped {
    text: String,
    origins: Vec<Option<usize>>,
}

/// The wrapped fragment, or `None` when the wrapping does not apply to the
/// language or the fragment.
fn wrap(source: &str, from: &str, wrapping: Wrapping) -> Result<Option<Wrapped>, GrammarError> {
    let Wrapper {
        lines,
        at,
        declaration,
    } = wrapper(from, wrapping)?;
    let all = source_lines(source);
    let leading = all
        .iter()
        .position(|line| !line.trim().is_empty())
        .unwrap_or(0);
    let fragment: Vec<Line> = dedent(&all)
        .into_iter()
        .enumerate()
        .map(|(index, text)| Line {
            text,
            origin: Some(leading + index + 1),
        })
        .collect();
    let indent = |index: usize| leading_space(&lines[index]);
    let parts: Vec<Line> = if wrapping == Wrapping::Declarations {
        // The declarations end at the first blank line of the fragment.
        let blank = if fragment.is_empty() {
            Some(0)
        } else {
            fragment.iter().position(|line| line.text.is_empty())
        };
        let (Some(declaration), Some(blank)) = (declaration, blank) else {
            return Ok(None);
        };
        let body = fragment
            .iter()
            .enumerate()
            .position(|(index, line)| index > blank && !line.text.is_empty());
        [
            own(&lines[..=declaration]),
            indented(&fragment[..blank], &indent(declaration)),
            own(&lines[declaration + 1..at]),
            indented(body.map_or(&[][..], |body| &fragment[body..]), &indent(at)),
            own(&lines[at + 1..]),
        ]
        .concat()
    } else {
        let after = if wrapping == Wrapping::Statements {
            at + 1
        } else {
            at
        };
        [
            own(&lines[..at]),
            indented(&fragment, &indent(at)),
            own(&lines[after..]),
        ]
        .concat()
    };
    let text: Vec<&str> = parts.iter().map(|line| line.text.as_str()).collect();
    Ok(Some(Wrapped {
        text: format!("{}\n", text.join("\n")),
        origins: parts.iter().map(|line| line.origin).collect(),
    }))
}

/// The fragment line of each line of the fragment read as it is.
fn own_origins(source: &str) -> Vec<Option<usize>> {
    (1..=source_lines(source).len()).map(Some).collect()
}

/// Why a reading of the fragment failed, and how far into the fragment it
/// went.
struct Failure {
    message: String,
    line: usize,
}

/// A syntax error reported at its line in the fragment. An error past the
/// last line of the fragment lies in the closing of the wrapper: the
/// fragment ended before something it opened was closed.
fn fragment_line(error: &GrammarError, origins: &[Option<usize>], count: usize) -> Failure {
    let Some(line) = error.line else {
        return Failure {
            message: error.to_string(),
            line: 0,
        };
    };
    let at = line.saturating_sub(1);
    let last = origins.iter().rposition(Option::is_some);
    if last.is_none_or(|last| at > last) {
        return Failure {
            message: format!("it ends before its closing (line {count})"),
            line: count + 1,
        };
    }
    let line = origins[..=at]
        .iter()
        .rev()
        .find_map(|origin| *origin)
        .unwrap_or(1);
    Failure {
        message: format!("{} (line {line})", error.message),
        line,
    }
}

/// An identifier as a whole word, or with the underscore that Fortran adds
/// to a name it reserves.
fn holds_name(line: &str, identifier: &str) -> bool {
    Regex::new(&format!(
        "(^|[^A-Za-z0-9_$]){}_?([^A-Za-z0-9_$]|$)",
        regex::escape(identifier)
    ))
    .is_ok_and(|pattern| pattern.is_match(line))
}

/// Languages that declare every variable before the first statement
/// (Pascal, Fortran, Ada) write the declarations of a statements fragment
/// above it: the lines that the statements add to the empty program and
/// that name a declared variable, with a one word heading above them
/// (Pascal's var).
fn declaration_lines(lines: &[String], empty_lines: &[String], declared: &[String]) -> Vec<String> {
    let added =
        |line: &str| !line.trim().is_empty() && !empty_lines.iter().any(|empty| empty == line);
    let heading = Regex::new(r"^\s*[A-Za-z0-9_]+$").expect("a valid pattern");
    let chosen: Vec<bool> = lines
        .iter()
        .map(|line| {
            added(line)
                && declared
                    .iter()
                    .any(|identifier| holds_name(line, identifier))
        })
        .collect();
    lines
        .iter()
        .enumerate()
        .filter(|(index, line)| {
            chosen[*index]
                || (added(line)
                    && heading.is_match(line)
                    && chosen.get(index + 1).copied().unwrap_or(false))
        })
        .map(|(_, line)| line.clone())
        .collect()
}

fn not_complete(message: &str) -> GrammarError {
    GrammarError::new(format!("The fragment is not complete: {message}"))
}

fn statements(meta: &Node) -> Vec<Node> {
    meta.node("main")
        .map(|main| main.node_list("statements"))
        .unwrap_or_default()
}

/// What a whole program read from the source holds.
fn program_kind(meta: &Node) -> Option<FragmentKind> {
    let has_functions = !meta.nodes("functions").is_empty();
    let has_definitions = !meta.nodes("definitions").is_empty();
    let has_statements = statements(meta)
        .iter()
        .any(|statement| !statement.is("Comment"));
    // A main function or procedure makes the source a program even when it
    // is empty.
    if meta.get("mainComments").is_some() || ((has_functions || has_definitions) && has_statements)
    {
        Some(FragmentKind::Program)
    } else if has_definitions {
        Some(FragmentKind::Definitions)
    } else if has_functions {
        Some(FragmentKind::Functions)
    } else if has_statements {
        Some(FragmentKind::Statements)
    } else {
        None
    }
}

fn list(nodes: Vec<Node>) -> Node {
    Node::new("List").with("items", nodes)
}

/// The fragment of a wrapped program, or a reason why the wrapper changed
/// shape (the fragment closed a block it did not open).
fn unwrap(meta: &Node, empty: &Node, wrapping: Wrapping) -> Result<Node, &'static str> {
    if !meta.nodes("definitions").is_empty() {
        return Err("it holds type definitions outside a complete program");
    }
    let functions = meta.node_list("functions");
    let empty_functions = empty.node_list("functions");
    if wrapping != Wrapping::Functions {
        if functions.len() != empty_functions.len()
            || !same_meaning(&list(functions), &list(empty_functions))
        {
            return Err("it closes the block around it");
        }
        let fragment: Vec<Node> = meta
            .texts("comments")
            .iter()
            .map(|text| comment(text))
            .chain(statements(meta).into_iter().skip(statements(empty).len()))
            .collect();
        return if fragment.iter().any(|statement| !statement.is("Comment")) {
            Ok(program(Vec::new(), fragment, Vec::new()))
        } else {
            Err("it holds no statement")
        };
    }
    let complete = functions.len() > empty_functions.len()
        && match (functions.last(), empty_functions.last()) {
            (Some(closing), Some(empty_closing)) => same_meaning(closing, empty_closing),
            _ => false,
        }
        && match (meta.node("main"), empty.node("main")) {
            (Some(main), Some(empty_main)) => same_meaning(main, empty_main),
            _ => false,
        };
    if !complete {
        return Err("it holds no complete function definition");
    }
    Ok(program(
        functions[..functions.len() - 1].to_vec(),
        Vec::new(),
        meta.texts("comments"),
    ))
}

fn is_machine_target(id: &str) -> bool {
    languages::machine_target_ids().contains(&id)
}

/// Read a fragment: the source as a whole program first, then as function
/// definitions, then as statements.
pub fn parse_fragment(
    translator: &Translator,
    source: &str,
    from: &str,
) -> Result<Fragment, GrammarError> {
    if source.trim().is_empty() {
        return Err(GrammarError::new("The fragment is empty"));
    }
    if natural::is_natural_language(from) || is_machine_target(from) {
        // Words are read sentence by sentence and need no wrapper; machine
        // code is read as whole programs only.
        let meta = translator.to_meta(source, from)?;
        let kind = if is_machine_target(from) {
            Some(FragmentKind::Program)
        } else {
            program_kind(&meta)
        };
        return match kind {
            Some(kind) => Ok(Fragment {
                kind,
                program: meta,
            }),
            None => Err(GrammarError::new(
                "The fragment holds no statement or function",
            )),
        };
    }
    languages::language_syntax(from)?;
    let count = source_lines(source)
        .iter()
        .rposition(|line| !line.trim().is_empty())
        .map_or(0, |index| index + 1);
    let mut failures = Vec::new();
    match translator.to_meta(source, from) {
        Ok(meta) => {
            if let Some(kind) = program_kind(&meta) {
                return Ok(Fragment {
                    kind,
                    program: meta,
                });
            }
            failures.push(Failure {
                message: "it holds no statement or function".to_owned(),
                line: 0,
            });
        }
        Err(error) => failures.push(fragment_line(&error, &own_origins(source), count)),
    }
    // Statements with their declarations above them (Pascal's var block)
    // are read last; plain statements are the most general reading, so
    // their failure comes last.
    let mut statements_failure = None;
    for wrapping in [
        Wrapping::Functions,
        Wrapping::Statements,
        Wrapping::Declarations,
    ] {
        let Some(wrapped) = wrap(source, from, wrapping)? else {
            continue;
        };
        let read = translator.to_meta(&wrapped.text, from).and_then(|meta| {
            let empty = wrap("", from, wrapping)?
                .ok_or_else(|| GrammarError::new(format!("{from} cannot read fragments")))?;
            Ok((meta, translator.to_meta(&empty.text, from)?))
        });
        let failure = match read {
            Ok((meta, empty)) => match unwrap(&meta, &empty, wrapping) {
                Ok(mut fragment) => {
                    crate::source_origins::remap_origins(&mut fragment, source, &wrapped.origins);
                    return Ok(Fragment {
                        kind: if wrapping == Wrapping::Functions {
                            FragmentKind::Functions
                        } else {
                            FragmentKind::Statements
                        },
                        program: fragment,
                    });
                }
                Err(problem) => Failure {
                    message: problem.to_owned(),
                    line: 0,
                },
            },
            Err(error) => fragment_line(&error, &wrapped.origins, count),
        };
        if wrapping == Wrapping::Statements {
            statements_failure = Some(failure);
        } else {
            failures.push(failure);
        }
    }
    failures.extend(statements_failure);
    // The reading that went furthest into the fragment explains best what
    // is missing; on a tie the last reading (statements) is the most
    // general one.
    let furthest = failures
        .into_iter()
        .reduce(|best, failure| {
            if failure.line >= best.line {
                failure
            } else {
                best
            }
        })
        .map(|failure| failure.message)
        .unwrap_or_default();
    Err(not_complete(&furthest))
}

fn with_fields(adapted: &Node, functions: Vec<Node>, main: Vec<Node>) -> Node {
    adapted
        .clone()
        .with("comments", Vec::<String>::new())
        .with("mainComments", Vec::<String>::new())
        .with("functions", functions)
        .with("main", block(main))
}

/// The lines before the start marker of the same program without its
/// statements.
fn empty_lines(
    translator: &Translator,
    shape: &Node,
    to: &str,
) -> Result<Vec<String>, GrammarError> {
    let empty = shape
        .clone()
        .with("main", block(vec![comment(START_MARKER)]));
    let lines = source_lines(&translator.emit_text(&empty, to)?);
    let start = marker_line(&lines, START_MARKER).unwrap_or(0);
    Ok(lines[..start].to_vec())
}

/// The adapted fragment written in the target, between marker comments.
fn write_between_markers(
    translator: &Translator,
    adapted: &Node,
    kind: FragmentKind,
    to: &str,
) -> Result<String, GrammarError> {
    let comments = adapted.texts("comments");
    let functions = adapted.nodes("functions");
    let shape = if kind == FragmentKind::Statements {
        let main: Vec<Node> = std::iter::once(comment(START_MARKER))
            .chain(comments.iter().map(|text| comment(text)))
            .chain(statements(adapted))
            .chain(std::iter::once(comment(END_MARKER)))
            .collect();
        with_fields(adapted, Vec::new(), main)
    } else if kind == FragmentKind::Definitions {
        let marked: Vec<String> = std::iter::once(START_MARKER.to_owned())
            .chain(comments.iter().cloned())
            .collect();
        let mut written: Vec<_> = functions.iter().map(|&item| item.clone()).collect();
        written.push(closing_function(vec![END_MARKER.to_owned()]));
        with_fields(adapted, written, Vec::new()).with("comments", marked)
    } else {
        let mut written: Vec<Node> = functions
            .iter()
            .enumerate()
            .map(|(index, &item)| {
                if index > 0 {
                    return item.clone();
                }
                let marked: Vec<String> = std::iter::once(START_MARKER.to_owned())
                    .chain(comments.iter().cloned())
                    .chain(item.texts("comments"))
                    .collect();
                item.clone().with("comments", marked)
            })
            .collect();
        written.push(closing_function(vec![END_MARKER.to_owned()]));
        with_fields(adapted, written, Vec::new())
    };
    let lines = source_lines(&translator.emit_text(&shape, to)?);
    let (Some(start), Some(end)) = (
        marker_line(&lines, START_MARKER),
        marker_line(&lines, END_MARKER),
    ) else {
        return Err(GrammarError::new(format!(
            "{to} cannot write {kind} on their own"
        )));
    };
    if end < start {
        return Err(GrammarError::new(format!(
            "{to} cannot write {kind} on their own"
        )));
    }
    let inner = dedent(&lines[start + 1..end]);
    if kind == FragmentKind::Definitions {
        return Ok(inner.join("\n") + "\n");
    }
    let above = if kind == FragmentKind::Statements {
        let declared: Vec<String> = adapted
            .node("main")
            .map(|main| {
                declared_variables(main, true)
                    .into_iter()
                    .map(|(name, _)| name)
                    .collect()
            })
            .unwrap_or_default();
        declaration_lines(
            &lines[..start],
            &empty_lines(translator, &shape, to)?,
            &declared,
        )
    } else {
        // Languages that read from top to bottom announce a function called
        // before its definition; the announcements belong to the fragment.
        let announced: Vec<String> = later_calls(functions)
            .iter()
            .filter_map(|item| item.str("name").map(str::to_owned))
            .collect();
        lines[..start]
            .iter()
            .filter(|line| {
                announced
                    .iter()
                    .any(|identifier| holds_name(line, identifier))
            })
            .cloned()
            .collect()
    };
    let parts = if above.is_empty() {
        inner
    } else {
        [dedent(&above), vec![String::new()], inner].concat()
    };
    Ok(format!("{}\n", parts.join("\n")))
}

/// Translate a fragment into the same kind of fragment in the target.
pub fn translate_fragment(
    translator: &Translator,
    source: &str,
    from: &str,
    to: &str,
    options: Options,
) -> Result<String, GrammarError> {
    let Fragment {
        kind,
        program: meta,
    } = parse_fragment(translator, source, from)?;
    let adapted = translator.adapt(&meta, to, Some(from), options)?;
    if kind == FragmentKind::Program || natural::is_natural_language(to) {
        return translator.write(&adapted, to);
    }
    if is_machine_target(to) {
        return Err(GrammarError::new(format!(
            "Machine targets hold whole programs only, not {kind} on their own ({to})"
        )));
    }
    write_between_markers(translator, &adapted, kind, to)
}

/// Comments that stand on their own as statements of the target (notes in
/// a natural language). Partial translation marks what it cannot translate
/// with them. The texts are kept as written (literal mode).
pub fn write_notes(
    translator: &Translator,
    texts: &[String],
    to: &str,
) -> Result<String, GrammarError> {
    write_source_notes(translator, texts, to, None)
}

pub(crate) fn write_source_notes(
    translator: &Translator,
    texts: &[String],
    to: &str,
    source: Option<&str>,
) -> Result<String, GrammarError> {
    let locator = source.map(crate::source_origins::SourceLocator::new);
    // A comment must not close a block comment early.
    let notes = texts
        .iter()
        .enumerate()
        .map(|(index, text)| {
            let mut note = comment(&text.replace("*/", "* /"));
            if let Some(locator) = &locator {
                note.origin = Some(locator.line(index.saturating_sub(1)));
            }
            note
        })
        .collect();
    let meta = program(Vec::new(), notes, Vec::new());
    let options = Options {
        mode: crate::Mode::Literal,
        ..Options::default()
    };
    let adapted = translator.adapt(&meta, to, Some(to), options)?;
    if natural::is_natural_language(to) || is_machine_target(to) {
        return translator.write(&adapted, to);
    }
    write_between_markers(translator, &adapted, FragmentKind::Statements, to)
}
