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
