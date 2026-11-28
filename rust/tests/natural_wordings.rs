//! Everyday wordings of algorithm sentences ("Let n be 0", "Print n",
//! "While ..., do this", "Increase n by 1") read like the canonical ones in
//! English, Russian and every other natural language. The
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
fn grammatical_case_preserves_constant_and_variable_identity() {
    for value in ["истина", "истину"] {
        assert_eq!(
            to(&format!("Вернуть {value}."), "russian", "python"),
            "def _ut_main0():\n    return True\n    return 0\n\nraise SystemExit(_ut_main0())\n"
        );
    }
    assert_eq!(
        to("return True\n", "python", "russian"),
        "Вернуть истину.\n"
    );
    assert_eq!(
        to(
            "Создать число со значением 7.\nЕсли делитель не больше числа, сделать это:\n  Вернуть истину.\n",
            "russian",
            "python"
        ),
        "def _ut_main0():\n    number = 7\n    if divisor <= number:\n        return True\n    return 0\n\nraise SystemExit(_ut_main0())\n"
    );
}

#[test]
fn round_trips_array_reads_and_writes_through_every_shipped_profile() {
    let source = "values = [1, 2]\nvalues[1 - 1] = values[1] + 3\nprint(values[0])\n";
    let expected = to(source, "python", "python");
    for id in universal_translator::natural::catalog::natural_language_ids() {
        let natural = to(source, "python", id);
        assert_eq!(to(&natural, id, "python"), expected, "{id}");
    }
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
        (
            "Let n be 7 - 2.\nPrint n % 4.\n",
            "print(ut_integer_remainder(n, 4))",
        ),
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

#[test]
fn reads_english_increase_add_to_decrease_and_subtract_from() {
    let source = "Let n be 0.\nIncrease n by 1.\nAdd 2 to n.\nDecrease n by 1.\nSubtract 1 from n.\nPrint n.\n";
    assert_eq!(
        to(source, "english", "javascript"),
        "let n = 0;\nn += 1;\nn += 2;\nn -= 1;\nn -= 1;\nconsole.log(n);\n"
    );
    assert_eq!(
        to("Let n be 0.\nIncrease n by 1.\n", "english", "english"),
        "Create n with value 0.\nChange n to n plus 1.\n"
    );
}

const RUSSIAN_EVERYDAY: &str = "Пусть n равно 0.\nПока n меньше 3, сделать это:\n  Установить n в n + 1.\nНапечатать n.\nУвеличить n на 2.\nУменьшить n на 1.\nВывести n.\nДля каждого i от 1 до 3, сделать это:\n  Показать i.\n";

#[test]
fn reads_everyday_russian_wordings() {
    assert_eq!(
        to(RUSSIAN_EVERYDAY, "russian", "python"),
        "n = 0\nwhile n < 3:\n    n += 1\nprint(n)\nn += 2\nn -= 1\nprint(n)\nfor i in range(1, 4):\n    print(i)\n"
    );
    let cases = [
        ("Пусть n будет 5.\n", "n = 5"),
        ("Пусть n равно 0.\nПрисвоить n значение 4.\n", "n = 4"),
        ("Вывести 7.\n", "print(7)"),
        ("вывести 7\n", "print(7)"),
    ];
    for (source, expected) in cases {
        let output = to(source, "russian", "python");
        assert!(output.contains(expected), "{source} -> {output}");
    }
}

#[test]
fn detects_everyday_russian_as_russian_that_reads() {
    let detected = universal_translator::Translator::new().detect_language(RUSSIAN_EVERYDAY, 5);
    assert_eq!(
        (detected[0].id.as_str(), detected[0].reads),
        ("russian", true)
    );
}

/// What a sentence of each key with the name n and the value 2 reads as,
/// after a declaration of n (a declaration alone is never reassigned).
const EVERYDAY_KEYS: [(&str, &str); 5] = [
    ("declare", "const n = 2;"),
    ("assign", "n = 2;"),
    ("increase", "n += 2;"),
    ("decrease", "n -= 2;"),
    ("print-line", "console.log(n);"),
];

fn base_languages() -> Vec<&'static universal_translator::natural::catalog::Language> {
    universal_translator::natural::catalog::natural_language_ids()
        .into_iter()
        .map(|id| universal_translator::natural::catalog::natural_language(id).unwrap())
        .filter(|language| language.base.is_none())
        .collect()
}

#[test]
fn gives_every_language_increase_and_decrease() {
    let languages = base_languages();
    assert!(languages.len() >= 30, "{} languages", languages.len());
    for language in languages {
        for key in ["increase", "decrease"] {
            assert!(
                language.templates.get(key).is_some(),
                "{} {key}",
                language.id
            );
        }
    }
}

#[test]
fn reads_every_wording_of_a_statement_as_the_statement() {
    for language in base_languages() {
        let id = language.id.as_str();
        let declare = to("let n = 0;\n", "javascript", id);
        for (key, expected) in EVERYDAY_KEYS {
            for wording in language.templates.get(key).unwrap() {
                let value = if key == "print-line" { "n" } else { "2" };
                let sentence = format!(
                    "{}{}",
                    wording.replace("{name}", "n").replace("{value}", value),
                    language.sentence_end
                );
                let text = if key == "declare" {
                    format!("{sentence}\n")
                } else {
                    format!("{}\n{sentence}\n", declare.trim())
                };
                let output = to(&text, id, "javascript");
                let last = output.trim().lines().last().unwrap_or_default();
                assert_eq!((sentence.as_str(), last), (sentence.as_str(), expected));
            }
        }
    }
}
