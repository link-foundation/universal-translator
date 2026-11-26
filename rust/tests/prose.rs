//! Issue #14: natural texts that the controlled grammars do not read are
//! detected by their known words and translated freely, word by word through
//! the shared vocabulary (the parts are listed in `prose`). The JavaScript
//! twin is js/tests/prose.test.js.

use universal_translator::{Options, detect_language, translate_comments, translate_partial};

fn detected(text: &str) -> String {
    detect_language(text)[0].id.clone()
}

#[test]
fn detects_the_language_of_a_greeting_and_of_a_question() {
    assert_eq!(detected("Привет"), "russian");
    assert_eq!(detected("Привет мир"), "russian");
    assert_eq!(detected("Как хорошо покакать?"), "russian");
    assert_eq!(detected("Hello world"), "english");
}

#[test]
fn translates_prose_freely_and_lists_it() {
    for from in ["russian", "minimal-russian"] {
        let result = translate_partial("Как хорошо покакать?", from, "english", Options::default())
            .expect("a translation");
        assert_eq!(result.text, "How good to poop?\n");
        assert!(result.complete);
        assert_eq!(result.prose, [(1, 1)]);
    }
    let text = |source: &str, from: &str, to: &str| {
        translate_partial(source, from, to, Options::default())
            .expect("a translation")
            .text
    };
    assert_eq!(text("Привет мир", "russian", "english"), "Hello world\n");
    assert_eq!(text("Hello world", "english", "russian"), "Привет мир\n");
}

#[test]
fn translates_a_russian_comment_to_english() {
    assert_eq!(
        translate_comments("// Привет мир\nlet x = 1;\n", "javascript", None, "english")
            .expect("a translation"),
        "// Hello world\nlet x = 1;\n"
    );
}
