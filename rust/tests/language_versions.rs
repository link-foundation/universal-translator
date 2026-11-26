//! Versions of popular languages (javascript@es5, php@5, csharp@5). The
//! JavaScript twin is js/tests/language-versions.test.js.

use std::fs;
use std::path::Path;

use universal_translator::{Mode, Options, Translator, check_equivalence, translate, versions_of};

const SOURCE: &str = "const n = 7;\n\
const half = Math.trunc(n / 2);\n\
console.log(`n is ${n}, half ${half}`);\n\
const items = new Array(3).fill(0);\n\
const list = [1, 2, 3];\n\
console.log(list.length);\n";

fn written(source: &str, to: &str) -> String {
    translate(source, "javascript", to, Mode::default())
        .unwrap_or_else(|error| panic!("javascript -> {to}: {error}"))
}

fn to(target: &str) -> String {
    written(SOURCE, target)
}

fn tasks() -> Vec<(String, String)> {
    let folder = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs");
    let mut tasks: Vec<(String, String)> = fs::read_dir(folder)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "js"))
        .map(|path| {
            let name = path.file_stem().unwrap().to_string_lossy().into_owned();
            (name, fs::read_to_string(&path).unwrap())
        })
        .collect();
    tasks.sort();
    tasks
}

#[test]
fn lists_the_newer_version_first_as_the_default() {
    for (id, versions) in [
        ("javascript", ["es6", "es5"]),
        ("php", ["7", "5"]),
        ("csharp", ["6", "5"]),
    ] {
        let listed: Vec<&str> = versions_of(id).iter().map(|v| v.version).collect();
        assert_eq!(listed, versions, "{id}");
        assert!(versions_of(id)[0].default, "{id}");
    }
}

#[test]
fn writes_ecmascript_5_with_var_plus_and_a_fill_loop() {
    let es5 = to("javascript@es5");
    for word in ["let ", "const ", ".fill(", "`"] {
        assert!(!es5.contains(word), "{word}: {es5}");
    }
    assert!(es5.contains("var n = 7;"), "{es5}");
    assert!(
        es5.contains("console.log(\"n is \" + String(n) + \", half \" + String(half));"),
        "{es5}"
    );
    assert!(es5.contains("var half = ~~(n / 2);"), "{es5}");
    assert!(es5.contains("var items = new Array(3);"), "{es5}");
    assert!(
        es5.contains("for (var index = 0; index < 3; index++) {"),
        "{es5}"
    );
}

#[test]
fn keeps_the_default_javascript_for_the_newer_version() {
    let es6 = to("javascript");
    assert!(es6.contains("const n = 7;"), "{es6}");
    assert!(es6.contains("`n is ${n}, half ${half}`"), "{es6}");
    assert!(es6.contains("Math.trunc(n / 2)"), "{es6}");
    assert_eq!(to("javascript@es6"), es6);
}

#[test]
fn writes_php_5_with_int_and_array_and_php_7_with_intdiv() {
    let php5 = to("php@5");
    assert!(php5.contains("$half = (int) ($n / 2);"), "{php5}");
    assert!(php5.contains("array(1, 2, 3)"), "{php5}");
    assert!(!php5.contains("intdiv") && !php5.contains("[1, 2, 3]"));
    let php7 = to("php");
    assert!(php7.contains("$half = intdiv($n, 2);"), "{php7}");
    assert!(php7.contains("[1, 2, 3]"), "{php7}");
    assert_eq!(to("php@7"), php7);
}

#[test]
fn writes_csharp_5_without_string_interpolation() {
    let csharp5 = to("csharp@5");
    assert!(
        csharp5.contains(
            "\"n is \" + System.Convert.ToString(n) + \", half \" + System.Convert.ToString(half)"
        ),
        "{csharp5}"
    );
    assert!(!csharp5.contains("$\""), "{csharp5}");
    assert!(to("csharp").contains("$\"n is {n}, half {half}\""));
}

#[test]
fn refuses_a_version_a_language_does_not_have() {
    for (target, message) in [
        ("javascript@es3", "javascript has no version \"es3\""),
        ("php@4", "php has no version \"4\""),
        ("csharp@1", "csharp has no version \"1\""),
    ] {
        let error = translate(SOURCE, "javascript", target, Mode::default()).unwrap_err();
        assert!(error.to_string().contains(message), "{error}");
    }
}

#[test]
fn reads_every_version_back_as_the_same_program() {
    let source = "const list = [1, 2, 3];\nconsole.log(Math.trunc(7 / 2));\n";
    let python = written(source, "python");
    for (target, language) in [
        ("javascript@es5", "javascript"),
        ("php@5", "php"),
        ("csharp@5", "csharp"),
    ] {
        let text = written(source, target);
        let back = translate(&text, language, "python", Mode::default()).unwrap();
        assert_eq!(back, python, "{target}: {text}");
    }
}

#[test]
fn translates_every_example_program_in_every_new_version() {
    for target in ["javascript@es5", "php@5", "csharp@5"] {
        for (task, source) in tasks() {
            assert!(!written(&source, target).is_empty(), "{task} in {target}");
        }
    }
}

#[test]
fn writes_no_let_const_or_fill_in_any_ecmascript_5_example() {
    for (task, source) in tasks() {
        let es5 = written(&source, "javascript@es5");
        assert!(!es5.contains(".fill("), "{task}");
        assert!(
            es5.lines().all(|line| {
                let line = line.trim_start();
                !line.starts_with("let ")
                    && !line.starts_with("const ")
                    && !(line.starts_with("for (") && line.contains(" of "))
            }),
            "{task}: {es5}"
        );
    }
}

#[test]
fn counts_over_the_indexes_of_an_array_where_ecmascript_5_has_no_for_of() {
    let source = "const list = [1, 2, 3];\nfor (const item of list) {\n  console.log(item);\n}\n";
    let es5 = written(source, "javascript@es5");
    assert!(
        es5.contains("for (var index = 0; index < list.length; index++) {"),
        "{es5}"
    );
    assert!(es5.contains("var item = list[index];"), "{es5}");
    let translator = Translator::new();
    let check = check_equivalence(
        &translator,
        (source, "javascript"),
        (Some(&es5), "javascript@es5"),
        Options::default(),
    )
    .unwrap();
    assert!(check.equivalent, "{:?}", check.differences);
}

const LOOP: &str = "const list = [1, 2, 3];\nfor (const item of list) {\n  console.log(item);\n}\n";
const PRINTS: &str = "process.stdout.write(\"a\");\nconsole.log(\"b\");\n";

fn read(source: &str, from: &str) -> String {
    translate(source, from, "javascript", Mode::default())
        .unwrap_or_else(|error| panic!("{from} -> javascript: {error}"))
}

#[test]
fn counts_over_the_indexes_of_an_array_where_java_1_4_has_no_for_each() {
    let java = written(LOOP, "java@1.4");
    assert!(
        java.contains("for (int index = 0; index < list.length; index++) {"),
        "{java}"
    );
    assert!(java.contains("int item = list[index];"), "{java}");
    assert!(written(LOOP, "java").contains("for (int item : list) {"));
    assert!(read(&java, "java@1.4").contains("console.log(item);"));
}

#[test]
fn writes_and_reads_println_and_print_in_swift_1() {
    assert_eq!(written(PRINTS, "swift@1"), "print(\"a\")\nprintln(\"b\")\n");
    assert_eq!(read("print(\"a\")\nprintln(\"b\")\n", "swift@1"), PRINTS);
}

#[test]
fn reads_the_empty_terminator_of_swift_2_and_later_as_no_line_end() {
    let swift = written(PRINTS, "swift");
    assert_eq!(swift, "print(\"a\", terminator: \"\")\nprint(\"b\")\n");
    assert_eq!(read(&swift, "swift"), PRINTS);
}

#[test]
fn prints_any_other_terminator_and_separator_after_the_values() {
    assert_eq!(
        read(
            "print(\"a\", terminator: \"!\")\nprint(\"a\", \"b\", separator: \"-\")\n",
            "swift"
        ),
        "process.stdout.write(\"a!\");\nconsole.log(`a-b`);\n"
    );
    assert_eq!(
        read(
            "print(\"a\", end=\"!\")\nprint(\"a\", \"b\", sep=\", \", end=\".\\n\")\n",
            "python"
        ),
        "process.stdout.write(\"a!\");\nconsole.log(\"a, b.\");\n"
    );
}

#[test]
fn joins_text_with_plus_and_str_in_python_3_5_before_f_strings() {
    let source = "const n = 7;\nconsole.log(`n is ${n}`);\n";
    assert_eq!(
        written(source, "python@3.5"),
        "n = 7\nprint(\"n is \" + str(n))\n"
    );
    assert_eq!(written(source, "python"), "n = 7\nprint(f\"n is {n}\")\n");
}

#[test]
fn reads_text_joined_from_conversions_as_text_not_as_a_sum() {
    assert_eq!(
        read(
            "n = 7\nprint str(n) + str(n) + \" items\"\nprint str(n) + str(n)\nprint n + n\n",
            "python"
        ),
        "const n = 7;\nconsole.log(`${n}${n} items`);\nconsole.log(`${n}${n}`);\nconsole.log(n + n);\n"
    );
    let source = "const n = 7;\nconsole.log(`${n}${n} items`);\n";
    for version in ["python@2", "python@3.5", "csharp@5"] {
        let text = written(source, version);
        assert_eq!(read(&text, version), source, "{version}: {text}");
    }
}
