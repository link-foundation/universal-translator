use universal_translator::formal::{
    emitter::emit_program, languages::language_syntax, parser::parse_program,
};
use universal_translator::meta::{rewrite, same_meaning};
use universal_translator::natural::{check_text, natural_language_ids};
use universal_translator::{Mode, Translator, reconstruct_concrete};

#[test]
fn nullable_operators_round_trip_all_query_grammars() {
    let t = Translator::new();
    let cases: Vec<serde_json::Value> =
        serde_json::from_str(include_str!("../../examples/queries/nullable.json")).unwrap();
    for case in cases {
        let filter = case["condition"]
            .as_str()
            .map(|c| format!(" WHERE {c}"))
            .unwrap_or_default();
        let sql = format!(
            "SELECT {} FROM people AS p{filter};",
            case["projection"].as_str().unwrap()
        );
        let meta = t.to_meta(&sql, "sql").unwrap();
        for language in ["sql", "python", "javascript", "typescript", "csharp"] {
            let written = t
                .from_meta(&meta, language, None, Mode::ContextDependent)
                .unwrap();
            let read = t
                .to_meta(&written, language)
                .unwrap_or_else(|e| panic!("{sql}: {language}: {e:?}: {written}"));
            assert!(same_meaning(&meta, &read), "{sql}: {language}: {written}");
        }
    }
}

#[test]
fn nullable_operations_keep_their_own_meaning_and_natural_vocabulary() {
    let t = Translator::new();
    let meta = t
        .to_meta(
            "SELECT NULL + age FROM people WHERE NOT (age IS NULL) OR age IS NOT FALSE;",
            "sql",
        )
        .unwrap();
    let q = meta.node("main").unwrap().nodes("statements")[0]
        .node("expression")
        .unwrap();
    assert!(q.node("projection").unwrap().is("SqlBinary"));
    assert!(
        q.node("projection")
            .unwrap()
            .node("left")
            .unwrap()
            .is("Null")
    );
    assert!(q.node("condition").unwrap().is("SqlTruth"));
    for language in natural_language_ids() {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        for sql in [
            "SELECT NULL + 1 FROM people;",
            "SELECT NOT NULL FROM people;",
            "SELECT 1 FROM people WHERE NULL;",
            "SELECT 1 IS NOT FALSE FROM people;",
            "SELECT 1 BETWEEN 0 AND 2 FROM people;",
        ] {
            let simple = t
                .translate(sql, "sql", language, Mode::ContextDependent)
                .unwrap();
            assert!(
                check_text(&simple, language).unwrap().is_empty(),
                "{language}: {simple}"
            );
        }
        assert!(
            same_meaning(&meta, &t.to_meta(&written, language).unwrap()),
            "{language}: {written}"
        );
    }
}

#[test]
fn between_round_trips_through_each_natural_grammar() {
    let t = Translator::new();
    let meta = t
        .to_meta(
            "SELECT age FROM people WHERE age BETWEEN NULL AND 2;",
            "sql",
        )
        .unwrap();
    for language in natural_language_ids() {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        assert!(
            same_meaning(&meta, &t.to_meta(&written, language).unwrap()),
            "{language}: {written}"
        );
    }
}

#[test]
fn between_writers_use_each_scalar_operand_once() {
    let t = Translator::new();
    let meta = t
        .to_meta(
            "SELECT sample() BETWEEN lower() AND upper() FROM people;",
            "sql",
        )
        .unwrap();
    let projection = meta.node("main").unwrap().nodes("statements")[0]
        .node("expression")
        .unwrap()
        .node("projection")
        .unwrap();
    assert!(projection.is("SqlBetween"));
    assert_eq!(projection.str("type"), Some("object"));
    for language in ["sql", "python", "javascript", "typescript", "csharp"] {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        let offsets = ["sample()", "lower()", "upper()"].map(|call| {
            let mut occurrences = written.match_indices(call);
            let first = occurrences.next().expect("operand call").0;
            assert!(occurrences.next().is_none(), "{language}: {written}");
            first
        });
        assert!(offsets.is_sorted(), "{language}: {written}");
    }
}

#[test]
fn in_choices_round_trip_all_controlled_grammars() {
    let t = Translator::new();
    let meta = t
        .to_meta(
            "SELECT age IN (NULL, 18) FROM people WHERE age NOT IN ();",
            "sql",
        )
        .unwrap();
    let projection = meta.node("main").unwrap().nodes("statements")[0]
        .node("expression")
        .unwrap()
        .node("projection")
        .unwrap();
    assert!(projection.is("SqlIn"));
    assert_eq!(projection.str("type"), Some("object"));
    let elements = projection.node("choices").unwrap().nodes("elements");
    assert_eq!(
        elements
            .iter()
            .map(|value| value.kind.as_str())
            .collect::<Vec<_>>(),
        ["Null", "Number"]
    );
    for language in natural_language_ids() {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        assert!(
            same_meaning(&meta, &t.to_meta(&written, language).unwrap()),
            "{language}: {written}"
        );
    }
}

#[test]
fn membership_helpers_require_a_verified_definition_and_nullary_operands() {
    let t = Translator::new();
    let methods: serde_json::Value =
        serde_json::from_str(include_str!("../../data/runtime/sql-in.json")).unwrap();
    let meta = t.to_meta("SELECT 1 IN (2) FROM people;", "sql").unwrap();
    for language in ["python", "javascript", "typescript", "csharp"] {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        let method = methods[language]
            .as_str()
            .unwrap()
            .replace("$SQL$", "UtSqlValue");
        let choice = if language == "python" {
            "lambda: 2"
        } else {
            "() => 2"
        };
        assert!(
            written.contains(&method) && written.contains(choice),
            "{language}"
        );
        for invalid in [written.replace(&method, ""), written.replace(choice, "2")] {
            let error = t.to_meta(&invalid, language).unwrap_err();
            assert!(
                error.to_string().contains("SQL value library"),
                "{language}"
            );
        }
    }
}

#[test]
fn membership_requires_a_scalar_expression_list() {
    let t = Translator::new();
    for input in ["people", "(1,)", "(SELECT age FROM people)"] {
        let sql = format!("SELECT age IN {input} FROM people;");
        assert!(t.to_meta(&sql, "sql").is_err(), "{sql}");
    }
}

#[test]
fn legacy_sql_value_helpers_remain_readable_without_a_between_contract() {
    let t = Translator::new();
    let methods: serde_json::Value =
        serde_json::from_str(include_str!("../../data/runtime/sql-between.json")).unwrap();
    let meta = t.to_meta("SELECT NULL FROM people;", "sql").unwrap();
    for language in ["python", "javascript", "typescript", "csharp"] {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        let method = methods[language]
            .as_str()
            .unwrap()
            .replace("$SQL$", "UtSqlValue");
        assert!(written.contains(&method), "{language}");
        let legacy = written.replacen(&method, "", 1);
        assert!(same_meaning(&meta, &t.to_meta(&legacy, language).unwrap()));
        let invalid = legacy.replace("UtSqlValue.nullValue()", "UtSqlValue.between(1, 0, 2)");
        let error = t.to_meta(&invalid, language).unwrap_err();
        assert!(
            error.to_string().contains("SQL value library"),
            "{language}"
        );
    }
}

#[test]
fn a_legacy_python_helper_cannot_hide_a_range_helper_at_the_same_binding() {
    let t = Translator::new();
    let generated = t
        .translate(
            "SELECT 1 BETWEEN 0 AND 2 FROM people;",
            "sql",
            "python",
            Mode::ContextDependent,
        )
        .unwrap();
    let (header, query) = generated.trim_end().rsplit_once('\n').unwrap();
    let legacy: serde_json::Value =
        serde_json::from_str(include_str!("../../data/runtime/sql-values.json")).unwrap();
    let legacy = legacy["python"]
        .as_str()
        .unwrap()
        .replace("$SQL$", "UtSqlValue");
    let error = t
        .to_meta(&format!("{header}\n\n{legacy}\n{query}\n"), "python")
        .unwrap_err();
    assert!(error.to_string().contains("SQL value library"));
}

#[test]
fn verified_sql_helpers_preserve_utf8_concrete_bytes_and_reject_changed_definitions() {
    let t = Translator::new();
    for language in ["python", "javascript", "typescript", "csharp"] {
        let written = t
            .translate(
                "SELECT 'é😀' FROM people WHERE age IS NULL;",
                "sql",
                language,
                Mode::ContextDependent,
            )
            .unwrap();
        let parsed = parse_program(&written, &language_syntax(language).unwrap()).unwrap();
        let syntax = parsed.node("syntax").unwrap();
        assert_eq!(reconstruct_concrete(syntax).unwrap(), written);
        for child in syntax.nodes("children") {
            assert_eq!(
                &written[child.number("start").unwrap() as usize
                    ..child.number("end").unwrap() as usize],
                child.str("text").unwrap()
            );
        }
        assert!(
            syntax
                .nodes("productions")
                .iter()
                .any(|n| n.str("rule") == Some("sqlValueLibrary"))
        );
        assert!(
            t.to_meta(
                &written.replace("numeric or NULL value", "changed value"),
                language
            )
            .is_err()
        );
    }
}

#[test]
fn helper_names_are_fresh_and_caller_contracts_are_checked() {
    let t = Translator::new();
    let meta = t
        .to_meta("SELECT NULL FROM UtSqlValue AS record;", "sql")
        .unwrap();
    for language in ["python", "javascript", "typescript", "csharp"] {
        let written = t
            .from_meta(&meta, language, None, Mode::ContextDependent)
            .unwrap();
        let raw = rewrite(meta.clone(), |part| {
            if part.is("Name") {
                part.with("name", "UtSqlValue")
            } else if part.is("Query") {
                part.with("variable", "UtSqlValue_")
            } else {
                part
            }
        });
        assert!(
            emit_program(&raw, language)
                .unwrap()
                .contains("class UtSqlValue__")
        );
        assert!(
            same_meaning(&meta, &t.to_meta(&written, language).unwrap()),
            "{language}"
        );
    }
    let written = t
        .translate(
            "SELECT NULL FROM people;",
            "sql",
            "javascript",
            Mode::ContextDependent,
        )
        .unwrap();
    let (prefix, expression) = written.trim_end().rsplit_once('\n').unwrap();
    for body in [
        format!("UtSqlValue = 1;\n{expression}"),
        format!("UtSqlValue.binary = other;\n{expression}"),
        format!("const alias = UtSqlValue;\n{expression}"),
        "UtSqlValue.unknown();".into(),
        "UtSqlValue.binary(\"wrong\",1,2);".into(),
        "people.map(UtSqlValue => UtSqlValue.nullValue());".into(),
    ] {
        assert!(
            t.to_meta(&format!("{prefix}\n{body}"), "javascript")
                .is_err(),
            "{body}"
        );
    }
    assert!(
        t.translate(
            "SELECT NULL FROM people;",
            "sql",
            "javascript@es5",
            Mode::ContextDependent
        )
        .is_err()
    );
}

#[test]
fn javascript_and_typescript_return_newlines_change_the_library_contract() {
    let t = Translator::new();
    for language in ["javascript", "typescript"] {
        let written = t
            .translate(
                "SELECT NULL FROM people;",
                "sql",
                language,
                Mode::ContextDependent,
            )
            .unwrap();
        for newline in ["\n", "\u{2028}", "\u{2029}", "/* é😀\n */"] {
            assert!(
                t.to_meta(
                    &written.replace("return null;", &format!("return{newline}null;")),
                    language
                )
                .is_err()
            );
        }
    }
}

#[test]
fn multiple_libraries_keep_original_ranges_with_unicode_whitespace() {
    let t = Translator::new();
    let sql = t
        .translate(
            "SELECT NULL FROM people;",
            "sql",
            "javascript",
            Mode::ContextDependent,
        )
        .unwrap();
    let (prefix, expression) = sql.trim_end().rsplit_once('\n').unwrap();
    let objpak = t
        .translate(
            "id values = [Set new];",
            "objc",
            "javascript",
            Mode::ContextDependent,
        )
        .unwrap();
    let objpak = objpak[..objpak.find("\n}\n").unwrap() + 3]
        .replace("static create", "/* é😀 */ static create");
    let source = format!(
        "{}\n{objpak}\n{}\n{expression}\n",
        prefix.replace("static nullValue", "/* é😀 */ static\u{a0}nullValue"),
        prefix.replace("UtSqlValue", "UtSqlValue_")
    );
    let parsed = parse_program(&source, &language_syntax("javascript").unwrap()).unwrap();
    let syntax = parsed.node("syntax").unwrap();
    assert_eq!(reconstruct_concrete(syntax).unwrap(), source);
    assert_eq!(
        syntax
            .nodes("productions")
            .iter()
            .filter(|p| p.str("concept") == Some("LibraryDefinition"))
            .count(),
        3
    );
    for child in syntax.nodes("children") {
        assert_eq!(
            &source[child.number("start").unwrap() as usize..child.number("end").unwrap() as usize],
            child.str("text").unwrap()
        );
    }
    assert!(
        t.to_meta(&source, "javascript")
            .unwrap()
            .node("main")
            .unwrap()
            .nodes("statements")[0]
            .node("expression")
            .unwrap()
            .node("projection")
            .unwrap()
            .is("Null")
    );
}
