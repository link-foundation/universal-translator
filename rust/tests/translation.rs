use universal_translator::{Mode, Translator};
use universal_translator::{rank_interpretations, read_referent_input};

#[test]
fn dependent_referents_keep_uncertainty() {
    let (source, candidates) =
        read_referent_input(include_str!("../../data/translation/referent-input.lino")).unwrap();
    let ranking = rank_interpretations(&source, &candidates, &[]).unwrap();
    assert_eq!(ranking.preferred[0].candidate.id, "white-skin");
    let scores: Vec<_> = ranking
        .candidates
        .iter()
        .map(|ranked| ranked.confidence)
        .collect();
    assert_eq!(scores, [[0.65, 0.65], [0.91, 0.91], [0.0, 0.29]]);
    let prefix = ["person", "white", "painted white"].map(str::to_owned);
    assert_eq!(
        rank_interpretations(&source, &candidates, &prefix)
            .unwrap()
            .preferred[0]
            .candidate
            .id,
        "painted-white"
    );
    assert!(
        rank_interpretations(&source, &candidates, &["plant".into()])
            .unwrap()
            .candidates
            .is_empty()
    );
}

#[test]
fn perl_print_arguments_include_arithmetic_and_trailing_text() {
    let source = include_str!("../../examples/printing/arithmetic.py");
    let translator = Translator::new();
    let meta = translator.to_meta(source, "python").unwrap();
    let output = translator
        .translate(source, "python", "perl", Mode::default())
        .unwrap();
    assert_eq!(
        universal_translator::meta::meaning_difference(
            &meta,
            &translator.to_meta(&output, "perl").unwrap()
        ),
        None
    );
    assert!(output.contains("print((1 + 2) . \"\\n\");"));
}
