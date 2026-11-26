//! Helpers shared by the machine code readers (`machine_reader` and the
//! dialect readers next to it).

use regex::{Captures, Regex};

use super::lowering::{Instruction, LoweredProgram, Procedure};
use crate::meta::GrammarError;

pub(super) type Result<T> = std::result::Result<T, GrammarError>;

/// A read instruction, or `None` for the "push rax" that keeps the result
/// of the call before it.
pub(super) type Raw = Option<Instruction>;

pub(super) type Build<'a> = Box<dyn Fn(&[Captures]) -> Result<Option<Vec<Raw>>> + 'a>;

/// Patterns that match consecutive lines, and the instructions they mean.
/// `build` may decline a match by returning `None`.
pub(super) struct ReadRule<'a> {
    pub(super) patterns: Vec<Regex>,
    pub(super) build: Build<'a>,
}

pub(super) fn rule<'a, S: AsRef<str>>(
    patterns: &[S],
    build: impl Fn(&[Captures]) -> Result<Option<Vec<Raw>>> + 'a,
) -> ReadRule<'a> {
    ReadRule {
        patterns: patterns
            .iter()
            .map(|pattern| pattern_regex(pattern.as_ref()))
            .collect(),
        build: Box::new(build),
    }
}

/// A rule that always yields the same instructions.
pub(super) fn fixed<'a, S: AsRef<str>>(patterns: &[S], code: Vec<Instruction>) -> ReadRule<'a> {
    rule(patterns, move |_| {
        Ok(Some(code.iter().cloned().map(Some).collect()))
    })
}

pub(super) fn pattern_regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("reader patterns are valid regular expressions")
}

pub(super) fn read_error(target: &str, line: &str, message: &str) -> GrammarError {
    GrammarError::new(format!("Cannot read {target} line \"{line}\": {message}"))
}

/// Read instructions with a list of rules. The first rule that matches
/// wins, so longer sequences come first.
pub(super) fn read_instructions(
    lines: &[String],
    rules: &[ReadRule],
    target: &str,
) -> Result<Vec<Raw>> {
    let mut code = Vec::new();
    let mut index = 0;
    'lines: while index < lines.len() {
        for rule in rules {
            let matches: Option<Vec<Captures>> = rule
                .patterns
                .iter()
                .enumerate()
                .map(|(offset, pattern)| {
                    lines
                        .get(index + offset)
                        .and_then(|line| pattern.captures(line))
                })
                .collect();
            if let Some(matches) = matches
                && let Some(built) = (rule.build)(&matches)?
            {
                code.extend(built);
                index += rule.patterns.len();
                continue 'lines;
            }
        }
        return Err(read_error(target, &lines[index], "unknown instruction"));
    }
    Ok(code)
}

pub(super) fn without_results(code: Vec<Raw>) -> Vec<Instruction> {
    code.into_iter().flatten().collect()
}

/// Split a file into the program comments (before the first line that
/// starts the program) and the rest.
pub(super) fn leading_comments(
    lines: &[String],
    prefix: &str,
    start: &str,
) -> (Vec<String>, Vec<String>) {
    let start = pattern_regex(start);
    match lines.iter().position(|line| start.is_match(line)) {
        Some(first) => {
            let comments = lines[..first]
                .iter()
                .filter_map(|line| line.strip_prefix(prefix))
                .map(|text| text.strip_prefix(' ').unwrap_or(text).to_owned())
                .collect();
            (comments, lines[first..].to_vec())
        }
        None => (Vec::new(), lines.last().cloned().into_iter().collect()),
    }
}

pub(super) fn integer(text: &str) -> Result<f64> {
    const SAFE: f64 = 9_007_199_254_740_991.0;
    match text.parse::<f64>() {
        Ok(value) if value.abs() <= SAFE => Ok(value),
        _ => Err(GrammarError::new(format!(
            "The integer {text} is outside the supported range"
        ))),
    }
}

pub(super) fn group<'t>(captures: &'t Captures, index: usize) -> &'t str {
    captures.get(index).map_or("", |found| found.as_str())
}

pub(super) fn trimmed_lines(source: &str) -> Vec<String> {
    source
        .split('\n')
        .map(|line| line.trim().to_owned())
        .collect()
}

/// The program after reading: "main" is the entry point.
pub(super) fn program(comments: Vec<String>, mut items: Vec<Procedure>) -> Result<LoweredProgram> {
    let position = items
        .iter()
        .position(|item| item.name == "main")
        .ok_or_else(|| GrammarError::new("The machine program has no entry point"))?;
    let main = items.remove(position);
    Ok(LoweredProgram {
        comments,
        functions: items,
        main,
    })
}

pub(super) fn procedure(
    name: String,
    parameter_count: usize,
    slot_names: Vec<String>,
    returns: bool,
    comments: Vec<String>,
    code: Vec<Instruction>,
) -> Procedure {
    Procedure {
        name,
        parameter_count,
        slot_count: slot_names.len(),
        slot_arrays: vec![false; slot_names.len()],
        slot_names,
        returns,
        max_depth: 0,
        comments,
        code,
    }
}

/// "call f" followed by the instruction that pushes the result keeps the
/// result of f; the rules read that instruction as `None`. A call without it
/// is a call to a function that returns nothing.
pub(super) fn resolve_results(raw: Vec<Raw>, target: &str, line: &str) -> Result<Vec<Instruction>> {
    let mut code: Vec<Instruction> = Vec::new();
    for instruction in raw {
        match instruction {
            Some(instruction) => code.push(instruction),
            None if matches!(code.last(), Some(Instruction::Call(..))) => {}
            None => return Err(read_error(target, line, "not after a call")),
        }
    }
    Ok(code)
}

/// A pattern that matches a whole line exactly.
pub(super) fn exact(line: &str) -> String {
    format!("^{}$", regex::escape(line))
}

/// The text that bytes spell.
pub(super) fn decode_bytes(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}
