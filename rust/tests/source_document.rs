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
            language: path.split('/').nth(1).unwrap().into(),
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
