use universal_translator::natural::natural_language_ids;
use universal_translator::translator::{language_ids, machine_target_ids};
use universal_translator::{Options, TextLayout, Translator};

const SOURCE: &str = include_str!("../../examples/translation/comment-headers.cpp");
const MEANINGS: [&str; 3] = ["число", "последовательность", "итеративно"];

fn options() -> Options {
    Options {
        layout: TextLayout::Target,
        comment_from: Some("english"),
        comment_language: Some("russian"),
        ..Options::default()
    }
}

#[test]
fn translated_header_comments_keep_their_origins_in_every_writer() {
    let translator = Translator::new();
    for target in language_ids()
        .into_iter()
        .chain(machine_target_ids())
        .chain(natural_language_ids())
    {
        let result = translator
            .translate_partial(SOURCE, "cpp", target, options(), false)
            .unwrap();
        assert!(result.complete, "{target}");
        let lines: Vec<_> = result.text.lines().collect();
        for (from, meaning) in [0, 2, 7].into_iter().zip(MEANINGS) {
            let mapped: Vec<_> = result
                .line_map
                .iter()
                .filter_map(|(source, to)| (*source == from).then_some(lines[*to].trim()))
                .collect();
            let expected = lines
                .iter()
                .find(|line| line.contains(meaning))
                .unwrap()
                .trim();
            assert_eq!(mapped, [expected], "{target}: {meaning}");
        }
    }
}

#[test]
fn formal_headers_map_independently_of_their_translated_spelling() {
    let translator = Translator::new();
    for from in language_ids() {
        let source = translator
            .translate_with(SOURCE, "cpp", from, options())
            .unwrap();
        let result = translator
            .translate_partial(
                &source,
                from,
                "python",
                Options {
                    comment_from: Some("russian"),
                    comment_language: Some("english"),
                    ..options()
                },
                false,
            )
            .unwrap();
        assert!(result.complete, "{from}");
        let lines: Vec<_> = source.lines().collect();
        let output: Vec<_> = result.text.lines().collect();
        for (meaning, expected) in MEANINGS
            .into_iter()
            .zip(["number", "sequence", "iteratively"])
        {
            let line = lines
                .iter()
                .position(|line| line.contains(meaning))
                .unwrap();
            let mapped: Vec<_> = result
                .line_map
                .iter()
                .filter_map(|(source, to)| (*source == line).then_some(output[*to].trim()))
                .collect();
            assert_eq!(mapped, [format!("# {expected}")], "{from}: {meaning}");
        }
    }
}

#[test]
fn natural_and_machine_readers_retain_header_comment_origins() {
    let translator = Translator::new();
    for from in natural_language_ids()
        .into_iter()
        .chain(machine_target_ids())
    {
        let source = translator
            .translate_with(SOURCE, "cpp", from, options())
            .unwrap();
        let result = translator
            .translate_partial(
                &source,
                from,
                "python",
                Options {
                    comment_from: Some("russian"),
                    ..options()
                },
                false,
            )
            .unwrap();
        assert!(result.complete, "{from}");
        let lines: Vec<_> = source.lines().collect();
        let output: Vec<_> = result.text.lines().collect();
        for meaning in MEANINGS {
            let line = lines
                .iter()
                .position(|line| line.contains(meaning))
                .unwrap();
            let mapped: Vec<_> = result
                .line_map
                .iter()
                .filter_map(|(source, to)| (*source == line).then_some(output[*to].trim()))
                .collect();
            assert_eq!(mapped, [format!("# {meaning}")], "{from}: {meaning}");
        }
    }
}
