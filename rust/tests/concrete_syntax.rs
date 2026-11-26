use std::sync::{Arc, Mutex};
use universal_translator::formal::{languages::language_syntax, parser::parse_program};
use universal_translator::reconstruct_concrete;
use universal_translator::{Mode, Translator};

#[test]
fn concrete_tokens_partition_every_source_byte() {
    let cases = [
        (
            "javascript",
            "\t// Привет 😀\r\n\r\nconst x = `a\n b`; // fin\r\n",
        ),
        ("python", "# note\n\ndef f(x):\n\treturn \"é\"  # tail\n\n"),
        (
            "cpp",
            "#include <string>\nint main() { /* x\ny */ return 0; }\n",
        ),
        ("php", "<?php\n\n$x = \"é\";\n?>\n"),
    ];
    for (language, source) in cases {
        let tree = parse_program(source, &language_syntax(language).unwrap()).unwrap();
        let syntax = tree.node("syntax").unwrap();
        assert_eq!(reconstruct_concrete(syntax).unwrap(), source);
        assert_eq!(syntax.str("unit"), Some("utf8"));
        let mut end = 0;
        for child in syntax.nodes("children") {
            assert_eq!(child.number("start"), Some(end as f64));
            end += child.str("text").unwrap().len();
            assert_eq!(child.number("end"), Some(end as f64));
        }
        assert_eq!(end, source.len());
        assert!(!syntax.nodes("productions").is_empty());
        for production in syntax.nodes("productions") {
            assert!(production.number("start").unwrap() >= 0.0);
            assert!(production.number("end").unwrap() <= end as f64);
        }
    }
}

#[test]
fn reconstruction_requires_a_concrete_tree() {
    assert!(reconstruct_concrete(&universal_translator::meta::Node::new("Program")).is_err());
}

#[test]
fn words_and_all_machine_formats_retain_their_source_record() {
    let standard = Translator::new();
    for language in ["english", "russian"].into_iter().chain(
        universal_translator::translator::machine_target_ids()
            .iter()
            .copied(),
    ) {
        let source = standard
            .translate(
                "const value = 5;\nconsole.log(value + 2);\n",
                "javascript",
                language,
                Mode::default(),
            )
            .unwrap();
        let syntax = Arc::new(Mutex::new(None));
        let seen = syntax.clone();
        let reader = Translator::new().with_trace(move |stage, tree| {
            if stage == "parsed" {
                *seen.lock().unwrap() = tree.node("syntax").cloned();
            }
        });
        assert_eq!(
            reader
                .translate(&source, language, "python", Mode::default())
                .unwrap(),
            "value = 5\nprint(value + 2)\n",
            "{language}"
        );
        let syntax = syntax.lock().unwrap();
        let syntax = syntax.as_ref().unwrap();
        assert_eq!(reconstruct_concrete(syntax).unwrap(), source, "{language}");
        assert_eq!(syntax.str("language"), Some(language));
        assert!(
            syntax
                .nodes("productions")
                .iter()
                .any(|view| view.str("concept") == Some("Print")),
            "{language}"
        );
        assert!(syntax.nodes("errors").is_empty());
    }
}

#[test]
fn incomplete_source_retains_accepted_regions_and_explicit_errors() {
    let source = "const value = 5;\r\nconsole.log(value);\r\nconst text = \"unfinished 😀\r\n\r\n";
    let reading = Translator::new()
        .parse_partial(source, "javascript")
        .unwrap();
    assert!(!reading.complete);
    assert_eq!(reconstruct_concrete(&reading.syntax).unwrap(), source);
    assert_eq!(reading.syntax.number("end"), Some(source.len() as f64));
    let views = reading.syntax.nodes("productions");
    assert!(!views.is_empty());
    let errors = reading.syntax.nodes("errors");
    assert_eq!(errors.len(), 1);
    let error = &errors[0];
    assert!(error.is("Error"));
    let start = error.number("start").unwrap() as usize;
    let end = error.number("end").unwrap() as usize;
    assert!(source[start..end].contains("\"unfinished 😀"));
    assert!(error.str("message").unwrap().contains("Unterminated"));
    assert!(
        views
            .iter()
            .all(|view| view.number("end").unwrap() <= start as f64)
    );
}

#[test]
fn empty_and_whitespace_input_have_lossless_records() {
    for source in ["", "\r\n\t \r\n"] {
        let reading = Translator::new()
            .parse_partial(source, "javascript")
            .unwrap();
        assert!(reading.complete);
        assert_eq!(reconstruct_concrete(&reading.syntax).unwrap(), source);
        assert!(reading.syntax.nodes("errors").is_empty());
        assert!(reading.syntax.nodes("productions").is_empty());
    }
}
