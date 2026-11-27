use universal_translator::formal::{languages::language_syntax, lexer::tokenize, parser::parse_program};
use universal_translator::meta::meaning_difference;
use universal_translator::{Mode, Options, Translator, reconstruct_concrete};

#[test]
fn token_equivalent_rocq_runtime_headers_keep_layout_comments_and_real_line_numbers() {
    let translator = Translator::new();
    let python = "n = 2\nprint(n)\n";
    let expected = translator.to_meta(python, "python").unwrap();
    let canonical = translator.translate(python, "python", "rocq", Mode::default()).unwrap();
    let syntax = language_syntax("rocq").unwrap();
    let variants = [
        canonical.clone(),
        format!("\r\n{canonical}"),
        canonical.replace('\n', "\r\n"),
        canonical.replace('\n', "\n\n"),
        canonical.replace("From Stdlib", "From\tStdlib"),
        canonical.replace("Import ListNotations.", "(* number 😀 *)\nImport ListNotations."),
    ];
    for source in variants {
        let actual = translator.to_meta(&source, "rocq").unwrap();
        assert_eq!(meaning_difference(&expected, &actual), None);
        let concrete = parse_program(&source, &syntax).unwrap();
        assert_eq!(reconstruct_concrete(concrete.node("syntax").unwrap()).unwrap(), source);
        let tokens = tokenize(&source, &syntax).unwrap();
        let print = tokens.iter().find(|token| token.value == "print_line").unwrap();
        let start = print.raw_span.unwrap().0;
        assert_eq!(print.line, 1 + source.chars().take(start).filter(|c| *c == '\n').count());
        let partial = translator.translate_partial(&source, "rocq", "rocq", Options {
            comment_from: Some("english"), comment_language: Some("russian"), ..Options::default()
        }, false).unwrap();
        assert!(partial.complete);
        assert_eq!(partial.text, source.replace("number 😀", "число 😀"));
    }
}

#[test]
fn changed_rocq_runtime_tokens_and_literal_values_are_not_discarded() {
    let translator = Translator::new();
    let canonical = translator.translate("print(2)\n", "python", "rocq", Mode::default()).unwrap();
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
