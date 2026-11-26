//! Nested grammars: comments and strings read with the grammars they are
//! written in, each long text kept a single time under an id. The
//! JavaScript twin is js/tests/nesting.test.js.

use std::io::Write;
use std::process::{Command, Stdio};

use universal_translator::meta::Node;
use universal_translator::meta::notation::format_meta;
use universal_translator::natural::read_prose;
use universal_translator::{Mode, Translator};
use universal_translator::{nest_grammars, unnest};

const LONG: &str =
    "This program reads a list of numbers, adds them together and prints the sum of all of them";

fn nested(source: &str, language: &str) -> Node {
    let translator = Translator::new();
    let meta = translator.to_meta(source, language).expect("meta");
    nest_grammars(&meta, language, &translator)
}

fn cli(arguments: &[&str], input: &str) -> String {
    let mut child = Command::new(env!("CARGO_BIN_EXE_universal-translator"))
        .args(arguments)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the command line");
    child
        .stdin
        .take()
        .expect("standard input")
        .write_all(input.as_bytes())
        .expect("the input");
    let output = child.wait_with_output().expect("the output");
    String::from_utf8(output.stdout).expect("UTF-8")
}

#[test]
fn reads_a_comment_as_prose_and_the_code_it_quotes() {
    let text = format_meta(&nested(
        "// Prints `x + 1` twice\nconst x = 1;\nconsole.log(x + 1);\n",
        "javascript",
    ));
    let expected = [
        "  comment 'Prints `x + 1` twice'",
        "    prose english",
        "      sentence",
        "        word Prints (concept print) (part verb)",
        "        code javascript",
        "          program",
        "            evaluate",
        "              binary add (type integer)",
    ]
    .join("\n");
    assert!(text.contains(&expected), "{text}");
}

#[test]
fn reads_a_string_as_code_when_it_looks_like_code() {
    let text = format_meta(&nested("code = \"print(1 + 2)\"\nprint(code)\n", "python"));
    assert!(
        text.contains(
            "    text 'print(1 + 2)' (type text)\n      code python\n        program\n          call print-line"
        ),
        "{text}"
    );
}

#[test]
fn reads_russian_prose_a_question_and_its_phrases() {
    let text = format_meta(&nested(
        "// Как хорошо покакать?\nconsole.log(\"Привет мир\");\n",
        "javascript",
    ));
    let expected = [
        "    prose russian",
        "      sentence (question true)",
        "        word 'Как хорошо' (concept how-good) (part phrase)",
        "        word покакать (concept poop) (part verb)",
    ]
    .join("\n");
    assert!(text.contains(&expected), "{text}");
    assert!(text.contains("          word Привет (concept hello) (part interjection)"));
}

#[test]
fn keeps_a_long_text_once_and_refers_to_it_by_id() {
    let source = format!("// {LONG}\nconst message = \"{LONG}\";\nconsole.log(message);\n");
    let translator = Translator::new();
    let meta = translator.to_meta(&source, "javascript").expect("meta");
    let deep = nest_grammars(&meta, "javascript", &translator);
    let texts: Vec<(&str, &str)> = deep
        .nodes("texts")
        .into_iter()
        .map(|it| (it.str("id").unwrap(), it.str("text").unwrap()))
        .collect();
    assert_eq!(texts, [("text-1", LONG)]);
    let text = format_meta(&deep);
    assert!(text.contains("  comment (reference text-1)\n"), "{text}");
    assert!(
        text.contains("    text (reference text-1) (type text)\n"),
        "{text}"
    );
    assert_eq!(unnest(&deep), meta);
}

#[test]
fn reads_the_comment_lists_of_a_program() {
    let source = "# Hello world\ndef twice(x):\n    return x * 2\n\nprint(twice(1))\n";
    let translator = Translator::new();
    let meta = translator.to_meta(source, "python").expect("meta");
    let deep = nest_grammars(&meta, "python", &translator);
    let text = format_meta(&deep);
    assert!(
        text.contains("  function twice (blank-after true) (return-type integer)\n    comment 'Hello world'\n      prose english\n"),
        "{text}"
    );
    assert_eq!(unnest(&deep), meta);
}

#[test]
fn translates_a_nested_program_like_the_plain_one() {
    let source = format!("// {LONG}\nconst message = \"{LONG}\";\nconsole.log(message);\n");
    let translator = Translator::new();
    let deep = nested(&source, "javascript");
    assert_eq!(
        translator
            .from_meta(&deep, "python", Some("javascript"), Mode::default())
            .expect("python"),
        translator
            .translate(&source, "javascript", "python", Mode::default())
            .expect("python")
    );
}

#[test]
fn leaves_text_without_a_known_word_unread() {
    assert_eq!(read_prose("zzqx vvqk", None, &|_| None), None);
    let prose = read_prose("Hello world", None, &|_| None).expect("prose");
    let word = prose.nodes("sentences")[0].nodes("words")[0].clone();
    assert_eq!(word.str("concept"), Some("hello"));
    assert_eq!(word.str("part"), Some("interjection"));
}

#[test]
fn prints_the_nested_meta_program_on_the_command_line() {
    let source = "# Hello world\nprint(1)\n";
    assert!(
        cli(&["meta", "python", "-"], source)
            .contains("  comment 'Hello world'\n    prose english\n")
    );
    let meta = Translator::new().to_meta(source, "python").expect("meta");
    assert_eq!(
        cli(&["meta", "python", "-", "--shallow"], source),
        format_meta(&meta)
    );
}
