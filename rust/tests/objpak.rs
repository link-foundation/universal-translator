use universal_translator::formal::{languages::language_syntax, parser::parse_program};
use universal_translator::meta::{Node, same_meaning, walk};
use universal_translator::natural::{check_description, check_text, natural_language_ids};
use universal_translator::{Mode, Translator, reconstruct_concrete};
const SOURCE: &str = include_str!("../../examples/objpak/hello.m");

#[test]
fn runtime_header_is_one_concrete_directive_without_ignoring_conditional_code() {
    use universal_translator::formal::lexer::{TokenType, tokenize};
    let header =
        "#ifdef __PORTABLE_OBJC__\n#include <objcrt.h>\n#else\n#import <objc/objc.h>\n#endif";
    let source = format!("{header}\nBOOL active = YES;");
    let tokens = tokenize(&source, &language_syntax("objc").unwrap()).unwrap();
    assert_eq!(tokens[0].kind, TokenType::Directive);
    assert_eq!(tokens[0].value, header);
    assert_eq!(tokens[0].raw_span, Some((0, header.len())));
    assert_eq!(tokens.iter().find(|t| t.value == "BOOL").unwrap().line, 6);
    assert!(
        Translator::new()
            .to_meta(
                &header.replace("#else", "printf(\"changed\");\n#else"),
                "objc"
            )
            .is_err()
    );
}

#[test]
fn conditions_distinguish_boolean_and_numeric_calls_after_inference() {
    let translator = Translator::new();
    let source = include_str!("../../examples/objpak/conditions.m");
    let meta = translator.to_meta(source, "objc").unwrap();
    assert!(meta.nodes("functions")[1].nodes("parameters").is_empty());
    let main = meta.node("main").unwrap().nodes("statements");
    let boolean = main[2].node("condition").unwrap();
    assert!(boolean.is("Call"));
    assert_eq!(boolean.str("type"), Some("boolean"));
    let numeric = main[3].node("condition").unwrap();
    assert_eq!(numeric.str("operator"), Some("notEqual"));
    assert_eq!(numeric.str("type"), Some("boolean"));
    assert_eq!(numeric.node("right").unwrap().str("type"), Some("integer"));
    for language in ["python", "javascript", "rust", "objc"] {
        let output = translator
            .translate(source, "objc", language, Mode::default())
            .unwrap();
        assert!(
            same_meaning(&meta, &translator.to_meta(&output, language).unwrap()),
            "{language}\n{output}"
        );
    }
}

#[test]
fn boolean_variable_tests_keep_their_value_role() {
    let translator = Translator::new();
    let meta = translator.to_meta("int main(void) { BOOL active = YES; int left = 2; while (active) { active = NO; } if (left) { left--; } return 0; }", "objc").unwrap();
    let main = meta.node("main").unwrap().nodes("statements");
    let condition = main[2].node("condition").unwrap();
    assert!(condition.is("Name"));
    assert_eq!(condition.str("type"), Some("boolean"));
    assert!(
        translator
            .from_meta(&meta, "rust", None, Mode::default())
            .unwrap()
            .contains("while active")
    );
}

#[test]
fn void_parameter_markers_are_limited_to_c_family_grammars() {
    let translator = Translator::new();
    for language in ["c", "cpp", "objc"] {
        let meta = translator
            .to_meta("int remaining(\nvoid) { return 2; }", language)
            .unwrap();
        assert!(
            meta.nodes("functions")[0].nodes("parameters").is_empty(),
            "{language}"
        );
    }
    let meta = translator
        .to_meta("def identity(void):\n    return void\n", "python")
        .unwrap();
    assert_eq!(
        meta.nodes("functions")[0].nodes("parameters")[0].str("name"),
        Some("void")
    );
}
fn kinds(tree: &Node, kind: &str) -> Vec<Node> {
    let mut result = Vec::new();
    walk(tree, |n| {
        if n.is(kind) {
            result.push(n.clone());
        }
    });
    result
}
#[test]
fn receiver_selectors_and_blocks_are_compositional() {
    let tree = parse_program("[receiver first:1 second:[String str:\"text\"]]; [items do:{ :one :two | printf(\"%s\", [one str]); }];", &language_syntax("objc").unwrap()).unwrap();
    let messages = kinds(&tree, "Message");
    let outer = messages
        .iter()
        .find(|n| n.str("selector") == Some("first:second:"))
        .unwrap();
    assert_eq!(outer.nodes("arguments").len(), 2);
    assert_eq!(
        kinds(&tree, "BlockLambda")[0].texts("parameters"),
        ["one", "two"]
    );
}
#[test]
fn original_collection_program_has_portable_concepts() {
    let t = Translator::new();
    let meta = t.to_meta(SOURCE, "objc").unwrap();
    for kind in ["Message", "Dereference", "BlockLambda"] {
        assert!(kinds(&meta, kind).is_empty(), "{kind}");
    }
    assert_eq!(
        kinds(&meta, "ProcessArguments")[0].flag("includeProgram"),
        Some(true)
    );
    assert_eq!(
        kinds(&meta, "SetLiteral")[0].str("order"),
        Some("objpak-string")
    );
    assert_eq!(kinds(&meta, "SetInsert").len(), 1);
    assert_eq!(
        kinds(&meta, "ForEach")[0]
            .node("array")
            .unwrap()
            .str("type"),
        Some("set<text>")
    );
    assert_eq!(kinds(&meta, "Update").len(), 2);
    for target in ["python", "javascript", "rust"] {
        assert!(
            !t.from_meta(&meta, target, None, Mode::ContextDependent)
                .unwrap()
                .is_empty()
        );
    }
}
#[test]
fn renamed_entry_and_braced_body_work() {
    let t = Translator::new();
    let meta = t.to_meta("int main(int total, char **words) { id names = [ Set\n new ]; words++; while (--total) { [names add:[String str:*words++]]; } [names add:[String str:\"Alice\"]]; [names do:{ :person | printf(\"%s\\n\", [person str]); }]; return 0; }", "objc").unwrap();
    assert_eq!(kinds(&meta, "SetInsert").len(), 2);
    assert!(kinds(&meta, "Message").is_empty());
}
#[test]
fn aliases_and_insertion_results_keep_shared_identity() {
    let t = Translator::new();
    let meta = t.to_meta("id first = [Set new]; id second = first; id third = [second add:[String str:\"name\"]]; [first do:{ :person | printf(\"%s\\n\", [person str]); }];", "objc").unwrap();
    assert!(kinds(&meta, "Message").is_empty());
    let rust = t
        .from_meta(&meta, "rust", None, Mode::ContextDependent)
        .unwrap();
    assert!(rust.contains("let second = first.clone();"), "{rust}");
    assert!(rust.contains("let third = second.clone().add"), "{rust}");
}
#[test]
fn unknown_messages_and_pointer_misuse_are_not_guessed() {
    let t = Translator::new();
    assert_eq!(
        kinds(&t.to_meta("[unknown add:1];", "objc").unwrap(), "Message").len(),
        1
    );
    assert!(
        t.to_meta(
            "int main(int count, char **args) { consume(args); }",
            "objc"
        )
        .unwrap_err()
        .message
        .contains("Command-line pointers")
    );
    let meta = t.to_meta(SOURCE, "objc").unwrap();
    for (target, diagnostic) in [
        ("javascript@es5", "ECMAScript 2015"),
        ("python@2", "Python 3.8"),
        ("python@3.5", "Python 3.8"),
    ] {
        assert!(
            t.from_meta(&meta, target, None, Mode::ContextDependent)
                .unwrap_err()
                .message
                .contains(diagnostic)
        );
    }
}
#[test]
fn every_natural_grammar_round_trips_the_full_algorithm() {
    let t = Translator::new();
    let meta = t.to_meta(SOURCE, "objc").unwrap();
    for language in natural_language_ids() {
        assert!(
            check_description(language).unwrap().is_empty(),
            "{language}"
        );
        let text = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        assert!(
            same_meaning(&meta, &t.to_meta(&text, language).unwrap()),
            "{language}: {text}"
        );
        let simple = t
            .translate(
                "id people = [Set new];",
                "objc",
                language,
                Mode::ContextDependent,
            )
            .unwrap();
        assert!(
            check_text(&simple, language).unwrap().is_empty(),
            "{language}: {simple}"
        );
        assert_eq!(
            kinds(&t.to_meta(&simple, language).unwrap(), "SetLiteral").len(),
            1
        );
        let text = t
            .translate(
                "printf(\"objpak-string-set\");",
                "objc",
                language,
                Mode::ContextDependent,
            )
            .unwrap();
        assert!(kinds(&t.to_meta(&text, language).unwrap(), "SetLiteral").is_empty());
    }
}

#[test]
fn emitted_library_contracts_and_callers_round_trip() {
    let t = Translator::new();
    let meta = t.to_meta(SOURCE, "objc").unwrap();
    for target in ["javascript", "python", "rust", "objc"] {
        let text = t
            .from_meta(&meta, target, None, Mode::ContextDependent)
            .unwrap();
        let read = t.to_meta(&text, target).unwrap();
        assert!(same_meaning(&meta, &read), "{target}: {read:?}");
    }
}

#[test]
fn generated_c89_entry_point_returns_a_successful_status() {
    let t = Translator::new();
    let source = "printf(\"done\\n\");";
    let written = t
        .translate(source, "objc", "objc", Mode::ContextDependent)
        .unwrap();
    assert!(written.contains("return 0;\n}"), "{written}");
    assert!(same_meaning(
        &t.to_meta(source, "objc").unwrap(),
        &t.to_meta(&written, "objc").unwrap()
    ));
}

#[test]
fn concrete_library_definitions_keep_utf8_bytes_and_verified_contracts() {
    let t = Translator::new();
    let meta = t.to_meta(SOURCE, "objc").unwrap();
    for (target, before, after) in [
        ("objc", "int index = 0;", "int index = 1;"),
        ("python", "[None] * 16", "[None] * 17"),
        ("javascript", "new Array(16)", "new Array(17)"),
        ("rust", "vec![None; 16]", "vec![None; 17]"),
    ] {
        let prefix = if target == "python" { "#" } else { "//" };
        let written = format!(
            "{prefix} 🦀 Привет\n{}",
            t.from_meta(&meta, target, None, Mode::default()).unwrap()
        );
        let parsed = parse_program(&written, &language_syntax(target).unwrap()).unwrap();
        assert_eq!(parsed.texts("objpakBindings"), ["UtObjpakSet"]);
        let syntax = parsed.node("syntax").unwrap();
        assert_eq!(reconstruct_concrete(syntax).unwrap(), written);
        let mut offset = 0;
        for child in syntax.nodes("children") {
            assert_eq!(child.number("start"), Some(offset as f64));
            offset += child.str("text").unwrap().len();
            assert_eq!(child.number("end"), Some(offset as f64));
        }
        assert_eq!(offset, written.len());
        assert!(
            syntax
                .nodes("children")
                .iter()
                .any(|n| n.str("type") == Some("library-definition"))
        );
        assert!(
            syntax
                .nodes("productions")
                .iter()
                .any(|n| n.str("concept") == Some("LibraryDefinition"))
        );
        assert!(written.contains(before));
        assert!(t.to_meta(&written.replace(before, after), target).is_err());
    }
}

#[test]
fn updates_keep_prefix_postfix_values_and_a_previous_binding() {
    let t = Translator::new();
    let meta = t.to_meta("int previous = 3; printf(\"%d\\n\", previous++); printf(\"%d\\n\", --previous); printf(\"%d\\n\", previous--); printf(\"%d\\n\", ++previous);", "objc").unwrap();
    let updates = kinds(&meta, "Update")
        .iter()
        .map(|n| (n.number("delta").unwrap(), n.flag("prefix").unwrap()))
        .collect::<Vec<_>>();
    assert_eq!(
        updates,
        [(1.0, false), (-1.0, true), (-1.0, false), (1.0, true)]
    );
    for target in ["javascript", "python", "rust", "objc"] {
        let written = t.from_meta(&meta, target, None, Mode::default()).unwrap();
        assert!(
            same_meaning(&meta, &t.to_meta(&written, target).unwrap()),
            "{target}: {written}"
        );
    }
}

#[test]
fn parameters_shadow_library_class_names() {
    let meta = Translator::new().to_meta("void example(id Set, id String) { id names = [Set new]; id value = [String str:\"text\"]; }", "objc").unwrap();
    assert_eq!(kinds(&meta, "Message").len(), 2);
    assert!(kinds(&meta, "SetLiteral").is_empty());
}

#[test]
fn generated_library_contracts_survive_source_layout_and_explicit_styles() {
    use universal_translator::{Braces, Indent, Options, Style};
    let t = Translator::new();
    let meta = t.to_meta(SOURCE, "objc").unwrap();
    for target in ["objc", "javascript", "python", "rust"] {
        for style in [
            Style::default(),
            Style {
                braces: Some(Braces::NextLine),
                indent: Some(Indent::Spaces(2)),
            },
            Style {
                braces: None,
                indent: Some(Indent::Tab),
            },
        ] {
            let options = Options {
                style,
                ..Default::default()
            };
            let written = t.translate_with(SOURCE, "objc", target, options).unwrap();
            assert!(
                same_meaning(&meta, &t.to_meta(&written, target).unwrap()),
                "{target}: {style:?}: {written}"
            );
        }
    }
}

#[test]
fn a_changed_javascript_return_line_has_no_library_contract() {
    let t = Translator::new();
    let meta = t.to_meta(SOURCE, "objc").unwrap();
    let written = t
        .from_meta(&meta, "javascript", None, Mode::default())
        .unwrap();
    assert!(written.contains("return hash;"));
    assert!(
        t.to_meta(
            &written.replace("return hash;", "return\nhash;"),
            "javascript"
        )
        .is_err()
    );
}

#[test]
fn split_operators_and_hexadecimal_literals_have_no_library_contract() {
    let t = Translator::new();
    let meta = t.to_meta(SOURCE, "objc").unwrap();
    for (target, before, after) in [
        ("javascript", ">>> 0", ">> > 0"),
        ("python", "0xffffffff", "0 xffffffff"),
    ] {
        let written = t.from_meta(&meta, target, None, Mode::default()).unwrap();
        assert!(written.contains(before));
        assert!(t.to_meta(&written.replace(before, after), target).is_err());
    }
}
