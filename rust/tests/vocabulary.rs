//! The grammar of free translation: the stems of inflected words and the
//! languages that write words without spaces.

use universal_translator::natural::vocabulary::{grammar_of, stems_of};

#[test]
fn stems_keep_three_letters() {
    let grammar = grammar_of("russian");
    assert!(stems_of("мира", &grammar).contains(&"мир"));
    assert!(stems_of("мир", &grammar).is_empty());
}

#[test]
fn languages_without_spaces_are_marked() {
    assert!(!grammar_of("chinese").spaced);
    assert!(grammar_of("english").spaced);
    assert_eq!(
        grammar_of("english").infinitive.as_deref(),
        Some("to {verb}")
    );
}
