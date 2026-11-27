//! Checks that a controlled language description, and text written in it,
//! keeps the rules of the standard it follows.
//!
//! A description may state, under "rules:":
//!
//! ```text
//!   max-sentence-words      most words (a quoted text counts as one) a
//!                           sentence may have
//!   average-sentence-words  most words a sentence may have on average
//!   sentence-starts         the only words a sentence may start with (for
//!                           example the imperative verbs of ASD-STE100)
//!   forbidden-words         words no template, lexicon entry or written
//!                           sentence may use (for example "is" in E-Prime)
//!   vocabulary              the only words templates may use
//!   primes                  templates may also use the exponents of the
//!                           65 semantic primes in this language
//!   extra-words             further words templates may use (grammatical
//!                           words and the molecules a minimal language
//!                           allows, or the technical words a profile adds)
//!   relations               relation phrases (Gellish) that templates must
//!                           express facts with; each must appear in one
//! ```
//!
//! Notes ("Note: ...") copy comments of the program and quoted texts are the
//! program's own data, so neither is checked. The JavaScript twin is
//! js/src/natural/rules.js.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::LazyLock;

use regex::Regex;

use super::catalog::{
    Language, PRIMES_FILE, SOURCES, label_of, natural_language, parse_root, plain, values_of,
};
use super::tokens::{Kind, fold};

/// A set that remembers insertion order, so problems come out in the same
/// order as in JavaScript (which iterates a `Set` in insertion order).
#[derive(Default)]
struct OrderedSet {
    items: Vec<String>,
    seen: HashSet<String>,
}

impl OrderedSet {
    fn insert(&mut self, item: String) {
        if self.seen.insert(item.clone()) {
            self.items.push(item);
        }
    }

    fn iter(&self) -> impl Iterator<Item = &String> {
        self.items.iter()
    }
}

/// One of the 65 semantic primes of Natural Semantic Metalanguage, with its
/// exponents (word forms) in several languages.
#[derive(Clone, Debug)]
pub struct SemanticPrime {
    pub prime: String,
    pub category: String,
    pub exponents: BTreeMap<String, Vec<String>>,
}

static PRIMES: LazyLock<Result<Vec<SemanticPrime>, String>> = LazyLock::new(|| {
    let source = SOURCES
        .iter()
        .find(|(file, _)| *file == PRIMES_FILE)
        .map(|(_, source)| *source)
        .ok_or_else(|| format!("No {PRIMES_FILE}"))?;
    let root = parse_root(source)?;
    Ok(values_of(&root)
        .iter()
        .map(|prime| {
            let mut exponents: BTreeMap<String, Vec<String>> = values_of(prime)
                .iter()
                .map(|field| (label_of(field).to_owned(), plain(values_of(field))))
                .collect();
            let category = exponents
                .remove("category")
                .and_then(|values| values.into_iter().next())
                .unwrap_or_default();
            SemanticPrime {
                prime: label_of(prime).to_owned(),
                category,
                exponents,
            }
        })
        .collect())
});

/// The 65 semantic primes.
pub fn semantic_primes() -> Result<&'static [SemanticPrime], String> {
    PRIMES.as_deref().map_err(Clone::clone)
}

static WORD_BREAK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[\s-]+").expect("word break pattern"));

/// Single words of a list of words or multi-word phrases.
fn words_of<S: AsRef<str>>(phrases: &[S]) -> Vec<String> {
    phrases
        .iter()
        .flat_map(|phrase| {
            WORD_BREAK
                .split(phrase.as_ref())
                .map(fold)
                .collect::<Vec<_>>()
        })
        .collect()
}

fn template_words(language: &Language) -> OrderedSet {
    let mut words = OrderedSet::default();
    for (key, _) in &language.templates.entries {
        for token in language.variants(key).iter().flatten() {
            // Symbols such as "<=" are not words of any vocabulary.
            if token.kind == Kind::Word && token.folded.chars().any(char::is_alphabetic) {
                words.insert(token.folded.clone());
            }
        }
    }
    for word in [
        Some(&language.true_word),
        Some(&language.false_word),
        language.list_and.as_ref(),
    ]
    .into_iter()
    .flatten()
    {
        for part in words_of(&[word]) {
            words.insert(part);
        }
    }
    words
}

fn allowed_words(language: &Language) -> Result<Option<HashSet<String>>, String> {
    if language.rules.get("vocabulary").is_none() && language.rules.get("primes").is_none() {
        return Ok(None);
    }
    let mut allowed: HashSet<String> = words_of(language.rule("vocabulary"))
        .into_iter()
        .chain(words_of(language.rule("extra-words")))
        .collect();
    for id in language.rule("primes") {
        for prime in semantic_primes()? {
            if let Some(exponents) = prime.exponents.get(id) {
                allowed.extend(words_of(exponents));
            }
        }
    }
    Ok(Some(allowed))
}

fn check_lexicon(language: &Language) -> Vec<String> {
    let mut problems = Vec::new();
    let mut seen: HashMap<String, String> = HashMap::new();
    for (neutral, word) in &language.lexicon.entries {
        let one_word = language
            .tokenize(word)
            .is_ok_and(|tokens| tokens.len() == 1 && tokens[0].kind == Kind::Word);
        if !one_word || word.contains(language.name_joiner.as_str()) {
            problems.push(format!(
                "the word for \"{neutral}\" (\"{word}\") is not one word"
            ));
        }
        let folded = fold(word);
        if let Some(previous) = seen.get(&folded) {
            problems.push(format!(
                "\"{previous}\" and \"{neutral}\" are both \"{word}\""
            ));
        }
        seen.insert(folded, neutral.clone());
    }
    problems
}

/// Problems with a language description itself (empty when it keeps its
/// rules).
pub fn check_description(id: &str) -> Result<Vec<String>, String> {
    let language = natural_language(id)?;
    let mut problems = check_lexicon(language);
    let words = template_words(language);
    if let Some(allowed) = allowed_words(language)? {
        for word in words.iter() {
            if !allowed.contains(word) {
                problems.push(format!(
                    "template word \"{word}\" is outside the vocabulary"
                ));
            }
        }
    }
    let texts: Vec<String> = language
        .templates
        .entries
        .iter()
        .flat_map(|(_, texts)| texts.iter().map(|text| fold(text)))
        .collect();
    for relation in language.rule("relations") {
        let wanted = fold(relation);
        if !texts.iter().any(|text| text.contains(&wanted)) {
            problems.push(format!("no template uses the relation \"{relation}\""));
        }
    }
    let forbidden: HashSet<String> = words_of(language.rule("forbidden-words"))
        .into_iter()
        .collect();
    let lexicon = language.lexicon.entries.iter().map(|(_, word)| fold(word));
    for word in words.iter().cloned().chain(lexicon) {
        if forbidden.contains(&word) {
            problems.push(format!("\"{word}\" is a forbidden word"));
        }
    }
    Ok(problems)
}

fn is_note(line: &str, language: &Language) -> bool {
    let prefix = language.note.split("{text}").next().unwrap_or_default();
    line.starts_with(prefix)
}

struct Limits {
    limit: f64,
    starts: HashSet<String>,
    forbidden: HashSet<String>,
}

/// A numeric rule, as JavaScript's `Number` reads it (infinite when absent).
fn numeric_rule(language: &Language, name: &str) -> f64 {
    language.rule(name).first().map_or(f64::INFINITY, |value| {
        value.trim().parse().unwrap_or(f64::NAN)
    })
}

fn format_limit(value: f64) -> String {
    if value.is_infinite() {
        "Infinity".into()
    } else {
        crate::meta::format_number(value)
    }
}

fn sentence_problems(
    line: &str,
    tokens: &[super::tokens::Token],
    limits: &Limits,
    joiner: &str,
) -> Vec<String> {
    let mut problems = Vec::new();
    if tokens.len() as f64 > limits.limit {
        problems.push(format!(
            "{} words (most {}): {line}",
            tokens.len(),
            format_limit(limits.limit)
        ));
    }
    let first = tokens.first();
    if !limits.starts.is_empty()
        && !first.is_some_and(|token| limits.starts.contains(&token.folded))
    {
        let value = first.map_or("undefined", |token| token.value.as_str());
        problems.push(format!("starts with \"{value}\": {line}"));
    }
    for token in tokens.iter().filter(|token| token.kind == Kind::Word) {
        for word in token.folded.split(joiner) {
            if limits.forbidden.contains(word) {
                problems.push(format!("uses forbidden \"{word}\": {line}"));
            }
        }
    }
    problems
}

/// Problems with a text written in the language (empty when it keeps the
/// rules). Each line holds one sentence.
pub fn check_text(text: &str, id: &str) -> Result<Vec<String>, String> {
    let language = natural_language(id)?;
    let limits = Limits {
        limit: numeric_rule(language, "max-sentence-words"),
        starts: words_of(language.rule("sentence-starts"))
            .into_iter()
            .collect(),
        forbidden: words_of(language.rule("forbidden-words"))
            .into_iter()
            .collect(),
    };
    let average = numeric_rule(language, "average-sentence-words");
    let mut problems = Vec::new();
    let mut lengths = Vec::new();
    for (_, raw) in super::lines::sentence_lines(text, language) {
        let line = raw.trim();
        if line.is_empty() || is_note(line, language) {
            continue;
        }
        let tokens: Vec<_> = language
            .tokenize(line)?
            .into_iter()
            .filter(|token| matches!(token.kind, Kind::Word | Kind::Number | Kind::Text))
            .collect();
        lengths.push(tokens.len());
        problems.extend(sentence_problems(
            line,
            &tokens,
            &limits,
            &language.name_joiner,
        ));
    }
    if !lengths.is_empty() {
        let mean = lengths.iter().sum::<usize>() as f64 / lengths.len() as f64;
        if mean > average {
            problems.push(format!(
                "average sentence has {:.1} words (most {})",
                // toFixed rounds a tie up, as `round` does.
                (mean * 10.0).round() / 10.0,
                format_limit(average)
            ));
        }
    }
    Ok(problems)
}
