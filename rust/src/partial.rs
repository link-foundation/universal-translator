//! Partial reading and translation (issue #8).
//!
//! A text often holds a part the grammar does not cover yet. Partial
//! translation keeps everything it can read and marks the rest. The text is
//! cut into parts along its own layout, so the method needs no grammar of
//! its own and works for every language:
//!
//! 1. A part starts at a line and may end before any later line that is
//!    indented no deeper than its first line, unless that line only closes
//!    or continues the part (`}`, `end`, `else`, ...).
//! 2. The shortest such part that reads as a fragment is taken, then
//!    extended while the longer part still reads.
//! 3. A part that does not read at all is reported with the reason. When it
//!    has an indented body, the header and its closing lines are reported,
//!    and the body is read the same way.
//! 4. Between two natural languages a part outside the controlled templates
//!    is prose: it is translated freely by the comment translator (the
//!    vocabulary, [`crate::natural::translate_comment_text`], unless the
//!    translator has one of its own), not marked, and is listed in `prose`.
//!
//! The JavaScript twin is js/src/translation/partial.js.

use std::sync::LazyLock;

use regex::Regex;

use crate::custom_rules::js_regex;
use crate::fragments::FragmentKind;
use crate::meta::GrammarError;
use crate::natural::is_natural_language;
use crate::translator::{Options, Translator};

static CLOSERS: LazyLock<Regex> = LazyLock::new(|| {
    js_regex(
        r"(?i)^\s*(?:[}\])]|end\b|fi\b|done\b|esac\b|else\b|elif\b|elsif\b|elseif\b|until\b|loop\b|wend\b|next\b|catch\b|finally\b|except\b|rescue\b|ensure\b|then\b|begin\b|do\b)",
    )
    .expect("closers")
});

static LINE_NUMBER: LazyLock<Regex> =
    LazyLock::new(|| js_regex(r"\b(line )(\d+)").expect("line numbers"));

/// How many shortest candidates are tried before a part is given up.
const MAX_TRIES: usize = 8;

/// Whether a part was read.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PartStatus {
    Read,
    Failed,
    /// Translated freely, as prose.
    Free,
}

impl PartStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            PartStatus::Read => "read",
            PartStatus::Failed => "failed",
            PartStatus::Free => "free",
        }
    }
}

/// One part of a text: lines `start..end` (indexes from 0).
#[derive(Clone, Debug, PartialEq)]
pub struct Part {
    pub start: usize,
    pub end: usize,
    pub status: PartStatus,
    /// What a read part holds.
    pub kind: Option<FragmentKind>,
    /// Why a failed part does not read.
    pub message: Option<String>,
    /// The first line, counted from 1.
    pub line: usize,
    /// The last line, counted from 1.
    pub end_line: usize,
    /// The text of the part without its common indentation.
    pub source: String,
}

/// A part that could not be read or translated.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PartError {
    pub line: usize,
    pub end_line: usize,
    pub message: String,
    pub source: String,
}

/// What [`Translator::parse_partial`] reads.
#[derive(Clone, Debug, PartialEq)]
pub struct PartialReading {
    pub complete: bool,
    pub parts: Vec<Part>,
    /// The written (non-blank) lines of the text.
    pub lines: usize,
    /// The written lines of the parts that read.
    pub read_lines: usize,
    pub coverage: f64,
    pub errors: Vec<PartError>,
}

/// What [`Translator::translate_partial`] writes.
#[derive(Clone, Debug, PartialEq)]
pub struct PartialTranslation {
    pub text: String,
    /// Pairs of 0-based (source line, target line) that hold the same
    /// tokens, for programming languages on both sides (see
    /// [`crate::layout`]); empty otherwise.
    pub line_map: Vec<(usize, usize)>,
    pub complete: bool,
    pub errors: Vec<PartError>,
    pub lines: usize,
    pub read_lines: usize,
    pub coverage: f64,
    /// The parts translated freely, as prose: (first line, last line),
    /// counted from 1.
    pub prose: Vec<(usize, usize)>,
}

fn indent_of(line: &str) -> usize {
    line.chars()
        .take_while(|character| character.is_whitespace())
        .map(|character| if character == '\t' { 4 } else { 1 })
        .sum()
}

fn blank(line: &str) -> bool {
    line.trim().is_empty()
}

fn dedented(lines: &[&str]) -> String {
    let common = lines
        .iter()
        .filter(|line| !blank(line))
        .map(|line| indent_of(line))
        .min()
        .unwrap_or(0);
    let written: Vec<String> = lines
        .iter()
        .map(|line| {
            if blank(line) {
                return String::new();
            }
            let rest = line.trim_start();
            let space = indent_of(line).saturating_sub(common);
            format!("{}{rest}", " ".repeat(space))
        })
        .collect();
    format!("{}\n", written.join("\n"))
}

/// Errors count lines from the start of the part; count them from the
/// start of the whole text instead.
fn shift_lines(message: &str, offset: usize) -> String {
    let first = message.split('\n').next().unwrap_or_default();
    LINE_NUMBER
        .replace_all(first, |captures: &regex::Captures| {
            let line: usize = captures[2].parse().unwrap_or(0);
            format!("{}{}", &captures[1], line + offset)
        })
        .into_owned()
}

/// Where a part that starts at line `start` may end (exclusive indexes).
fn boundaries(lines: &[&str], start: usize, end: usize) -> Vec<usize> {
    let indent = indent_of(lines[start]);
    let mut result: Vec<usize> = Vec::new();
    for next in start + 1..=end {
        let candidate = if next == end {
            Some(end)
        } else if !blank(lines[next])
            && indent_of(lines[next]) <= indent
            && !CLOSERS.is_match(lines[next])
        {
            // The part ends after its last written line.
            let mut last = next;
            while last > start + 1 && blank(lines[last - 1]) {
                last -= 1;
            }
            Some(last)
        } else {
            None
        };
        if let Some(candidate) = candidate.filter(|candidate| !result.contains(candidate)) {
            result.push(candidate);
        }
    }
    result
}

/// The lines a failed part's header opens: those indented deeper than it.
fn body_end(lines: &[&str], start: usize, end: usize) -> usize {
    let indent = indent_of(lines[start]);
    let mut last = start + 1;
    for (line, text) in lines.iter().enumerate().take(end).skip(start + 1) {
        if !blank(text) {
            if indent_of(text) <= indent {
                break;
            }
            last = line + 1;
        }
    }
    last
}

fn part(start: usize, end: usize, status: PartStatus) -> Part {
    Part {
        start,
        end,
        status,
        kind: None,
        message: None,
        line: start + 1,
        end_line: end,
        source: String::new(),
    }
}

struct Reader<'a> {
    translator: &'a Translator,
    from: &'a str,
}

impl Reader<'_> {
    fn read(&self, lines: &[&str], offset: usize) -> Result<FragmentKind, String> {
        self.translator
            .parse_fragment(&dedented(lines), self.from)
            .map(|fragment| fragment.kind)
            .map_err(|error| shift_lines(&error.to_string(), offset))
    }

    fn segments(&self, lines: &[&str], start: usize, end: usize) -> Vec<Part> {
        let mut parts = Vec::new();
        let mut line = start;
        while line < end {
            if blank(lines[line]) {
                line += 1;
                continue;
            }
            let candidates = boundaries(lines, line, end);
            let mut found = None;
            let mut first_failure = None;
            for &candidate in candidates.iter().take(MAX_TRIES) {
                match self.read(&lines[line..candidate], line) {
                    Ok(kind) => {
                        found = Some((candidate, kind));
                        break;
                    }
                    Err(message) => {
                        first_failure.get_or_insert(message);
                    }
                }
            }
            if let Some((mut found_end, mut found_kind)) = found {
                // Extend while the longer part still reads.
                let shortest = found_end;
                for &candidate in candidates.iter().filter(|&&at| at > shortest) {
                    match self.read(&lines[line..candidate], line) {
                        Ok(kind) => {
                            found_end = candidate;
                            found_kind = kind;
                        }
                        Err(_) => break,
                    }
                }
                let mut read = part(line, found_end, PartStatus::Read);
                read.kind = Some(found_kind);
                parts.push(read);
                line = found_end;
                continue;
            }
            let part_end = candidates[0];
            let inner = body_end(lines, line, part_end);
            let failed = |start: usize, end: usize, message: Option<String>| {
                let mut failed = part(start, end, PartStatus::Failed);
                failed.message = message;
                failed
            };
            if inner - line > 1 && part_end - line > 1 {
                parts.push(failed(line, line + 1, first_failure));
                parts.extend(self.segments(lines, line + 1, inner));
                if lines[inner..part_end].iter().any(|text| !blank(text)) {
                    parts.push(failed(
                        inner,
                        part_end,
                        Some(format!("closes the part that starts on line {}", line + 1)),
                    ));
                }
            } else {
                parts.push(failed(line, part_end, first_failure));
            }
            line = part_end;
        }
        parts
    }
}

fn errors_of(parts: &[Part]) -> Vec<PartError> {
    parts
        .iter()
        .filter(|part| part.status == PartStatus::Failed)
        .map(|part| PartError {
            line: part.line,
            end_line: part.end_line,
            message: part.message.clone().unwrap_or_default(),
            source: part.source.clone(),
        })
        .collect()
}

/// Read as much of a text as the grammar covers.
pub fn parse_partial(
    translator: &Translator,
    source: &str,
    from: &str,
) -> Result<PartialReading, GrammarError> {
    let normalized = source.replace("\r\n", "\n");
    let lines: Vec<&str> = normalized.trim_end_matches('\n').split('\n').collect();
    let written = lines.iter().filter(|line| !blank(line)).count();
    let parts = match translator.parse_fragment(source, from) {
        Ok(fragment) => {
            let mut whole = part(0, lines.len(), PartStatus::Read);
            whole.kind = Some(fragment.kind);
            vec![whole]
        }
        Err(error) => {
            let reader = Reader { translator, from };
            let parts = reader.segments(&lines, 0, lines.len());
            if parts.is_empty() {
                return Err(error);
            }
            parts
        }
    };
    let parts: Vec<Part> = parts
        .into_iter()
        .map(|mut part| {
            part.source = dedented(&lines[part.start..part.end]);
            part
        })
        .collect();
    let read_lines = parts
        .iter()
        .filter(|part| part.status == PartStatus::Read)
        .map(|part| {
            lines[part.start..part.end]
                .iter()
                .filter(|line| !blank(line))
                .count()
        })
        .sum();
    Ok(PartialReading {
        complete: parts.iter().all(|part| part.status == PartStatus::Read),
        errors: errors_of(&parts),
        parts,
        lines: written,
        read_lines,
        coverage: if written == 0 {
            1.0
        } else {
            read_lines as f64 / written as f64
        },
    })
}

/// Translate what can be read; every other part becomes a comment in the
/// target that holds the reason and the original text.
pub fn translate_partial(
    translator: &Translator,
    source: &str,
    from: &str,
    to: &str,
    options: Options,
) -> Result<PartialTranslation, GrammarError> {
    let mut reading = parse_partial(translator, source, from)?;
    let mut text = String::new();
    for part in &mut reading.parts {
        if part.status == PartStatus::Read {
            match translator.translate_fragment(&part.source, from, to, options) {
                Ok(written) => {
                    text.push_str(&written);
                    continue;
                }
                Err(error) => {
                    // A part may read but not be writable in the target.
                    part.status = PartStatus::Failed;
                    part.message = Some(shift_lines(&error.to_string(), part.start));
                }
            }
        }
        if is_natural_language(from)
            && is_natural_language(to)
            && let Ok(prose) = (translator.comment_translator())(&part.source, from, to)
        {
            part.status = PartStatus::Free;
            text.push_str(&prose);
            continue;
        }
        let place = if part.end_line > part.line {
            format!("lines {}-{}", part.line, part.end_line)
        } else {
            format!("line {}", part.line)
        };
        let notes: Vec<String> = std::iter::once(format!(
            "untranslated ({place}): {}",
            part.message.as_deref().unwrap_or_default()
        ))
        .chain(
            part.source
                .strip_suffix('\n')
                .unwrap_or(&part.source)
                .split('\n')
                .map(str::to_owned),
        )
        .collect();
        text.push_str(&translator.write_notes(&notes, to)?);
    }
    let errors = errors_of(&reading.parts);
    Ok(PartialTranslation {
        text,
        line_map: Vec::new(),
        complete: errors.is_empty(),
        errors,
        lines: reading.lines,
        read_lines: reading.read_lines,
        coverage: reading.coverage,
        prose: reading
            .parts
            .iter()
            .filter(|part| part.status == PartStatus::Free)
            .map(|part| (part.line, part.end_line))
            .collect(),
    })
}
