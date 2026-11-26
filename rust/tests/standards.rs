//! Natural language standards and the Wikidata definition cache. Nothing
//! here uses the network: lookups read the cache file the JavaScript side
//! writes (data/definitions/wikidata-english.lino).

use std::fs;
use std::path::Path;

use serde_json::json;
use universal_translator::natural::standards::{
    DefinitionCache, STANDARD_WORD_LIMIT, Standard, define_word, lemma_candidates, lexeme_glosses,
    precached_definitions, primitive_words, read_definition_cache, wikidata_language_code,
    wikidata_lookup, words_of_text, write_definition_cache,
};

fn cache_file() -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("data/definitions/wikidata-english.lino");
    fs::read_to_string(path).expect("the English pre-cache")
}

fn cache() -> DefinitionCache {
    read_definition_cache(&cache_file()).expect("a definition cache")
}

fn defined(
    word: &str,
) -> (
    Standard,
    universal_translator::natural::standards::Definition,
) {
    let cache = cache();
    let mut lookup = wikidata_lookup(&cache);
    let mut standard = Standard::of_language("english").expect("an English standard");
    let result = define_word(&mut standard, word, &mut lookup, 4, 64).expect("a definition");
    (standard, result)
}

fn pair(word: &str, definition: &str) -> (String, String) {
    (word.to_owned(), definition.to_owned())
}

#[test]
fn reads_the_words_of_a_text() {
    assert_eq!(
        words_of_text("Don't stop 42 times, well-known!"),
        vec!["don't", "stop", "times", "well-known"]
    );
}

#[test]
fn guesses_the_dictionary_forms_of_english_words() {
    assert_eq!(
        lemma_candidates("bigger", "english"),
        ["bigger", "bigg", "big"]
    );
    assert_eq!(
        lemma_candidates("running", "english"),
        ["running", "runne", "runn", "run"]
    );
    assert_eq!(
        lemma_candidates("cities", "english"),
        ["cities", "city", "citie", "citi"]
    );
    assert_eq!(
        lemma_candidates("hated", "english"),
        ["hated", "hate", "hat"]
    );
    assert_eq!(
        lemma_candidates("dog's", "english"),
        ["dog's", "dog'", "dog"]
    );
    assert_eq!(lemma_candidates("Мира", "russian"), ["мира"]);
}

#[test]
fn a_standard_starts_from_the_primes_and_grammar_words() {
    assert_eq!(primitive_words("english").expect("English").len(), 122);
    assert_eq!(primitive_words("russian").expect("Russian").len(), 118);
    let standard = Standard::of_language("english").expect("an English standard");
    assert_eq!(standard.size(), 122);
    assert_eq!(standard.limit, STANDARD_WORD_LIMIT);
    assert!(standard.is_primitive("two"));
}

#[test]
fn definitions_use_only_known_words() {
    let mut standard = Standard::of_language("english").expect("an English standard");
    assert_eq!(
        standard.add_definition("Twice", "two times"),
        Ok("twice".into())
    );
    assert_eq!(
        standard.add_definition("double", "being twice as much as something else"),
        Ok("double".into())
    );
    assert_eq!(
        standard.add_definition("cat", "a small animal"),
        Err(r#"The definition of "cat" uses unknown words: animal"#.into())
    );
    assert_eq!(
        standard.add_definition("loop", "a loop"),
        Err(r#""loop" is defined through itself"#.into())
    );
    assert_eq!(
        standard.add_definition("two", "one one"),
        Err(r#""two" is a primitive word of my-standard"#.into())
    );
    assert_eq!(
        standard.expand_word("double"),
        Ok("being (two times) as much as something else".into())
    );
}

#[test]
fn the_word_limit_holds() {
    let mut standard = Standard::new("tiny", "english", 123).expect("a standard");
    assert!(standard.add_definition("twice", "two times").is_ok());
    assert_eq!(
        standard.add_definition("thrice", "three times"),
        Err("The definition of \"thrice\" uses unknown words: three".into())
    );
    assert_eq!(
        standard.add_definition("hop", "one time"),
        Err("tiny already has 123 words".into())
    );
    assert!(Standard::new("small", "english", 10).is_err());
}

#[test]
fn defines_words_through_the_cache_like_javascript() {
    let (standard, result) = defined("twice");
    assert!(result.defined);
    assert_eq!(result.added, vec![pair("twice", "two times")]);
    assert_eq!((result.lookups, standard.size()), (1, 123));

    let (_, result) = defined("double");
    assert_eq!(
        result.added,
        vec![
            pair("twice", "two times"),
            pair("double", "being twice as much as something else"),
        ]
    );
    assert_eq!(result.lookups, 2);

    let (_, result) = defined("half");
    assert!(result.defined);
    assert_eq!(
        result.added,
        vec![
            pair("into", "to move inside of (something)"),
            pair("in", "moving into"),
            pair("which", "of a kind"),
            pair("half", "50%"),
        ]
    );
}

#[test]
fn a_word_without_a_reachable_definition_stays_missing() {
    let (standard, result) = defined("again");
    assert!(!result.defined);
    assert_eq!(result.missing, ["another", "once", "again"]);
    assert_eq!((result.lookups, standard.size()), (4, 122));

    let (_, result) = defined("mother");
    assert_eq!((result.defined, result.lookups), (false, 2));
    assert_eq!(result.missing, ["mother"]);
}

#[test]
fn the_budget_limits_the_lookups() {
    let (standard, result) = defined("ball");
    assert_eq!((result.lookups, standard.size()), (64, 125));
}

#[test]
fn reads_and_writes_the_cache_file_of_javascript() {
    let text = cache_file();
    let cache = read_definition_cache(&text).expect("a definition cache");
    assert_eq!(cache.len(), 69);
    assert_eq!(cache["en:again"], ["another time; once more"]);
    assert!(cache["en:accuracy"].is_empty());
    assert_eq!(write_definition_cache(&cache), text);
    assert_eq!(precached_definitions("english"), Some(cache));
    assert_eq!(precached_definitions("german"), None);
}

#[test]
fn quotes_of_a_gloss_are_doubled_and_read_back() {
    let mut cache = DefinitionCache::new();
    cache.insert(
        "en:it's".into(),
        vec!["a 'thing', maybe".into(), "x".into()],
    );
    let text = write_definition_cache(&cache);
    assert_eq!(
        text,
        "definitions:\n  'en:it''s': 'a ''thing'', maybe' 'x'\n"
    );
    assert_eq!(read_definition_cache(&text), Ok(cache));
    assert!(read_definition_cache("other:\n  a: b\n").is_err());
}

#[test]
fn the_lookup_never_fetches() {
    let cache = cache();
    let mut lookup = wikidata_lookup(&cache);
    assert_eq!(lookup("again", "english"), ["another time; once more"]);
    assert_eq!(lookup("Again", "english"), ["another time; once more"]);
    assert!(lookup("zzzz", "english").is_empty());
    assert!(lookup("again", "russian").is_empty());
    assert_eq!(wikidata_language_code("russian"), Some("ru"));
    assert_eq!(wikidata_language_code("klingon"), None);
}

#[test]
fn reads_the_glosses_of_lexemes() {
    let lexemes = vec![
        json!({
            "lemmas": {"en": {"language": "en", "value": "Twice"}},
            "senses": [
                {"glosses": {"en": {"value": "two times"}}},
                {"glosses": {"en": {"value": "two times"}, "de": {"value": "zweimal"}}},
                {"glosses": {"de": {"value": "doppelt"}}},
            ],
        }),
        json!({
            "lemmas": {"en": {"language": "en", "value": "other"}},
            "senses": [{"glosses": {"en": {"value": "not this"}}}],
        }),
    ];
    assert_eq!(lexeme_glosses(&lexemes, "twice", "en"), ["two times"]);
    assert_eq!(
        lexeme_glosses(&lexemes, "twice", "de"),
        Vec::<String>::new()
    );
}
