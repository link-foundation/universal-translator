use universal_translator::{Mode, translator::Translator};

const SOURCE: &str = include_str!("../../examples/translation/spring/create-user.java");

#[test]
fn spring_annotations_named_types_and_fluent_calls_survive_translation() {
    let translator = Translator::new();
    let meta = translator.to_meta(SOURCE, "java").unwrap();
    let method = meta.nodes("functions")[0];
    assert_eq!(method.str("name"), Some("create-user"));
    assert_eq!(
        method.str("returnType"),
        Some("source:ResponseEntity < UserDto >")
    );
    assert_eq!(
        method.nodes("annotations")[0]
            .node("expression")
            .unwrap()
            .str("name"),
        Some("PostMapping")
    );
    let parameter = method.nodes("parameters")[0];
    assert_eq!(parameter.str("type"), Some("source:CreateUserRequest"));
    assert_eq!(parameter.nodes("annotations").len(), 2);
    let python = translator
        .translate(SOURCE, "java", "python", Mode::default())
        .unwrap();
    for expected in [
        "from typing import Annotated",
        "@PostMapping",
        "request: \"Annotated[CreateUserRequest, RequestBody, Valid]\"",
        "-> \"ResponseEntity[UserDto]\"",
        "ResponseEntity.status(HttpStatus.CREATED).body(user)",
    ] {
        assert!(python.contains(expected), "{expected}\n{python}");
    }
    let java = translator
        .translate(&python, "python", "java", Mode::default())
        .unwrap();
    assert!(
        java.contains("@RequestBody @Valid CreateUserRequest request"),
        "{java}"
    );
    assert!(
        java.contains("ResponseEntity<UserDto> createUser"),
        "{java}"
    );
    let kotlin = translator
        .translate(SOURCE, "java", "kotlin", Mode::default())
        .unwrap();
    let again = translator
        .translate(&kotlin, "kotlin", "java", Mode::default())
        .unwrap();
    assert!(
        again.contains("@RequestBody @Valid CreateUserRequest request"),
        "{again}"
    );
    assert!(
        translator
            .translate(SOURCE, "java", "c", Mode::default())
            .unwrap_err()
            .to_string()
            .contains("Annotations need a framework mapping")
    );
}

#[test]
fn generics_balance_commas_and_combined_closing_brackets() {
    let translator = Translator::new();
    let source = "Map<String, List<UserDto>> lookup(Map<String, List<UserDto>> users, int count) { return users; }";
    let meta = translator.to_meta(source, "java").unwrap();
    let parameters = meta.nodes("functions")[0].nodes("parameters");
    assert_eq!(
        parameters
            .iter()
            .map(|value| value.str("name"))
            .collect::<Vec<_>>(),
        [Some("users"), Some("count")]
    );
    assert!(
        translator
            .translate(source, "java", "python", Mode::default())
            .unwrap()
            .contains("Map[String,List[UserDto]]")
    );
    assert!(
        translator
            .to_meta("UserDto lookup(\n) { return user; }", "java")
            .unwrap()
            .nodes("functions")[0]
            .nodes("parameters")
            .is_empty()
    );
}

#[test]
fn annotation_arguments_remain_expressions() {
    let python = Translator::new()
        .translate(
            "@PostMapping(\"/users\")\nUserDto create(@Valid UserDto user) { return user; }",
            "java",
            "python",
            Mode::default(),
        )
        .unwrap();
    assert!(python.contains("@PostMapping(\"/users\")"), "{python}");
}
