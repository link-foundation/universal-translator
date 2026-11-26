//! Issue #6: language versions (python@2, British English, smaller
//! vocabularies) and comment languages, alone and with the partial
//! translation, language detection and command line of issue #8. The
//! JavaScript twins are js/tests/versions.test.js, js/tests/comments.test.js
//! and js/tests/issue-6-with-8.test.js.

use std::fs;
use std::io::Write;
use std::process::{Command, Stdio};

use universal_translator::formal::languages::{language_ids, language_syntax};
use universal_translator::meta::tree::same_meaning;
use universal_translator::natural::{
    VersionKind, base_natural_language_ids, detect_comment_language, natural_language_versions,
    preferred_natural_version, primes_version, translate_comment_text,
};
use universal_translator::translator::languages;
use universal_translator::{
    Mode, Options, Translator, split_version, translate, translate_comments, translate_fragment,
    translate_partial, versions_of,
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

fn read(task: &str) -> String {
    fs::read_to_string(format!("examples/programs/{task}.js")).expect("the example")
}

fn tasks() -> Vec<String> {
    let mut tasks: Vec<String> = fs::read_dir("examples/programs")
        .expect("the examples")
        .filter_map(|entry| {
            let name = entry.ok()?.file_name().into_string().ok()?;
            name.strip_suffix(".js").map(str::to_owned)
        })
        .collect();
    tasks.sort();
    tasks
}

fn to(source: &str, from: &str, target: &str) -> String {
    translate(source, from, target, Mode::default())
        .unwrap_or_else(|error| panic!("{from} -> {target}: {error}"))
}

fn commenting(to: &str, from: Option<&str>) -> Options {
    Options::default()
        .with_comment_language(to, from)
        .expect("a comment language")
}

fn with_comments(source: &str, from: &str, target: &str, options: Options) -> String {
    Translator::new()
        .translate_with(source, from, target, options)
        .unwrap_or_else(|error| panic!("{from} -> {target}: {error}"))
}

fn code_of(source: &str, marker: &str) -> String {
    source
        .split('\n')
        .map(|line| line.split(marker).next().unwrap_or_default())
        .collect::<Vec<_>>()
        .join("\n")
}

// Programming language versions (js/tests/versions.test.js).

#[test]
fn lists_one_python_with_its_versions_python_3_first() {
    let pythons: Vec<_> = languages()
        .into_iter()
        .filter(|language| language.id.starts_with("python"))
        .collect();
    assert_eq!(
        pythons
            .iter()
            .map(|language| language.id)
            .collect::<Vec<_>>(),
        ["python"]
    );
    assert_eq!(
        pythons[0]
            .versions
            .iter()
            .map(|version| version.version)
            .collect::<Vec<_>>(),
        ["3", "3.5", "2"]
    );
    assert!(versions_of("python")[0].default);
    assert!(versions_of("ruby").is_empty());
    assert_eq!(split_version("python@2"), ("python", Some("2")));
}

#[test]
fn writes_python_2_without_f_strings_and_with_the_print_statement() {
    let source = "const x = 2;\nconsole.log(`a${x}`);\nconsole.log();\n";
    let python2 = to(source, "javascript", "python@2");
    assert!(python2.contains("print \"a\" + str(x)"), "{python2}");
    assert!(python2.lines().any(|line| line == "print"), "{python2}");
    assert!(to(source, "javascript", "python").contains("print(f\"a{x}\")"));
    assert!(
        to("process.stdout.write(\"b\");\n", "javascript", "python@2")
            .contains("sys.stdout.write(\"b\")")
    );
    let error = translate(source, "javascript", "python@1", Mode::default()).unwrap_err();
    assert!(
        error.to_string().contains("python has no version \"1\""),
        "{error}"
    );
}

#[test]
fn reads_both_versions_as_one_python() {
    let fragment = |source: &str| {
        translate_fragment(source, "python", "javascript", Options::default()).expect("a fragment")
    };
    assert_eq!(fragment("print \"hi\""), "console.log(\"hi\");\n");
    assert_eq!(
        fragment("print(\"a\" + str(1))"),
        fragment("print(\"a\" + 1)")
    );
}

#[test]
fn keeps_the_meaning_of_every_task_written_in_python_2() {
    let translator = Translator::new();
    for task in tasks() {
        let meta = translator
            .to_meta(&read(&task), "javascript")
            .expect("meta");
        let python2 = translator
            .from_meta(&meta, "python@2", None, Mode::default())
            .expect("Python 2");
        let back = translator
            .to_meta(&python2, "python")
            .expect("Python 2 read back");
        assert!(same_meaning(&meta, &back), "{task}:\n{python2}");
    }
}

#[test]
fn writes_the_common_library_route_in_python_2() {
    let options = Options {
        common_library: true,
        ..Options::default()
    };
    assert!(
        with_comments(&read("hello-world"), "javascript", "python@2", options)
            .contains("from common_library import")
    );
}

// Natural language versions (js/tests/versions.test.js).

#[test]
fn lists_each_natural_language_once() {
    let ids = base_natural_language_ids();
    assert_eq!(ids.len(), 30);
    assert!(ids.contains(&"english"));
    assert!(!ids.contains(&"english-british"));
    assert!(!ids.contains(&"minimal-english"));
}

#[test]
fn orders_versions_from_the_full_vocabulary_down_to_the_standards() {
    let versions = natural_language_versions("english").expect("English");
    let listed: Vec<_> = versions
        .iter()
        .map(|version| {
            (
                version.id,
                version.kind.as_str(),
                version.words,
                version.primes,
            )
        })
        .collect();
    // As naturalLanguageVersions("english") lists them in JavaScript.
    assert_eq!(
        listed,
        [
            ("english", "full", None, false),
            ("english-british", "region", None, false),
            ("english-globish", "vocabulary", Some(1500), false),
            ("english-special-english", "vocabulary", Some(1500), false),
            ("english-asd-ste100", "vocabulary", Some(875), false),
            ("english-basic-english", "vocabulary", Some(850), false),
            ("minimal-english", "vocabulary", Some(65), true),
            ("english-ace", "standard", None, false),
            ("english-e-prime", "standard", None, false),
            ("english-gellish", "standard", None, false),
            ("english-plain-language", "standard", None, false),
            ("english-sbvr", "standard", None, false),
        ]
    );
    assert!(versions[0].default && versions.iter().skip(1).all(|version| !version.default));
    assert_eq!(
        versions.last().map(|version| version.kind),
        Some(VersionKind::Standard)
    );
    assert_eq!(
        natural_language_versions("minimal-english").expect("Minimal English")[0].id,
        "english"
    );
}

#[test]
fn picks_american_or_british_english_from_the_browser_languages() {
    let preferred =
        |id: &str, tags: &[&str]| preferred_natural_version(id, tags).expect("a version");
    assert_eq!(preferred("english", &["en-GB", "en-US"]), "english-british");
    assert_eq!(preferred("english", &["en-US", "en-GB"]), "english");
    assert_eq!(preferred("english", &["ru-RU", "en-AU"]), "english-british");
    assert_eq!(preferred("english", &[]), "english");
    assert_eq!(preferred("russian", &["en-GB"]), "russian");
}

#[test]
fn spells_british_english_with_british_spellings() {
    let text = to(
        "const color = 1;\nconsole.log(\"x\");\n",
        "javascript",
        "english-british",
    );
    assert!(text.contains("colour"), "{text}");
    assert!(text.contains("‘x’"), "{text}");
    assert_eq!(
        primes_version("english").expect("English"),
        Some("minimal-english")
    );
}

// Comment language (js/tests/comments.test.js).

#[test]
fn keeps_the_gaps_and_the_case_of_each_comment_word() {
    let german = |text: &str| translate_comment_text(text, "english", "german").unwrap();
    assert_eq!(german("NUMBER"), "ZAHL");
    assert_eq!(german("Sum"), "Summe");
    assert_eq!(german("sum"), "summe");
    assert_eq!(german(" sum-of, squares 42"), " sum-of, quadrate 42");
}

#[test]
fn translates_comment_words_through_the_shared_meanings() {
    let text = |text: &str, from: &str, to: &str| {
        translate_comment_text(text, from, to).expect("a comment")
    };
    assert_eq!(
        text("Sum of squares", "english", "russian"),
        "Сумма из квадраты"
    );
    assert_eq!(text("Сумма", "russian", "english"), "Sum");
    assert_eq!(
        text("the color, 42", "english", "english-british"),
        "the colour, 42"
    );
    assert_eq!(
        text("  keep   spaces  ", "english", "english"),
        "  keep   spaces  "
    );
}

#[test]
fn detects_the_language_of_the_comments() {
    assert_eq!(detect_comment_language(&["Сумма квадратов"]), "russian");
    assert_eq!(detect_comment_language(&["Summe der Quadrate"]), "german");
    assert_eq!(detect_comment_language(&["42"]), "english");
}

#[test]
fn changes_only_the_comments_when_the_code_language_stays() {
    let source = read("sum-of-squares");
    let russian = with_comments(
        &source,
        "javascript",
        "javascript",
        commenting("russian", None),
    );
    assert!(
        russian.contains("// Сумма из квадраты в JavaScript"),
        "{russian}"
    );
    assert_eq!(code_of(&russian, "//"), code_of(&source, "//"));
    let block = "/* Sum\n *   of   squares */\nlet x = 1; // number\n";
    assert_eq!(
        translate_comments(block, "javascript", Some("english"), "german").expect("comments"),
        "/* Summe\n *   von   quadrate */\nlet x = 1; // zahl\n"
    );
}

#[test]
fn translates_comments_together_with_the_code() {
    let python = with_comments(
        &read("sum-of-squares"),
        "javascript",
        "python",
        commenting("german", None),
    );
    assert!(
        python.contains("# Summe von quadrate in Python"),
        "{python}"
    );
    assert!(python.contains("def sum_of_squares(limit):"), "{python}");
}

#[test]
fn takes_a_translator_of_its_own_for_the_comments() {
    let translator = Translator::new().with_comment_translator(|text, from, to| {
        Ok(format!("{from}>{to}:{}", text.to_uppercase()))
    });
    assert_eq!(
        translator
            .translate_with(
                "// hi\nlet x = 1;\n",
                "javascript",
                "javascript",
                commenting("french", Some("english"))
            )
            .expect("a translation"),
        "//english>french: HI\nlet x = 1;\n"
    );
}

#[test]
fn comment_language_is_available_from_the_command_line() {
    let run = cli(
        &[
            "translate",
            "javascript",
            "javascript",
            "-",
            "--comment-language",
            "russian",
        ],
        "// number\nlet x = 1;\n",
    );
    assert_eq!(
        (run.status, run.output.as_str()),
        (0, "// число\nlet x = 1;\n")
    );
}

#[test]
fn comment_options_take_a_single_value() {
    for arguments in [
        &["--comment-language"][..],
        &["--comment-language", "--trace"],
        &["--comment-from", "english", "--comment-from", "german"],
        &["--mode"],
    ] {
        let run = cli(
            &[&["translate", "javascript", "python"][..], arguments].concat(),
            "let x = 1;\n",
        );
        assert_eq!(run.status, 1, "{arguments:?}");
        assert!(
            run.errors
                .contains(&format!("Expected a single value for {}", arguments[0])),
            "{}",
            run.errors
        );
    }
    assert!(
        Options::default()
            .with_comment_language("klingon", None)
            .is_err()
    );
}

// Comments inside indented blocks and around functions
// (js/tests/comments.test.js).

#[test]
fn keeps_a_comment_that_opens_an_indented_block() {
    let python = "def sq(n):\n    # square it\n    return n * n\n\nprint(sq(2))\n";
    let javascript = to(python, "python", "javascript");
    assert_eq!(
        javascript,
        "function sq(n) {\n    // square it\n    return n * n;\n}\n\nconsole.log(sq(2));\n"
    );
    assert_eq!(to(&javascript, "javascript", "python"), python);
}

#[test]
fn keeps_comments_that_close_an_indented_block() {
    let python = "def sq(n):\n    return n * n\n    # inside\n# outside\nprint(sq(2))\n";
    let javascript = to(python, "python", "javascript");
    assert_eq!(
        javascript,
        "function sq(n) {\n    return n * n;\n    // inside\n}\n// outside\nconsole.log(sq(2));\n"
    );
    assert_eq!(to(&javascript, "javascript", "python"), python);
    assert_eq!(to("// only\n", "javascript", "python"), "# only\n");
}

#[test]
fn keeps_a_comment_right_above_a_function_with_that_function() {
    let python = "# square it\ndef sq(n):\n    return n * n\n\nprint(sq(2))\n";
    assert_eq!(
        to(python, "python", "javascript"),
        "// square it\nfunction sq(n) {\n    return n * n;\n}\n\nconsole.log(sq(2));\n"
    );
}

#[test]
fn keeps_a_comment_right_above_an_import_as_a_file_comment() {
    let c = "/* Hello World in C */\n#include <stdio.h>\n\nint main(void)\n{\n    printf(\"Hi\\n\");\n    return 0;\n}\n";
    assert_eq!(
        to(c, "c", "python"),
        "# Hello World in Python\n\nprint(\"Hi\")\n"
    );
}

#[test]
fn keeps_functions_without_an_empty_line_between_them() {
    let tight = "function one(n) {\n    return n + 1;\n}\nfunction two(n) {\n    return n + 2;\n}\n\nconsole.log(one(two(1)));\n";
    for language in language_ids() {
        if language == "javascript" || language_syntax(language).expect("a language").machine {
            continue;
        }
        let text = to(tight, "javascript", language);
        assert_eq!(
            to(&text, language, "javascript"),
            tight,
            "{language}:\n{text}"
        );
    }
}

#[test]
fn reads_a_lone_return_1_back_as_a_number() {
    let perl = "sub one {\n    return 1;\n}\n\nprint 2 . \"\\n\";\n";
    assert_eq!(
        to(perl, "perl", "javascript"),
        "function one() {\n    return 1;\n}\n\nconsole.log(2);\n"
    );
}

// Together with issue #8 (js/tests/issue-6-with-8.test.js).

const COMMENTED: &str = "// number\nlet x = 1;\nconsole.log(x);\n";

#[test]
fn writes_comments_in_another_language_into_a_version_of_a_language() {
    let result = translate_partial(
        COMMENTED,
        "javascript",
        "python@2",
        commenting("russian", None),
    )
    .expect("a partial translation");
    assert!(result.complete);
    assert_eq!(result.text, "# число\nx = 1\nprint x\n");
}

#[test]
fn keeps_comment_languages_and_versions_in_parts_that_translate() {
    let source = "# number\nx = 1\nwith open(f) as g:\n    y = 2\nprint(x)\n";
    let result = translate_partial(source, "python", "javascript", commenting("russian", None))
        .expect("a partial translation");
    assert!(!result.complete);
    assert_eq!(
        result
            .errors
            .iter()
            .map(|error| error.line)
            .collect::<Vec<_>>(),
        [3]
    );
    assert!(result.text.contains("// число"), "{}", result.text);
    assert!(result.text.contains("console.log(x);"), "{}", result.text);
    assert!(
        result.text.contains("// untranslated (line 3)"),
        "{}",
        result.text
    );
}

#[test]
fn passes_comment_options_through_the_partial_default() {
    let versioned = cli(
        &[
            "translate",
            "javascript",
            "python@2",
            "--comment-language",
            "russian",
        ],
        COMMENTED,
    );
    assert_eq!(
        (
            versioned.status,
            versioned.output.as_str(),
            versioned.errors.as_str()
        ),
        (0, "# число\nx = 1\nprint x\n", "")
    );
    let strict = cli(
        &[
            "translate",
            "javascript",
            "python",
            "--all-or-nothing",
            "--comment-from",
            "english",
            "--comment-language",
            "german",
        ],
        COMMENTED,
    );
    // Word-by-word comments keep the case of the source word.
    assert_eq!(strict.output.to_lowercase(), "# zahl\nx = 1\nprint(x)\n");
}

#[test]
fn translates_only_the_comments_of_a_text_whose_language_is_detected() {
    let run = cli(
        &[
            "translate",
            "auto",
            "javascript",
            "--comment-language",
            "russian",
        ],
        COMMENTED,
    );
    assert_eq!(run.status, 0);
    assert_eq!(run.errors, "Detected language: javascript\n");
    assert_eq!(run.output, "// число\nlet x = 1;\nconsole.log(x);\n");
}
