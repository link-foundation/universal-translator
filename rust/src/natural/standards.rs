//! Natural language standards: the words a standard has and words defined
//! through other words. The JavaScript twin is js/src/natural/standards.js.
//!
//! A standard starts from the semantic primes of its language and the
//! grammatical words its minimal profile allows. Every other word is a
//! composite word with a definition made only of words the standard already
//! has, so every word expands down to the primes. A standard holds at most
//! [`STANDARD_WORD_LIMIT`] words.
//!
//! [`define_word`] extends a standard: it looks up the definition of an
//! unknown word, defines every unknown word of that definition the same way,
//! recursively, and adds the word when its definition is made only of words
//! of the standard.
//!
//! # The Wikidata definitions
//!
//! The JavaScript `wikidataLookup` fetches the glosses of Wikidata lexemes
//! over HTTPS and keeps every answer in a cache file
//! (`data/definitions/wikidata-<language>.lino`, written by
//! `scripts/precache-definitions.mjs`). The Rust standard library has no
//! HTTPS client, so Rust never fetches: [`wikidata_lookup`] answers from a
//! [`DefinitionCache`] read from the very file format the JavaScript side
//! writes ([`read_definition_cache`] and [`write_definition_cache`] are the
//! twins of `readDefinitionCache` and `writeDefinitionCache`). A word that is
//! not in the cache has no definitions, as an empty lookup does in
//! JavaScript. [`precached_definitions`] is the cache shipped with the crate.
//! [`lexeme_glosses`] reads the glosses out of a Wikidata response, for a
//! caller that fetches one itself.

use std::collections::{BTreeMap, HashSet};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::catalog::{label_of, natural_language, natural_language_ids, parse_root, values_of};
use super::rules::semantic_primes;

/// The most words a standard holds. The largest well-known controlled
/// vocabularies below it are ASD-STE100 (875 words) and Basic English (850).
pub const STANDARD_WORD_LIMIT: usize = 1024;

fn fold(text: &str) -> String {
    text.to_lowercase()
}

/// Words are letters with inner apostrophes and hyphens; numbers are data
/// and need no definition.
static WORD_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*").expect("word pattern"));

/// The words of a text, folded to lower case.
pub fn words_of_text(text: &str) -> Vec<String> {
    WORD_PATTERN
        .find_iter(&fold(text))
        .map(|word| word.as_str().to_owned())
        .collect()
}

fn base_of(id: &str) -> Result<String, String> {
    Ok(natural_language(id)?
        .base
        .clone()
        .unwrap_or_else(|| id.to_owned()))
}

/// The minimal profile of a language (minimal-english for english).
fn minimal_profile(base: &str) -> Option<&'static str> {
    natural_language_ids().into_iter().find(|id| {
        base_of(id).is_ok_and(|candidate| candidate == base)
            && natural_language(id)
                .ok()
                .and_then(|language| language.rules.get("primes"))
                .is_some_and(|primes| primes.iter().any(|prime| prime == base))
    })
}

/// The words every standard of a language starts from, each with where it
/// comes from (`prime:<prime>` or `grammar`): the exponents of the primes and
/// the grammatical words of its minimal profile.
pub fn primitive_words(id: &str) -> Result<Vec<(String, String)>, String> {
    let base = base_of(id)?;
    let mut words: Vec<(String, String)> = Vec::new();
    let mut add = |word: String, meaning: String| {
        if !words.iter().any(|(known, _)| *known == word) {
            words.push((word, meaning));
        }
    };
    for prime in semantic_primes()? {
        for phrase in prime.exponents.get(&base).into_iter().flatten() {
            // "a-long-time" is the phrase "a long time": its words count too.
            let parts = words_of_text(&phrase.replace('-', " "));
            for word in words_of_text(phrase).into_iter().chain(parts) {
                add(word, format!("prime:{}", prime.prime));
            }
        }
    }
    let extra = minimal_profile(&base)
        .and_then(|minimal| natural_language(minimal).ok())
        .and_then(|language| language.rules.get("extra-words"));
    for word in words_of_text(&extra.map(|words| words.join(" ")).unwrap_or_default()) {
        add(word, "grammar".to_owned());
    }
    Ok(words)
}

/// Endings of English words and what replaces them in the dictionary form.
const ENGLISH_ENDINGS: [(&str, &str); 18] = [
    ("ies", "y"),
    ("ied", "y"),
    ("ves", "f"),
    ("sses", "ss"),
    ("ches", "ch"),
    ("shes", "sh"),
    ("xes", "x"),
    ("es", "e"),
    ("es", ""),
    ("s", ""),
    ("ed", "e"),
    ("ed", ""),
    ("ing", "e"),
    ("ing", ""),
    ("ly", ""),
    ("er", ""),
    ("est", ""),
    ("'s", ""),
];

/// Whether a stem ends in a doubled consonant: "bigg", "runn".
fn ends_doubled(stem: &str) -> bool {
    let mut letters = stem.chars().rev();
    match (letters.next(), letters.next()) {
        (Some(last), Some(before)) => last == before && !"aeiou".contains(last),
        _ => false,
    }
}

/// Likely dictionary forms of an inflected word, the word itself first. Only
/// English endings are known; other languages match exact forms.
pub fn lemma_candidates(word: &str, language: &str) -> Vec<String> {
    let folded = fold(word);
    let mut forms = vec![folded.clone()];
    if base_of(language).is_ok_and(|base| base != "english") {
        return forms;
    }
    let length = folded.chars().count();
    for (ending, replacement) in ENGLISH_ENDINGS {
        if let Some(stem) = folded.strip_suffix(ending)
            && length > ending.chars().count() + 1
        {
            forms.push(format!("{stem}{replacement}"));
        }
    }
    // Doubled final consonants: "bigger" -> "big", "running" -> "run".
    for ending in ["ing", "ed", "er", "est"] {
        if let Some(stem) = folded.strip_suffix(ending)
            && ends_doubled(stem)
        {
            forms.push(stem.chars().take(stem.chars().count() - 1).collect());
        }
    }
    let mut seen = HashSet::new();
    forms.retain(|form| seen.insert(form.clone()));
    forms
}

/// A standard: a language, its primitive words and its composite words.
#[derive(Clone, Debug)]
pub struct Standard {
    pub id: String,
    pub language: String,
    pub limit: usize,
    /// Word -> where it comes from (`prime:<prime>` or `grammar`).
    pub primitives: Vec<(String, String)>,
    /// Composite word -> its definition, in the order they were added.
    pub definitions: Vec<(String, String)>,
}

impl Standard {
    /// A standard of `language` with the given id and word limit.
    pub fn new(id: &str, language: &str, limit: usize) -> Result<Self, String> {
        let primitives = primitive_words(language)?;
        if primitives.len() > limit {
            return Err(format!(
                "{language} has {} primitive words, more than {limit}",
                primitives.len()
            ));
        }
        Ok(Self {
            id: id.to_owned(),
            language: language.to_owned(),
            limit,
            primitives,
            definitions: Vec::new(),
        })
    }

    /// A standard of `language` with the id "my-standard" and the default
    /// word limit.
    pub fn of_language(language: &str) -> Result<Self, String> {
        Self::new("my-standard", language, STANDARD_WORD_LIMIT)
    }

    pub fn size(&self) -> usize {
        self.primitives.len() + self.definitions.len()
    }

    pub fn is_primitive(&self, word: &str) -> bool {
        self.primitives.iter().any(|(known, _)| known == word)
    }

    pub fn has_definition(&self, word: &str) -> bool {
        self.definitions.iter().any(|(known, _)| known == word)
    }

    /// The definition of a composite word.
    pub fn definition(&self, word: &str) -> Option<&str> {
        self.definitions
            .iter()
            .find(|(known, _)| known == word)
            .map(|(_, definition)| definition.as_str())
    }

    /// The form of a word the standard has, if it has one.
    pub fn known_form(&self, word: &str) -> Option<String> {
        lemma_candidates(word, &self.language)
            .into_iter()
            .find(|form| self.is_primitive(form) || self.has_definition(form))
    }

    /// Words of a definition the standard does not have.
    pub fn unknown_words(&self, definition: &str) -> Vec<String> {
        words_of_text(definition)
            .into_iter()
            .filter(|word| self.known_form(word).is_none())
            .collect()
    }

    /// Add a composite word. Its definition may use only words the standard
    /// has (a word cannot be defined through itself), and the standard must
    /// stay within its limit. Returns the folded word.
    pub fn add_definition(&mut self, word: &str, definition: &str) -> Result<String, String> {
        let folded = fold(word);
        if self.is_primitive(&folded) {
            return Err(format!(r#""{word}" is a primitive word of {}"#, self.id));
        }
        let mut missing: Vec<String> = self
            .unknown_words(definition)
            .into_iter()
            .filter(|unknown| *unknown != folded)
            .collect();
        if words_of_text(definition).contains(&folded) {
            return Err(format!(r#""{word}" is defined through itself"#));
        }
        if !missing.is_empty() {
            let mut seen = HashSet::new();
            missing.retain(|unknown| seen.insert(unknown.clone()));
            return Err(format!(
                r#"The definition of "{word}" uses unknown words: {}"#,
                missing.join(", ")
            ));
        }
        if !self.has_definition(&folded) && self.size() >= self.limit {
            return Err(format!("{} already has {} words", self.id, self.limit));
        }
        let text = definition.trim().to_owned();
        match self
            .definitions
            .iter_mut()
            .find(|(known, _)| *known == folded)
        {
            Some(entry) => entry.1 = text,
            None => self.definitions.push((folded.clone(), text)),
        }
        Ok(folded)
    }

    /// A word expanded down to primitive words: each composite word of its
    /// definition is replaced by that word's own expansion, in parentheses.
    pub fn expand_word(&self, word: &str) -> Result<String, String> {
        self.expand_within(word, &HashSet::new())
    }

    fn expand_within(&self, word: &str, seen: &HashSet<String>) -> Result<String, String> {
        let form = self
            .known_form(word)
            .ok_or_else(|| format!(r#"{} has no word "{word}""#, self.id))?;
        if self.is_primitive(&form) || seen.contains(&form) {
            return Ok(word.to_owned());
        }
        let definition = self.definition(&form).unwrap_or_default();
        let mut inner = seen.clone();
        inner.insert(form);
        let mut expanded = String::new();
        let mut end = 0;
        for part in WORD_PATTERN.find_iter(definition) {
            expanded.push_str(&definition[end..part.start()]);
            end = part.end();
            match self.known_form(part.as_str()) {
                Some(known) if self.has_definition(&known) => {
                    expanded.push_str(&format!("({})", self.expand_within(part.as_str(), &inner)?));
                }
                _ => expanded.push_str(part.as_str()),
            }
        }
        expanded.push_str(&definition[end..]);
        Ok(expanded)
    }
}

/// What [`define_word`] did.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Definition {
    pub word: String,
    pub defined: bool,
    /// The words added with their definitions, the innermost first.
    pub added: Vec<(String, String)>,
    /// The words the standard could not reach.
    pub missing: Vec<String>,
    pub lookups: usize,
}

/// The candidate definitions of a word in a language, best first.
pub type Lookup<'a> = dyn FnMut(&str, &str) -> Vec<String> + 'a;

struct Definer<'a, 'b> {
    standard: &'a mut Standard,
    lookup: &'a mut Lookup<'b>,
    depth: usize,
    budget: usize,
    lookups: usize,
    added: Vec<(String, String)>,
    missing: Vec<String>,
    failed: HashSet<String>,
}

impl Definer<'_, '_> {
    fn define(
        &mut self,
        candidate: &str,
        level: usize,
        visiting: &HashSet<String>,
    ) -> Result<bool, String> {
        if self.standard.known_form(candidate).is_some() {
            return Ok(true);
        }
        let forms = lemma_candidates(candidate, &self.standard.language);
        if level > self.depth
            || forms
                .iter()
                .any(|form| visiting.contains(form) || self.failed.contains(form))
        {
            return Ok(false);
        }
        for form in &forms {
            if self.lookups >= self.budget {
                break;
            }
            self.lookups += 1;
            let definitions = (self.lookup)(form, &self.standard.language);
            let mut inner = visiting.clone();
            inner.insert(form.clone());
            for definition in &definitions {
                if self.defines(form, definition, level, &inner)? {
                    return Ok(true);
                }
            }
            if !definitions.is_empty() {
                break;
            }
        }
        self.failed.extend(forms);
        self.missing.push(fold(candidate));
        Ok(false)
    }

    /// Define the words of a definition, then the word through it when all
    /// of them are defined.
    fn defines(
        &mut self,
        form: &str,
        definition: &str,
        level: usize,
        visiting: &HashSet<String>,
    ) -> Result<bool, String> {
        let parts = words_of_text(definition);
        if parts.iter().any(|part| part == form) {
            return Ok(false);
        }
        let mut complete = true;
        for part in &parts {
            if !self.define(part, level + 1, visiting)? {
                complete = false;
            }
        }
        if complete && self.standard.size() < self.standard.limit {
            self.standard.add_definition(form, definition)?;
            self.added
                .push((form.to_owned(), definition.trim().to_owned()));
            return Ok(true);
        }
        Ok(false)
    }
}

/// Define a word, and recursively every unknown word of its definition,
/// through the words of a standard. `lookup(word, language)` gives the
/// candidate definitions of a word (a list of phrases, best first). Words the
/// standard cannot reach within `depth` levels or `budget` lookups stay
/// undefined.
pub fn define_word(
    standard: &mut Standard,
    word: &str,
    lookup: &mut Lookup<'_>,
    depth: usize,
    budget: usize,
) -> Result<Definition, String> {
    let mut definer = Definer {
        standard,
        lookup,
        depth,
        budget,
        lookups: 0,
        added: Vec::new(),
        missing: Vec::new(),
        failed: HashSet::new(),
    };
    let defined = definer.define(word, 0, &HashSet::new())?;
    let (added, lookups, missing) = (definer.added, definer.lookups, definer.missing);
    let mut listed = HashSet::new();
    let missing = missing
        .into_iter()
        .filter(|unknown| standard.known_form(unknown).is_none() && listed.insert(unknown.clone()))
        .collect();
    Ok(Definition {
        word: fold(word),
        defined,
        added,
        missing,
        lookups,
    })
}

/// The Wikidata language codes of the natural languages.
pub fn wikidata_language_code(language: &str) -> Option<&'static str> {
    Some(match language {
        "english" => "en",
        "arabic" => "ar",
        "bengali" => "bn",
        "chinese" => "zh",
        "dutch" => "nl",
        "french" => "fr",
        "german" => "de",
        "gujarati" => "gu",
        "hausa" => "ha",
        "hindi" => "hi",
        "indonesian" => "id",
        "italian" => "it",
        "japanese" => "ja",
        "korean" => "ko",
        "marathi" => "mr",
        "persian" => "fa",
        "polish" => "pl",
        "portuguese" => "pt",
        "punjabi" => "pa",
        "russian" => "ru",
        "spanish" => "es",
        "swahili" => "sw",
        "tagalog" => "tl",
        "tamil" => "ta",
        "telugu" => "te",
        "thai" => "th",
        "turkish" => "tr",
        "ukrainian" => "uk",
        "urdu" => "ur",
        "vietnamese" => "vi",
        _ => return None,
    })
}

/// Wikidata glosses per `<language code>:<word>`: what the JavaScript
/// `wikidataLookup` keeps in its cache (empty lists included).
pub type DefinitionCache = BTreeMap<String, Vec<String>>;

/// A lookup over the glosses of a definition cache. It never fetches: a word
/// that is not in the cache, or a language without a Wikidata code, has no
/// definitions.
pub fn wikidata_lookup(cache: &DefinitionCache) -> impl FnMut(&str, &str) -> Vec<String> + '_ {
    move |word, language| {
        let code = base_of(language)
            .ok()
            .and_then(|base| wikidata_language_code(&base));
        code.and_then(|code| cache.get(&format!("{code}:{}", fold(word))))
            .cloned()
            .unwrap_or_default()
    }
}

/// Glosses in one language of the lexemes spelled `word` in that language,
/// from the `entities` of a Wikidata `wbgetentities` answer.
pub fn lexeme_glosses(lexemes: &[Value], word: &str, code: &str) -> Vec<String> {
    let spelled = |lexeme: &Value| {
        lexeme["lemmas"].as_object().is_some_and(|lemmas| {
            lemmas.iter().any(|(lemma_code, lemma)| {
                lemma_code.split('-').next() == Some(code)
                    && lemma["value"].as_str().map(fold) == Some(fold(word))
            })
        })
    };
    let mut glosses: Vec<String> = Vec::new();
    for lexeme in lexemes.iter().filter(|lexeme| spelled(lexeme)) {
        for sense in lexeme["senses"].as_array().into_iter().flatten() {
            if let Some(gloss) = sense["glosses"][code]["value"]
                .as_str()
                .filter(|gloss| !gloss.is_empty())
                && !glosses.iter().any(|known| known == gloss)
            {
                glosses.push(gloss.to_owned());
            }
        }
    }
    glosses
}

fn quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', "''"))
}

/// A definition cache as Links Notation, to keep it in a file:
///
/// ```text
/// definitions:
///   'en:double': 'being twice as much as something else'
/// ```
///
/// The keys are sorted, by code point where JavaScript's `localeCompare`
/// sorts by locale; the two agree for the lower case ASCII words of the
/// English cache.
pub fn write_definition_cache(cache: &DefinitionCache) -> String {
    let mut text = String::from("definitions:\n");
    for (key, glosses) in cache {
        text.push_str(&format!("  {}:", quote(key)));
        for gloss in glosses {
            text.push(' ');
            text.push_str(&quote(gloss));
        }
        text.push('\n');
    }
    text
}

/// Links Notation -> definition cache.
pub fn read_definition_cache(source: &str) -> Result<DefinitionCache, String> {
    let root = parse_root(source).map_err(|_| definitions_start())?;
    if label_of(&root) != "definitions" {
        return Err(definitions_start());
    }
    Ok(values_of(&root)
        .iter()
        .map(|entry| {
            let glosses = values_of(entry)
                .iter()
                .map(|gloss| label_of(gloss).to_owned());
            (label_of(entry).to_owned(), glosses.collect())
        })
        .collect())
}

fn definitions_start() -> String {
    r#"A definition cache starts with "definitions:""#.to_owned()
}

/// The Wikidata definitions shipped with the crate for a language
/// (data/definitions/wikidata-<language>.lino), if there are any.
pub fn precached_definitions(language: &str) -> Option<DefinitionCache> {
    let source = match language {
        "english" => include_str!("../../../data/definitions/wikidata-english.lino"),
        _ => return None,
    };
    read_definition_cache(source).ok()
}
