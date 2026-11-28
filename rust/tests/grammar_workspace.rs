use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use universal_translator::grammar_workspace::{
    FeatureParseOptions, GrammarHooks, GrammarReader, GrammarSource, GrammarWorkspace, SyntaxTree,
    source_node,
};
use universal_translator::meta::{GrammarError, Node};
use universal_translator::{Mode, Translator, reconstruct_concrete};

fn descriptor(id: &str, source: &str) -> GrammarSource {
    let mut source = GrammarSource::new(id, "toy", "ebnf", source);
    source.revision = Some("v1".into());
    source
}

fn parse(
    workspace: &GrammarWorkspace,
    source: &str,
    id: Option<&str>,
) -> universal_translator::grammar_workspace::GrammarReading {
    workspace
        .parse(source, "toy", "", id, FeatureParseOptions::default())
        .unwrap()
}

#[test]
fn all_import_formats_produce_executable_lossless_concrete_trees() {
    let fixtures: Vec<serde_json::Value> =
        serde_json::from_str(include_str!("../../data/grammar-interchange.json")).unwrap();
    assert_eq!(
        fixtures.len(),
        meta_language::grammar::interchange::GRAMMAR_IMPORT_FORMATS.len()
    );
    for fixture in fixtures {
        let mut workspace = GrammarWorkspace::new();
        let mut source = descriptor("one", fixture["source"].as_str().unwrap());
        source.format = fixture["format"].as_str().unwrap().into();
        workspace.import(source).unwrap();
        let result = parse(&workspace, "hello мир", None);
        assert!(
            result.outcome.ok,
            "{}: {:?}",
            fixture["format"], result.outcome.rejection
        );
        assert_eq!(reconstruct_concrete(&result.syntax).unwrap(), "hello мир");
        assert_eq!(result.syntax.number("end"), Some(12.0));
        assert!(!result.syntax.nodes("productions").is_empty());
        assert_eq!(
            result.syntax.nodes("grammar")[0].str("revision"),
            Some("v1")
        );
        assert!(!parse(&workspace, "bye мир", None).outcome.ok);
        let converted = workspace.export("native", "toy", "", None).unwrap();
        let mut copy = GrammarWorkspace::new();
        let original = copy
            .import(GrammarSource::new("copy", "toy", "native", &converted))
            .unwrap()
            .grammar
            .clone()
            .unwrap();
        assert!(parse(&copy, "hello мир", None).outcome.ok);
        if fixture["format"] == "antlr" {
            assert!(parse(&copy, "hello мир", Some("copy")).outcome.ok);
            let remerged = copy.merge(&Default::default()).unwrap();
            for production in &remerged.groups[0].source_productions {
                let rule = production.alias.strip_prefix("copy:").unwrap();
                assert_eq!(Some(&production.rule), original.rule(rule));
            }
        }
    }
}

#[test]
fn concrete_trees_preserve_unicode_crlf_trivia_nesting_and_failed_input() {
    let mut workspace = GrammarWorkspace::new();
    workspace.import(GrammarSource::new("one", "toy", "native", "start start\nextra repeat1(class(char(\" \"), char(\"\\r\"), char(\"\\n\")))\nrule start = normal seq(literal(\"hello\"), ref(word))\nrule word = normal literal(\"мир\")\n")).unwrap();
    let source = "hello \r\n мир";
    let reading = parse(&workspace, source, None);
    assert!(reading.outcome.ok);
    assert_eq!(reconstruct_concrete(&reading.syntax).unwrap(), source);
    assert!(
        reading
            .syntax
            .nodes("children")
            .iter()
            .any(|node| node.is("Trivia"))
    );
    assert!(
        reading
            .syntax
            .nodes("productions")
            .iter()
            .any(|node| node.str("rule") == Some("word"))
    );
    let failed = parse(&workspace, "hello ???", None);
    assert!(!failed.outcome.ok);
    assert_eq!(reconstruct_concrete(&failed.syntax).unwrap(), "hello ???");
    assert_eq!(failed.syntax.nodes("errors").len(), 1);
}

#[test]
fn bounded_recovery_preserves_missing_tokens_and_error_leaves() {
    let mut workspace = GrammarWorkspace::new();
    workspace
        .import(descriptor("one", "start = \"hello\", \"!\" ;"))
        .unwrap();
    for source in ["hello", "hello?"] {
        let reading = workspace
            .parse(
                source,
                "toy",
                "",
                None,
                FeatureParseOptions {
                    error_recovery: Some(true),
                    max_repairs: Some(2),
                    ..Default::default()
                },
            )
            .unwrap();
        assert!(!reading.outcome.ok);
        assert_eq!(reading.outcome.rejection.unwrap().reason, "recovered");
        assert_eq!(reconstruct_concrete(&reading.syntax).unwrap(), source);
        assert_eq!(
            reading.syntax.nodes("errors")[0].str("message"),
            Some("missing")
        );
        if source.ends_with('?') {
            assert!(reading.syntax.nodes("children").last().unwrap().is("Error"));
            assert_eq!(reading.syntax.nodes("errors").len(), 2);
        }
    }
}

#[test]
fn subsequent_merges_reuse_prior_identities_without_manual_cache_options() {
    let mut workspace = GrammarWorkspace::new();
    workspace
        .import(descriptor("original", "start = \"hello\" ;"))
        .unwrap();
    let first = workspace.merge(&Default::default()).unwrap();
    assert_eq!(
        workspace.merge(&Default::default()).unwrap().reused,
        ["toy@"]
    );
    workspace
        .import(descriptor("aaa", "earlier = \"hello\" ;"))
        .unwrap();
    let expanded = workspace.merge(&Default::default()).unwrap();
    assert_eq!(
        expanded.groups[0].identities["aaa:earlier"],
        first.groups[0].identities["original:start"]
    );
}

#[test]
fn updates_keep_separate_sources_editions_and_stable_merge_identities() {
    let mut workspace = GrammarWorkspace::new();
    workspace
        .import(descriptor("one", "start = \"hello\" ;"))
        .unwrap();
    workspace
        .import(descriptor("two", "root = \"hello\" ;"))
        .unwrap();
    let first = workspace.merge(&Default::default()).unwrap();
    assert_eq!(first.groups.len(), 1);
    assert_eq!(
        first.groups[0].identities["one:start"],
        first.groups[0].identities["two:root"]
    );
    let options = universal_translator::grammar_workspace::GrammarMergeOptions {
        previous: Some(&first),
        ..Default::default()
    };
    assert_eq!(workspace.merge(&options).unwrap().reused, ["toy@"]);
    workspace
        .update("two", "root = \"bye\" ;", Some("v2".into()))
        .unwrap();
    assert!(parse(&workspace, "bye", Some("two")).outcome.ok);
    assert!(parse(&workspace, "hello", Some("one")).outcome.ok);
    let changed = workspace.merge(&Default::default()).unwrap();
    assert_ne!(
        changed.groups[0].identities["one:start"],
        changed.groups[0].identities["two:root"]
    );
    assert_eq!(workspace.sources()[1].revision.as_deref(), Some("v2"));
    assert!(
        workspace
            .update("two", "broken =", Some("bad".into()))
            .is_err()
    );
    assert!(parse(&workspace, "bye", Some("two")).outcome.ok);
    workspace.remove("two").unwrap();
    assert_eq!(workspace.sources().len(), 1);
    let mut newer = descriptor("new", "start = \"new\" ;");
    newer.edition = "2".into();
    workspace.import(newer).unwrap();
    assert_eq!(
        workspace.merge(&Default::default()).unwrap().groups.len(),
        2
    );
    assert!(
        workspace
            .parse("new", "toy", "2", None, Default::default())
            .unwrap()
            .outcome
            .ok
    );
    assert!(!parse(&workspace, "new", None).outcome.ok);
}

#[test]
fn imports_follow_updated_dependencies_and_parser_limits_are_finite() {
    let mut workspace = GrammarWorkspace::new();
    workspace
        .import(descriptor("words", "word = \"hello\" ;"))
        .unwrap();
    workspace
        .import(GrammarSource::new(
            "main",
            "toy",
            "native",
            "start start\nimport words\nrule start = normal ref(word)\n",
        ))
        .unwrap();
    assert!(parse(&workspace, "hello", Some("main")).outcome.ok);
    workspace
        .update("words", "word = \"bye\" ;", Some("v2".into()))
        .unwrap();
    assert!(parse(&workspace, "bye", Some("main")).outcome.ok);
    assert!(!parse(&workspace, "hello", Some("main")).outcome.ok);
    let limited = workspace
        .parse(
            "bye",
            "toy",
            "",
            Some("main"),
            FeatureParseOptions {
                step_limit: Some(1),
                ..Default::default()
            },
        )
        .unwrap();
    assert!(!limited.outcome.ok);
    assert_eq!(limited.outcome.rejection.unwrap().reason, "stepLimit");
    assert_eq!(reconstruct_concrete(&limited.syntax).unwrap(), "bye");
    assert_eq!(
        limited.syntax.nodes("errors")[0].str("message"),
        Some("stepLimit")
    );
}

#[test]
fn transforms_reapply_to_updates_and_tracing_is_explicit() {
    let seen = Arc::new(Mutex::new(Vec::<String>::new()));
    let log = seen.clone();
    let mut workspace = GrammarWorkspace::new();
    workspace.hooks = GrammarHooks {
        before_import: vec![Arc::new(
            |source, _| Ok(source.replace("GREETING", "hello")),
        )],
        after_import: vec![Arc::new(|grammar, _| {
            meta_language::grammar::merge::rename_grammar_rule(
                &grammar,
                "start",
                "program",
                None,
                &[],
            )
            .map(|result| result.grammar)
            .map_err(|error| GrammarError::new(error.to_string()))
        })],
        before_compile: vec![Arc::new(|grammar, _| Ok(grammar))],
        after_parse: vec![Arc::new(|result, _| Ok(result))],
        before_export: vec![Arc::new(|grammar, _| Ok(grammar))],
        after_export: vec![Arc::new(|source, _| Ok(format!("{source}\n")))],
        trace: Some(Arc::new(move |stage, _| {
            log.lock().unwrap().push(stage.into())
        })),
    };
    workspace
        .import(descriptor("one", "start = \"GREETING\" ;"))
        .unwrap();
    assert!(parse(&workspace, "hello", None).outcome.ok);
    assert!(
        workspace
            .export("ebnf", "toy", "", None)
            .unwrap()
            .contains("program")
    );
    workspace
        .update("one", "start = \"GREETING\" ;", Some("v2".into()))
        .unwrap();
    assert!(parse(&workspace, "hello", None).outcome.ok);
    assert!(workspace.sources()[0].source.contains("GREETING"));
    assert_eq!(
        *seen.lock().unwrap(),
        [
            "beforeImport",
            "afterImport",
            "beforeCompile",
            "afterParse",
            "beforeExport",
            "afterExport",
            "beforeImport",
            "afterImport",
            "beforeCompile",
            "afterParse"
        ]
    );
}

fn say_reader() -> GrammarReader {
    Arc::new(|tree, source| {
        let SyntaxTree::Node { children, .. } = tree else {
            panic!("start production")
        };
        let amount = children
            .iter()
            .find(|child| matches!(child, SyntaxTree::Node { kind, .. } if kind == "amount"))
            .unwrap();
        let number: f64 = source[amount.start()..amount.end()].parse().unwrap();
        let value = source_node(Node::new("Number").with("value", number), amount, source)?;
        let print = source_node(
            Node::new("Print")
                .with("value", value)
                .with("newline", true),
            tree,
            source,
        )?;
        Ok(Node::new("SourceProgram").with("items", vec![print]))
    })
}

#[test]
fn imported_grammar_joins_the_normal_translator_pipeline() {
    let mut workspace = GrammarWorkspace::new();
    workspace
        .import(GrammarSource::new(
            "say",
            "javascript",
            "ebnf",
            "start = \"say \", amount, \".\" ; amount = \"5\" | \"7\" ;",
        ))
        .unwrap();
    let lower = say_reader();
    let reading = workspace.read("say 7.", "javascript", "", &lower).unwrap();
    assert_eq!(
        reconstruct_concrete(reading.node("syntax").unwrap()).unwrap(),
        "say 7."
    );
    assert!(workspace.read("say 8.", "javascript", "", &lower).is_err());
    let invalid: GrammarReader = Arc::new(|_, _| Ok(Node::new("Program")));
    assert!(
        workspace
            .read("say 7.", "javascript", "", &invalid)
            .is_err()
    );
    let workspace = Arc::new(workspace);
    let readers = BTreeMap::from([("javascript".into(), lower)]);
    let translator = Translator::new()
        .decorate_parse(|next| workspace.decorate_parser(next, readers, String::new()));
    assert_eq!(
        translator
            .translate("say 7.", "javascript", "python", Mode::Literal)
            .unwrap(),
        "print(7)\n"
    );
    assert_eq!(
        translator
            .translate("print(5)", "python", "javascript", Mode::Literal)
            .unwrap(),
        "console.log(5);\n"
    );
}

#[test]
fn bad_configuration_lossy_conversion_and_invalid_ranges_are_errors() {
    let mut workspace = GrammarWorkspace::new();
    assert!(
        workspace
            .import(descriptor("bad:id", "start = \"x\" ;"))
            .is_err()
    );
    assert!(
        workspace
            .import(GrammarSource::new("one", "toy", "unknown", "x"))
            .is_err()
    );
    assert!(workspace.update("unknown", "", None).is_err());
    assert!(workspace.remove("unknown").is_err());
    assert!(
        workspace
            .parse("", "unknown", "", None, Default::default())
            .is_err()
    );
    workspace
        .import(GrammarSource::new(
            "one",
            "toy",
            "native",
            "start start\nrule start = normal capture(\"answer\", literal(\"hello\"))\n",
        ))
        .unwrap();
    assert!(workspace.export("unknown", "toy", "", None).is_err());
    assert!(
        workspace
            .export("ebnf", "toy", "", None)
            .unwrap_err()
            .to_string()
            .contains("would lose")
    );
    let invalid = SyntaxTree::Error {
        start: 1,
        end: 2,
        text: meta_language::grammar::feature_runtime::LeafText::Text("x".into()),
        reason: None,
    };
    assert!(source_node(Node::new("Name"), &invalid, "мир").is_err());
    workspace
        .hooks
        .after_parse
        .push(Arc::new(move |mut outcome, _| {
            outcome.tree = Some(invalid.clone());
            Ok(outcome)
        }));
    assert!(
        workspace
            .parse("мир", "toy", "", None, Default::default())
            .is_err()
    );
}
