//! Equivalence of two programs, in the library and on the command line.
//! The JavaScript twin is js/tests/equivalence.test.js.

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use universal_translator::{
    Equivalence, GrammarError, Mode, Translator, check_equivalence, compare_meta,
};

const SUM: &str = "const total = 2 + 3;\nconsole.log(total);\n";
const COMMENTED: &str = "# the sum\n\ntotal = 2 + 3\nprint(total)\n";
const CHANGED: &str = "total = 2 + 4\nprint(total)\n";
const DIFFERENCE: &str = "/main/statements/0/value/right/value: 3 != 4";

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

fn check(source: &str, to: &str, target: Option<&str>) -> Result<Equivalence, GrammarError> {
    check_equivalence(&Translator::new(), source, "javascript", to, target)
}

#[test]
fn finds_every_committed_translation_equivalent_to_its_source() {
    let languages = extensions();
    assert_eq!(languages.len(), 39);
    for task in ["factorial", "greatest-common-divisor"] {
        let source = fs::read_to_string(programs().join(format!("{task}.js"))).expect("source");
        for (language, extension) in &languages {
            let target = fs::read_to_string(
                programs()
                    .join("translated")
                    .join(task)
                    .join(format!("{task}{extension}")),
            )
            .expect("golden");
            let checked = check(&source, language, Some(&target)).expect("read");
            assert_eq!((language, task, checked.difference), (language, task, None));
        }
    }
}

#[test]
fn leaves_comments_blank_lines_and_layout_out() {
    let checked = check(SUM, "python", Some(COMMENTED)).expect("read");
    assert!(checked.equivalent());
    assert_eq!(checked.target, COMMENTED);
}

#[test]
fn translates_the_source_when_no_target_is_given() {
    let checked = check(SUM, "rust", None).expect("read");
    assert!(checked.equivalent());
    let translated = Translator::new()
        .translate(SUM, "javascript", "rust", Mode::default())
        .expect("translation");
    assert_eq!(checked.target, translated);
}

#[test]
fn reports_the_first_difference_with_its_path() {
    let checked = check(SUM, "python", Some(CHANGED)).expect("read");
    assert_eq!(checked.difference.as_deref(), Some(DIFFERENCE));
    let translator = Translator::new();
    let javascript = translator.to_meta(SUM, "javascript").expect("meta");
    let python = translator.to_meta(COMMENTED, "python").expect("meta");
    assert_eq!(compare_meta(&javascript, &python), None);
}

fn cli(arguments: &[&str]) -> (i32, String, String) {
    let output = Command::new(env!("CARGO_BIN_EXE_universal-translator"))
        .args(arguments)
        .output()
        .expect("the command line");
    (
        output.status.code().unwrap_or(-1),
        String::from_utf8(output.stdout).expect("UTF-8 output"),
        String::from_utf8(output.stderr).expect("UTF-8 errors"),
    )
}

#[test]
fn the_command_reports_equivalence_and_the_first_difference() {
    let directory = std::env::temp_dir().join(format!("ut-equivalence-{}", std::process::id()));
    fs::create_dir_all(&directory).expect("directory");
    let file = |name: &str, text: &str| {
        let path = directory.join(name);
        fs::write(&path, text).expect("file");
        path.to_string_lossy().into_owned()
    };
    let (sum, commented, changed) = (
        file("sum.js", SUM),
        file("sum.py", COMMENTED),
        file("changed.py", CHANGED),
    );
    assert_eq!(
        cli(&[
            "check-equivalence",
            "javascript",
            "python",
            &sum,
            &commented
        ]),
        (
            0,
            "The javascript and python programs are equivalent\n".to_owned(),
            String::new()
        )
    );
    assert_eq!(cli(&["check-equivalence", "javascript", "go", &sum]).0, 0);
    assert_eq!(
        cli(&["check-equivalence", "javascript", "python", &sum, &changed]),
        (
            1,
            String::new(),
            format!("The javascript and python programs are not equivalent: {DIFFERENCE}\n")
        )
    );
    assert_eq!(cli(&["check-equivalence", "javascript", "python"]).0, 1);
    fs::remove_dir_all(&directory).expect("cleanup");
}
