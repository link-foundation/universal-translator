//! Template-slot cases preserve the neutral identity of names and constants.
use super::catalog::Language;
use super::tokens::{Kind, Token};
use super::vocabulary::grammar_of;

fn base(language: &Language) -> &str {
    language.base.as_deref().unwrap_or(&language.id)
}

pub(super) fn slot_case(language: &Language, template: &str, slot: &str) -> Option<String> {
    let key = format!("{template}.{slot}");
    grammar_of(base(language))
        .slot_cases
        .into_iter()
        .find(|(name, _)| name == &key)
        .map(|(_, case)| case)
}

fn inflect(word: &str, language: &Language, case: &str) -> String {
    let grammar = grammar_of(base(language));
    let (forms, mut endings) = match case {
        "accusative" => (grammar.object_forms, grammar.object_endings),
        "genitive" => (grammar.genitive_forms, grammar.genitive_endings),
        _ => return word.to_owned(),
    };
    if let Some((_, form)) = forms.iter().find(|(lemma, _)| lemma == word) {
        return form.clone();
    }
    endings.sort_by_key(|(ending, _)| std::cmp::Reverse(ending.chars().count()));
    for (from, to) in endings {
        if let Some(stem) = word.strip_suffix(&from) {
            return format!("{stem}{to}");
        }
    }
    word.to_owned()
}

pub(super) fn agree(tokens: &[Token], language: &Language, case: Option<String>) -> Vec<Token> {
    let case = case.unwrap_or_else(|| "nominative".to_owned());
    tokens
        .iter()
        .map(|token| {
            let mut result = token.clone();
            if token.reference && token.grammatical_case.is_none() {
                result.value = token
                    .value
                    .split(&language.name_joiner)
                    .map(|part| inflect(part, language, &case))
                    .collect::<Vec<_>>()
                    .join(&language.name_joiner);
                result.folded = result.value.to_lowercase();
                result.grammatical_case = Some(case.clone());
            }
            result
        })
        .collect()
}

pub(super) fn normalize(tokens: &[Token], language: &Language, case: &str) -> Vec<Token> {
    let candidates = [&language.true_word, &language.false_word]
        .into_iter()
        .chain(language.lexicon.entries.iter().map(|(_, value)| value))
        .collect::<Vec<_>>();
    tokens
        .iter()
        .map(|token| {
            if token.kind != Kind::Word {
                return token.clone();
            }
            let value = token
                .value
                .split(&language.name_joiner)
                .map(|part| {
                    let folded = part.to_lowercase();
                    candidates
                        .iter()
                        .find(|candidate| {
                            candidate.as_str() != folded
                                && inflect(candidate, language, case) == folded
                        })
                        .map_or(folded, |candidate| (*candidate).clone())
                })
                .collect::<Vec<_>>()
                .join(&language.name_joiner);
            Token::word(value)
        })
        .collect()
}
