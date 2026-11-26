//! More languages of the TIOBE top 50, listed after those in
//! [`super::languages`]. Each starts from a description there and changes
//! fields; their dialects are in [`super::dialects`].

use super::languages::{
    BRACE_OPERATORS, C_QUOTES, CommandCalls, Convention, FUNCTION_TERMS, Interpolation,
    InterpolationStyle, JAVASCRIPT, PrintCalls, Syntax, same,
};

/// Every further language, in listing order.
pub static MORE_LANGUAGES: [Syntax; 1] = [Syntax {
    // GameMaker Language is written with the JavaScript tables, plus its
    // output, template strings and arrays (dialects/gml.rs).
    id: "gml",
    family: Some("javascript"),
    for_each: None,
    label: "GameMaker Language",
    naming: same(Convention::Snake),
    quotes: C_QUOTES,
    interpolation: &[Interpolation {
        quote: Some('"'),
        prefix: Some("$"),
        style: InterpolationStyle::Braces,
    }],
    declarations: &["var"],
    declaration_keyword: Some("var"),
    operators: super::languages::Operators {
        integer_divide: Some("div"),
        ..BRACE_OPERATORS
    },
    print_line: "show_debug_message",
    print_calls: Some(PrintCalls {
        line: &["show_debug_message"],
        text: &[],
        adjacent: false,
    }),
    text_conversions: &["string"],
    command_calls: CommandCalls::No,
    terms: FUNCTION_TERMS,
    ..JAVASCRIPT
}];
