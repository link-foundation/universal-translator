use universal_translator::meta::same_meaning;
use universal_translator::{FragmentKind, Options, parse_fragment, translate_fragment};

const POINT: &str = include_str!("../../examples/translation/point-class.txt");
const POINT_INSTANCES: &str = include_str!("../../examples/translation/point-instances.txt");
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
}

#[test]
fn round_trips_a_program_constructing_different_instances_and_reading_fields() {
    let original = parse_fragment(POINT_INSTANCES, "javascript").unwrap();
    assert_eq!(original.kind, FragmentKind::Program);
    let statements: Vec<_> = original
        .program
        .node("main")
        .unwrap()
        .nodes("statements")
        .into_iter()
        .filter(|statement| !statement.is("Blank"))
        .collect();
    assert!(
        statements[0]
            .node("value")
            .unwrap()
            .is("RecordConstruction")
    );
    assert!(statements[2].node("value").unwrap().is("RecordFieldRead"));
    assert_eq!(statements[2].str("type"), Some("integer"));
    let rust = translate(POINT_INSTANCES, "javascript", "rust");
    assert!(rust.contains("let first_point = Point::new(-8 as i64, 6 as i64);"));
    assert!(rust.contains("let horizontal: i64 = first_point.x;"));
    let reread = parse_fragment(&rust, "rust").unwrap();
    assert!(same_meaning(&original.program, &reread.program));
    let javascript = translate(&rust, "rust", "javascript");
    assert!(javascript.contains("const horizontal = firstPoint.x;"));
    let recovered = parse_fragment(&javascript, "javascript").unwrap();
    assert!(same_meaning(&original.program, &recovered.program));
}

#[test]
fn rejects_aliases_writes_unknown_fields_and_forward_class_references() {
    const BINDING: &str = "const p = new Point(2, 3);";
    let unsupported = [
        format!("{POINT}\n{BINDING}\nconst alias = p;"),
        format!("{POINT}\n{BINDING}\np.x = 9;"),
        format!("{POINT}\n{BINDING}\nconsole.log(p.unknown);"),
        format!("{BINDING}\n{POINT}"),
        format!("{POINT}\nconst p = new Point(-0, 3);"),
        format!("{POINT}\nconst p = new Point(2147483648, 3);"),
        format!("{POINT}\nconst p = new Point(2);"),
        format!("{POINT}\nconst console = new Point(2, 3);"),
        format!("{POINT}\nconst p = new Point('%s', 'value'); console.log(p.x, p.y);"),
        format!("{POINT}\nconst p = new Point('\\x25s', 'value'); console.log(p.x);"),
    ];
    for source in unsupported {
        let result = translate_fragment(&source, "javascript", "rust", Options::default());
        assert!(result.is_err(), "{source} unexpectedly produced {result:?}");
    }
}

#[test]
fn rejects_rust_narrowing_casts_boolean_casts_and_custom_formatting() {
    let record = translate(POINT, "javascript", "rust");
    for (argument, format) in [("270 as u8", "{}"), ("true as i64", "{}"), ("2", "{:?}")] {
        let source = format!(
            "{record}\nfn main() {{ let p = Point::new({argument}, 3); println!(\"{format}\", p.x); }}"
        );
        let result = translate_fragment(&source, "rust", "javascript", Options::default());
        assert!(result.is_err(), "{source} unexpectedly produced {result:?}");
    }
}
