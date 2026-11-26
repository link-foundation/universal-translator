//! Issue #8: comparison wordings, partial translation, language detection
//! and rules as data. The JavaScript twin is js/tests/issue-8.test.js.

use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Instant;

use universal_translator::natural::{check_description, natural_language_ids};
use universal_translator::{
    CustomRules, Mode, Options, Translator, detect_language, parse_partial, translate,
    translate_partial,
};

struct Run {
    status: i32,
    output: String,
    errors: String,
}

fn cli(arguments: &[&str], input: &str) -> Run {
    let mut child = Command::new(env!("CARGO_BIN_EXE_universal-translator"))
        .args(arguments)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the command line");
    // A command that rejects its arguments exits before it reads its input.
    let mut stdin = child.stdin.take().expect("standard input");
    let written = stdin.write_all(input.as_bytes());
    drop(stdin);
    if let Err(error) = written
        && error.kind() != std::io::ErrorKind::BrokenPipe
    {
        panic!("the input: {error}");
    }
    let output = child.wait_with_output().expect("the output");
    Run {
        status: output.status.code().unwrap_or(-1),
        output: String::from_utf8(output.stdout).expect("UTF-8 output"),
        errors: String::from_utf8(output.stderr).expect("UTF-8 errors"),
    }
}

fn to(source: &str, from: &str, target: &str) -> String {
    translate(source, from, target, Mode::default())
        .unwrap_or_else(|error| panic!("{from} -> {target}: {error}"))
}

#[test]
fn reads_the_russian_examples_of_the_issue() {
    for (words, operator) in [("меньше или равно", "<="), ("больше или равно", ">=")]
    {
        let source = format!("Если n {words} 1, сделать это:\n  Ничего не делать\n");
        assert!(to(&source, "russian", "javascript").contains(&format!("n {operator} 1")));
    }
}

#[test]
fn an_isolated_name_is_parseable_as_english_and_wins_ambiguous_ties() {
    let candidates = detect_language("c");
    assert_eq!(candidates[0].id, "english");
    assert!(candidates[0].reads);
    assert_eq!(
        Translator::new()
            .translate_fragment("c", "english", "python", Options::default())
            .unwrap(),
        "c\n"
    );
}

#[test]
fn reads_other_obvious_variations() {
    let cases = [
        (
            "Если n меньше либо равно 1, то:\n  Ничего не делать\n",
            "russian",
        ),
        ("Если n <= 1, то:\n  Ничего не делать\n", "russian"),
        ("Если n ≤ 1:\n  Ничего не делать\n", "russian"),
        (
            "If n is less than or equal to 1, then:\n  Do nothing\n",
            "english",
        ),
        ("If n is at most 1:\n  Do nothing\n", "english"),
        ("If n <= 1:\n  Do nothing\n", "english"),
    ];
    for (source, from) in cases {
        assert!(to(source, from, "python").contains("n <= 1"), "{source}");
    }
}

#[test]
fn keeps_every_language_within_its_own_rules() {
    for id in natural_language_ids() {
        assert_eq!(
            check_description(id).expect(id),
            Vec::<String>::new(),
            "{id}"
        );
    }
}

#[test]
fn reads_python_pass_as_an_empty_statement() {
    assert!(!to("if n <= 1:\n    pass\n", "python", "russian").contains("проход"));
}

const PARTIAL: &str = "x = 1\nwith open(f) as g:\n    y = 2\nprint(x)\n";

#[test]
fn translates_what_it_can_and_marks_the_rest() {
    let result = translate_partial(PARTIAL, "python", "javascript", Options::default()).unwrap();
    assert!(!result.complete);
    assert!(result.errors.iter().any(|error| error.line == 2));
    assert!(result.text.contains("console.log(x)"), "{}", result.text);
    assert!(
        result.text.contains("// untranslated (line 2)"),
        "{}",
        result.text
    );
}

#[test]
fn counts_the_lines_it_reads() {
    let reading = parse_partial(PARTIAL, "python").unwrap();
    assert_eq!(reading.lines, 4);
    assert_eq!(reading.read_lines, 3);
    assert_eq!(reading.coverage, 0.75);
}

#[test]
fn is_complete_when_everything_reads() {
    let result =
        translate_partial("print(1)\n", "python", "javascript", Options::default()).unwrap();
    assert!(result.complete);
    assert!(result.errors.is_empty());
    assert_eq!(result.coverage, 1.0);
}

#[test]
fn marks_untranslated_natural_sentences() {
    let result = translate_partial(
        "Написать 1 и закончить строку.\nЛетать к луне.\n",
        "russian",
        "python",
        Options::default(),
    )
    .unwrap();
    assert_eq!(result.errors[0].line, 2);
    assert!(result.text.contains("print(1)"), "{}", result.text);
}

#[test]
fn partial_translation_is_the_default_of_the_command_line() {
    let run = cli(&["translate", "python", "javascript"], PARTIAL);
    assert_eq!(run.status, 0);
    assert!(run.output.contains("console.log(x)"));
    assert!(
        run.errors.contains("Translated 3 of 4 lines"),
        "{}",
        run.errors
    );
    let strict = cli(
        &["translate", "python", "javascript", "--all-or-nothing"],
        PARTIAL,
    );
    assert_eq!(strict.status, 1);
    assert_eq!(strict.output, "");
}

#[test]
fn reports_coverage_on_the_command_line() {
    // Indented Links Notation by default (issue 12), JSON with --json.
    let run = cli(&["coverage", "python"], PARTIAL);
    assert!(
        run.output.lines().any(|line| line == "coverage: 0.75"),
        "{}",
        run.output
    );
    assert!(
        run.output.lines().any(|line| line == "parts:"),
        "{}",
        run.output
    );
    let json = cli(&["coverage", "python", "--json"], PARTIAL);
    assert!(
        json.output.contains("\"coverage\": 0.75,"),
        "{}",
        json.output
    );
}

const DETECTED: [(&str, &str); 5] = [
    ("console.log(\"hi\");\n", "javascript"),
    ("def f(x):\n    return x\nprint(f(1))\n", "python"),
    ("fn main() {\n    println!(\"hi\");\n}\n", "rust"),
    (
        "Если n меньше или равно 1, сделать это:\n  Ничего не делать\n",
        "russian",
    ),
    ("If n is less than 1, then:\n  Do nothing\n", "english"),
];

#[test]
fn finds_the_language_of_a_text() {
    for (source, id) in DETECTED {
        assert_eq!(detect_language(source)[0].id, id, "{source}");
    }
}

#[test]
fn detects_nothing_in_an_empty_text() {
    assert!(detect_language("  \n").is_empty());
}

#[test]
fn translates_from_auto_on_the_command_line() {
    let run = cli(&["translate", "auto", "python"], DETECTED[0].0);
    assert!(run.output.contains("print(\"hi\")"), "{}", run.output);
    assert!(run.errors.contains("Detected language: javascript"));
    let detected = cli(&["detect"], DETECTED[1].0).output;
    assert!(
        detected.starts_with("(id python) (natural false) (reads true) "),
        "{detected}"
    );
    let json = cli(&["detect", "--json"], DETECTED[1].0).output;
    assert!(
        json.starts_with("[\n  {\n    \"id\": \"python\","),
        "{json}"
    );
}

const RULES: &str = r#"{
  "source": [{ "language": "russian", "find": "ничего", "replace": "Ничего" }],
  "templates": { "russian": { "less-or-equal": ["{left} самое большее {right}"] } },
  "names": [{ "find": "n", "replace": "count" }],
  "output": [{ "language": "python", "find": "<=", "replace": "<=" }]
}"#;
const RULED: &str = "Если n самое большее 1, сделать это:\n  ничего не делать\n";

fn with_rules(rules: &str) -> Result<Translator, String> {
    Ok(Translator::new().with_rules(CustomRules::from_json(rules)?))
}

#[test]
fn rules_apply_at_every_stage() {
    let translator = with_rules(RULES).unwrap();
    assert_eq!(
        translator
            .translate(RULED, "russian", "python", Mode::default())
            .unwrap(),
        "if count <= 1:\n    pass\n"
    );
    assert!(translate(RULED, "russian", "python", Mode::default()).is_err());
}

#[test]
fn rules_rewrite_the_output_with_regular_expressions() {
    let translator =
        with_rules(r#"{ "output": [{ "find": "(\\d+)", "replace": "[$1]", "regex": true }] }"#)
            .unwrap();
    assert_eq!(
        translator
            .translate("print(1)\n", "python", "python", Mode::default())
            .unwrap(),
        "print([1])\n"
    );
}

#[test]
fn rules_are_checked() {
    let error = |rules: &str| with_rules(rules).err().unwrap_or_default();
    assert!(error(r#"{ "parse": [] }"#).contains("Unknown rule stage"));
    assert!(error(r#"{ "source": [{}] }"#).contains("needs a \"find\" text"));
    assert!(
        error(r#"{ "templates": { "english": { "nope": ["x"] } } }"#)
            .contains("No template \"nope\"")
    );
}

#[test]
fn rules_are_read_from_a_file_on_the_command_line() {
    let file = std::env::temp_dir().join(format!("issue-8-rules-{}.json", std::process::id()));
    std::fs::write(&file, RULES).unwrap();
    let path = file.to_string_lossy().into_owned();
    let run = cli(&["translate", "russian", "python", "--rules", &path], RULED);
    std::fs::remove_file(&file).ok();
    assert_eq!(run.output, "if count <= 1:\n    pass\n", "{}", run.errors);
}

#[test]
fn cut_texts_end_a_dialect_read_instead_of_looping() {
    let started = Instant::now();
    let reading = parse_partial("procedure P is\n   x : Integer;\n", "ada").unwrap();
    assert_eq!(reading.lines, 2);
    assert!(started.elapsed().as_secs() < 5);
}
