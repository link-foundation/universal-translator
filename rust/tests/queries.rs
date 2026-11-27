use universal_translator::formal::query_languages::query_language_ids;
use universal_translator::meta::{Node, same_meaning};
use universal_translator::natural::{check_description, check_text, natural_language_ids};
use universal_translator::translator::languages;
use universal_translator::{Mode, Options, Translator};

const SQL: &str = "SELECT age + 1 FROM people AS person WHERE age >= 18 AND age < 65;";
fn expression(source: &str, from: &str) -> Node {
    Translator::new()
        .to_meta(source, from)
        .unwrap()
        .node("main")
        .unwrap()
        .nodes("statements")[0]
        .node("expression")
        .unwrap()
        .clone()
}

#[test]
fn sql_negation_binds_below_comparisons_and_retains_explicit_groups() {
    let t = Translator::new();
    let q = expression("SELECT age FROM people WHERE NOT age = 18;", "sql");
    let condition = q.node("condition").unwrap();
    assert!(condition.is("Unary"));
    assert_eq!(condition.str("operator"), Some("not"));
    assert_eq!(
        condition.node("operand").unwrap().str("operator"),
        Some("equal")
    );
    let predicates: Vec<String> =
        serde_json::from_str(include_str!("../../examples/queries/negation.json")).unwrap();
    for predicate in predicates {
        let meta = t
            .to_meta(
                &format!("SELECT age FROM people AS p WHERE {predicate};"),
                "sql",
            )
            .unwrap();
        for target in [
            "sql",
            "python",
            "javascript",
            "typescript",
            "csharp",
            "english",
            "russian",
        ] {
            let written = t
                .from_meta(&meta, target, None, Mode::ContextDependent)
                .unwrap();
            assert!(
                same_meaning(&meta, &t.to_meta(&written, target).unwrap()),
                "{target}: {predicate}: {written}"
            );
        }
    }
}

#[test]
fn query_capabilities_and_detection_are_explicit() {
    assert_eq!(query_language_ids(), ["sql"]);
    assert!(languages().iter().find(|l| l.id == "sql").unwrap().query);
    let t = Translator::new();
    assert_eq!(t.detect_language(SQL, 3)[0].id, "sql");
    assert!(
        t.translate("print(1)", "python", "sql", Mode::ContextDependent)
            .unwrap_err()
            .message
            .contains("selection queries")
    );
    assert!(
        t.translate_with(
            SQL,
            "sql",
            "sql",
            Options {
                common_library: true,
                ..Options::default()
            }
        )
        .unwrap_err()
        .message
        .contains("no common library")
    );
}

#[test]
fn scoped_predicates_and_projections_round_trip_four_formal_grammars() {
    let t = Translator::new();
    let meta = t.to_meta(SQL, "sql").unwrap();
    let q = expression(SQL, "sql");
    assert!(q.is("Query"));
    assert_eq!(q.str("variable"), Some("person"));
    assert!(
        q.node("projection")
            .unwrap()
            .node("left")
            .unwrap()
            .is("Index")
    );
    for language in ["sql", "python", "javascript", "typescript", "csharp"] {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        let read = t.to_meta(&written, language).unwrap();
        assert!(same_meaning(&meta, &read), "{language}: {written}");
    }
}

#[test]
fn linq_comprehensions_and_filter_map_chains_keep_strategy_and_scope() {
    for (language, source) in [
        (
            "csharp",
            "(from person in people where person[\"age\"] >= 18 select person[\"age\"] + 1).ToArray();",
        ),
        (
            "python",
            "[person[\"age\"] + 1 for person in people if person[\"age\"] >= 18]",
        ),
        (
            "javascript",
            "people.filter(p => p.age >= 18).map(person => person.age + 1);",
        ),
    ] {
        let q = expression(source, language);
        assert!(q.is("Query"), "{language}: {q:?}");
        assert_eq!(q.flag("eager"), Some(true));
        assert_eq!(q.node("source").unwrap().str("name"), Some("people"));
    }
    assert_eq!(
        expression("from person in people select person.Name;", "csharp").flag("eager"),
        Some(false)
    );
    assert_eq!(
        expression("(person for person in people)", "python").flag("eager"),
        Some(false)
    );
}

#[test]
fn query_questions_and_answers_compose_through_every_natural_standard() {
    let t = Translator::new();
    let meta = t.to_meta(SQL, "sql").unwrap();
    for language in natural_language_ids() {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        assert!(written.trim_end().ends_with('?'), "{language}: {written}");
        assert_eq!(
            check_description(language).unwrap(),
            Vec::<String>::new(),
            "{language}"
        );
        let simple = t
            .translate(
                "SELECT * FROM people;",
                "sql",
                language,
                Mode::ContextDependent,
            )
            .unwrap();
        assert_eq!(
            check_text(&simple, language).unwrap(),
            Vec::<String>::new(),
            "{language}: {simple}"
        );
        let read = t
            .to_meta(&written, language)
            .unwrap_or_else(|e| panic!("{language}: {written}: {e}"));
        assert!(same_meaning(&meta, &read), "{language}: {written}");
    }
}

#[test]
fn sql_quoted_keywords_strings_and_case_are_data() {
    let t = Translator::new();
    let source = "SELECT \"from\" FROM \"MixedCase\" AS item WHERE \"where\" = 'it''s ready';";
    let meta = t.to_meta(source, "sql").unwrap();
    let written = t
        .from_meta(&meta, "sql", None, Mode::ContextDependent)
        .unwrap();
    assert!(written.contains("\"MixedCase\""), "{written}");
    assert!(written.contains("'it''s ready'"), "{written}");
    assert!(same_meaning(&meta, &t.to_meta(&written, "sql").unwrap()));
    assert!(
        expression("SELECT \"true\" FROM people;", "sql")
            .node("projection")
            .unwrap()
            .is("Index")
    );
    assert!(t.to_meta("SELECT NULL FROM people;", "sql").is_err());
}

#[test]
fn query_results_are_collections_and_range_variables_have_local_types() {
    let t = Translator::new();
    let source = "p = 3.5\nvalues = [p + 1 for p in [1, 2]]";
    let meta = t.to_meta(source, "python").unwrap();
    let statements = meta.node("main").unwrap().nodes("statements");
    assert_eq!(statements[1].str("type"), Some("array<integer>"));
    assert_eq!(
        statements[1]
            .node("value")
            .unwrap()
            .node("projection")
            .unwrap()
            .node("left")
            .unwrap()
            .str("type"),
        Some("integer")
    );
    let written = t
        .from_meta(&meta, "csharp", None, Mode::ContextDependent)
        .unwrap();
    assert!(
        written
            .contains("var values = (from pQuery2 in new[] {1, 2} select pQuery2 + 1).ToArray()"),
        "{written}"
    );
    for (expression, kind) in [
        ("[p + 1 for p in [1, 2]]", "int[]"),
        (
            "(p + 1 for p in [1, 2])",
            "System.Collections.Generic.IEnumerable<int>",
        ),
        ("[\"ready\" for p in [1, 2]]", "string[]"),
    ] {
        let written = t
            .translate(
                &format!("def values():\n    return {expression}"),
                "python",
                "csharp",
                Mode::ContextDependent,
            )
            .unwrap();
        assert!(
            written.contains(&format!("static {kind} Values()")),
            "{written}"
        );
        assert!(
            t.to_meta(&written, "csharp").unwrap().nodes("functions")[0]
                .node("body")
                .unwrap()
                .nodes("statements")[0]
                .node("value")
                .unwrap()
                .is("Query")
        );
    }
    let written = t
        .translate(
            "[[p.age for p in p.children] for p in people]",
            "python",
            "csharp",
            Mode::ContextDependent,
        )
        .unwrap();
    assert!(
        written.contains(
            "from pQuery2_ in people select (from pQuery2 in pQuery2_[\"children\"] select pQuery2[\"age\"]"
        ),
        "{written}"
    );
    let method = t
        .translate(
            "p = 1\nvalues = [p.compute() for p in people]",
            "python",
            "csharp",
            Mode::ContextDependent,
        )
        .unwrap();
    assert!(
        method.contains("from pQuery2 in people select pQuery2.compute()"),
        "{method}"
    );
    let source_collision = t
        .translate(
            "SELECT * FROM row;",
            "sql",
            "csharp",
            Mode::ContextDependent,
        )
        .unwrap();
    assert!(
        source_collision.contains("from rowQuery2 in row select rowQuery2"),
        "{source_collision}"
    );
}

#[test]
fn deferred_queries_and_unsupported_targets_are_explicit() {
    let t = Translator::new();
    let meta = t
        .to_meta("(person for person in people)", "python")
        .unwrap();
    for language in natural_language_ids()
        .into_iter()
        .chain(["python", "csharp"])
    {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        assert!(
            same_meaning(&meta, &t.to_meta(&written, language).unwrap()),
            "{language}: {written}"
        );
    }
    assert!(
        t.from_meta(&meta, "sql", None, Mode::ContextDependent)
            .unwrap_err()
            .message
            .contains("deferred iterator")
    );
    assert!(
        t.translate(SQL, "sql", "javascript@es5", Mode::ContextDependent)
            .unwrap_err()
            .message
            .contains("ECMAScript 2015")
    );
    assert!(
        expression(
            "people.filter(p => keep(p)).map(p => project(p));",
            "javascript"
        )
        .node("source")
        .unwrap()
        .is("Query")
    );
    let meta = t
        .to_meta(
            "Let values be the values of person for each person in people where true.",
            "english",
        )
        .unwrap();
    assert!(
        meta.node("main").unwrap().nodes("statements")[0]
            .node("value")
            .unwrap()
            .is("Query")
    );
}
