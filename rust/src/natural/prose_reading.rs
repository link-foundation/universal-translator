//! A deep reading of prose: the sentences of a text, their words and the
//! meanings the words stand for, with the code a text quotes between
//! backticks read by the grammar of its programming language.
//!
//! ```text
//!   Prose     { language, sentences }
//!   Sentence  { words, question? }
//!   Word      { text, concept? | prime? | word?, part? }
//!   Code      { language, program }   a quoted piece of code, read
//! ```
//!
//! A word's meaning is a concept of the everyday vocabulary
//! (data/natural/vocabulary.lino), a semantic prime or a neutral word of
//! program names, found the way the free translation of prose finds it
//! (comments.rs): the longest known phrase of up to four words first, an
//! inflected word through its stem, and in a question the interrogative
//! meanings first. The JavaScript twin is js/src/natural/prose-reading.js.

use std::sync::LazyLock;

use regex::Regex;

use super::comments::{Meanings, detect_comment_language, fold, likely, meanings_of, pieces};
use super::vocabulary::known_form;
use crate::meta::tree::{Node, Value};

const LONGEST_PHRASE: usize = 4;
/// The longest word looked for inside a text written without spaces.
const LONGEST_RUN: usize = 8;

static TERMINATORS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[.!?;。！？؟]").expect("terminators"));
static QUESTION_MARKS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[?？؟]").expect("question marks"));

/// A word and its meaning: `concept:print` -> `(concept print)`.
fn word(text: &str, meaning: Option<&str>, language: &Meanings) -> Node {
    let mut node = Node::new("Word").with("text", text);
    if let Some(meaning) = meaning
        && let Some((field, value)) = meaning.split_once(':')
    {
        node.set(field, value);
        let part = language.part(meaning);
        if !part.is_empty() {
            node.set("part", part);
        }
    }
    node
}

fn understood(word: &Node) -> bool {
    !word.is("Word") || word.str("part").is_some()
}

/// The meaning of a known phrase, through its stem for a single word.
fn meaning_of(phrase: &str, language: &Meanings, single: bool, question: bool) -> Option<String> {
    let form = if language.meanings.contains_key(phrase) {
        Some(phrase.to_owned())
    } else if single {
        known_form(phrase, &language.stems, &language.grammar)
    } else {
        None
    };
    form.and_then(|form| {
        likely(&form, language, question)
            .first()
            .map(|it| (*it).clone())
    })
}

/// The words of a run of letters written without spaces: the longest known
/// runs first, unknown letters joined into one word.
fn segmented(text: &str, language: &Meanings, question: bool) -> Vec<Node> {
    let letters: Vec<char> = text.chars().collect();
    let mut words: Vec<Node> = Vec::new();
    let mut at = 0;
    while at < letters.len() {
        let found = (1..=LONGEST_RUN.min(letters.len() - at))
            .rev()
            .find_map(|size| {
                let run: String = letters[at..at + size].iter().collect();
                meaning_of(&fold(&run), language, false, question).map(|meaning| (size, meaning))
            });
        if let Some((size, meaning)) = found {
            let run: String = letters[at..at + size].iter().collect();
            words.push(word(&run, Some(&meaning), language));
            at += size;
            continue;
        }
        match words.last_mut() {
            Some(last) if !understood(last) => {
                let joined = format!("{}{}", last.str("text").unwrap_or(""), letters[at]);
                last.set("text", joined);
            }
            _ => words.push(word(&letters[at].to_string(), None, language)),
        }
        at += 1;
    }
    words
}

/// A word piece of a sentence and the gap before it, or quoted code.
enum Item<'a> {
    Word { text: &'a str, gap: &'a str },
    Code(&'a str),
}

struct Sentence<'a> {
    items: Vec<Item<'a>>,
    question: bool,
}

/// The words of one sentence: `run` holds its word pieces and the gaps
/// between them.
fn sentence_words(run: &[(&str, &str)], language: &Meanings, question: bool) -> Vec<Node> {
    let mut words = Vec::new();
    let mut index = 0;
    while index < run.len() {
        let found = (1..=LONGEST_PHRASE).rev().find_map(|size| {
            let last = index + size - 1;
            let joined =
                last < run.len() && run[index + 1..=last].iter().all(|(_, gap)| *gap == " ");
            if !joined {
                return None;
            }
            let text = run[index..=last]
                .iter()
                .map(|(text, _)| *text)
                .collect::<Vec<_>>()
                .join(" ");
            meaning_of(&fold(&text), language, size == 1, question)
                .map(|meaning| (text, meaning, size))
        });
        if let Some((text, meaning, size)) = found {
            words.push(word(&text, Some(&meaning), language));
            index += size;
        } else if !language.grammar.spaced {
            words.extend(segmented(run[index].0, language, question));
            index += 1;
        } else {
            words.push(word(run[index].0, None, language));
            index += 1;
        }
    }
    words
}

/// Close the current sentence at a terminator `mark`.
fn close<'a>(sentences: &mut Vec<Sentence<'a>>, current: &mut Sentence<'a>, mark: &str) {
    let items = std::mem::take(&mut current.items);
    if !items.is_empty() {
        sentences.push(Sentence {
            items,
            question: QUESTION_MARKS.is_match(mark),
        });
    }
}

/// The text cut into sentences: each one a list of word pieces (with the
/// gap before each word) and quoted code, and whether it asks.
fn sentences_of(text: &str) -> Vec<Sentence<'_>> {
    let mut sentences = Vec::new();
    let mut current = Sentence {
        items: Vec::new(),
        question: false,
    };
    for (at, segment) in text.split('`').enumerate() {
        if at % 2 == 1 {
            current.items.push(Item::Code(segment));
            continue;
        }
        let mut gap = "";
        for (index, piece) in pieces(segment).into_iter().enumerate() {
            if index % 2 == 1 {
                current.items.push(Item::Word { text: piece, gap });
                continue;
            }
            gap = piece;
            if let Some(mark) = TERMINATORS.find(piece) {
                close(&mut sentences, &mut current, mark.as_str());
                gap = "";
            }
        }
    }
    close(&mut sentences, &mut current, "");
    sentences
}

/// The words of a sentence, with its quoted code read by `read_code`.
fn read_sentence(
    sentence: &Sentence<'_>,
    language: &Meanings,
    read_code: &dyn Fn(&str) -> Option<Node>,
) -> Node {
    let mut words: Vec<Node> = Vec::new();
    let mut run: Vec<(&str, &str)> = Vec::new();
    for item in &sentence.items {
        match item {
            Item::Word { text, gap } => run.push((text, gap)),
            Item::Code(code) => {
                words.extend(sentence_words(&run, language, sentence.question));
                run.clear();
                words.push(read_code(code).unwrap_or_else(|| word(code, None, language)));
            }
        }
    }
    words.extend(sentence_words(&run, language, sentence.question));
    let node = Node::new("Sentence").with(
        "words",
        Value::List(words.into_iter().map(Value::Node).collect()),
    );
    if sentence.question {
        node.with("question", true)
    } else {
        node
    }
}

/// The deep reading of a text as prose of a natural language (the one most
/// of its words belong to, unless `language` names it), or `None` when no
/// word of it is known and it quotes no code.
pub fn read_prose(
    text: &str,
    language: Option<&str>,
    read_code: &dyn Fn(&str) -> Option<Node>,
) -> Option<Node> {
    let id = language.unwrap_or_else(|| detect_comment_language(&[text]));
    let meanings = meanings_of(id).ok()?;
    let sentences: Vec<Node> = sentences_of(text)
        .iter()
        .map(|sentence| read_sentence(sentence, &meanings, read_code))
        .collect();
    let known = sentences
        .iter()
        .any(|sentence| sentence.nodes("words").into_iter().any(understood));
    known.then(|| {
        Node::new("Prose").with("language", id).with(
            "sentences",
            Value::List(sentences.into_iter().map(Value::Node).collect()),
        )
    })
}
