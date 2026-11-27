//! Ranking of candidate translations by frequency and round trip, as truth
//! values of relative meta logic, and the imprecision a meta program
//! records. The JavaScript twin is js/tests/ranking.test.js.

use std::io::Write;
use std::process::{Command, Stdio};

use universal_translator::meta::Node;
use universal_translator::meta::imprecision::mark_imprecision;
use universal_translator::meta::notation::format_meta;
use universal_translator::natural::probability::{priors, product, similarity, truth};
use universal_translator::natural::{RankedProse, rank_prose, read_prose};
use universal_translator::{Mode, Options, TranslationCandidate, Translator};

const GREETING: &str = "Привет мир. Как дела?\n";

fn cli(arguments: &[&str], input: &str) -> (Option<i32>, String) {
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
    let text = String::from_utf8(output.stdout).expect("UTF-8");
    (output.status.code(), text)
}

fn candidates(source: &str, from: &str, to: &str, options: Options) -> Vec<TranslationCandidate> {
    Translator::new()
        .translate_candidates(source, from, to, options)
        .expect("candidates")
}

#[test]
fn keeps_truth_values_on_a_grid_of_six_decimals() {
    assert_eq!(truth(1.0 / 3.0), 0.333333);
    assert_eq!(truth(2.0 / 3.0), 0.666667);
    assert_eq!(truth(1.5), 1.0);
    assert_eq!(truth(-1.0), 0.0);
    assert_eq!(truth(f64::NAN), 0.5);
}

#[test]
fn combines_independent_values_by_their_product() {
    assert_eq!(product(&[]), 1.0);
    assert_eq!(product(&[0.5, 0.5]), 0.25);
    assert_eq!(product(&[2.0 / 3.0, 2.0 / 3.0]), 0.444445);
}

#[test]
fn gives_the_most_frequent_reading_the_largest_prior() {
    assert_eq!(priors(1), [1.0]);
    assert_eq!(priors(2), [0.666667, 0.333333]);
    assert_eq!(priors(3), [0.545455, 0.272727, 0.181818]);
}

#[test]
fn measures_what_survives_a_round_trip_in_order() {
    let none: [&str; 0] = [];
    assert_eq!(similarity(&none, &none), 1.0);
    assert_eq!(similarity(&["a", "b", "c"], &["a", "b", "c"]), 1.0);
    assert_eq!(
        similarity(&["a", "b", "c", "d"], &["a", "x", "c", "d"]),
        0.75
    );
    assert_eq!(similarity(&["a", "b"], &none), 0.0);
}

#[test]
fn ranks_the_readings_of_prose_the_default_first() {
    let ranked = rank_prose("Привет мир. Как дела?", "russian", "english").expect("ranked");
    assert_eq!(
        ranked[0],
        RankedProse {
            text: "Hello world. How do?".to_owned(),
            probability: 0.409992,
            frequency: 0.409992,
            round_trip: 1.0,
        }
    );
    assert!(
        ranked
            .iter()
            .any(|candidate| candidate.text == "Hello peace. How do?")
    );
    assert!(
        ranked
            .windows(2)
            .all(|pair| pair[0].probability >= pair[1].probability)
    );
    let mut texts: Vec<&str> = ranked.iter().map(|it| it.text.as_str()).collect();
    texts.sort_unstable();
    texts.dedup();
    assert_eq!(texts.len(), ranked.len());
}

#[test]
fn uses_observed_noun_readings_and_reports_the_same_prior_in_meta() {
    let expected = [
        RankedProse {
            text: "world".to_owned(),
            probability: 0.922481,
            frequency: 0.922481,
            round_trip: 1.0,
        },
        RankedProse {
            text: "peace".to_owned(),
            probability: 0.0,
            frequency: 0.077519,
            round_trip: 0.0,
        },
    ];
    for form in ["мир", "мира", "миру", "миром", "мире"] {
        assert_eq!(
            rank_prose(form, "russian", "english").expect(form),
            expected
        );
        let prose = read_prose(form, Some("russian"), &|_| None).expect(form);
        let word = prose.nodes("sentences")[0].nodes("words")[0];
        assert_eq!(word.str("concept"), Some("world"));
        assert_eq!(word.number("alternatives"), Some(2.0));
        assert_eq!(word.number("probability"), Some(0.922481));
    }
    let unmeasured = rank_prose("строка", "russian", "english").expect("unmeasured");
    assert_eq!(unmeasured[0].frequency, 0.666667);
}

#[test]
fn keeps_prose_in_its_own_language_as_it_is() {
    assert_eq!(
        rank_prose("Hello world", "english", "english").expect("ranked"),
        [RankedProse {
            text: "Hello world".to_owned(),
            probability: 1.0,
            frequency: 1.0,
            round_trip: 1.0,
        }]
    );
}

#[test]
fn makes_the_most_probable_candidate_the_default_translation() {
    let found = candidates(GREETING, "russian", "english", Options::default());
    let partial = Translator::new()
        .translate_partial(GREETING, "russian", "english", Options::default(), false)
        .expect("translation");
    assert_eq!(found[0].text, partial.text);
    assert_eq!(found[0].text, "Hello world. How do?\n");
    assert!(found.len() > 1);
    assert_eq!(found[0].coverage, 1.0);
}

#[test]
fn ranks_the_comments_of_a_program() {
    let source = "# say hello to the world\nx = 1\nprint(x)\n";
    let options = Options::default()
        .with_comment_language("russian", None)
        .expect("options");
    let best = &candidates(source, "python", "python", options)[0];
    let translated = Translator::new()
        .translate_with(source, "python", "python", options)
        .expect("translation");
    assert_eq!(best.text, translated);
    assert_eq!(best.frequency, 1.0);
    assert!(best.round_trip < 1.0);
}

#[test]
fn scores_code_without_prose_by_its_coverage() {
    assert_eq!(
        candidates(
            "x = 1\nprint(x)\n",
            "python",
            "javascript",
            Options::default()
        ),
        [TranslationCandidate {
            text: "const x = 1;\nconsole.log(x);\n".to_owned(),
            probability: 1.0,
            frequency: 1.0,
            round_trip: 1.0,
            coverage: 1.0,
        }]
    );
    let partial = &candidates(
        "x = 1\nfoo bar baz\n",
        "python",
        "javascript",
        Options::default(),
    )[0];
    assert_eq!(partial.coverage, 0.5);
    assert_eq!(partial.probability, 0.5);
}

#[test]
fn prints_the_candidates_on_the_command_line() {
    let (status, output) = cli(
        &["translate", "russian", "english", "-", "--candidates"],
        GREETING,
    );
    assert_eq!(status, Some(0));
    assert_eq!(
        output.split('\n').next(),
        Some("(text 'Hello world. How do?")
    );
    assert!(
        output.contains(
            "') (probability 0.409992) (frequency 0.409992) (roundTrip 1) (coverage 1)\n"
        )
    );
    assert!(output.contains("(text 'Hello peace. How do?"));
    let (status, _) = cli(
        &[
            "translate",
            "russian",
            "english",
            "-",
            "--candidates",
            "--fragment",
        ],
        GREETING,
    );
    assert_ne!(status, Some(0));
}

#[test]
fn marks_the_ambiguous_and_the_untranslated_words_of_prose() {
    let prose = read_prose("how is x?", None, &|_| None).expect("prose");
    let sentence = prose.nodes("sentences")[0];
    let words = sentence.nodes("words");
    assert_eq!(
        *words[0],
        Node::new("Word")
            .with("text", "how")
            .with("concept", "how")
            .with("part", "interrogative")
            .with("imprecision", "ambiguous")
            .with("alternatives", 2.0)
            .with("probability", 0.666667)
    );
    assert_eq!(words[1].number("alternatives"), Some(3.0));
    assert_eq!(words[1].number("probability"), Some(0.545455));
    assert_eq!(
        *words[2],
        Node::new("Word")
            .with("text", "x")
            .with("imprecision", "untranslated")
    );
}

#[test]
fn marks_numbers_an_integer_type_loses() {
    let source = "x = 12345678901234567890\ny = 1.5\nz = 3\nprint(x)\n";
    let text = format_meta(&Translator::new().to_meta(source, "python").expect("meta"));
    assert!(
        text.contains("number 12345678901234567000 (imprecision rounded) (type integer)"),
        "{text}"
    );
    assert!(text.contains("number 1.5 (type real)\n"), "{text}");
    assert!(text.contains("number 3 (type integer)\n"));
}

#[test]
fn marks_a_number_with_a_fraction_typed_as_an_integer() {
    let number = Node::new("Number")
        .with("value", 1.5)
        .with("type", "integer");
    let marked = mark_imprecision(number);
    assert_eq!(marked.str("imprecision"), Some("truncated"));
}

#[test]
fn shows_imprecision_in_the_meta_program_and_not_in_a_translation() {
    let source = "// how is x?\nlet x = 1.5;\nconsole.log(x);\n";
    let (_, output) = cli(&["meta", "javascript", "-"], source);
    assert!(output.contains(
        "word how (alternatives 2) (concept how) (imprecision ambiguous) (part interrogative) (probability 0.666667)"
    ));
    assert!(output.contains("word x (imprecision untranslated)"));
    let (_, json) = cli(&["meta", "javascript", "-", "--json"], source);
    assert!(json.contains("\"type\": \"real\""), "{json}");
    assert!(!json.contains("\"imprecision\": \"truncated\""), "{json}");
    let python = Translator::new()
        .translate(source, "javascript", "python", Mode::default())
        .expect("translation");
    assert!(!python.contains("imprecision"));
    assert!(python.contains("x = 1.5"));
}
