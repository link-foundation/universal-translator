//! Brace placement and indent width. The JavaScript twin is
//! js/tests/style.test.js.

use universal_translator::{Braces, Indent, Options, Style, Translator};

const SIGN: &str =
    "function sign(a) {\n  if (a > 0) {\n    return 1;\n  } else {\n    return 0;\n  }\n}\n";

fn options(braces: Option<Braces>, indent: Option<Indent>) -> Options {
    Options {
        style: Style { braces, indent },
        ..Options::default()
    }
}

#[test]
fn puts_each_opening_brace_of_csharp_on_a_line_of_its_own() {
    let translation = Translator::new()
        .translate_partial(
            SIGN,
            "javascript",
            "csharp",
            options(Some(Braces::NextLine), None),
            false,
        )
        .unwrap();
    assert!(
        translation.text.contains(
            &[
                "    static int Sign(int a)",
                "    {",
                "        if (a > 0)",
                "        {",
                "            return 1;",
                "        }",
                "        else",
                "        {",
                "            return 0;",
                "        }",
                "    }",
            ]
            .join("\n")
        )
    );
    let lines: Vec<&str> = translation.text.split('\n').collect();
    let sources: Vec<&str> = SIGN.split('\n').collect();
    let mapped: Vec<(&str, &str)> = translation
        .line_map
        .iter()
        .map(|&(source, target)| (sources[source], lines[target]))
        .collect();
    assert_eq!(
        mapped,
        vec![
            ("function sign(a) {", "    static int Sign(int a)"),
            ("  if (a > 0) {", "        if (a > 0)"),
            ("    return 1;", "            return 1;"),
            ("  } else {", "        }"),
            ("    return 0;", "            return 0;"),
            ("  }", "        }"),
            ("}", "    }"),
        ]
    );
}

#[test]
fn indents_javascript_by_two_spaces_and_rust_by_a_tab() {
    let translator = Translator::new();
    let wide = SIGN.replace("  ", "    ");
    let two = translator
        .translate_partial(
            &wide,
            "javascript",
            "javascript",
            options(None, Some(Indent::Spaces(2))),
            false,
        )
        .unwrap();
    assert_eq!(two.text, SIGN);
    let tab = translator
        .translate_with(SIGN, "javascript", "rust", options(None, Some(Indent::Tab)))
        .unwrap();
    assert_eq!(
        tab,
        "fn sign(a: i64) -> i64 {\n\tif a > 0 {\n\t\treturn 1;\n\t} else {\n\t\treturn 0;\n\t}\n}\n\nfn main() {\n}\n"
    );
}

#[test]
fn indents_blocks_without_braces_and_leaves_their_lines_alone() {
    let python = Translator::new()
        .translate_partial(
            SIGN,
            "javascript",
            "python",
            options(Some(Braces::NextLine), Some(Indent::Spaces(3))),
            false,
        )
        .unwrap();
    assert_eq!(
        python.text,
        "def sign(a):\n   if a > 0:\n      return 1\n   else:\n      return 0\n"
    );
}

#[test]
fn rejects_styles_a_language_cannot_be_written_in() {
    let error = Translator::new()
        .translate_partial(
            SIGN,
            "javascript",
            "go",
            options(Some(Braces::NextLine), None),
            false,
        )
        .err()
        .unwrap();
    assert_eq!(
        error.to_string(),
        "Go needs the opening brace on the line of its statement"
    );
    assert_eq!(
        "below".parse::<Braces>().err().unwrap(),
        r#"Unsupported brace style "below": same-line or next-line"#
    );
    assert_eq!(
        "0".parse::<Indent>().err().unwrap(),
        r#"Unsupported indent "0": a number of spaces from 1 to 16 or "tab""#
    );
    assert_eq!("16".parse::<Indent>(), Ok(Indent::Spaces(16)));
    assert!("+2".parse::<Indent>().is_err());
}
