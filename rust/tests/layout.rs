//! Translations keep the layout of their source (issue 14): the same
//! examples as js/tests/layout.test.js, read from examples/layout.

use std::fs;
use std::path::{Path, PathBuf};

use universal_translator::formal::languages::language_syntax;
use universal_translator::layout::{Marks, align_tokens, layout_tokens, transfer_layout};
use universal_translator::{Options, TextLayout, Translator};

fn layout_folder() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/layout")
}

fn read(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

/// (case, from, to, source, expected) for every example.
fn cases() -> Vec<(String, String, String, String, String)> {
    let mut cases = Vec::new();
    let mut folders: Vec<PathBuf> = fs::read_dir(layout_folder())
        .expect("the layout folder")
        .map(|entry| entry.expect("a layout entry").path())
        .filter(|path| path.is_dir())
        .collect();
    folders.sort();
    for folder in folders {
        let mut files: Vec<String> = fs::read_dir(&folder)
            .expect("a layout case")
            .map(|entry| {
                entry
                    .expect("a layout file")
                    .file_name()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        files.sort();
        let source_file = files
            .iter()
            .find(|file| file.starts_with("from-"))
            .expect("a source")
            .clone();
        let language =
            |file: &str, prefix: &str| file[prefix.len()..file.len() - ".txt".len()].to_owned();
        let from = language(&source_file, "from-");
        let source = read(&folder.join(&source_file));
        for file in files.iter().filter(|file| file.starts_with("to-")) {
            cases.push((
                folder.file_name().unwrap().to_string_lossy().into_owned(),
                from.clone(),
                language(file, "to-"),
                source.clone(),
                read(&folder.join(file)),
            ));
        }
    }
    cases
}

fn marks(id: &str) -> Marks {
    Marks::of(&language_syntax(id).expect("a language"))
}

#[test]
fn every_layout_example_keeps_the_source_layout() {
    let cases = cases();
    assert!(cases.len() > 10);
    let translator = Translator::new();
    for (name, from, to, source, expected) in cases {
        let result = translator
            .translate_partial(&source, &from, &to, Options::default(), true)
            .unwrap_or_else(|error| panic!("{name} {from} -> {to}: {error}"));
        assert_eq!(result.text, expected, "{name}: {from} -> {to}");
    }
}

#[test]
fn the_issue_example_maps_its_lines() {
    let source = "\nconsole.log( \"Hello World!\");\n\nconsole.log(1+ 2);\n";
    let translator = Translator::new();
    let result = translator
        .translate_partial(source, "javascript", "python", Options::default(), true)
        .unwrap();
    assert_eq!(result.text, "\nprint( \"Hello World!\")\n\nprint(1+ 2)\n");
    assert_eq!(result.line_map, vec![(1, 1), (3, 3)]);
    let target = Options {
        layout: TextLayout::Target,
        ..Options::default()
    };
    let written = translator
        .translate_partial(
            "\nconsole.log( \"Hello World!\");",
            "javascript",
            "python",
            target,
            true,
        )
        .unwrap();
    assert_eq!(written.text, "print(\"Hello World!\")\n");
    assert_eq!(written.line_map, vec![(1, 0)]);
}

fn keys(text: &str, language: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    layout_tokens(&chars, &marks(language))
        .into_iter()
        .map(|token| token.key)
        .collect()
}

#[test]
fn tokens_are_operators_strings_comments_and_names() {
    assert_eq!(
        keys("total_count += \"a b\" // note", "javascript"),
        ["wtotalcount", "p+=", "sa b", "cnote"]
    );
    assert_eq!(
        keys("x := 'it''s' { c }", "pascal"),
        ["wx", "p:", "p=", "sit", "ss", "cc"]
    );
    assert_eq!(
        keys("f(a, b);", "c"),
        ["wf", "p(", "wa", "p,", "wb", "p)", "p;"]
    );
}

#[test]
fn alignment_follows_unique_anchors() {
    let c = marks("c");
    let tokens = |text: &str| layout_tokens(&text.chars().collect::<Vec<_>>(), &c);
    let pairs = align_tokens(&tokens("a ( b ) c ( d )"), &tokens("( b ) x ( d ) a"));
    assert_eq!(pairs, vec![(1, 0), (2, 1), (3, 2), (5, 4), (6, 5), (7, 6)]);
}

#[test]
fn spaces_never_join_tokens() {
    let c = marks("c");
    for (source, target, expected) in [
        ("a  =  -1;\n", "a = - 1;\n", "a  =  -1;\n"),
        ("u\"x\";\n", "u \"x\";\n", "u \"x\";\n"),
        ("return(x);\n", "return (x);\n", "return (x);\n"),
        ("f (x);\n", "f(x);\n", "f(x);\n"),
        ("a+b;\n", "a + b;\n", "a+b;\n"),
        ("a.b;\n", "a . b;\n", "a . b;\n"),
    ] {
        let layout = transfer_layout(source, target, &c, &c, true, "c");
        assert_eq!(layout.text, expected, "{source}");
    }
    let js = marks("javascript");
    let multiline = transfer_layout(
        "x = `a\n\n  b`;\n",
        "x = `a\n\n    b`;\n",
        &js,
        &js,
        true,
        "javascript",
    );
    assert_eq!(multiline.text, "x = `a\n\n    b`;\n");
}

#[test]
fn line_ends_blank_lines_and_indentation_follow_the_source() {
    let c = marks("c");
    let crlf = transfer_layout("\r\nf(1);\r\n\r\n", "f(1);\n", &c, &c, true, "c");
    assert_eq!(crlf.text, "\r\nf(1);\r\n\r\n");
    let between = transfer_layout(
        "f(1);\r\n\r\nf(2);\r\n",
        "f(1);\nf(2);\n",
        &c,
        &c,
        true,
        "c",
    );
    assert_eq!(between.text, "f(1);\r\n\r\nf(2);\r\n");
    let indented = transfer_layout(
        "if (a) {\n\tb();\n}\n",
        "if a:\n    b()\n",
        &marks("javascript"),
        &marks("python"),
        true,
        "python",
    );
    assert_eq!(indented.text, "if a:\n\tb()\n");
    let bash = marks("bash");
    let kept = transfer_layout("x = 1\n", "x=1\n", &bash, &bash, true, "bash");
    assert_eq!(kept.text, "x=1\n");
    let empty = transfer_layout("\n\n", "x\n", &c, &c, true, "c");
    assert_eq!(empty.text, "x\n");
}

#[test]
fn each_closing_brace_maps_to_the_brace_that_closes_its_own_block() {
    let source = "function f(a) {\n  if (a) {\n    g();\n  }\n}\n";
    let target = [
        "class Program {",
        "    static void F(bool a) {",
        "        if (a) {",
        "            G();",
        "        }",
        "    }",
        "",
        "    static void Main() {",
        "    }",
        "}",
        "",
    ]
    .join("\n");
    let layout = transfer_layout(
        source,
        &target,
        &marks("javascript"),
        &marks("csharp"),
        false,
        "csharp",
    );
    assert_eq!(layout.lines, vec![(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)]);
}
