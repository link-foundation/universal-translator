use universal_translator::formal::{languages::language_syntax, parser::parse_program};
use universal_translator::reconstruct_concrete;

#[test]
fn concrete_tokens_partition_every_source_byte() {
    let cases = [
        (
            "javascript",
            "\t// Привет 😀\r\n\r\nconst x = `a\n b`; // fin\r\n",
        ),
        ("python", "# note\n\ndef f(x):\n\treturn \"é\"  # tail\n\n"),
        (
            "cpp",
            "#include <string>\nint main() { /* x\ny */ return 0; }\n",
        ),
        ("php", "<?php\n\n$x = \"é\";\n?>\n"),
    ];
    for (language, source) in cases {
        let tree = parse_program(source, &language_syntax(language).unwrap()).unwrap();
        let syntax = tree.node("syntax").unwrap();
        assert_eq!(reconstruct_concrete(syntax).unwrap(), source);
        assert_eq!(syntax.str("unit"), Some("utf8"));
        let mut end = 0;
        for child in syntax.nodes("children") {
            assert_eq!(child.number("start"), Some(end as f64));
            end += child.str("text").unwrap().len();
            assert_eq!(child.number("end"), Some(end as f64));
        }
        assert_eq!(end, source.len());
        assert!(!syntax.nodes("productions").is_empty());
        for production in syntax.nodes("productions") {
            assert!(production.number("start").unwrap() >= 0.0);
            assert!(production.number("end").unwrap() <= end as f64);
        }
    }
}

#[test]
fn reconstruction_requires_a_concrete_tree() {
    assert!(reconstruct_concrete(&universal_translator::meta::Node::new("Program")).is_err());
}
