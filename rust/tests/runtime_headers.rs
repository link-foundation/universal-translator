use universal_translator::formal::{
    languages::language_syntax, lexer::tokenize, parser::parse_program,
};
use universal_translator::meta::meaning_difference;
use universal_translator::{Mode, Options, Translator, reconstruct_concrete};

#[test]
fn token_equivalent_rocq_runtime_headers_keep_layout_comments_and_real_line_numbers() {
    let translator = Translator::new();
    let python = "n = 2\nprint(n)\n";
    let expected = translator.to_meta(python, "python").unwrap();
    let canonical = translator
        .translate(python, "python", "rocq", Mode::default())
        .unwrap();
    let syntax = language_syntax("rocq").unwrap();
    let variants = [
        canonical.clone(),
        format!("\r\n{canonical}"),
        canonical.replace('\n', "\r\n"),
        canonical.replace('\n', "\n\n"),
        canonical.replace("From Stdlib", "From\tStdlib"),
        canonical.replace(
            "Import ListNotations.",
            "(* number 😀 *)\nImport ListNotations.",
        ),
    ];
    for source in variants {
        let actual = translator.to_meta(&source, "rocq").unwrap();
        assert_eq!(meaning_difference(&expected, &actual), None);
        let concrete = parse_program(&source, &syntax).unwrap();
        assert_eq!(
            reconstruct_concrete(concrete.node("syntax").unwrap()).unwrap(),
            source
        );
        let tokens = tokenize(&source, &syntax).unwrap();
        let print = tokens
            .iter()
            .find(|token| token.value == "print_line")
            .unwrap();
        let start = print.raw_span.unwrap().0;
        assert_eq!(
            print.line,
            1 + source.chars().take(start).filter(|c| *c == '\n').count()
        );
        let partial = translator
            .translate_partial(
                &source,
                "rocq",
                "rocq",
                Options {
                    comment_from: Some("english"),
                    comment_language: Some("russian"),
                    ..Options::default()
                },
                false,
            )
            .unwrap();
        assert!(partial.complete);
        assert_eq!(partial.text, source.replace("number 😀", "число 😀"));
    }
}

#[test]
fn changed_rocq_runtime_tokens_and_literal_values_are_not_discarded() {
    let translator = Translator::new();
    let canonical = translator
        .translate("print(2)\n", "python", "rocq", Mode::default())
        .unwrap();
    let syntax = language_syntax("rocq").unwrap();
    let header = syntax.header.unwrap().trim_end();
    for source in [
        canonical.replace("From Stdlib", "FromStdlib"),
        canonical.replace("ascii_of_nat 10", "ascii_of_nat 13"),
        canonical.replace("\"true\"", "\" true \""),
        header[..header.len() - 1].to_owned(),
    ] {
        assert!(translator.to_meta(&source, "rocq").is_err());
    }
}

#[test]
fn php_output_whitespace_outside_tags_keeps_its_runtime_effect() {
    let translator = Translator::new();
    for (source, expected) in [
        ("<?php\u{a0}echo \"ok\";", "<?php\u{a0}echo \"ok\";"),
        (r#"<?phpecho "ok";"#, r#"<?phpecho "ok";"#),
        ("<?php\x0cecho \"ok\";", "<?php\x0cecho \"ok\";"),
        ("\r\n<?php\r\necho \"ok\\n\";\r\n", "\r\nok\n"),
        (" \t<?PHP echo \"ok\"; ?>\r\n\r\n", " \tok\r\n"),
        ("<?php echo \"ok\"; ?> \n", "ok \n"),
        ("<?php echo \"ok\"; ?>\n", "ok"),
        ("<?php echo \"ok\"; ?>\r", "ok"),
        (
            "\r\n<?php\r\n// number\r\necho \"😀\";\r\n?>\r\n\t",
            "\r\n😀\t",
        ),
    ] {
        let meta = translator.to_meta(source, "php").unwrap();
        let mut printed = String::new();
        for statement in meta.node("main").unwrap().nodes("statements") {
            if statement.is("Print") {
                printed.push_str(statement.node("value").unwrap().str("value").unwrap());
                if statement.flag("newline").unwrap_or(false) {
                    printed.push('\n');
                }
            }
        }
        assert_eq!(printed, expected);
        let python = translator
            .translate(source, "php", "python", Mode::default())
            .unwrap();
        assert_eq!(
            meaning_difference(&meta, &translator.to_meta(&python, "python").unwrap()),
            None
        );
        let concrete = parse_program(source, &language_syntax("php").unwrap()).unwrap();
        assert_eq!(
            reconstruct_concrete(concrete.node("syntax").unwrap()).unwrap(),
            source
        );
        let partial = translator
            .translate_partial(
                source,
                "php",
                "php",
                Options {
                    comment_from: Some("english"),
                    comment_language: Some("russian"),
                    ..Options::default()
                },
                false,
            )
            .unwrap();
        assert!(partial.complete);
        assert_eq!(partial.text, source.replace("number", "число"));
    }
}

#[test]
fn php_markup_mode_switches_and_short_echoes_retain_scope_and_concrete_source() {
    let translator = Translator::new();
    let cases: Vec<(String, String)> = serde_json::from_str(include_str!(
        "../../examples/runtime-headers/php-modes.json"
    ))
    .unwrap();
    let syntax = language_syntax("php").unwrap();
    for (source, _) in cases {
        let meta = translator.to_meta(&source, "php").unwrap();
        let python = translator
            .translate(&source, "php", "python", Mode::default())
            .unwrap();
        assert_eq!(
            meaning_difference(&meta, &translator.to_meta(&python, "python").unwrap()),
            None
        );
        let concrete = parse_program(&source, &syntax).unwrap();
        assert_eq!(
            reconstruct_concrete(concrete.node("syntax").unwrap()).unwrap(),
            source
        );
        let partial = translator
            .translate_partial(
                &source,
                "php",
                "php",
                Options {
                    comment_from: Some("english"),
                    comment_language: Some("russian"),
                    ..Options::default()
                },
                false,
            )
            .unwrap();
        assert!(partial.complete);
        assert_eq!(
            partial.text,
            source
                .replace("// number ?>", "// число ?>")
                .replace("# number ?>", "# число ?>")
                .replace("/* ?> number */", "/* ?> число */")
        );
        for token in tokenize(&source, &syntax).unwrap() {
            if let Some((start, _)) = token.raw_span {
                assert_eq!(
                    token.line,
                    1 + source.chars().take(start).filter(|c| *c == '\n').count()
                );
            }
        }
    }
}

#[test]
fn tagless_php_snippets_keep_code_mode_even_when_strings_contain_tag_text() {
    let translator = Translator::new();
    for source in [
        r#"echo "<?php ?>";"#,
        r#"echo "<?= 2 ?>";"#,
        "$x = 2; echo $x;",
    ] {
        let meta = translator.to_meta(source, "php").unwrap();
        let document = translator
            .to_meta(&format!("<?php {source}"), "php")
            .unwrap();
        assert_eq!(meaning_difference(&meta, &document), None);
    }
}

#[test]
fn emitted_php_comments_with_close_tags_retain_code_mode() {
    let translator = Translator::new();
    for comment in ["?> number", "*/ ?> number", "first ?>\nsecond */"] {
        let comments: Vec<_> = comment
            .split('\n')
            .map(|line| format!("# {line}"))
            .collect();
        let source = format!("{}\nprint(\"ok\")\n", comments.join("\n"));
        let php = translator
            .translate(&source, "python", "php", Mode::default())
            .unwrap();
        assert!(php.contains("/* "));
        assert!(!php.contains("// ?>"));
        assert_eq!(
            meaning_difference(
                &translator.to_meta(&source, "python").unwrap(),
                &translator.to_meta(&php, "php").unwrap()
            ),
            None
        );
    }
}

#[test]
fn php_markup_and_code_retain_distinct_utf8_output_regions() {
    let translator = Translator::new();
    let source = "<b>😀</b><?php echo \"ok\" ?>\r\n<footer>end</footer>";
    let result = translator
        .translate_partial(
            source,
            "php",
            "python",
            Options {
                layout: universal_translator::TextLayout::Target,
                ..Options::default()
            },
            false,
        )
        .unwrap();
    assert!(result.complete);
    assert_eq!(result.line_map, [(0, 0), (0, 1), (1, 2)]);
    for markup in ["<b>😀</b>", "<footer>end</footer>"] {
        assert!(
            result
                .region_map
                .iter()
                .any(|pair| &source[pair.source.start..pair.source.end] == markup
                    && result.text[pair.target.start..pair.target.end].contains(markup))
        );
    }
}
