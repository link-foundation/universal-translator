//! The equivalence check: a translation does what its source does when both
//! read into the same meta program, comments, imports, blank lines, types
//! and mutability left out. The same cases as js/tests/equivalence.test.js.

use std::fs;
use std::path::Path;
use universal_translator::meta::notation::format_meta;
use universal_translator::{
    Difference, Mode, Options, Translator, check_equivalence, effect_of, translate,
};

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

fn example_programs() -> Vec<std::path::PathBuf> {
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs");
    let mut files: Vec<_> = fs::read_dir(&directory)
        .expect("examples")
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|it| it == "js"))
        .collect();
    files.sort();
    files
}

#[test]
fn holds_for_the_example_programs() {
    let files = example_programs();
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

/// The language id and file extension of every committed translation, as
/// examples/programs/verify-native.mjs lists them (`  python: '.py',`).
fn committed_extensions(root: &Path) -> Vec<(String, String)> {
    let script = fs::read_to_string(root.join("examples/programs/verify-native.mjs")).unwrap();
    let start = script.find("export const extensions = {").unwrap();
    let end = start + script[start..].find("};").unwrap();
    script[start..end]
        .lines()
        .filter_map(|line| {
            let (id, extension) = line.trim().trim_end_matches(',').split_once(": '")?;
            Some((id.to_owned(), extension.trim_end_matches('\'').to_owned()))
        })
        .collect()
}

#[test]
fn holds_for_every_committed_translation_of_two_tasks() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let extensions = committed_extensions(root);
    assert!(extensions.len() > 30, "{extensions:?}");
    let translator = Translator::new();
    for task in ["factorial", "greatest-common-divisor"] {
        let programs = root.join("examples/programs");
        let source = fs::read_to_string(programs.join(format!("{task}.js"))).unwrap();
        for (to, extension) in &extensions {
            let file = programs.join(format!("translated/{task}/{task}{extension}"));
            let translation = fs::read_to_string(&file).unwrap();
            let result = check_equivalence(
                &translator,
                (&source, "javascript"),
                (Some(&translation), to),
                Options::default(),
            )
            .unwrap_or_else(|error| panic!("{}: {error}", file.display()));
            assert_eq!(result.differences, vec![], "{}", file.display());
        }
    }
}

/// JavaScript -> Rust -> JavaScript: the Rosetta tasks keep what they do,
/// and writing the read-back JavaScript in Rust again gives the same Rust.
#[test]
fn keeps_the_example_programs_through_a_round_trip_in_rust() {
    let translator = Translator::new();
    let write = |text: &str, from: &str, to: &str| {
        translate(text, from, to, Mode::default()).unwrap_or_else(|error| panic!("{error}"))
    };
    for file in example_programs() {
        let source = fs::read_to_string(&file).expect("program");
        let rust = write(&source, "javascript", "rust");
        let back = write(&rust, "rust", "javascript");
        let result = check_equivalence(
            &translator,
            (&source, "javascript"),
            (Some(&back), "javascript"),
            Options::default(),
        )
        .expect("both texts read");
        assert_eq!(result.differences, vec![], "{}", file.display());
        assert_eq!(
            write(&back, "javascript", "rust"),
            rust,
            "{}",
            file.display()
        );
    }
}
