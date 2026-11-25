use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use universal_translator::formal::common_library::COMMON_LIBRARY_LANGUAGES;
use universal_translator::translator::{language_ids, machine_target_ids};
use universal_translator::{Mode, Options, Translator};

const PROGRAMS: [&str; 5] = [
    "hello-world",
    "factorial",
    "fizz-buzz",
    "greatest-common-divisor",
    "sum-of-squares",
];

fn read(name: &str) -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!("examples/programs/{name}.js"));
    fs::read_to_string(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

fn translate(source: &str, from: &str, to: &str, common_library: bool) -> String {
    let options = Options {
        mode: Mode::ContextDependent,
        common_library,
    };
    Translator::new()
        .translate_with(source, from, to, options)
        .unwrap_or_else(|error| panic!("{from} -> {to}: {error}"))
}

#[test]
fn replaces_prints_with_library_calls_and_imports_the_library() {
    let python = translate(&read("sum-of-squares"), "javascript", "python", true);
    assert!(
        python.contains("from common_library import write_text, write_integer, end_line"),
        "{python}"
    );
    assert!(python.contains("write_integer(limit)"), "{python}");
    let csharp = translate(&read("hello-world"), "javascript", "csharp", true);
    assert!(
        csharp.contains("CommonLibrary.PrintLine(\"Hello World!\");"),
        "{csharp}"
    );
}

#[test]
fn reads_library_calls_back_as_the_same_program_in_every_language() {
    for name in PROGRAMS {
        for language in COMMON_LIBRARY_LANGUAGES {
            let plain = translate(&read(name), "javascript", language, false);
            let via_library = translate(&read(name), "javascript", language, true);
            assert_eq!(
                translate(&via_library, language, "javascript", false),
                translate(&plain, language, "javascript", false),
                "{name} in {language}"
            );
        }
    }
}

#[test]
fn has_an_implementation_for_every_language() {
    let machine = machine_target_ids();
    let languages: Vec<&str> = language_ids()
        .into_iter()
        .filter(|id| !machine.contains(id))
        .collect();
    assert_eq!(languages, COMMON_LIBRARY_LANGUAGES);
}

#[test]
fn is_rejected_for_machine_targets() {
    let options = Options {
        mode: Mode::ContextDependent,
        common_library: true,
    };
    let error = Translator::new()
        .translate_with(&read("hello-world"), "javascript", "nasm", options)
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("Machine targets have no common library"),
        "{error}"
    );
}

#[test]
fn is_available_from_the_command_line() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_universal-translator"))
        .args(["translate", "javascript", "ruby", "-", "--common-library"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("start the command line");
    child
        .stdin
        .take()
        .expect("standard input")
        .write_all(b"console.log(\"Hi\");\n")
        .expect("write the program");
    let output = child.wait_with_output().expect("run the command line");
    assert!(output.status.success());
    let output = String::from_utf8_lossy(&output.stdout);
    assert!(
        output.contains("require_relative \"common_library\""),
        "{output}"
    );
    assert!(output.contains("print_line(\"Hi\")"), "{output}");
}
