//! Language detection (issue #8): the command line can translate without
//! being told the source language.
//!
//! Every language the translator reads is a candidate. A candidate whose
//! grammar reads the whole text wins over one that reads only a part, and
//! one that reads nothing comes last. Ties are broken by evidence from the
//! language's own syntax tables and, for controlled natural languages, by
//! how many words of the text are words of its templates. Only the best
//! candidates by that evidence are read partially. Machine code (assembly,
//! bytecode, intermediate languages) is read whole only: each dialect's
//! reader takes its own programs and no other text.
//!
//! The JavaScript twin is js/src/translation/detect.js.

use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;

use crate::custom_rules::js_regex;
use crate::formal::languages;
use crate::natural::{self, tokens::Kind};
use crate::translator::Translator;

/// A language a text may be written in.
#[derive(Clone, Debug, PartialEq)]
pub struct Detection {
    pub id: String,
    pub natural: bool,
    /// Whether the grammar reads the whole text.
    pub reads: bool,
    /// The share of written lines the grammar reads.
    pub coverage: f64,
    /// 100 × coverage + evidence, rounded to two decimals.
    pub score: f64,
}

/// Patterns that only one language (or a small family) writes.
const SIGNATURES: &[(&str, &[&str])] = &[
    (
        "javascript",
        &[r"\bconsole\.log\s*\(", r"\b(?:let|const)\s+\w+\s*=", "==="],
    ),
    (
        "typescript",
        &[
            r"\b(?:let|const)\s+\w+\s*:\s*\w+",
            r"\):\s*(?:number|string|void)\b",
        ],
    ),
    (
        "python",
        &[
            r"(?m)^\s*(?:with|for|while|if)\b[^{]*:\s*$",
            r"(?m)^\s*def\s+\w+\(.*\)\s*:",
            r"(?m)^\s*(?:elif|pass)\b",
            r"\bprint\(",
        ],
    ),
    (
        "ruby",
        &[
            r"(?m)^\s*puts\b",
            r"(?m)^\s*def\s+\w+(?:\(.*\))?\s*$",
            r"\.each\b",
        ],
    ),
    ("lua", &[r"(?m)^\s*local\s+\w+", r"(?m)\bthen\s*$", "~="]),
    ("php", &[r"<\?php", r"\$\w+\s*=", r"\becho\b"]),
    (
        "c",
        &[
            r"#include\s*<stdio\.h>",
            r"\bprintf\s*\(",
            r"\bint\s+main\s*\(",
        ],
    ),
    ("cpp", &[r"#include\s*<iostream>", "std::cout", r"\bstd::"]),
    (
        "csharp",
        &[r"\bConsole\.Write(?:Line)?\s*\(", r"\busing\s+System\b"],
    ),
    (
        "java",
        &[
            r"\bSystem\.out\.print(?:ln)?\s*\(",
            r"\bpublic\s+static\s+void\s+main\b",
        ],
    ),
    (
        "go",
        &[
            r"\bfmt\.Print(?:ln|f)?\s*\(",
            r"(?m)^\s*package\s+main\b",
            ":=",
        ],
    ),
    (
        "rust",
        &[r"\bprintln!\s*\(", r"\bfn\s+\w+\s*\(", r"\blet\s+mut\b"],
    ),
    (
        "kotlin",
        &[r"\bfun\s+\w+\s*\(", r"\bprintln\s*\(", r"\bval\s+\w+"],
    ),
    (
        "swift",
        &[r"\bfunc\s+\w+\s*\(.*->", r"\bvar\s+\w+\s*=", r"\bprint\("],
    ),
    (
        "perl",
        &[
            r"\bmy\s+\$\w+",
            r"(?m)^\s*use\s+strict\b",
            r"\bsub\s+\w+\s*\{",
        ],
    ),
    ("dart", &[r"\bvoid\s+main\s*\(\s*\)", r"\bprint\("]),
    (
        "scala",
        &[r"\bdef\s+\w+\(.*\)\s*:\s*\w+\s*=", r"\bobject\s+\w+"],
    ),
    (
        "julia",
        &[
            r"(?m)^\s*function\s+\w+\(.*\)\s*$",
            r"\bprintln\(",
            r"(?m)^\s*end\s*$",
        ],
    ),
    ("r", &["<-", r"\bfunction\s*\(", r"\bcat\s*\("]),
    ("groovy", &[r"\bdef\s+\w+\s*=", r"\bprintln\b"]),
    ("objc", &[r"#import\b", r"\bNSLog\s*\(", "@\""]),
    ("nim", &[r"\bproc\s+\w+", r"\becho\b"]),
    ("d", &[r"\bwriteln\s*\(", r"(?m)^\s*import\s+std\."]),
    (
        "pascal",
        &[
            r"(?im)^\s*program\s+\w+\s*;",
            r"(?i)\bwriteln\b",
            ":=",
            r"(?i)\bbegin\b",
        ],
    ),
    (
        "fortran",
        &[
            r"(?im)^\s*program\s+\w+\s*$",
            r"(?i)\bimplicit\s+none\b",
            r"(?i)\bend\s+program\b",
        ],
    ),
    (
        "ada",
        &[r"\bPut_Line\b", r"(?m)^\s*with\s+Ada\.", r"\bprocedure\b"],
    ),
    (
        "vb",
        &[
            r"\bConsole\.WriteLine\b",
            r"\bDim\s+\w+\s+As\b",
            r"\bEnd\s+(?:Sub|Module|If)\b",
        ],
    ),
    (
        "bash",
        &[
            r"^#!/bin/(?:ba)?sh",
            r"\becho\b",
            r"(?m)\bfi\s*$",
            r"\$\(\(",
        ],
    ),
    (
        "matlab",
        &[r"\bdisp\s*\(", r"\bfprintf\s*\(", r"(?m)^\s*end\s*$", "%"],
    ),
    (
        "zig",
        &[
            r#"@import\("std"\)"#,
            r"\bstd\.debug\.print\b",
            r"\bpub\s+fn\b",
        ],
    ),
    (
        "lean",
        &[r"\bdef\s+\w+.*:=", r"\bIO\.println\b", r"#eval\b"],
    ),
    (
        "rocq",
        &[r"\bFixpoint\b", r"\bDefinition\b", r"\bCompute\b"],
    ),
    (
        "gml",
        &[
            r"\bshow_debug_message\s*\(",
            r"\barray_create\s*\(",
            r"\barray_length\s*\(",
        ],
    ),
    (
        "nasm",
        &[
            r"(?m)^\s*section\s+\.text",
            r"(?m)^\s*global\s+_?main",
            r"\bmov\s+\w+,",
        ],
    ),
    (
        "cil",
        &[r"(?m)^\s*\.method\b", r"\bldc\.i4", r"\.assembly\b"],
    ),
    (
        "jvm",
        &[
            r"(?m)^\s*\.class\b",
            r"(?m)^\s*\.method\b",
            r"\binvokestatic\b",
        ],
    ),
    (
        "gas",
        &[
            r"(?m)^\s*\.globl\b",
            r"%r[sb]p\b",
            r"(?m)^\s*(?:push|mov|sub)q\s",
        ],
    ),
    (
        "arm64",
        &[
            r"(?m)^\s*stp\s+x\d+,",
            r"(?m)^\s*(?:ldr|str)\s+x\d+,",
            r"%function\b",
        ],
    ),
    (
        "llvm",
        &[
            r"(?m)^\s*define\s+\S+\s+@\w+\(",
            r"(?m)^\s*declare\s+\S+\s+@\w+\(",
            r"\balloca\b",
        ],
    ),
    (
        "wat",
        &[r"(?m)^\s*\(module\b", r"\blocal\.get\b", r"\(func\s+\$\w+"],
    ),
];

/// Patterns a language never writes: Objective-C imports its headers, C and
/// C++ include them, so "#import" rules C and C++ out.
const CONTRADICTIONS: &[(&str, &[&str])] = &[
    ("c", &[r"(?m)^\s*#import\b"]),
    ("cpp", &[r"(?m)^\s*#import\b"]),
];

/// The languages whose JavaScript syntax table names a print call; the
/// others print through their dialect's call tables, and their
/// `print_line` is only inherited.
const PRINTED: &[&str] = &[
    "javascript",
    "typescript",
    "python",
    "ruby",
    "lua",
    "php",
    "c",
    "cpp",
    "csharp",
    "java",
    "go",
    "rust",
    "kotlin",
    "swift",
    "objc",
];

fn compile(
    table: &'static [(&'static str, &'static [&'static str])],
) -> HashMap<&'static str, Vec<Regex>> {
    table
        .iter()
        .map(|(id, patterns)| {
            let compiled = patterns
                .iter()
                .map(|pattern| js_regex(pattern).expect("signature"))
                .collect();
            (*id, compiled)
        })
        .collect()
}

static COMPILED: LazyLock<HashMap<&'static str, Vec<Regex>>> =
    LazyLock::new(|| compile(SIGNATURES));
static CONTRADICTED: LazyLock<HashMap<&'static str, Vec<Regex>>> =
    LazyLock::new(|| compile(CONTRADICTIONS));

fn is_word(text: &str) -> bool {
    !text.is_empty()
        && text
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn syntax_evidence(source: &str, id: &str) -> f64 {
    let Ok(syntax) = languages::language_syntax(id) else {
        return 0.0;
    };
    let mut score = 0.0;
    for pattern in COMPILED.get(id).into_iter().flatten() {
        if pattern.is_match(source) {
            score += 3.0;
        }
    }
    for pattern in CONTRADICTED.get(id).into_iter().flatten() {
        if pattern.is_match(source) {
            score -= 6.0;
        }
    }
    let words = syntax
        .function_keyword
        .into_iter()
        .chain(syntax.declarations.iter().copied())
        .filter(|word| is_word(word));
    for word in words {
        let pattern = js_regex(&format!(r"\b{}\b", regex::escape(word)));
        if pattern.is_ok_and(|pattern| pattern.is_match(source)) {
            score += 1.0;
        }
    }
    if PRINTED.contains(&id)
        && syntax.print_line.chars().count() > 2
        && source.contains(syntax.print_line)
    {
        score += 2.0;
    }
    if !syntax.line_comment.is_empty() {
        let pattern = js_regex(&format!(r"(?m)^\s*{}", regex::escape(syntax.line_comment)));
        if pattern.is_ok_and(|pattern| pattern.is_match(source)) {
            score += 1.0;
        }
    }
    score
}

fn word_evidence(source: &str, id: &str) -> f64 {
    let Ok(language) = natural::natural_language(id) else {
        return 0.0;
    };
    let Ok(tokens) = language.tokenize(source) else {
        return 0.0;
    };
    let words: Vec<_> = tokens
        .iter()
        .filter(|token| token.kind == Kind::Word)
        .collect();
    if words.is_empty() {
        return 0.0;
    }
    let known = words
        .iter()
        .filter(|token| {
            language.reserved.contains(&token.folded)
                || language.reverse_lexicon.contains_key(&token.folded)
                || natural::is_known_word(&token.folded, id)
        })
        .count();
    10.0 * known as f64 / words.len() as f64
}

/// Symbols that code writes and prose does not.
static CODE_SYMBOLS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[{}()\[\];=<>+*/\\$#@&|^~`]").expect("code symbols"));

/// How much of a text reads as prose of a natural language: its known words
/// (in the vocabulary, the primes or the templates, directly or through
/// their stems) among all its words and code symbols. Prose outside the
/// controlled templates is still translated freely, so it counts as read.
fn prose_coverage(source: &str, id: &str) -> f64 {
    let Ok(language) = natural::natural_language(id) else {
        return 0.0;
    };
    let words = natural::words_of(source);
    if words.is_empty() {
        return 0.0;
    }
    let known = words
        .iter()
        .filter(|word| {
            language.reserved.contains(*word)
                || language.reverse_lexicon.contains_key(*word)
                || natural::is_known_word(word, id)
        })
        .count();
    let symbols = CODE_SYMBOLS.find_iter(source).count();
    known as f64 / (words.len() + symbols) as f64
}

struct Candidate {
    id: String,
    natural: bool,
    machine: bool,
    evidence: f64,
    reads: bool,
    coverage: f64,
}

/// The likeliest languages first.
pub fn detect_language(translator: &Translator, source: &str, limit: usize) -> Vec<Detection> {
    if source.trim().is_empty() {
        return Vec::new();
    }
    let candidate = |id: &str, natural: bool, evidence: f64| Candidate {
        id: id.to_owned(),
        natural,
        machine: false,
        evidence,
        reads: false,
        coverage: 0.0,
    };
    let mut candidates: Vec<Candidate> = languages::language_ids()
        .into_iter()
        .map(|id| candidate(id, false, syntax_evidence(source, id)))
        .chain(
            languages::machine_target_ids()
                .into_iter()
                .map(|id| Candidate {
                    machine: true,
                    ..candidate(id, false, syntax_evidence(source, id))
                }),
        )
        .chain(natural::natural_language_ids().into_iter().map(|id| {
            // A profile only narrows its language, so on a tie the
            // language itself is the better guess.
            let profile =
                natural::natural_language(id).is_ok_and(|language| language.base.is_some());
            candidate(
                id,
                true,
                word_evidence(source, id) - if profile { 0.5 } else { 0.0 },
            )
        }))
        .collect();
    for candidate in &mut candidates {
        candidate.reads =
            candidate.evidence > -1.0 && translator.parse_fragment(source, &candidate.id).is_ok();
        candidate.coverage = if candidate.reads { 1.0 } else { 0.0 };
    }
    // Read the best of the rest partially: the likeliest programming and
    // natural languages by evidence.
    for natural in [false, true] {
        let mut unread: Vec<usize> = (0..candidates.len())
            .filter(|&index| {
                let candidate = &candidates[index];
                candidate.natural == natural && !candidate.machine && !candidate.reads
            })
            .collect();
        unread.sort_by(|&a, &b| candidates[b].evidence.total_cmp(&candidates[a].evidence));
        for index in unread.into_iter().take(limit) {
            candidates[index].coverage = translator
                .parse_partial(source, &candidates[index].id)
                .map_or(0.0, |reading| reading.coverage);
        }
    }
    for candidate in &mut candidates {
        if candidate.natural && !candidate.reads {
            candidate.coverage = candidate
                .coverage
                .max(prose_coverage(source, &candidate.id));
        }
    }
    let mut detections: Vec<Detection> = candidates
        .into_iter()
        .map(|candidate| Detection {
            score: ((100.0 * candidate.coverage + candidate.evidence) * 100.0 + 0.5).floor()
                / 100.0,
            id: candidate.id,
            natural: candidate.natural,
            reads: candidate.reads,
            coverage: candidate.coverage,
        })
        .filter(|detection| detection.score > 0.0)
        .collect();
    detections.sort_by(|a, b| b.score.total_cmp(&a.score));
    detections
}
