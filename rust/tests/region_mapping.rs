use universal_translator::natural::natural_language_ids;
use universal_translator::translator::{language_ids, machine_target_ids};
use universal_translator::{Options, TextLayout, TranslationRegion, Translator};

fn spelling<'a>(text: &'a str, range: universal_translator::ByteRange) -> &'a str {
    &text[range.start..range.end]
}

fn translate(source: &str, from: &str) -> universal_translator::PartialTranslation {
    Translator::new()
        .translate_partial(
            source,
            from,
            "python",
            Options {
                layout: TextLayout::Target,
                ..Options::default()
            },
            true,
        )
        .unwrap()
}

fn matching<'a>(
    pairs: &'a [TranslationRegion],
    source: &str,
    text: &str,
) -> Vec<&'a TranslationRegion> {
    pairs
        .iter()
        .filter(|pair| spelling(source, pair.source) == text)
        .collect()
}

#[test]
fn separates_statements_and_repeated_names_on_the_same_line() {
    let source = "const first = 1; console.log(first); const second = 2; console.log(second);";
    let result = translate(source, "javascript");
    assert!(result.complete);
    for name in ["first", "second"] {
        let uses = matching(&result.region_map, source, name);
        assert_eq!(uses.len(), 1);
        assert_eq!(spelling(&result.text, uses[0].target), name);
        assert_eq!(
            uses[0].source.start,
            source.find(&format!("({name})")).unwrap() + 1
        );
        assert_eq!(
            uses[0].target.start,
            result.text.find(&format!("({name})")).unwrap() + 1
        );
    }
    let declarations: Vec<_> = result
        .region_map
        .iter()
        .filter(|pair| spelling(source, pair.source).starts_with("const "))
        .map(|pair| spelling(&result.text, pair.target))
        .collect();
    assert_eq!(declarations, ["first = 1", "second = 2"]);
}

#[test]
fn preserves_utf8_ranges_indentation_and_crlf_in_wrapped_fragments() {
    let source = "\r\n\treturn \"Привет 🌍\";\r\n";
    let result = translate(source, "c");
    let text = matching(&result.region_map, source, "\"Привет 🌍\"");
    assert_eq!(text.len(), 1);
    assert_eq!(spelling(&result.text, text[0].target), "\"Привет 🌍\"");
    assert_eq!(
        (text[0].source.start, text[0].source.end),
        (10, source.len() - 3)
    );
}

#[test]
fn excludes_nested_same_line_statements_from_the_parent_condition_region() {
    let source = "if (true) { console.log(1); console.log(2); }";
    let result = translate(source, "javascript");
    let headers: Vec<_> = result
        .region_map
        .iter()
        .filter(|pair| spelling(source, pair.source).starts_with("if "))
        .collect();
    assert!(!headers.is_empty());
    assert!(
        headers
            .iter()
            .all(|pair| !spelling(source, pair.source).contains("console"))
    );
    for value in ["1", "2"] {
        assert!(
            matching(&result.region_map, source, value)
                .iter()
                .any(|pair| spelling(&result.text, pair.target) == value)
        );
    }
}

#[test]
fn keeps_regions_through_bash_call_lowering_and_its_inverse() {
    let translator = Translator::new();
    let source = "function fib(n) { return n; }\nconsole.log(fib(5));\n";
    let result = translator
        .translate_partial(
            source,
            "javascript",
            "bash",
            Options {
                layout: TextLayout::Target,
                ..Options::default()
            },
            true,
        )
        .unwrap();
    let prints = matching(&result.region_map, source, "console.log(fib(5));");
    assert!(
        prints
            .iter()
            .any(|pair| spelling(&result.text, pair.target).contains("fib 5"))
    );
    assert!(
        prints
            .iter()
            .any(|pair| spelling(&result.text, pair.target).contains("echo \"$REPLY\""))
    );
    let inverse = translator
        .translate_partial(
            &result.text,
            "bash",
            "javascript",
            Options {
                layout: TextLayout::Target,
                ..Options::default()
            },
            true,
        )
        .unwrap();
    for command in ["fib 5", "echo \"$REPLY\""] {
        let at = result.text.find(command).unwrap();
        assert!(inverse.region_map.iter().any(|pair| pair.source.start <= at
            && pair.source.end > at
            && spelling(&inverse.text, pair.target).contains("console.log")));
    }
}

#[test]
fn supplies_valid_regions_for_all_reader_and_writer_families() {
    let translator = Translator::new();
    let source = "const value = 5;\nconsole.log(value + 2);\n";
    let options = Options {
        layout: TextLayout::Target,
        ..Options::default()
    };
    for language in language_ids()
        .into_iter()
        .chain(machine_target_ids())
        .chain(natural_language_ids())
    {
        let forward = translator
            .translate_partial(source, "javascript", language, options, false)
            .unwrap();
        let inverse = translator
            .translate_partial(&forward.text, language, "python", options, false)
            .unwrap();
        for (before, result) in [(source, &forward), (&forward.text, &inverse)] {
            assert!(result.complete, "{language}");
            assert!(!result.region_map.is_empty(), "{language}");
            for pair in &result.region_map {
                assert!(
                    !spelling(before, pair.source).trim().is_empty(),
                    "{language}"
                );
                assert!(
                    !spelling(&result.text, pair.target).trim().is_empty(),
                    "{language}"
                );
            }
        }
    }
}
