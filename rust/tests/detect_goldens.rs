//! Language detection on the committed goldens: every factorial program,
//! machine code included, is detected as the language it is written in.
//! The JavaScript twin is js/tests/detect-goldens.test.js.

use std::fs;
use std::path::PathBuf;

use universal_translator::Translator;

fn programs() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("examples/programs")
}

/// The file extension of every language, as examples/programs/verify-native.mjs
/// names them (`  python: '.py',`).
fn extensions() -> Vec<(String, String)> {
    let script = fs::read_to_string(programs().join("verify-native.mjs")).expect("the script");
    let start = script
        .find("export const extensions = {")
        .expect("the extensions");
    script[start..]
        .lines()
        .skip(1)
        .take_while(|line| !line.starts_with('}'))
        .filter_map(|line| {
            let (language, rest) = line.trim().split_once(": '")?;
            Some((language.to_owned(), rest.strip_suffix("',")?.to_owned()))
        })
        .collect()
}

fn golden(extension: &str) -> String {
    fs::read_to_string(
        programs()
            .join("translated/factorial")
            .join(format!("factorial{extension}")),
    )
    .expect("the golden")
}

#[test]
fn detects_every_golden() {
    let translator = Translator::new();
    let languages = extensions();
    assert!(languages.len() >= 40, "{languages:?}");
    for (language, extension) in &languages {
        let detected = translator.detect_language(&golden(extension), 5);
        assert_eq!(detected[0].id, *language, "{extension}");
    }
    let source = fs::read_to_string(programs().join("factorial.js")).expect("source");
    assert_eq!(translator.detect_language(&source, 5)[0].id, "javascript");
}

#[test]
fn tells_objective_c_from_c_by_its_import() {
    let detected = Translator::new().detect_language(&golden(".m"), 5);
    assert_eq!(
        [detected[0].id.as_str(), detected[1].id.as_str()],
        ["objc", "c"]
    );
}

#[test]
fn reads_machine_code_whole_only() {
    let detected = Translator::new().detect_language(&golden(".wat"), 5);
    assert_eq!(detected[0].id, "wat");
    assert!(detected[0].reads);
    assert_eq!(detected[0].coverage, 1.0);
    assert_eq!(
        detected.iter().filter(|candidate| candidate.reads).count(),
        1
    );
}

/// "_" alone, or a word that starts with it, is one word: the tokenizer
/// moves past it and the reading ends with an ordinary error.
#[test]
fn reads_perl_argument_lists_as_natural_text_without_hanging() {
    let translator = Translator::new();
    for text in ["_", "_x", "@_", "my ($number) = @_;"] {
        let error = translator.parse_fragment(text, "english").expect_err(text);
        assert!(
            error.message.contains("No sentence template matches"),
            "{error}"
        );
        let reading = translator.parse_partial(text, "english").expect(text);
        assert_eq!(reading.coverage, 0.0, "{text}");
    }
}
