use std::fs;
use std::path::{Path, PathBuf};

use universal_translator::translator::{Translator, language_ids, machine_target_ids};
use universal_translator::{FragmentKind, Options, parse_fragment, translate_fragment};

fn fragments() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs/fragments")
}

fn read(path: PathBuf) -> String {
    fs::read_to_string(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

/// Every JavaScript fragment shared with the JavaScript tests.
fn sources() -> Vec<(String, String)> {
    let mut names: Vec<String> = fs::read_dir(fragments())
        .expect("the fragments folder")
        .filter_map(|entry| {
            let name = entry.expect("a fragment entry").file_name();
            name.to_string_lossy()
                .strip_suffix(".js")
                .map(str::to_owned)
        })
        .collect();
    names.sort();
    names
        .into_iter()
        .map(|name| {
            let source = read(fragments().join(format!("{name}.js")));
            (name, source)
        })
        .collect()
}

fn extension(target: &str) -> &'static str {
    match target {
        "javascript" => "js",
        "typescript" => "ts",
        "python" => "py",
        "ruby" => "rb",
        "lua" => "lua",
        "php" => "php",
        "c" => "c",
        "cpp" => "cpp",
        "csharp" => "cs",
        "java" => "java",
        "go" => "go",
        "rust" => "rs",
        "kotlin" => "kt",
        "swift" => "swift",
        "perl" => "pl",
        "dart" => "dart",
        "scala" => "scala",
        "julia" => "jl",
        "r" => "R",
        "groovy" => "groovy",
        "objc" => "m",
        "nim" => "nim",
        "d" => "d",
        "pascal" => "pas",
        "fortran" => "f90",
        "ada" => "adb",
        "vb" => "vb",
        "bash" => "sh",
        "matlab" => "matlab",
        "zig" => "zig",
        "lean" => "lean",
        "rocq" => "v",
        "gml" => "gml",
        other => panic!("no extension for {other}"),
    }
}

fn grammar_languages() -> Vec<&'static str> {
    let machine = machine_target_ids();
    language_ids()
        .into_iter()
        .filter(|language| !machine.contains(language))
        .collect()
}

fn translate(source: &str, from: &str, to: &str) -> String {
    translate_fragment(source, from, to, Options::default())
        .unwrap_or_else(|error| panic!("{from} -> {to}: {error}"))
}

fn error(source: &str, from: &str) -> String {
    parse_fragment(source, from)
        .err()
        .unwrap_or_else(|| panic!("{source:?} should not be complete"))
        .to_string()
}

#[test]
fn reads_a_whole_program_functions_or_statements() {
    let kinds: Vec<(String, &str)> = sources()
        .into_iter()
        .map(|(name, source)| {
            let kind = parse_fragment(&source, "javascript").unwrap().kind;
            (name, kind.as_str())
        })
        .collect();
    let expected = [
        ("block", "statements"),
        ("declaration", "statements"),
        ("function", "functions"),
        ("functions", "functions"),
        ("print", "statements"),
        ("program", "program"),
        ("statement", "statements"),
    ]
    .map(|(name, kind)| (name.to_owned(), kind));
    assert_eq!(kinds, expected);
    assert_eq!(
        FragmentKind::ALL.map(FragmentKind::as_str),
        ["program", "functions", "statements"]
    );
}

#[test]
fn keeps_a_whole_program_with_its_main_function() {
    let rust = "fn main() {\n    println!(\"hi\");\n}\n";
    assert_eq!(
        parse_fragment(rust, "rust").unwrap().kind,
        FragmentKind::Program
    );
    assert_eq!(translate(rust, "rust", "python"), "print(\"hi\")\n");
}

#[test]
fn writes_statements_and_functions_without_a_main_or_a_class() {
    let sources = sources();
    let source = |wanted: &str| {
        sources
            .iter()
            .find(|(name, _)| name == wanted)
            .map(|(_, source)| source.clone())
            .unwrap()
    };
    assert_eq!(translate("x = x + 1;", "javascript", "java"), "x += 1;\n");
    assert!(!translate(&source("function"), "javascript", "java").contains("class"));
    assert!(!translate(&source("print"), "javascript", "c").contains("main"));
    let translator = Translator::new();
    assert_eq!(
        translator
            .translate_fragment("x = 2", "python", "ruby", Options::default())
            .unwrap(),
        translate("x = 2", "python", "ruby")
    );
}

#[test]
fn matches_the_shared_goldens_and_reads_them_back() {
    for (name, source) in sources() {
        let again = translate(&source, "javascript", "javascript");
        for target in grammar_languages() {
            let path = fragments()
                .join("translated")
                .join(&name)
                .join(format!("{name}.{}", extension(target)));
            let text = translate(&source, "javascript", target);
            assert_eq!(text, read(path), "{name} -> {target}");
            assert_eq!(
                translate(&text, target, "javascript"),
                again,
                "{name} {target} -> javascript"
            );
        }
    }
}

#[test]
fn incomplete_fragments_fail_with_the_reason_and_the_line() {
    let failures = [
        (
            "javascript",
            "function square(value) {\n  return value * value;\n",
            "The fragment is not complete: it ends before its closing (line 2)",
        ),
        (
            "javascript",
            "if (x > 0) {\n  x = 0;\n",
            "The fragment is not complete: it ends before its closing (line 2)",
        ),
        (
            "javascript",
            "let y = (1 + 2;",
            "The fragment is not complete: Expected \")\" but found \";\" (line 1)",
        ),
        (
            "python",
            "def square(value):\n",
            "The fragment is not complete: it ends before its closing (line 1)",
        ),
        (
            "pascal",
            "function Square(Value: Int64): Int64;\nbegin\n  Exit(Value * Value);\n",
            "The fragment is not complete: it ends before its closing (line 3)",
        ),
        ("javascript", "  \n", "The fragment is empty"),
    ];
    for (from, source, message) in failures {
        assert_eq!(error(source, from), message, "{from} {source:?}");
    }
}

#[test]
fn reads_and_writes_a_sentence_as_a_statement() {
    assert_eq!(
        translate("Change x to x plus 1.", "english", "javascript"),
        "x += 1;\n"
    );
    assert!(translate("x = x + 1;", "javascript", "english").contains('x'));
}

#[test]
fn rejects_statements_and_functions_for_machine_targets() {
    for target in machine_target_ids() {
        assert_eq!(
            translate_fragment("x = x + 1;", "javascript", target, Options::default())
                .unwrap_err()
                .to_string(),
            format!(
                "Machine targets hold whole programs only, not statements on their own ({target})"
            )
        );
    }
}

#[test]
fn ends_every_rocq_function_group_with_its_period() {
    let source = read(fragments().join("functions.js"));
    let functions = translate(&source, "javascript", "rocq");
    assert!(functions.trim_end().ends_with('.'), "{functions}");
    assert!(!functions.contains("fragmentEnd"), "{functions}");
}

#[test]
fn reads_the_length_of_an_array_the_fragment_only_indexes() {
    let fragment = |source: &str, from: &str, to: &str| {
        translate_fragment(source, from, to, Options::default())
            .unwrap_or_else(|error| panic!("{from} -> {to}: {error}"))
    };
    let looped =
        "for (let index = 0; index < numbers.length; index++) {\n    total += numbers[index];\n}\n";
    assert_eq!(
        fragment(looped, "javascript", "python"),
        "for index in range(len(numbers)):\n    total += numbers[index]\n"
    );
    for to in ["english", "arabic", "fortran", "minimal-english"] {
        let written = fragment(looped, "javascript", to);
        assert_eq!(fragment(&written, to, "javascript"), looped, "{to}");
    }
}
