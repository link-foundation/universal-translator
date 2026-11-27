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
