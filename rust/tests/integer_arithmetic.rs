//! Shared rounding contracts and full helper-algorithm recognition.
use universal_translator::meta::{Node, same_meaning, walk};
use universal_translator::natural::natural_language_ids;
use universal_translator::{Mode, Translator};
const FLOOR: &str = "print(-7 // 3)\nprint(-7 % 3)\n";
const TRUNC: &str =
    "int main(void) { printf(\"%d\\n\", -7 / 3); printf(\"%d\\n\", -7 % 3); return 0; }";
fn operators(tree: &Node) -> Vec<String> {
    let mut found = vec![];
    walk(tree, |n| {
        if n.is("Binary") {
            found.push(n.str("operator").unwrap_or_default().to_owned());
        }
    });
    found
}
fn equivalent(t: &Translator, meta: &Node, language: &str) {
    let written = t
        .from_meta(meta, language, None, Mode::ContextDependent)
        .unwrap();
    let read = t.to_meta(&written, language).unwrap();
    assert!(same_meaning(meta, &read), "{language}: {written}\n{read:?}");
}
#[test]
fn distinguishes_source_rounding_and_remainder_signs() {
    let t = Translator::new();
    for (language, source) in [
        ("python", FLOOR),
        ("python@2", "print(-7 / 3)\nprint(-7 % 3)\n"),
        ("ruby", "puts(-7 / 3)\nputs(-7 % 3)\n"),
        ("lua", FLOOR),
        ("r", "print(-7 %/% 3)\nprint(-7 %% 3)\n"),
    ] {
        assert_eq!(
            operators(&t.to_meta(source, language).unwrap()),
            ["floorDivide", "modulo"],
            "{language}"
        );
    }
    assert_eq!(
        operators(&t.to_meta(TRUNC, "c").unwrap()),
        ["divide", "remainder"]
    );
    assert_eq!(
        operators(&t.to_meta("print(-7 % 3);", "perl").unwrap()),
        ["modulo"]
    );
}
#[test]
fn round_trips_both_contracts_through_shared_helper_algorithms() {
    let t = Translator::new();
    for (source, from) in [(FLOOR, "python"), (TRUNC, "c")] {
        let meta = t.to_meta(source, from).unwrap();
        for language in [
            "javascript",
            "javascript@es5",
            "typescript",
            "python",
            "python@2",
            "ruby",
            "lua",
            "lua@5.1",
            "r",
            "perl",
            "php",
            "php@5",
            "c",
            "cpp",
            "csharp",
            "java",
            "go",
            "rust",
            "nim",
            "fortran",
            "rocq",
            "nasm",
            "gas",
            "arm64",
            "cil",
            "jvm",
            "llvm",
            "wat",
        ]
        .into_iter()
        .chain(natural_language_ids())
        {
            equivalent(&t, &meta, language);
        }
    }
}

#[test]
fn recognizes_previously_emitted_helpers_with_the_local_result_name() {
    let t = Translator::new();
    let meta = t.to_meta(FLOOR, "python").unwrap();
    let written = t
        .from_meta(&meta, "javascript", None, Mode::default())
        .unwrap();
    assert!(written.contains("quotient"));
    let legacy = written.replace("quotient", "result");
    let read = t.to_meta(&legacy, "javascript").unwrap();
    assert!(same_meaning(&meta, &read));
}
#[test]
fn preserves_floor_and_modulo_compound_assignments() {
    let t = Translator::new();
    let meta = t
        .to_meta(
            "value = -7\nvalue //= 3\nvalue %= 2\nprint(value)\n",
            "python",
        )
        .unwrap();
    assert_eq!(operators(&meta), ["floorDivide", "modulo"]);
    for language in ["javascript", "python", "perl", "rust"] {
        equivalent(&t, &meta, language);
    }
}
#[test]
fn real_slash_remains_true_division() {
    let t = Translator::new();
    for (language, source) in [
        ("ruby", "puts(-7.0 / 3)\n"),
        ("python@2", "print(-7.0 / 3)\n"),
    ] {
        assert_eq!(
            operators(&t.to_meta(source, language).unwrap()),
            ["realDivide"]
        );
    }
    assert!(
        t.translate("print(7.0 // 3)\n", "python", "c", Mode::default())
            .unwrap_err()
            .to_string()
            .contains("Real floorDivide")
    );
}
#[test]
fn fresh_names_and_complete_unshadowed_algorithms() {
    let t = Translator::new();
    let meta=t.to_meta("def ut_integer_floor_divide(first, second):\n    return first + second\n\nprint(-7 // 3)\n","python").unwrap();
    equivalent(&t, &meta, "javascript");
    let written = t
        .translate(FLOOR, "python", "javascript", Mode::default())
        .unwrap();
    for invalid in [
        written.replace("quotient -= 1", "quotient += 1"),
        written.replace("return quotient;", "return\nquotient;"),
        format!("{written}\nconst escaped = utIntegerFloorDivide;"),
        format!("{written}\nfunction shadow(utIntegerFloorDivide) {{ return 1; }}"),
        format!("{written}\nfunction utIntegerFloorDivide(first, second) {{ return 1; }}"),
        written.replace(
            "utIntegerFloorDivide(-7, 3)",
            "utIntegerFloorDivide(-7, 3, 9)",
        ),
    ] {
        assert!(
            t.to_meta(&invalid, "javascript")
                .unwrap()
                .nodes("functions")
                .iter()
                .any(|f| f.str("name") == Some("ut-integer-floor-divide")),
            "{invalid}"
        );
    }
}
