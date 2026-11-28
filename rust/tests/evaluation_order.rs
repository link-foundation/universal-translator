//! C-family evaluation ordering and guarded temporary recognition.
use universal_translator::meta::{Node, same_meaning, walk};
use universal_translator::{Mode, Translator};
const SOURCE: &str = include_str!("../../examples/arithmetic/evaluation.py");
fn contains(tree: &Node, kind: &str) -> bool {
    let mut found = false;
    walk(tree, |n| found |= n.is(kind));
    found
}
#[test]
fn sequences_scalar_calls_and_arithmetic_at_original_expression_sites() {
    let t = Translator::new();
    let meta = t.to_meta(SOURCE, "python").unwrap();
    for to in ["c", "cpp", "objc"] {
        let written = t
            .from_meta(&meta, to, Some("python"), Mode::default())
            .unwrap();
        assert!(written.contains(" = first()"));
        assert!(written.contains(" = second()"));
        let read = t.to_meta(&written, to).unwrap();
        assert!(contains(&read, "ExpressionSequence"));
        let rebuilt = t.from_meta(&read, "cpp", None, Mode::default()).unwrap();
        assert!(rebuilt.contains("ut_evaluation1 = first()"));
        let round_trip = t.from_meta(&read, "python", None, Mode::default()).unwrap();
        assert!(same_meaning(
            &meta,
            &t.to_meta(&round_trip, "python").unwrap()
        ));
    }
}
#[test]
fn keeps_user_comma_expressions_and_assignments() {
    let t = Translator::new();
    let meta = t
        .to_meta(
            "int main(void) { int x = 0; printf(\"%d\\n\", (x = 2, x + 1)); return 0; }",
            "c",
        )
        .unwrap();
    assert!(contains(&meta, "ExpressionSequence"));
    assert!(contains(&meta, "AssignmentExpression"));
    let written = t
        .from_meta(&meta, "c", Some("python"), Mode::default())
        .unwrap();
    assert!(written.contains("((x = 2), x + 1)"));
}
#[test]
fn preserves_escaping_rebound_reordered_and_changed_temporaries() {
    let t = Translator::new();
    let written=t.translate("def first():\n    return 7\n\ndef second():\n    return 3\n\nprint(first() // second())\n","python","c",Mode::default()).unwrap();
    for invalid in [
        written.replace("int ut_evaluation1 = 0;", "int ut_evaluation1 = 9;"),
        written.replace(
            "ut_integer_floor_divide(ut_evaluation1, ut_evaluation2)",
            "ut_integer_floor_divide(ut_evaluation2, ut_evaluation1)",
        ),
        written.replace(
            "int ut_evaluation1 = 0;",
            "int ut_evaluation1 = 0; printf(\"%d\\n\", ut_evaluation1);",
        ),
        written
            .replace("ut_evaluation1 = first()", "ut_evaluation1 = second()")
            .replace("ut_evaluation2 = second()", "ut_evaluation1 = second()"),
    ] {
        let read = t.to_meta(&invalid, "c").unwrap();
        assert!(contains(&read, "ExpressionSequence"), "{invalid}");
        assert!(t.from_meta(&read, "python", None, Mode::default()).is_err());
    }
}
#[test]
fn avoids_collisions_and_preserves_nested_returns() {
    let t = Translator::new();
    let meta=t.to_meta("def first():\n    return 7\n\ndef combine(left, right):\n    ut_evaluation1 = 8\n    return first() - ut_evaluation1\n\nprint(combine(first(), 3))\n","python").unwrap();
    let written = t
        .from_meta(&meta, "c", Some("python"), Mode::default())
        .unwrap();
    assert!(written.contains("int ut_evaluation2 = 0;"));
    let round_trip = t
        .translate(&written, "c", "python", Mode::default())
        .unwrap();
    assert!(same_meaning(
        &meta,
        &t.to_meta(&round_trip, "python").unwrap()
    ));
}
