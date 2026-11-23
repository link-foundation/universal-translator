use meta_language::{LinkNetwork, LinkType};
use universal_translator::SourceDocument;

#[test]
fn preserves_line_endings_bom_blank_lines_and_final_text() {
    for source in ["", "\n", "\u{feff}a\r\n\r\n# 🦀\0\t", "a\n🦀\n"] {
        let document = SourceDocument {
            language: "Language outside the effect catalog".into(),
            source: source.into(),
        };
        let notation = document.to_links_notation().unwrap();
        assert_eq!(
            SourceDocument::from_links_notation(&notation).unwrap(),
            document
        );
    }
}

#[test]
fn rejects_malformed_records_and_line_boundaries() {
    for notation in [
        "",
        "(source-document: (line: missing-language))",
        "(source-document: (language: Rust) (line: abc) (line: def))",
        "(source-document: (language: Rust))\n(source-document: (language: Rust))",
    ] {
        assert!(SourceDocument::from_links_notation(notation).is_err());
    }
}

#[test]
fn grammar_network_preserves_structure_and_source() {
    for (language, source, syntax) in [
        (
            "JavaScript",
            "\u{feff}// 🐍\r\nconst value = 1;\r\n",
            "lexical_declaration",
        ),
        ("Rust", "fn main() { /* 🦀 */ }\n", "function_item"),
        (
            "Python",
            "# 🐍\ndef greet():\r\n    return 'hi'\t",
            "function_definition",
        ),
        (
            "C",
            include_str!("../../examples/translation/hello.c"),
            "function_definition",
        ),
        (
            "C#",
            include_str!("../../examples/translation/hello.cs"),
            "class_declaration",
        ),
        ("sql-sqlite", "  SELECT 1; -- comment\n", "statement"),
        ("rust", "", "source_file"),
    ] {
        let document = SourceDocument {
            language: language.into(),
            source: source.into(),
        };
        let notation = document.syntax_network().unwrap().to_lino();
        let network = LinkNetwork::from_lino(&notation).unwrap();
        assert!(
            network.links().any(|link| {
                link.metadata().link_type() == Some(LinkType::Syntax)
                    && link.metadata().term() == Some(syntax)
            }),
            "{language} CST lacks {syntax}"
        );
        assert_eq!(network.to_lino(), notation);
        assert_eq!(
            SourceDocument::from_syntax_notation(&notation).unwrap(),
            document
        );
    }
}

#[test]
fn ranked_language_grammars_round_trip_programs() {
    for (language, source) in [
        ("Python", "print('Hello')\n"),
        ("C", include_str!("../../examples/translation/hello.c")),
        (
            "Java",
            "class Hello { public static void main(String[] args) {} }\n",
        ),
        ("C++", "int main() { return 0; }\n"),
        ("C#", include_str!("../../examples/translation/hello.cs")),
        ("JavaScript", "console.log('Hello');\n"),
        ("R", "print('Hello')\n"),
        ("sql-ansi", "SELECT 1;\n"),
        (
            "Visual Basic",
            "Module Main\n    Sub Hello()\n    End Sub\nEnd Module\n",
        ),
        ("Go", "package main\nfunc main() {}\n"),
        ("Rust", "fn main() {}\n"),
        ("PHP", "<?php echo 'Hello';\n"),
        ("Perl", "print 'Hello';\n"),
        ("MATLAB", "disp('Hello');\n"),
        ("Swift", "print(\"Hello\")\n"),
        ("Delphi/Object Pascal", "program Hello;\nbegin\nend.\n"),
        ("Dart", "void main() {}\n"),
        ("Ruby", "puts 'Hello'\n"),
        ("Lua", "print('Hello')\n"),
        ("Kotlin", "fun main() {}\n"),
        ("OCaml", "let () = print_endline \"Hello\"\n"),
        (
            "Scala",
            "object Hello { def main(args: Array[String]): Unit = () }\n",
        ),
        ("Haskell", "main = putStrLn \"Hello\"\n"),
        ("TypeScript", "const greeting: string = 'Hello';\n"),
        ("Solidity", "contract Hello {}\n"),
    ] {
        let document = SourceDocument {
            language: language.into(),
            source: source.into(),
        };
        let network = document
            .syntax_network()
            .unwrap_or_else(|error| panic!("{language}: {error}"));
        assert!(
            !network.links().any(|link| {
                link.metadata().link_type() == Some(LinkType::Syntax)
                    && link.metadata().flags().has_error()
            }),
            "{language} CST contains a parse error"
        );
        assert_eq!(
            SourceDocument::from_syntax_notation(&network.to_lino()).unwrap(),
            document
        );
    }
}

#[test]
fn grammar_network_rejects_unsupported_language_and_non_cst_documents() {
    let document = SourceDocument {
        language: "Nonexistent grammar".into(),
        source: "(text)".into(),
    };
    assert!(document.syntax_network().is_err());
    assert!(SourceDocument::from_syntax_notation(&document.to_links_notation().unwrap()).is_err());
    let backwards_span = "(1: (meta: (t: document) (span: 4 3 0 0 0 0)))";
    assert!(SourceDocument::from_syntax_notation(backwards_span).is_err());
    let overflowing_id = "(18446744073709551615: (meta: (t: document)))";
    assert!(SourceDocument::from_syntax_notation(overflowing_id).is_err());
}

#[test]
#[ignore = "streams the pinned archive from examples/translation/verify-corpus.py"]
fn verify_source_corpus() {
    use std::io::{self, BufRead, Read};

    let mut input = io::stdin().lock();
    let mut verified = 0;
    while !input.fill_buf().unwrap().is_empty() {
        let mut header = [0; 8];
        input.read_exact(&mut header).unwrap();
        let path_length = u32::from_le_bytes(header[..4].try_into().unwrap()) as usize;
        let source_length = u32::from_le_bytes(header[4..].try_into().unwrap()) as usize;
        let mut path = vec![0; path_length];
        input.read_exact(&mut path).unwrap();
        let path = String::from_utf8(path).unwrap();
        let mut source = vec![0; source_length];
        input.read_exact(&mut source).unwrap();
        let document = SourceDocument {
            language: path
                .split_once('/')
                .and_then(|(_, path)| path.rsplit_once('/'))
                .expect("expected corpus path with language")
                .0
                .into(),
            source: String::from_utf8(source).unwrap(),
        };
        let notation = document.to_links_notation().unwrap();
        let restored = SourceDocument::from_links_notation(&notation)
            .unwrap_or_else(|error| panic!("{path}: {error}"));
        assert_eq!(restored, document, "{path}");
        verified += 1;
    }
    assert!(
        verified > 0,
        "Expected pinned corpus data on standard input"
    );
    println!("Rust verified {verified} source documents");
}
