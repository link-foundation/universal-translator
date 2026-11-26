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

fn free(source: &str, from: &str, to: &str) -> String {
    translate_partial(source, from, to, Options::default())
        .expect("a translation")
        .text
}

#[test]
fn keeps_the_verb_form_the_object_case_and_the_genitive_of_a_sentence() {
    let sentences = [
        ("Greets someone", "russian", "Приветствует кого-то\n"),
        ("Greets someone", "ukrainian", "Вітає когось\n"),
        ("Greets someone", "polish", "Wita kogoś\n"),
        ("Greets someone", "german", "Grüßt jemanden\n"),
        ("Greets someone", "french", "Salue quelqu’un\n"),
        ("Greets someone", "spanish", "Saluda a alguien\n"),
        ("Prints the sum", "russian", "Печатает сумму\n"),
        ("Prints the sum", "ukrainian", "Друкує суму\n"),
        ("Prints the sum", "polish", "Drukuje sumę\n"),
        (
            "Returns the factorial of n",
            "russian",
            "Возвращает факториал n\n",
        ),
        (
            "Returns the factorial of n",
            "ukrainian",
            "Повертає факторіал n\n",
        ),
        ("Returns the factorial of n", "polish", "Zwraca silnię n\n"),
        (
            "Returns the factorial of n",
            "spanish",
            "Devuelve el factorial de n\n",
        ),
    ];
    for (source, language, expected) in sentences {
        assert_eq!(free(source, "english", language), expected);
    }
    // The lemma is the infinitive, a finite form never is.
    assert_eq!(free("to print", "english", "russian"), "печатать\n");
    assert_eq!(free("Print", "english", "russian"), "Печатать\n");
    // A noun keeps its form where it is no object or no singular nominative.
    assert_eq!(
        free("Prints the name", "english", "russian"),
        "Печатает имя\n"
    );
    assert_eq!(
        free("Sorts the numbers", "english", "russian"),
        "Сортирует числа\n"
    );
}

#[test]
fn reads_the_verb_forms_and_the_cases_back() {
    assert_eq!(free("Печатает сумму", "russian", "english"), "Prints sum\n");
    assert_eq!(
        free("Приветствует кого-то", "russian", "english"),
        "Greets someone\n"
    );
    assert_eq!(
        free("Saluda a alguien", "spanish", "english"),
        "Greets someone\n"
    );
    assert_eq!(
        free("Возвращает факториал n", "russian", "english"),
        "Returns factorial n\n"
    );
    assert_eq!(
        free("Печатать сумму", "russian", "english"),
        "To print sum\n"
    );
}
