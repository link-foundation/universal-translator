use universal_translator::natural::{check_description, check_text, natural_language_ids};
use universal_translator::{Mode, Translator};

const CASES: [(&str, &str); 4] = [
    ("type(meaning)\n", "type"),
    ("meaning.__doc__\n", "documentation"),
    ("import inspect\ninspect.getsource(meaning)\n", "source"),
    ("meaning??\n", "details"),
];

fn aspect(source: &str, from: &str) -> String {
    let read = Translator::new().to_meta(source, from).unwrap();
    let statements = read.node("main").unwrap().nodes("statements");
    let expression = statements[0].node("expression").unwrap();
    assert_eq!(expression.kind, "Question");
    assert_eq!(
        expression.node("subject").unwrap().str("name"),
        Some("meaning")
    );
    expression.str("aspect").unwrap().to_owned()
}

#[test]
fn introspection_questions_keep_distinct_aspects_and_subjects() {
    for (source, expected) in CASES {
        assert_eq!(aspect(source, "python"), expected);
        let python = Translator::new()
            .translate(source, "python", "python", Mode::ContextDependent)
            .unwrap();
        assert_eq!(aspect(&python, "python"), expected);
    }
}

#[test]
fn questions_round_trip_every_natural_language() {
    let translator = Translator::new();
    for language in natural_language_ids() {
        for (source, expected) in CASES {
            let text = translator
                .translate(source, "python", language, Mode::ContextDependent)
                .unwrap();
            assert!(
                check_description(language).unwrap().is_empty(),
                "{language}"
            );
            assert!(
                check_text(&text, language).unwrap().is_empty(),
                "{language}: {text}"
            );
            assert!(text.trim_end().ends_with('?'), "{language}: {text}");
            assert_eq!(aspect(&text, language), expected, "{language}");
            let python = translator
                .translate(&text, language, "python", Mode::ContextDependent)
                .unwrap();
            assert_eq!(aspect(&python, "python"), expected, "{language}");
        }
    }
}

#[test]
fn documentation_is_runtime_metadata_and_retains_multiline_contents() {
    let source = "def meaning(value):\n    \"\"\"Explain the meaning.\n\n    Keep indentation.\n    \"\"\"\n    return value\n\nprint(meaning.__doc__)\n";
    let translator = Translator::new();
    let read = translator.to_meta(source, "python").unwrap();
    let documentation = read.nodes("functions")[0].node("documentation").unwrap();
    let mut languages = natural_language_ids();
    languages.extend(["javascript", "typescript"]);
    for language in languages {
        let text = translator
            .translate(source, "python", language, Mode::ContextDependent)
            .unwrap();
        if natural_language_ids().contains(&language) {
            assert!(
                check_text(&text, language).unwrap().is_empty(),
                "{language}: {text}"
            );
        }
        let read = translator.to_meta(&text, language).unwrap();
        assert_eq!(
            read.nodes("functions")[0].node("documentation"),
            Some(documentation),
            "{language}: {text}"
        );
    }
}

#[test]
fn imports_are_resolved_and_custom_names_stay_calls() {
    assert_eq!(
        aspect(
            "import inspect as details\ndetails.getsource(meaning)\n",
            "python"
        ),
        "source"
    );
    assert_eq!(
        aspect(
            "from inspect import getsource as source_of\nsource_of(meaning)\n",
            "python"
        ),
        "source"
    );
    let translator = Translator::new();
    for source in [
        "type = custom\ntype(meaning)\n",
        "from custom import type\ntype(meaning)\n",
        "import inspect\nimport custom as inspect\ninspect.getsource(meaning)\n",
    ] {
        let read = translator.to_meta(source, "python").unwrap();
        let statements = read.node("main").unwrap().nodes("statements");
        assert_eq!(
            statements.last().unwrap().node("expression").unwrap().kind,
            "Call"
        );
    }
}

#[test]
fn documentation_editions_keep_the_source_runtime_value() {
    let source = "def meaning(value):\n    \"\"\"  Title\n\n    Indented\n      child\n    \"\"\"\n    return value\n";
    let translator = Translator::new();
    for (from, expected) in [
        ("python", "Title\n\nIndented\n  child\n"),
        ("python@3.13", "Title\n\nIndented\n  child\n"),
        ("python@3.12", "  Title\n\n    Indented\n      child\n    "),
        ("python@3.5", "  Title\n\n    Indented\n      child\n    "),
    ] {
        let read = translator.to_meta(source, from).unwrap();
        assert_eq!(
            read.nodes("functions")[0]
                .node("documentation")
                .unwrap()
                .str("value"),
            Some(expected),
            "{from}"
        );
        let written = translator
            .translate(source, from, "python@3.13", Mode::ContextDependent)
            .unwrap();
        let reread = translator.to_meta(&written, "python@3.13").unwrap();
        assert_eq!(
            reread.nodes("functions")[0]
                .node("documentation")
                .unwrap()
                .str("value"),
            Some(expected),
            "{written}"
        );
    }
}

#[test]
fn documentation_must_be_text_at_the_start_of_a_definition() {
    let translator = Translator::new();
    for source in ["Documentation is 3.", "Documentation is “orphan”."] {
        assert!(translator.to_meta(source, "english").is_err(), "{source}");
    }
}

#[test]
fn formatted_strings_are_not_python_docstrings() {
    let source = "def meaning():\n    f\"not documentation\"\n    return 3\n";
    let translator = Translator::new();
    let read = translator.to_meta(source, "python").unwrap();
    assert!(read.nodes("functions")[0].node("documentation").is_none());
    let written = translator
        .translate(source, "python", "python", Mode::ContextDependent)
        .unwrap();
    assert!(
        translator
            .to_meta(&written, "python")
            .unwrap()
            .nodes("functions")[0]
            .node("documentation")
            .is_none()
    );
}
