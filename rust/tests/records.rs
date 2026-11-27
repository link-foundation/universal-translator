use universal_translator::meta::same_meaning;
use universal_translator::{FragmentKind, Options, parse_fragment, translate_fragment};

const POINT: &str = include_str!("../../examples/translation/point-class.txt");
const PAIR: &str = r#"pub struct Pair<A, B> {
    pub letter: A,
    pub count: B,
}

impl<X, Y> Pair<Y, X> {
    // Assign both values.
    pub fn new(count: X, character: Y) -> Self {
        Self { count, letter: character }
    }
}
"#;

fn translate(source: &str, from: &str, to: &str) -> String {
    translate_fragment(source, from, to, Options::default()).unwrap()
}

#[test]
fn round_trips_a_class_constructor_through_rust_and_meta() {
    let original = parse_fragment(POINT, "javascript").unwrap();
    assert_eq!(original.kind, FragmentKind::Definitions);
    let definitions = original.program.nodes("definitions");
    let fields = definitions[0].nodes("fields");
    assert_eq!(fields[0].str("name"), Some("x"));
    assert_eq!(fields[0].str("parameter"), Some("horizontal"));
    assert_eq!(fields[1].str("name"), Some("y"));
    assert_eq!(fields[1].str("parameter"), Some("vertical"));
    let rust = translate(POINT, "javascript", "rust");
    assert!(rust.contains("pub struct Point<Field0, Field1>"));
    assert!(rust.contains("pub fn new(horizontal: Field0, vertical: Field1)"));
    assert!(!rust.contains("fn main"));
    let recovered = parse_fragment(&rust, "rust").unwrap();
    assert_eq!(recovered.kind, FragmentKind::Definitions);
    assert!(same_meaning(&original.program, &recovered.program));
    let javascript = translate(&rust, "rust", "javascript");
    assert!(same_meaning(
        &original.program,
        &parse_fragment(&javascript, "javascript").unwrap().program
    ));
}

#[test]
fn maps_rust_generic_arguments_to_constructor_bindings_and_keeps_comments() {
    let javascript = translate(PAIR, "rust", "javascript");
    assert!(javascript.contains("// Assign both values."));
    assert!(javascript.contains("constructor(count, character)"));
    assert!(javascript.contains("this.letter = character;"));
    let rust = translate(&javascript, "javascript", "rust");
    assert!(same_meaning(
        &parse_fragment(PAIR, "rust").unwrap().program,
        &parse_fragment(&rust, "rust").unwrap().program
    ));
}

#[test]
fn round_trips_multiple_records_including_an_empty_constructor() {
    let source = format!("// Empty record.\nclass Empty {{ constructor() {{}} }}\n\n{POINT}");
    let rust = translate(&source, "javascript", "rust");
    let javascript = translate(&rust, "rust", "javascript");
    assert!(javascript.contains("// Empty record."));
    assert!(javascript.contains("constructor()"));
    assert_eq!(
        parse_fragment(&javascript, "javascript")
            .unwrap()
            .program
            .nodes("definitions")
            .len(),
        2
    );
}

#[test]
fn rejects_constructor_effects_and_targets_outside_supported_class_syntax() {
    let options = Options::default();
    for source in [
        "class SideEffect { constructor(x) { console.log(x); this.x = x; } }",
        "class Duplicate { constructor(x, y) { this.x = x; this.y = x; } }",
        "class Prototype { constructor(x) { this.__proto__ = x; } }",
    ] {
        assert!(translate_fragment(source, "javascript", "rust", options).is_err());
    }
    assert!(translate_fragment(POINT, "javascript", "javascript@es5", options).is_err());
    assert!(translate_fragment(POINT, "javascript@es5", "rust", options).is_err());
    assert!(translate_fragment(POINT, "javascript", "python", options).is_err());
    let program = format!("{POINT}\nconst p = new Point(2, 3);\n");
    let error = translate_fragment(&program, "javascript", "rust", options).unwrap_err();
    assert!(error.message.contains("instance translation"), "{error}");
}
