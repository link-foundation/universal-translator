//! Issue #12: translation rules are written as indented Links Notation, not
//! JSON. The JavaScript twin is js/tests/rules-notation.test.js; both read
//! examples/rules/russian-at-most.lino.

use std::io::Write;
use std::process::{Command, Stdio};

use serde_json::json;
use universal_translator::custom_rules::{format_rules, read_rules};
use universal_translator::{CustomRules, Mode, Translator};

const EXAMPLE: &str = include_str!("../../examples/rules/russian-at-most.lino");
const RUSSIAN: &str = "Если n самое большее 1, сделать это:\n  ничего не делать\n";

fn example_rules() -> serde_json::Value {
    json!({
        "source": [{ "find": "ничего", "replace": "Ничего", "language": "russian" }],
        "templates": { "russian": { "less-or-equal": ["{left} самое большее {right}"] } },
        "names": [{ "find": "n", "replace": "count" }],
        "output": [
            { "find": "pass", "replace": "pass  # ничего", "language": "python" },
            { "find": "(\\d+)", "replace": "[$1]", "regex": true, "language": "javascript" }
        ]
    })
}

#[test]
fn reads_the_example_rule_file() {
    assert_eq!(read_rules(EXAMPLE).unwrap(), example_rules());
}

#[test]
fn writes_the_same_text_back() {
    assert_eq!(format_rules(&example_rules()), EXAMPLE);
    assert_eq!(format_rules(&read_rules(EXAMPLE).unwrap()), EXAMPLE);
}

#[test]
fn quotes_texts_with_spaces_brackets_and_quotes() {
    let rules = json!({
        "source": [{ "find": "it's (x)", "replace": "a b" }],
        "names": [{ "find": "x", "replace": "y" }]
    });
    let text = format_rules(&rules);
    assert_eq!(
        text,
        "source:\n  (find 'it''s (x)') (replace 'a b')\nnames:\n  (find x) (replace y)\n"
    );
    assert_eq!(read_rules(&text).unwrap(), rules);
}

#[test]
fn reads_a_rule_without_replace_and_writes_nothing_for_no_rules() {
    assert_eq!(
        read_rules("output:\n  (find x)\n").unwrap(),
        json!({ "output": [{ "find": "x" }] })
    );
    assert_eq!(format_rules(&json!({})), "");
    assert_eq!(read_rules("").unwrap(), json!({}));
}

#[test]
fn still_reads_rules_written_as_json() {
    let json = serde_json::to_string(&example_rules()).unwrap();
    assert_eq!(read_rules(&json).unwrap(), example_rules());
}

#[test]
fn says_what_is_wrong() {
    let error = |text: &str| read_rules(text).err().unwrap_or_default();
    assert!(error("parse:\n  (find x)\n").contains("Unknown rule stage \"parse\""));
    assert!(
        error("names:\n  (find x) (with y)\n").contains("The names rule 1 has no field \"with\"")
    );
    assert!(error("output:\n  (find x) (find y)\n").contains("\"find\" twice"));
    assert!(error("output:\n  (find x) (regex maybe)\n").contains("use true or false"));
    assert!(error("names:\n  (find a)\nnames:\n  (find b)\n").contains("given twice"));
}

#[test]
fn translates_with_the_rules_given_as_text() {
    let translator = Translator::new().with_rules(CustomRules::from_text(EXAMPLE).unwrap());
    assert_eq!(
        translator
            .translate(RUSSIAN, "russian", "python", Mode::default())
            .unwrap(),
        "if count <= 1:\n    pass  # ничего\n"
    );
    assert!(
        translator
            .translate(RUSSIAN, "russian", "javascript", Mode::default())
            .unwrap()
            .contains("count <= [1]")
    );
}

#[test]
fn reads_a_lino_rule_file_on_the_command_line() {
    let file = std::env::temp_dir().join(format!("issue-12-rules-{}.lino", std::process::id()));
    std::fs::write(&file, EXAMPLE).unwrap();
    let path = file.to_string_lossy().into_owned();
    let mut child = Command::new(env!("CARGO_BIN_EXE_universal-translator"))
        .args(["translate", "russian", "python", "--rules", &path])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the command line");
    child
        .stdin
        .take()
        .expect("standard input")
        .write_all(RUSSIAN.as_bytes())
        .expect("the input");
    let output = child.wait_with_output().expect("the output");
    std::fs::remove_file(&file).ok();
    assert_eq!(String::from_utf8_lossy(&output.stderr), "");
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        "if count <= 1:\n    pass  # ничего\n"
    );
}
