//! The equivalence check: a translation does what its source does when both
//! read into the same meta program, comments, imports, blank lines, types
//! and mutability left out. The same cases as js/tests/equivalence.test.js.

use std::fs;
use std::path::Path;
use universal_translator::meta::notation::format_meta;
use universal_translator::{Difference, Options, Translator, check_equivalence, effect_of};

const SUM: &str = "let total = 0;
for (let i = 1; i <= 3; i++) {
  total = total + i;
}
console.log(total);
";

fn check(translation: Option<&str>, to: &str) -> universal_translator::Equivalence {
    check_equivalence(
        &Translator::new(),
        (SUM, "javascript"),
        (translation, to),
        Options::default(),
    )
    .expect("both texts read")
}

#[test]
fn holds_for_what_the_translator_writes() {
    let result = check(None, "python");
    assert!(result.equivalent);
    assert!(result.differences.is_empty());
    assert!(result.translation.contains("range(1, 4)"));
    assert_eq!(result.meta_lines, 12);
}

#[test]
fn leaves_out_comments_blank_lines_and_the_spelling_of_an_update() {
    let python = "# sum\ntotal = 0\n\nfor i in range(1, 4):\n    total += i  # add\nprint(total)\n";
    assert!(check(Some(python), "python").equivalent);
}

#[test]
fn leaves_out_types_and_mutability() {
    let rust = "fn main() {\n    let mut total: i64 = 0;\n    for i in 1..=3 {\n        total += i;\n    }\n    println!(\"{}\", total);\n}\n";
    assert!(check(Some(rust), "rust").equivalent);
}

#[test]
fn finds_a_bound_that_is_one_off() {
    let result = check(
        Some("total = 0\nfor i in range(1, 3):\n    total += i\nprint(total)\n"),
        "python",
    );
    assert!(!result.equivalent);
    assert_eq!(
        result.differences,
        vec![Difference {
            line: 6,
            source: "number 4".into(),
            target: "number 3".into(),
        }]
    );
}

#[test]
fn finds_another_operator() {
    let result = check(
        Some("total = 0\nfor i in range(1, 4):\n    total = total * i\nprint(total)\n"),
        "python",
    );
    let pairs: Vec<(&str, &str)> = result
        .differences
        .iter()
        .map(|it| (it.source.as_str(), it.target.as_str()))
        .collect();
    assert_eq!(pairs, vec![("binary add", "binary multiply")]);
}

#[test]
fn keeps_what_a_program_does_in_the_meta_program() {
    let program = Translator::new()
        .to_meta(
            "// note\nlet x: number = 1;\n\nconsole.log(x);\n",
            "typescript",
        )
        .expect("reads");
    let effect = format_meta(&effect_of(&program));
    for left in ["note", "type", "mutable", "blank", "comments"] {
        assert!(!effect.contains(left), "{left} in {effect}");
    }
    assert!(effect.contains("declaration x"), "{effect}");
}

#[test]
fn holds_for_the_example_programs() {
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs");
    let mut files: Vec<_> = fs::read_dir(&directory)
        .expect("examples")
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|it| it == "js"))
        .collect();
    files.sort();
    let translator = Translator::new();
    for to in ["python", "rust", "wat"] {
        for file in &files {
            let source = fs::read_to_string(file).expect("program");
            let result = check_equivalence(
                &translator,
                (&source, "javascript"),
                (None, to),
                Options::default(),
            )
            .expect("both texts read");
            assert_eq!(result.differences, vec![], "{} -> {to}", file.display());
        }
    }
}
