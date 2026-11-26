//! Free translation of prose: the comments of a program, and the sentences
//! of a natural language text that no controlled template reads.
//!
//! A dictionary pairs the phrases of two natural languages through their
//! shared meaning: the exponents of the semantic primes, the neutral words
//! of program names (the lexicon of each language description) and the
//! concepts of the everyday vocabulary (data/natural/vocabulary.lino). Every
//! meaning of a phrase is kept, likeliest first, and the translation takes
//! the first meaning the other language has. Of that meaning's phrases it
//! writes the first one that reads back to the same meaning, so the words
//! chosen are the frequent ones that survive the round trip.
//!
//! The longest known phrase wins. A little grammar (data/natural/grammar.lino)
//! goes beyond word for word:
//!
//! - in a question, interrogative concepts come first (как -> how, not like);
//! - an inflected form is found through its stem (мира -> мир -> world);
//! - an infinitive stays one (покакать -> to poop, to poop -> покакать);
//! - a verb form keeps its slot when both languages name their verb forms
//!   (verb-forms): prints -> печатает, a finite form is never written as an
//!   infinitive;
//! - the object of a verb takes the accusative when the language has one
//!   (object-endings, object-forms): greets someone -> приветствует кого-то,
//!   prints the sum -> печатает сумму;
//! - "of" between two nouns is left out before a name the dictionary does
//!   not know, in a language whose second noun takes the genitive
//!   (of-genitive): factorial of n -> факториал n;
//! - an article the other language does not have is left out;
//! - words of languages written without spaces are found inside the text.
//!
//! Unknown words, numbers, punctuation and every other space stay as they
//! are, so the layout inside a comment is kept.
//!
//! The JavaScript twin is js/src/natural/comments.js.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock, Mutex};

use regex::Regex;

use super::catalog::{natural_language, natural_language_ids};
use super::rules::semantic_primes;
use super::vocabulary::{Grammar, grammar_of, known_form, stem_index, vocabulary_concepts};

pub(crate) fn fold(text: &str) -> String {
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

/// The meanings of one language.
pub(crate) struct Meanings {
    /// meaning -> phrases, the preferred phrase first
    pub(crate) phrases: HashMap<String, Vec<String>>,
    /// phrase -> meanings, the likeliest first
    pub(crate) meanings: HashMap<String, Vec<String>>,
    /// the phrases in the order they are first met
    pub(crate) order: Vec<String>,
    /// meaning -> part of speech ('prime' and 'name' for the primes and the
    /// words of program names)
    pub(crate) parts: HashMap<String, String>,
    /// concept meaning -> its forms in the order of the vocabulary, so the
    /// slot of a verb form (lemma, present) is its position
    pub(crate) forms: HashMap<String, Vec<String>>,
    pub(crate) grammar: Grammar,
    pub(crate) stems: HashMap<String, String>,
}

impl Meanings {
    fn add(&mut self, meaning: &str, part: &str, phrase: Option<&str>) {
        let Some(phrase) = phrase.filter(|phrase| !phrase.is_empty()) else {
            return;
        };
        let folded = fold(phrase);
        let known = self.phrases.entry(meaning.to_owned()).or_default();
        if known.contains(&folded) {
            return;
        }
        known.push(folded.clone());
        self.parts.insert(meaning.to_owned(), part.to_owned());
        let meanings = self.meanings.entry(folded.clone()).or_default();
        if meanings.is_empty() {
            self.order.push(folded);
        }
        meanings.push(meaning.to_owned());
    }

    pub(crate) fn part(&self, meaning: &str) -> &str {
        self.parts.get(meaning).map_or("", String::as_str)
    }
}

pub(crate) fn meanings_of(id: &str) -> Result<Arc<Meanings>, String> {
    static CACHE: LazyLock<Mutex<HashMap<String, Arc<Meanings>>>> =
        LazyLock::new(|| Mutex::new(HashMap::new()));
    if let Some(known) = CACHE.lock().ok().and_then(|cache| cache.get(id).cloned()) {
        return Ok(known);
    }
    let language = natural_language(id)?;
    let base = base_of(id)?;
    let grammar = grammar_of(&base);
    let mut result = Meanings {
        phrases: HashMap::new(),
        meanings: HashMap::new(),
        order: Vec::new(),
        parts: HashMap::new(),
        forms: HashMap::new(),
        grammar,
        stems: HashMap::new(),
    };
    for prime in semantic_primes()? {
        for phrase in prime.exponents.get(&base).into_iter().flatten() {
            result.add(&format!("prime:{}", prime.prime), "prime", Some(phrase));
        }
    }
    // Program words are neutral English words: English spells each of them
    // as it is (or in its regional spelling, color -> colour), other
    // languages through their lexicon.
    if base == "english" {
        for neutral in neutral_words() {
            let meaning = format!("word:{neutral}");
            result.add(
                &meaning,
                "name",
                language.lexicon.get(neutral).map(String::as_str),
            );
            result.add(&meaning, "name", Some(neutral));
        }
    } else {
        for (neutral, word) in &language.lexicon.entries {
            result.add(&format!("word:{neutral}"), "name", Some(word));
        }
    }
    for concept in vocabulary_concepts()? {
        let meaning = format!("concept:{}", concept.id);
        let written = concept.forms.get(&base).cloned().unwrap_or_default();
        for phrase in &written {
            result.add(&meaning, &concept.part, Some(phrase));
        }
        result.forms.insert(meaning, written);
    }
    // The accusative of a word with a form of its own is read as the word.
    for (nominative, accusative) in &result.grammar.object_forms.clone() {
        for meaning in result.meanings.get(nominative).cloned().unwrap_or_default() {
            let part = result.part(&meaning).to_owned();
            result.add(&meaning, &part, Some(accusative));
        }
    }
    result.stems = stem_index(&result.order, &result.grammar);
    let result = Arc::new(result);
    if let Ok(mut cache) = CACHE.lock() {
        cache.insert(id.to_owned(), result.clone());
    }
    Ok(result)
}

/// The meanings of a phrase in the order a sentence makes likely: first the
/// meanings that list it earliest (a word mostly means what it is the main
/// word of: "в" is first "in", only then "inside"), then in a question the
/// interrogative concepts first, elsewhere last.
pub(crate) fn likely<'a>(phrase: &str, language: &'a Meanings, question: bool) -> Vec<&'a String> {
    let rank = |meaning: &String| {
        language.phrases[meaning.as_str()]
            .iter()
            .position(|known| known == phrase)
            .unwrap_or(usize::MAX)
    };
    let mut meanings: Vec<&String> = language
        .meanings
        .get(phrase)
        .map_or(&[][..], Vec::as_slice)
        .iter()
        .collect();
    meanings.sort_by_key(|meaning| rank(meaning));
    let (asked, others): (Vec<&String>, Vec<&String>) = meanings
        .into_iter()
        .partition(|meaning| language.part(meaning) == "interrogative");
    if question {
        asked.into_iter().chain(others).collect()
    } else {
        others.into_iter().chain(asked).collect()
    }
}

/// The phrase of `target` for a meaning: the first that reads back to it.
/// A phrase that reads back to the program word spelled the same (count ->
/// word:count) reads back to the concept too: both are written "count".
fn preferred_phrase(meaning: &str, target: &Meanings, question: bool) -> String {
    let phrases = &target.phrases[meaning];
    phrases
        .iter()
        .find(|phrase| {
            likely(phrase, target, question)
                .first()
                .is_some_and(|first| *first == meaning || **first == format!("word:{phrase}"))
        })
        .unwrap_or(&phrases[0])
        .clone()
}

/// The translation of one known phrase. An article the target does not
/// have becomes an empty text.
struct Translated {
    text: String,
    part: String,
    meaning: String,
    lemma: bool,
}

/// The form of a verb in the slot (lemma, present) the source form has, when
/// both languages name their verb forms; None for the lemma and for every
/// verb form the languages do not both name.
fn slot_form(phrase: &str, meaning: &str, source: &Meanings, target: &Meanings) -> Option<String> {
    let slot = source
        .forms
        .get(meaning)?
        .iter()
        .position(|form| form == phrase)?;
    let name = source.grammar.verb_forms.get(slot).filter(|_| slot > 0)?;
    let at = target
        .grammar
        .verb_forms
        .iter()
        .position(|known| known == name)?;
    target
        .forms
        .get(meaning)?
        .get(at)
        .filter(|form| at > 0 && !form.is_empty())
        .cloned()
}

fn translate_phrase(
    phrase: &str,
    source: &Meanings,
    target: &Meanings,
    question: bool,
) -> Option<Translated> {
    source.meanings.get(phrase)?;
    for meaning in likely(phrase, source, question) {
        let part = source.part(meaning).to_owned();
        if target.phrases.contains_key(meaning.as_str()) {
            let form = if part == "verb" {
                slot_form(phrase, meaning, source, target)
            } else {
                None
            };
            return Some(Translated {
                lemma: form.is_none() && source.phrases[meaning.as_str()][0] == phrase,
                text: form.unwrap_or_else(|| preferred_phrase(meaning, target, question)),
                part,
                meaning: meaning.clone(),
            });
        }
        if part == "article" {
            return Some(Translated {
                text: String::new(),
                part,
                meaning: meaning.clone(),
                lemma: true,
            });
        }
    }
    None
}

type Dictionary = Arc<HashMap<String, String>>;

static DICTIONARIES: LazyLock<Mutex<HashMap<String, Dictionary>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Phrase of `from` -> phrase of `to`, for every meaning both languages have
/// (outside questions).
pub fn comment_dictionary(from: &str, to: &str) -> Result<Dictionary, String> {
    let key = format!("{from}>{to}");
    if let Some(known) = DICTIONARIES
        .lock()
        .ok()
        .and_then(|cache| cache.get(&key).cloned())
    {
        return Ok(known);
    }
    let source = meanings_of(from)?;
    let target = meanings_of(to)?;
    let mut dictionary = HashMap::new();
    for phrase in &source.order {
        if let Some(translated) = translate_phrase(phrase, &source, &target, false)
            && !translated.text.is_empty()
        {
            dictionary.insert(phrase.clone(), translated.text);
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
pub(crate) fn pieces(text: &str) -> Vec<&str> {
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
/// The longest word looked for inside a text written without spaces.
const LONGEST_RUN: usize = 8;

/// A word written in capitals is written in capitals, a capitalized word is
/// capitalized; scripts without case (你好) leave the translation as it is.
fn match_case(original: &str, replacement: &str) -> String {
    if original == original.to_uppercase()
        && original != original.to_lowercase()
        && original.encode_utf16().count() > 1
    {
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

/// For every word piece, whether the sentence it belongs to is a question:
/// the first end mark after the word decides.
fn questions_of(parts: &[&str]) -> Vec<bool> {
    let mut questions = vec![false; parts.len()];
    let mut question = false;
    for index in (0..parts.len()).rev() {
        if index % 2 == 0 {
            if let Some(mark) = parts[index].chars().find(|c| ".!?;。！？؟".contains(*c)) {
                question = "?？؟".contains(mark);
            }
        } else {
            questions[index] = question;
        }
    }
    questions
}

/// The translation of the words starting at a piece: `end` is the index of
/// the last word read.
struct Words {
    text: String,
    end: usize,
    part: String,
    meaning: String,
}

/// Phrase translation through the grammar of both languages.
struct ProseTranslator {
    source: Arc<Meanings>,
    target: Arc<Meanings>,
    /// the next noun is the object of the verb just written
    object: bool,
    /// the part of the word just written, when only blanks follow it
    last: Option<String>,
}

/// A translated phrase: its written text, its part of speech and its meaning.
struct Phrase {
    text: String,
    part: String,
    meaning: String,
}

impl ProseTranslator {
    /// The written form of a translated phrase.
    fn write(&self, translated: &Translated, infinitive: bool) -> String {
        match &self.target.grammar.infinitive {
            Some(pattern) if infinitive && translated.part == "verb" => {
                pattern.replace("{verb}", &translated.text)
            }
            _ => translated.text.clone(),
        }
    }

    fn phrase(&self, phrase: &str, question: bool) -> Option<Phrase> {
        let translated = translate_phrase(phrase, &self.source, &self.target, question)?;
        let infinitive =
            translated.lemma && self.source.grammar.verb_lemma.as_deref() == Some("infinitive");
        Some(Phrase {
            text: self.write(&translated, infinitive),
            part: translated.part,
            meaning: translated.meaning,
        })
    }

    /// The accusative of the object of a verb: a word with its own form
    /// (кто-то -> кого-то) or a noun with the ending of the case
    /// (сумма -> сумму).
    fn accusative(&self, result: &Words) -> String {
        let grammar = &self.target.grammar;
        if let Some((_, object)) = grammar
            .object_forms
            .iter()
            .find(|(nominative, _)| *nominative == result.text)
        {
            return object.clone();
        }
        // Only a singular nominative has the endings: the first phrase of the
        // meaning, and not a word of the program names in the plural.
        let nominative = self
            .target
            .phrases
            .get(&result.meaning)
            .and_then(|phrases| phrases.first());
        let plural = result.meaning.starts_with("word:") && result.meaning.ends_with('s');
        if !["noun", "name"].contains(&result.part.as_str())
            || result.text.contains(' ')
            || nominative != Some(&result.text)
            || plural
        {
            return result.text.clone();
        }
        // The longest ending decides (a neuter имя keeps its form).
        grammar
            .object_endings
            .iter()
            .find(|(ending, _)| result.text.ends_with(ending.as_str()))
            .map_or_else(
                || result.text.clone(),
                |(ending, object)| {
                    format!(
                        "{}{object}",
                        &result.text[..result.text.len() - ending.len()]
                    )
                },
            )
    }

    /// Whether the words at parts[index] are none the dictionary knows (the
    /// name of something in the program).
    fn unknown(&self, parts: &[&str], index: usize) -> bool {
        index < parts.len() && self.words(parts, index, false).is_none()
    }

    /// The words around a verb agree in case: the first noun after a verb
    /// (an article may come between) is its object and takes the accusative,
    /// and "of" between two nouns is left out of a language whose second noun
    /// takes the genitive when the second noun is a name the dictionary does
    /// not know. Only words separated by blanks belong together.
    fn agree(&mut self, parts: &[&str], mut result: Words) -> Words {
        let object = self.object;
        let last = self.last.take();
        let after = parts.get(result.end + 1).copied().unwrap_or("");
        let blank = after.chars().all(|c| c == ' ' || c == '\t');
        if object && result.part != "article" {
            result.text = self.accusative(&result);
        }
        if result.meaning == "word:of"
            && self.target.grammar.of_genitive
            && last
                .as_deref()
                .is_some_and(|part| part == "noun" || part == "name")
            && after == " "
            && self.unknown(parts, result.end + 2)
        {
            result.text = String::new();
        }
        self.object = blank && (result.part == "verb" || (object && result.part == "article"));
        self.last = blank.then(|| result.part.clone());
        result
    }

    /// A word no translation reads ends the sentence parts that agree.
    fn disagree(&mut self) {
        self.object = false;
        self.last = None;
    }

    /// An infinitive written around its verb ('to poop'): the words of the
    /// pattern before the verb, then the verb.
    fn infinitive(&self, parts: &[&str], index: usize, question: bool) -> Option<Words> {
        let pattern = self.source.grammar.infinitive.as_ref()?;
        let before: Vec<&str> = pattern
            .split("{verb}")
            .next()
            .unwrap_or_default()
            .split_whitespace()
            .collect();
        let verb_at = index + 2 * before.len();
        if verb_at >= parts.len() {
            return None;
        }
        for (word, expected) in before.iter().enumerate() {
            let at = index + 2 * word;
            if fold(parts[at]) != *expected || parts[at + 1] != " " {
                return None;
            }
        }
        let known = self.known(&fold(parts[verb_at]))?;
        let translated = translate_phrase(&known, &self.source, &self.target, question)?;
        if translated.part != "verb" {
            return None;
        }
        Some(Words {
            text: self.write(&translated, true),
            end: verb_at,
            part: "verb".to_owned(),
            meaning: translated.meaning,
        })
    }

    /// A known form of a word, directly or through its stem.
    fn known(&self, word: &str) -> Option<String> {
        if self.source.meanings.contains_key(word) {
            return Some(word.to_owned());
        }
        known_form(word, &self.source.stems, &self.source.grammar)
    }

    /// Known words inside a run of letters written without spaces, longest
    /// first; None when none is known.
    fn segments(&self, word: &str, question: bool) -> Option<String> {
        if self.source.grammar.spaced {
            return None;
        }
        let letters: Vec<char> = word.chars().collect();
        // (text, known)
        let mut found: Vec<(String, bool)> = Vec::new();
        let mut any = false;
        let mut at = 0;
        while at < letters.len() {
            let mut translated = None;
            for size in (1..=LONGEST_RUN.min(letters.len() - at)).rev() {
                let run = fold(&letters[at..at + size].iter().collect::<String>());
                if let Some(found) = self.phrase(&run, question) {
                    translated = Some((found.text, size));
                    break;
                }
            }
            if let Some((text, size)) = translated {
                found.push((text, true));
                at += size;
                any = true;
            } else {
                match found.last_mut() {
                    Some((text, false)) => text.push(letters[at]),
                    _ => found.push((letters[at].to_string(), false)),
                }
                at += 1;
            }
        }
        if !any {
            return None;
        }
        let joiner = if self.target.grammar.spaced { " " } else { "" };
        Some(
            found
                .into_iter()
                .map(|(text, _)| text)
                .collect::<Vec<_>>()
                .join(joiner),
        )
    }

    fn words(&self, parts: &[&str], index: usize, question: bool) -> Option<Words> {
        if let Some(infinitive) = self.infinitive(parts, index, question) {
            return Some(infinitive);
        }
        for size in (1..=LONGEST_PHRASE).rev() {
            let end = index + 2 * (size - 1);
            if end >= parts.len() {
                continue;
            }
            if (index + 1..end).step_by(2).any(|gap| parts[gap] != " ") {
                continue;
            }
            let phrase = fold(&parts[index..=end].concat());
            let translated = self.phrase(&phrase, question).or_else(|| {
                if size == 1 {
                    self.inflected(&phrase, question)
                } else {
                    None
                }
            });
            if let Some(Phrase {
                text,
                part,
                meaning,
            }) = translated
            {
                return Some(Words {
                    text,
                    end,
                    part,
                    meaning,
                });
            }
        }
        self.segments(parts[index], question).map(|text| Words {
            text,
            end: index,
            part: "segments".to_owned(),
            meaning: String::new(),
        })
    }

    fn inflected(&self, word: &str, question: bool) -> Option<Phrase> {
        let form = known_form(word, &self.source.stems, &self.source.grammar)?;
        self.phrase(&form, question)
    }
}

/// A piece of the written text: a gap, or a word (translated or not).
enum Written {
    Gap(String),
    Word(String, bool),
}

/// Translate the words of a text with the dictionary and the grammar of
/// both languages. Phrases of up to four words joined by single spaces are
/// tried longest first.
pub fn translate_comment_text(text: &str, from: &str, to: &str) -> Result<String, String> {
    natural_language(from)?;
    natural_language(to)?;
    if from == to {
        return Ok(text.to_owned());
    }
    let mut translator = ProseTranslator {
        source: meanings_of(from)?,
        target: meanings_of(to)?,
        object: false,
        last: None,
    };
    let parts = pieces(text);
    let questions = questions_of(&parts);
    let mut written = vec![Written::Gap(parts[0].to_owned())];
    let mut capitalize = false;
    let mut index = 1;
    while index < parts.len() {
        let Some(found) = translator.words(&parts, index, questions[index]) else {
            translator.disagree();
            written.push(Written::Word(parts[index].to_owned(), false));
            written.push(Written::Gap(parts[index + 1].to_owned()));
            capitalize = false;
            index += 2;
            continue;
        };
        let result = translator.agree(&parts, found);
        let original = parts[index..=result.end].concat();
        let mut output = match_case(&original, &result.text);
        if capitalize {
            output = match_case("A", &output);
        }
        capitalize = false;
        let mut gap = parts[result.end + 1];
        if output.is_empty() {
            // An article or an "of" left out goes with the space after it; a
            // capital moves on to the next word.
            let first: String = original.chars().take(1).collect();
            capitalize = first != fold(&first);
            if gap == " " {
                gap = "";
            }
        }
        written.push(Written::Word(output, true));
        written.push(Written::Gap(gap.to_owned()));
        index = result.end + 2;
    }
    // Words of a language written without spaces are joined.
    let joined = !translator.target.grammar.spaced;
    let translated_word = |piece: Option<&Written>| matches!(piece, Some(Written::Word(text, true)) if !text.is_empty());
    let mut output = String::new();
    for (at, piece) in written.iter().enumerate() {
        match piece {
            Written::Word(text, _) => output.push_str(text),
            Written::Gap(gap) => {
                let between = at > 0
                    && translated_word(written.get(at - 1))
                    && translated_word(written.get(at + 1));
                if !(joined && gap == " " && between) {
                    output.push_str(gap);
                }
            }
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
    let words: HashSet<String> = meanings_of(id)?
        .order
        .iter()
        .flat_map(|phrase| phrase.split(' ').map(str::to_owned).collect::<Vec<_>>())
        .collect();
    let words = Arc::new(words);
    if let Ok(mut cache) = KNOWN.lock() {
        cache.insert(id.to_owned(), words.clone());
    }
    Ok(words)
}

/// Whether a word (folded) is a word of a language, directly or through its
/// stem.
pub fn is_known_word(word: &str, id: &str) -> bool {
    if known_words(id).is_ok_and(|known| known.contains(word)) {
        return true;
    }
    meanings_of(id)
        .is_ok_and(|meanings| known_form(word, &meanings.stems, &meanings.grammar).is_some())
}

/// The words of a text (folded).
pub fn words_of(text: &str) -> Vec<String> {
    pieces(text)
        .into_iter()
        .skip(1)
        .step_by(2)
        .map(fold)
        .collect()
}

/// The natural language most words of the comments belong to (English when
/// no language knows them).
pub fn detect_comment_language<S: AsRef<str>>(texts: &[S]) -> &'static str {
    let words: Vec<String> = texts
        .iter()
        .flat_map(|text| words_of(text.as_ref()))
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
