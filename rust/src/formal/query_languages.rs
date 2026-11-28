//! Declarative query targets share expression syntax, with relation grammars.
use super::languages::{
    BRACE_OPERATORS, C, Convention, EntryPoint, Operators, Syntax, Typed, same,
};

pub(crate) static QUERY_LANGUAGES: [Syntax; 1] = [Syntax {
    id: "sql",
    label: "SQL",
    naming: same(Convention::Snake),
    line_comment: "--",
    block_comment: Some(("/*", "*/")),
    quotes: &['\'', '"'],
    doubled_quotes: true,
    case_insensitive: true,
    symbols: &["<>"],
    declarations: &[],
    operators: Operators {
        and: "AND",
        or: "OR",
        not: "NOT",
        equal: Some("="),
        not_equal: "<>",
        ..BRACE_OPERATORS
    },
    entry_point: EntryPoint::TopLevel,
    typed: Typed::No,
    ..C
}];

/// Query targets do not claim imperative-program or common-library support.
pub fn query_language_ids() -> Vec<&'static str> {
    QUERY_LANGUAGES.iter().map(|syntax| syntax.id).collect()
}
