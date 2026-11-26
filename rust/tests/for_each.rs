//! The for-each loop of the meta language: ForEach { variable, array, body }.
//! Languages with a for-each syntax write it natively, the others write the
//! counting loop over a fresh index. The JavaScript twin is
//! js/tests/for-each.test.js.

use universal_translator::Mode;
use universal_translator::meta::{Node, walk};
use universal_translator::translator::{Translator, language_ids, meaning_difference};

const SOURCE: &str = "const numbers = [3, 4, 5];
let total = 0;
for (const number of numbers) {
  total += number;
}
console.log(total);
";

fn kinds(meta: &Node) -> Vec<String> {
    let mut found = Vec::new();
    walk(meta, |node| found.push(node.kind.clone()));
    found
}

fn translate(source: &str, from: &str, to: &str) -> String {
    Translator::new()
        .translate(source, from, to, Mode::ContextDependent)
        .unwrap_or_else(|error| panic!("{from} -> {to}: {error}"))
}

fn the_loop(meta: &Node) -> Node {
    meta.node("main")
        .expect("a main block")
        .nodes("statements")
        .into_iter()
        .find(|statement| statement.is("ForEach"))
        .expect("a ForEach statement")
        .clone()
}

#[test]
fn reads_for_of_as_a_for_each_over_the_array() {
    let meta = Translator::new().to_meta(SOURCE, "javascript").unwrap();
    let each = the_loop(&meta);
    assert_eq!(each.str("variable"), Some("number"));
    assert_eq!(
        each.node("array").and_then(|array| array.str("name")),
        Some("numbers")
    );
    assert!(!kinds(&meta).contains(&"CountingLoop".to_owned()));
}

#[test]
fn reads_a_range_loop_as_a_counting_loop() {
    let meta = Translator::new()
        .to_meta(
            "let total = 0;\nfor (let index = 0; index < 3; index++) {\n  total += index;\n}\n",
            "javascript",
        )
        .unwrap();
    assert!(kinds(&meta).contains(&"CountingLoop".to_owned()));
    assert!(!kinds(&meta).contains(&"ForEach".to_owned()));
}

#[test]
fn reads_python_for_in_over_an_array() {
    let translator = Translator::new();
    let meta = translator
        .to_meta(
            "numbers = [3, 4]\nfor number in numbers:\n    print(number)\n",
            "python",
        )
        .unwrap();
    assert_eq!(the_loop(&meta).str("variable"), Some("number"));
    let counting = translator
        .to_meta("for index in range(3):\n    print(index)\n", "python")
        .unwrap();
    assert!(kinds(&counting).contains(&"CountingLoop".to_owned()));
}

#[test]
fn types_the_loop_variable_with_the_element_type() {
    let meta = Translator::new().to_meta(SOURCE, "javascript").unwrap();
    assert_eq!(the_loop(&meta).str("type"), Some("integer"));
}

#[test]
fn writes_the_loop_natively_in_the_languages_that_have_one() {
    for (language, line) in [
        ("javascript", "for (const number of numbers) {"),
        ("python", "for number in numbers:"),
        ("java", "for (int number : numbers) {"),
        ("go", "for _, number := range numbers {"),
        ("rust", "for &number in &numbers {"),
        ("kotlin", "for (number in numbers) {"),
        ("php", "foreach ($numbers as $number) {"),
        ("csharp", "foreach (int number in numbers) {"),
        ("lua", "for _, number in ipairs(numbers) do"),
    ] {
        let written = translate(SOURCE, "javascript", language);
        assert!(written.contains(line), "{language}: {written}");
    }
}

#[test]
fn writes_a_counting_loop_over_a_fresh_index_without_a_for_each() {
    let c = translate(SOURCE, "javascript", "c");
    assert!(c.contains(
        "for (int index = 0; index < (int) (sizeof numbers / sizeof numbers[0]); index++) {"
    ));
    assert!(c.contains("int number = numbers[index];"));
    let pascal = translate(SOURCE, "javascript", "pascal");
    assert!(pascal.contains("Number := Numbers[Index];"));
}

#[test]
fn picks_an_index_that_no_name_of_the_program_uses() {
    let c = translate(&SOURCE.replace("total", "index"), "javascript", "c");
    assert!(c.contains("for (int position = 0;"));
    assert!(c.contains("int number = numbers[position];"));
}

#[test]
fn writes_a_counting_loop_when_the_body_changes_the_loop_variable() {
    let python = translate(
        "const numbers = [3, 4];\nfor (let number of numbers) {\n  number += 1;\n  console.log(number);\n}\n",
        "javascript",
        "python",
    );
    assert!(!python.contains("for number in numbers"));
    assert!(python.contains("numbers[index]"));
}

#[test]
fn round_trips_javascript_through_the_meta_language() {
    let translator = Translator::new();
    let meta = translator.to_meta(SOURCE, "javascript").unwrap();
    let written = translator
        .from_meta(
            &meta,
            "javascript",
            Some("javascript"),
            Mode::ContextDependent,
        )
        .unwrap();
    assert!(written.contains("for (const number of numbers) {"));
    let back = translator.to_meta(&written, "javascript").unwrap();
    assert_eq!(meaning_difference(&meta, &back), None);
}

#[test]
fn keeps_its_meaning_through_every_grammar_language() {
    let translator = Translator::new();
    let meta = translator.to_meta(SOURCE, "javascript").unwrap();
    for language in language_ids() {
        let text = translator
            .from_meta(&meta, language, Some("javascript"), Mode::ContextDependent)
            .unwrap();
        let back = translator
            .to_meta(&text, language)
            .unwrap_or_else(|error| panic!("{language}: {error}"));
        assert_eq!(
            (language, meaning_difference(&meta, &back)),
            (language, None)
        );
    }
}

#[test]
fn writes_a_sentence_in_the_controlled_languages_that_have_one() {
    let translator = Translator::new();
    let meta = translator.to_meta(SOURCE, "javascript").unwrap();
    let english = translator
        .from_meta(&meta, "english", Some("javascript"), Mode::ContextDependent)
        .unwrap();
    assert!(english.contains("For each number in numbers, repeat this"));
    let back = translator.to_meta(&english, "english").unwrap();
    assert_eq!(meaning_difference(&meta, &back), None);
}

#[test]
fn lowers_the_loop_in_the_controlled_languages_without_a_sentence() {
    let translator = Translator::new();
    let meta = translator.to_meta(SOURCE, "javascript").unwrap();
    let german = translator
        .from_meta(&meta, "german", Some("javascript"), Mode::ContextDependent)
        .unwrap();
    let back = translator.to_meta(&german, "german").unwrap();
    assert_eq!(meaning_difference(&meta, &back), None);
}
