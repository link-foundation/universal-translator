//! Standards compose their existing loop, condition and return vocabulary.
use super::catalog::Language;
use crate::meta::queries::KEYS;

pub(super) fn derive(language: &mut Language) {
    let first = |key: &str| {
        language
            .templates
            .get(key)
            .and_then(|v| v.first())
            .cloned()
            .unwrap_or_default()
    };
    let loop_phrase = first("for-each");
    let instruction = first("evaluate");
    let condition = first("if");
    let result = first("return-value").replace("{value}", "{projection}");
    for key in KEYS {
        if language.templates.get(key).is_some() {
            continue;
        }
        let phrase = if loop_phrase.is_empty() {
            let operation = if key.contains("deferred") {
                "deferred-query"
            } else {
                "query"
            };
            let expression = format!(
                "{}{operation}{} ({{source}}) ({{variable}}) ({{condition}}) ({{projection}})",
                language.quotes.0, language.quotes.1
            );
            if key.starts_with("question-") {
                instruction.replace("{expression}", &expression)
            } else {
                expression
            }
        } else {
            let prefix = if key.contains("deferred") {
                format!("{}deferred{} ", language.quotes.0, language.quotes.1)
            } else {
                String::new()
            };
            format!(
                "{prefix}{}, {condition}, {result}",
                loop_phrase.replace("{array}", "{source}")
            )
        };
        language.templates.insert(key, vec![phrase]);
    }
}
