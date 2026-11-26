//! Identifier language of a program: translate the names it declares
//! (functions, parameters, variables) to another natural language, with or
//! without its code. Names the program does not declare (library procedures
//! such as `print`) never change.
//!
//! A meta program stores each declared name as neutral words joined by "-"
//! ("sum-of-squares"), so a name is translated as the phrase its words make
//! ("sum of squares" -> "сумма квадратов") and spelled again in the naming
//! convention of the target ("суммаКвадратов", "сумма_квадратов").
//!
//! The JavaScript twin is js/src/translation/identifier-language.js.

use std::collections::{BTreeMap, HashSet};
use std::sync::OnceLock;

use regex::Regex;

use crate::comment_language::CommentTranslator;
use crate::formal::languages::{Convention, InterpolationStyle, language_syntax};
use crate::formal::lexer::{TokenType, tokenize};
use crate::formal::names::{
    ascii_name, avoid_reserved, declared_names, name_words, rename_declared, spell_name,
};
use crate::meta::{GrammarError, Node};
use crate::natural::detect_comment_language;

fn phrase_of(neutral: &str) -> String {
    neutral.replace('-', " ")
}

fn is_name_start(character: char) -> bool {
    character.is_alphabetic() || character == '_'
}

/// The neutral name a translated phrase makes: its words, lower case,
/// without punctuation.
fn neutral_of(phrase: &str) -> Option<String> {
    static PUNCTUATION: OnceLock<Regex> = OnceLock::new();
    let punctuation = PUNCTUATION
        .get_or_init(|| Regex::new(r"[^\p{Alphabetic}\p{N}_\s]+").expect("valid pattern"));
    let name = name_words(&punctuation.replace_all(phrase, " ")).join("-");
    name.chars()
        .next()
        .is_some_and(is_name_start)
        .then_some(name)
}

/// Neutral name -> its translation, for the names that change. Two names
/// never become one: a translation already taken keeps the name as it was
/// (the names are taken in sorted order, as the JavaScript twin takes them).
pub fn identifier_dictionary(
    names: &HashSet<String>,
    from: Option<&str>,
    to: &str,
    translate: &CommentTranslator,
) -> Result<BTreeMap<String, String>, GrammarError> {
    let mut list: Vec<&String> = names.iter().collect();
    list.sort();
    let from = match from {
        Some(from) => from,
        None => {
            detect_comment_language(&list.iter().map(|name| phrase_of(name)).collect::<Vec<_>>())
        }
    };
    let mut taken: HashSet<String> = names.clone();
    let mut dictionary = BTreeMap::new();
    for name in list {
        let translated = translate(&phrase_of(name), from, to).map_err(GrammarError::new)?;
        if let Some(translated) = neutral_of(&translated)
            && translated != *name
            && !taken.contains(&translated)
        {
            taken.insert(translated.clone());
            dictionary.insert(name.clone(), translated);
        }
    }
    Ok(dictionary)
}

/// Translate the declared names of a meta program (before the context rules
/// spell them for the target).
pub fn translate_program_identifiers(
    program: Node,
    from: Option<&str>,
    to: &str,
    translate: &CommentTranslator,
) -> Result<Node, GrammarError> {
    let dictionary = identifier_dictionary(&declared_names(&program), from, to, translate)?;
    if dictionary.is_empty() {
        return Ok(program);
    }
    Ok(rename_declared(program, |name, _| {
        dictionary
            .get(name)
            .cloned()
            .unwrap_or_else(|| name.to_owned())
    }))
}

fn is_capital(word: &str) -> bool {
    word.chars().next().is_some_and(char::is_uppercase)
}

/// The naming convention a name is written in, read from the name itself.
fn convention_of(identifier: &str) -> Convention {
    let words: Vec<&str> = identifier
        .split('_')
        .filter(|word| !word.is_empty())
        .collect();
    if words.len() > 1 {
        return if words.iter().all(|word| is_capital(word)) {
            Convention::Ada
        } else {
            Convention::Snake
        };
    }
    if is_capital(identifier) {
        Convention::Pascal
    } else {
        Convention::Camel
    }
}

/// The same name in the same convention, with other words.
fn respell(identifier: &str, translated: &str, language: &str, machine: bool) -> String {
    let upper =
        identifier == identifier.to_uppercase() && identifier.chars().any(char::is_uppercase);
    let spelled = spell_name(translated, convention_of(identifier));
    let cased = if upper {
        spelled.to_uppercase()
    } else {
        spelled
    };
    avoid_reserved(ascii_name(cased, language, machine), language)
}

/// Translate the declared names of a source text in place: every other
/// character stays. `declared` are the neutral names the program declares
/// (its meta program knows them). `None` when a name also appears inside an
/// interpolated text, which only the meta program can rename.
pub fn translate_identifiers(
    source: &str,
    language: &str,
    declared: &HashSet<String>,
    from: Option<&str>,
    to: &str,
    translate: &CommentTranslator,
) -> Result<Option<String>, GrammarError> {
    let syntax = language_syntax(language)?;
    let dictionary = identifier_dictionary(declared, from, to, translate)?;
    let tokens = tokenize(source, &syntax)?;
    let phrases: Vec<String> = dictionary.keys().map(|name| phrase_of(name)).collect();
    let quoted = tokens.iter().any(|token| {
        token.kind == TokenType::Text
            && token.style != InterpolationStyle::Plain
            && phrases
                .iter()
                .any(|phrase| name_words(&token.value).join(" ").contains(phrase.as_str()))
    });
    if quoted {
        return Ok(None);
    }
    let characters: Vec<char> = source.chars().collect();
    let slice = |start: usize, end: usize| characters[start..end].iter().collect::<String>();
    let mut output = String::new();
    let mut at = 0;
    for token in &tokens {
        let (Some((start, end)), TokenType::Name) = (token.span, token.kind) else {
            continue;
        };
        let Some(translated) = dictionary.get(&name_words(&token.value).join("-")) else {
            continue;
        };
        output.push_str(&slice(at, start));
        output.push_str(&respell(
            &token.value,
            translated,
            syntax.id,
            syntax.machine,
        ));
        at = end;
    }
    output.push_str(&slice(at, characters.len()));
    Ok(Some(output))
}
