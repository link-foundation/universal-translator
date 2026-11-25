//! Comment language: translate only the comments of a program, word by word,
//! with the dictionaries the natural languages already have.
//!
//! A comment dictionary pairs the phrases of two natural languages through
//! their shared meaning: the neutral words of program names (the lexicon of
//! each language description) and the exponents of the semantic primes. The
//! longest known phrase wins; unknown words, numbers, punctuation and every
//! space stay as they are, so the layout inside a comment is kept.
//!
//! A dictionary cannot translate free prose well; it is the default
//! translation of comments. The JavaScript twin is js/src/natural/comments.js.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock, Mutex};

use regex::Regex;

use super::catalog::{natural_language, natural_language_ids};
use super::rules::semantic_primes;

fn fold(text: &str) -> String {
    text.to_lowercase()
}

fn base_of(id: &str) -> Result<String, String> {
    let language = natural_language(id)?;
    Ok(language.base.clone().unwrap_or_else(|| id.to_owned()))
}

/// Every neutral word some language has a word for, in first-seen order.
fn neutral_words() -> &'static [String] {
    static NEUTRAL: LazyLock<Vec<String>> = LazyLock::new(|| {
        let mut seen = HashSet::new();
        let mut words = Vec::new();
        for id in natural_language_ids() {
            let Ok(language) = natural_language(id) else {
                continue;
            };
            for (neutral, _) in &language.lexicon.entries {
                if seen.insert(neutral.clone()) {
                    words.push(neutral.clone());
                }
            }
        }
        words
    });
    &NEUTRAL
}

/// Neutral meaning -> phrases of one language, the preferred phrase first,
/// in the order the meanings are first met.
type Phrases = Vec<(String, Vec<String>)>;

fn phrases_of(id: &str) -> Result<Phrases, String> {
    let language = natural_language(id)?;
    let base = base_of(id)?;
    let mut phrases: Phrases = Vec::new();
    let mut add = |meaning: String, phrase: Option<&str>| {
        let Some(phrase) = phrase.filter(|phrase| !phrase.is_empty()) else {
            return;
        };
        let folded = fold(phrase);
        match phrases.iter_mut().find(|(known, _)| *known == meaning) {
            Some((_, known)) => {
                if !known.contains(&folded) {
                    known.push(folded);
                }
            }
            None => phrases.push((meaning, vec![folded])),
        }
    };
    for prime in semantic_primes()? {
        for phrase in prime.exponents.get(&base).into_iter().flatten() {
            add(format!("prime:{}", prime.prime), Some(phrase));
        }
    }
    // Program words are neutral English words: English spells each of them
    // as it is (or in its regional spelling, color -> colour), other
    // languages through their lexicon.
    if base == "english" {
        for neutral in neutral_words() {
            add(
                format!("word:{neutral}"),
                language.lexicon.get(neutral).map(String::as_str),
            );
            add(format!("word:{neutral}"), Some(neutral));
        }
    } else {
        for (neutral, word) in &language.lexicon.entries {
            add(format!("word:{neutral}"), Some(word));
        }
    }
    Ok(phrases)
}

type Dictionary = Arc<HashMap<String, String>>;

static DICTIONARIES: LazyLock<Mutex<HashMap<String, Dictionary>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Phrase of `from` -> phrase of `to`, for every meaning both languages have.
pub fn comment_dictionary(from: &str, to: &str) -> Result<Dictionary, String> {
    let key = format!("{from}>{to}");
    if let Some(known) = DICTIONARIES
        .lock()
        .ok()
        .and_then(|cache| cache.get(&key).cloned())
    {
        return Ok(known);
    }
    let source = phrases_of(from)?;
    let target: HashMap<String, Vec<String>> = phrases_of(to)?.into_iter().collect();
    let mut dictionary = HashMap::new();
    for (meaning, phrases) in source {
        if let Some(preferred) = target.get(&meaning).and_then(|phrases| phrases.first()) {
            for phrase in phrases {
                dictionary
                    .entry(phrase)
                    .or_insert_with(|| preferred.clone());
            }
        }
    }
    let dictionary = Arc::new(dictionary);
    if let Ok(mut cache) = DICTIONARIES.lock() {
        cache.insert(key, dictionary.clone());
    }
    Ok(dictionary)
}

/// Words are letters with inner apostrophes and hyphens; everything else
/// (spaces, digits, punctuation, code) is kept as it is. The pieces
/// alternate: a gap (maybe empty), a word, a gap, ... ending with a gap.
fn pieces(text: &str) -> Vec<&str> {
    static WORD: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*").expect("word pattern")
    });
    let mut result = Vec::new();
    let mut at = 0;
    for found in WORD.find_iter(text) {
        result.push(&text[at..found.start()]);
        result.push(found.as_str());
        at = found.end();
    }
    result.push(&text[at..]);
    result
}

const LONGEST_PHRASE: usize = 4;

fn match_case(original: &str, replacement: &str) -> String {
    if original == original.to_uppercase() && original.chars().count() > 1 {
        return replacement.to_uppercase();
    }
    let first: String = original.chars().take(1).collect();
    if first != first.to_lowercase() {
        let mut characters = replacement.chars();
        return characters.next().map_or_else(String::new, |head| {
            head.to_uppercase().chain(characters).collect()
        });
    }
    replacement.to_owned()
}

/// Translate the words of a text with a comment dictionary. Phrases of up
/// to four words joined by single spaces are tried longest first.
pub fn translate_comment_text(text: &str, from: &str, to: &str) -> Result<String, String> {
    natural_language(from)?;
    natural_language(to)?;
    if from == to {
        return Ok(text.to_owned());
    }
    let dictionary = comment_dictionary(from, to)?;
    let parts = pieces(text);
    let mut output = String::new();
    let mut index = 0;
    while index < parts.len() {
        if index % 2 == 0 {
            output.push_str(parts[index]);
            index += 1;
            continue;
        }
        let mut matched = false;
        for size in (1..=LONGEST_PHRASE).rev() {
            let end = index + 2 * (size - 1);
            if end >= parts.len() {
                continue;
            }
            if (index + 1..end).step_by(2).any(|gap| parts[gap] != " ") {
                continue;
            }
            let phrase = parts[index..=end].concat();
            if let Some(translated) = dictionary.get(&fold(&phrase)) {
                output.push_str(&match_case(&phrase, translated));
                index = end + 1;
                matched = true;
                break;
            }
        }
        if !matched {
            output.push_str(parts[index]);
            index += 1;
        }
    }
    Ok(output)
}

fn known_words(id: &str) -> Result<Arc<HashSet<String>>, String> {
    static KNOWN: LazyLock<Mutex<HashMap<String, Arc<HashSet<String>>>>> =
        LazyLock::new(|| Mutex::new(HashMap::new()));
    if let Some(known) = KNOWN.lock().ok().and_then(|cache| cache.get(id).cloned()) {
        return Ok(known);
    }
    let words: HashSet<String> = phrases_of(id)?
        .into_iter()
        .flat_map(|(_, phrases)| phrases)
        .flat_map(|phrase| phrase.split(' ').map(str::to_owned).collect::<Vec<_>>())
        .collect();
    let words = Arc::new(words);
    if let Ok(mut cache) = KNOWN.lock() {
        cache.insert(id.to_owned(), words.clone());
    }
    Ok(words)
}

/// The natural language most words of the comments belong to (English when
/// no language knows them).
pub fn detect_comment_language<S: AsRef<str>>(texts: &[S]) -> &'static str {
    let words: Vec<String> = texts
        .iter()
        .flat_map(|text| {
            pieces(text.as_ref())
                .into_iter()
                .skip(1)
                .step_by(2)
                .map(fold)
                .collect::<Vec<_>>()
        })
        .collect();
    let mut best = ("english", 0);
    for id in natural_language_ids() {
        let Ok(language) = natural_language(id) else {
            continue;
        };
        if language.base.is_some() {
            continue;
        }
        let Ok(known) = known_words(id) else {
            continue;
        };
        let score = words.iter().filter(|word| known.contains(*word)).count();
        if score > best.1 {
            best = (id, score);
        }
    }
    best.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pieces_alternate_gaps_and_words() {
        assert_eq!(pieces(" a-b, c"), vec![" ", "a-b", ", ", "c", ""]);
        assert_eq!(pieces("42"), vec!["42"]);
    }

    #[test]
    fn case_follows_the_original_word() {
        assert_eq!(match_case("NUMBER", "zahl"), "ZAHL");
        assert_eq!(match_case("Number", "zahl"), "Zahl");
        assert_eq!(match_case("number", "zahl"), "zahl");
    }
}
