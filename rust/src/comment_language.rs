//! Comment language of a program: translate its comments to another
//! natural language, with or without its code.
//!
//! The JavaScript twin is js/src/translation/comment-language.js.

use std::sync::Arc;

use crate::formal::languages::language_syntax;
use crate::formal::lexer::{TokenType, tokenize};
use crate::formal::rules::map_comments;
use crate::meta::{GrammarError, Node};
use crate::natural::{detect_comment_language, translate_comment_text};

/// Translates the text of one comment: `(text, from, to)`. The default is
/// the word-by-word dictionary of [`translate_comment_text`]; a better
/// translator (a machine translation service, a human) can replace it.
pub type CommentTranslator = Arc<dyn Fn(&str, &str, &str) -> Result<String, String> + Send + Sync>;

/// The default comment translator: the comment dictionary.
pub fn dictionary_translator() -> CommentTranslator {
    Arc::new(translate_comment_text)
}

/// Translate the comments of a source text in place: the code, every space
/// and every comment marker stay character for character, only the words
/// inside the comments change. `from` is detected when absent.
pub fn translate_comments(
    source: &str,
    language: &str,
    from: Option<&str>,
    to: &str,
) -> Result<String, GrammarError> {
    translate_comments_with(source, language, from, to, &dictionary_translator())
}

/// [`translate_comments`] with another comment translator.
pub fn translate_comments_with(
    source: &str,
    language: &str,
    from: Option<&str>,
    to: &str,
    translate: &CommentTranslator,
) -> Result<String, GrammarError> {
    let syntax = language_syntax(language)?;
    let characters: Vec<char> = source.chars().collect();
    let slice = |(start, end): (usize, usize)| characters[start..end].iter().collect::<String>();
    let spans: Vec<(usize, usize)> = tokenize(source, &syntax)?
        .iter()
        .filter(|token| token.kind == TokenType::Comment)
        .filter_map(|token| token.span)
        .collect();
    let from = match from {
        Some(from) => from,
        None => detect_comment_language(&spans.iter().map(|span| slice(*span)).collect::<Vec<_>>()),
    };
    let mut output = String::new();
    let mut at = 0;
    for (start, end) in spans {
        output.push_str(&slice((at, start)));
        output.push_str(&translate(&slice((start, end)), from, to).map_err(GrammarError::new)?);
        at = end;
    }
    output.push_str(&slice((at, characters.len())));
    Ok(output)
}

/// Translate the comments of a meta program (a layer that changes no code).
/// `from` is detected when absent.
pub fn translate_program_comments(
    program: Node,
    from: Option<&str>,
    to: &str,
    translate: &CommentTranslator,
) -> Result<Node, GrammarError> {
    let mut texts = Vec::new();
    map_comments(program.clone(), |text| {
        texts.push(text.to_owned());
        text.to_owned()
    });
    let from = from.unwrap_or_else(|| detect_comment_language(&texts));
    let mut failure = None;
    let translated = map_comments(program, |text| match translate(text, from, to) {
        Ok(translated) => translated,
        Err(error) => {
            failure.get_or_insert(error);
            text.to_owned()
        }
    });
    failure.map_or(Ok(translated), |error| Err(GrammarError::new(error)))
}
