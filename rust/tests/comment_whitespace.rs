use universal_translator::formal::languages::language_syntax;
use universal_translator::natural::natural_language_ids;
use universal_translator::translator::{language_ids, machine_target_ids};
use universal_translator::{Mode, Options, Translator, translate_comments};

fn options() -> Options {
    Options {
        comment_from: Some("english"),
        comment_language: Some("russian"),
        ..Options::default()
    }
}

#[test]
fn changing_comment_words_keeps_every_reader_familys_other_bytes() {
    let translator = Translator::new()
        .with_comment_translator(|text, _, _| Ok(text.replace("spaceprobe", "пробел")));
    for language in language_ids()
        .into_iter()
        .chain(machine_target_ids())
        .chain(natural_language_ids())
    {
        let canonical = translator
            .translate(
                "# spaceprobe\n\nn = 1\n# spaceprobe\nprint(n)\n",
                "python",
                language,
                Mode::ContextDependent,
            )
            .unwrap();
        let source = format!("\r\n{}\r\n", canonical.replace('\n', "\r\n"));
        assert_eq!(
            translator
                .translate_with(&source, language, language, options())
                .unwrap(),
            source.replace("spaceprobe", "пробел"),
            "{language}"
        );
        assert_eq!(
            translator
                .translate_comments(&source, language, Some("english"), "russian")
                .unwrap(),
            source.replace("spaceprobe", "пробел"),
            "{language}"
        );
    }
}

#[test]
fn partial_translations_through_every_reader_family_retain_the_source_layout() {
    let translator = Translator::new()
        .with_comment_translator(|text, _, _| Ok(text.replace("spaceprobe", "пробел")));
    for language in language_ids()
        .into_iter()
        .chain(natural_language_ids())
        .chain(machine_target_ids())
    {
        let canonical = translator
            .translate(
                "# spaceprobe\n\nprint(2)\n",
                "python",
                language,
                Mode::ContextDependent,
            )
            .unwrap();
        let header = if natural_language_ids().contains(&language) {
            ""
        } else {
            language_syntax(language).unwrap().header.unwrap_or("")
        };
        let source = format!(
            "{header}\r\n{}\r\n",
            canonical[header.len()..].replace('\n', "\r\n")
        );
        let result = translator
            .translate_partial(&source, language, language, options(), false)
            .unwrap();
        assert!(result.complete, "{language}");
        assert_eq!(
            result.text,
            source.replace("spaceprobe", "пробел"),
            "{language}"
        );
    }
}

#[test]
fn note_like_lines_inside_multiline_natural_literals_are_not_comments() {
    let source = "\r\nNote:\t number  \r\n\r\nWrite “first\nNote: number\nlast” and end the line.\r\nNote: sequence  \r\n";
    let expected = source
        .replace("Note:\t number", "Note:\t число")
        .replace("Note: sequence", "Note: последовательность");
    let translator = Translator::new();
    assert_eq!(
        translator
            .translate_with(source, "english", "english", options())
            .unwrap(),
        expected
    );
    let meta = translator.to_meta(&expected, "english").unwrap();
    let printed = meta
        .node("main")
        .unwrap()
        .nodes("statements")
        .into_iter()
        .find_map(|statement| statement.node("value"))
        .unwrap();
    assert_eq!(printed.str("value"), Some("first\nNote: number\nlast"));
}

#[test]
fn machine_strings_unicode_offsets_and_nested_comments_are_preserved() {
    let cases = [
        (
            "nasm",
            "\r\nlabel: db \"😀; number\", 0\t; number  \r\n",
            "\r\nlabel: db \"😀; number\", 0\t; число  \r\n",
        ),
        (
            "gas",
            ".asciz \"😀# number\" /* number */\t# sequence\r\n",
            ".asciz \"😀# number\" /* число */\t# последовательность\r\n",
        ),
        (
            "arm64",
            ".asciz \"😀// number\"\t// number\r\n",
            ".asciz \"😀// number\"\t// число\r\n",
        ),
        (
            "cil",
            ".method public void 'number//name'() { ldstr \"😀// number\" } // number\r\n",
            ".method public void 'number//name'() { ldstr \"😀// number\" } // число\r\n",
        ),
        (
            "jvm",
            "ldc \"😀; number\"\t; number\r\n",
            "ldc \"😀; number\"\t; число\r\n",
        ),
        (
            "llvm",
            "@x = constant [5 x i8] c\"; number\" ; number\r\n",
            "@x = constant [5 x i8] c\"; number\" ; число\r\n",
        ),
        (
            "wat",
            "(module (; number (; sequence ;) number ;) (data \"😀;; number\") ;; sequence\r\n)\r\n",
            "(module (; число (; последовательность ;) число ;) (data \"😀;; number\") ;; последовательность\r\n)\r\n",
        ),
    ];
    for (language, source, expected) in cases {
        assert_eq!(
            translate_comments(source, language, Some("english"), "russian").unwrap(),
            expected,
            "{language}"
        );
    }
    for (language, source) in [
        ("wat", "(;"),
        ("wat", "(; number (; sequence ;)"),
        ("cil", "/* number"),
    ] {
        assert!(
            translate_comments(source, language, Some("english"), "russian")
                .unwrap_err()
                .message
                .contains("Unterminated comment")
        );
    }
}

#[test]
fn sql_query_comments_and_whitespace_are_kept_in_place() {
    let source = "\r\n-- number\r\n\r\nSELECT age FROM people AS person; -- sequence\r\n\r\n";
    let expected = source
        .replace("number", "число")
        .replace("sequence", "последовательность");
    let result = Translator::new()
        .translate_partial(source, "sql", "sql", options(), false)
        .unwrap();
    assert_eq!(result.text, expected);
}
