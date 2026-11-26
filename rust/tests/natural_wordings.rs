//! Everyday English wordings of algorithm sentences ("Let n be 0",
//! "Print n", "While ..., do this") read like the canonical ones. The
//! JavaScript twin is js/tests/natural-wordings.test.js.

use universal_translator::{Mode, translate};

const EVERYDAY: &str =
    "Let n be 0.\nWhile n is less than 3, do this:\n  Set n to n plus 1.\nPrint n.\n";
const CANONICAL: &str = "Create n with value 0.\nWhile n falls below 3, repeat this:\n  Change n to n plus 1.\nWrite n and end the line.\n";

fn to(source: &str, from: &str, target: &str) -> String {
    translate(source, from, target, Mode::default())
        .unwrap_or_else(|error| panic!("{from} -> {target}: {error}"))
}

#[test]
fn read_like_the_canonical_sentences() {
    assert_eq!(
        to(EVERYDAY, "english", "python"),
        to(CANONICAL, "english", "python")
    );
}

#[test]
fn read_each_statement() {
    let cases = [
        ("Let total be 1.\n", "total = 1"),
        ("Let total be 1.\nSet total to 2.\n", "total = 2"),
        ("Print 7.\n", "print(7)"),
        ("Display 7.\n", "print(7)"),
        ("Show 7.\n", "print(7)"),
        (
            "For each i from 1 to 3, do this:\n  Print i.\n",
            "for i in range(1, 4):",
        ),
        (
            "For each i from 1 to 3:\n  Print i.\n",
            "for i in range(1, 4):",
        ),
        (
            "Define twice using x:\n  Return x times 2.\nPrint twice of (4).\n",
            "return x * 2",
        ),
    ];
    for (source, expected) in cases {
        let output = to(source, "english", "python");
        assert!(output.contains(expected), "{source} -> {output}");
    }
}

#[test]
fn are_written_back_in_the_canonical_wording() {
    let javascript = to(EVERYDAY, "english", "javascript");
    assert_eq!(to(&javascript, "javascript", "english"), CANONICAL);
}

#[test]
fn reads_arithmetic_written_with_symbols() {
    let cases = [
        ("Let n be 0.\nSet n to n + 1.\n", "n += 1"),
        ("Let n be 2 * 3 + 1.\nPrint n.\n", "n = 2 * 3 + 1"),
        ("Let n be 7 - 2.\nPrint n % 4.\n", "print(n % 4)"),
    ];
    for (source, expected) in cases {
        let output = to(source, "english", "python");
        assert!(output.contains(expected), "{source} -> {output}");
    }
}

#[test]
fn opens_a_block_after_a_heading_without_its_colon() {
    let source = "Let n be 0.\nwhile n is less than 3, do this\n  Print n.\n  Set n to n plus 1.\n";
    assert_eq!(
        to(source, "english", "python"),
        "n = 0\nwhile n < 3:\n    print(n)\n    n += 1\n"
    );
}

#[test]
fn keeps_a_sentence_without_its_full_stop_a_statement() {
    assert_eq!(
        to("Print 7\nPrint 8\n", "english", "python"),
        "print(7)\nprint(8)\n"
    );
}
