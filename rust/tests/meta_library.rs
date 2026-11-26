//! The standard library of the meta language: printing and lengths are
//! calls to library procedures in the general form of a meta program. The
//! JavaScript twin is the last suite of js/tests/meta-notation.test.js.

use universal_translator::Translator;
use universal_translator::meta::library::{STANDARD_PROCEDURES, generalize, specialize};
use universal_translator::meta::{Node, Value};

const SOURCE: &str = "const numbers = [3, 1, 2];\nconsole.log(numbers.length);\nprocess.stdout.write('no newline');\n";

fn statements(program: &Node) -> Vec<&Node> {
    program.node("main").expect("main").nodes("statements")
}

#[test]
fn writes_printing_and_lengths_as_calls_to_library_procedures() {
    let meta = Translator::new()
        .to_meta(SOURCE, "javascript")
        .expect("javascript");
    let general = generalize(meta);
    let calls: Vec<(&str, &str)> = statements(&general)
        .into_iter()
        .filter(|it| it.is("Evaluate"))
        .map(|it| {
            let call = it.node("expression").expect("call");
            (call.str("callee").unwrap(), call.str("library").unwrap())
        })
        .collect();
    assert_eq!(calls, [("print-line", "standard"), ("print", "standard")]);
    let length = statements(&general)[1]
        .node("expression")
        .and_then(|call| call.get("arguments"))
        .and_then(Value::as_list)
        .and_then(|it| it[0].as_node())
        .expect("length");
    assert_eq!(length.str("callee"), Some("length"));
    assert_eq!(length.str("type"), Some("integer"));
    let names: Vec<&str> = STANDARD_PROCEDURES.iter().map(|it| it.name).collect();
    assert_eq!(names, ["print-line", "print", "length"]);
}

#[test]
fn reads_the_general_form_back_to_the_same_program() {
    let meta = Translator::new()
        .to_meta(SOURCE, "javascript")
        .expect("javascript");
    assert_eq!(specialize(generalize(meta.clone())), meta);
}

#[test]
fn translates_a_program_written_with_library_calls() {
    let call = Node::new("Call")
        .with("callee", "print-line")
        .with("library", "standard")
        .with("arguments", vec![Node::new("Text").with("value", "hi")]);
    let program = Node::new("Program").with(
        "main",
        Node::new("Block").with(
            "statements",
            vec![Node::new("Evaluate").with("expression", call)],
        ),
    );
    let translator = Translator::new();
    let python = translator
        .from_meta(&program, "python", None, Default::default())
        .expect("python");
    assert_eq!(python, "print(\"hi\")\n");
    let c = translator
        .from_meta(&program, "c", None, Default::default())
        .expect("c");
    assert!(c.contains("printf"), "{c}");
}

#[test]
fn keeps_calls_a_program_declares_itself() {
    let call = Node::new("Call")
        .with("callee", "print")
        .with("arguments", Vec::<Node>::new());
    assert_eq!(specialize(call.clone()), call);
}

#[test]
fn every_example_reads_back_and_writes_the_same_text() {
    let translator = Translator::new();
    let folder = concat!(env!("CARGO_MANIFEST_DIR"), "/examples/programs");
    let mut checked = 0;
    for entry in std::fs::read_dir(folder).expect("examples") {
        let path = entry.expect("entry").path();
        if path.extension().and_then(|it| it.to_str()) != Some("js") {
            continue;
        }
        let text = std::fs::read_to_string(&path).expect("read");
        let meta = translator.to_meta(&text, "javascript").expect("meta");
        assert_eq!(specialize(generalize(meta.clone())), meta, "{path:?}");
        let general = generalize(meta);
        for to in ["python", "c", "rust", "english"] {
            assert_eq!(
                translator
                    .from_meta(&general, to, Some("javascript"), Default::default())
                    .expect("from meta"),
                translator
                    .translate(&text, "javascript", to, Default::default())
                    .expect("translate"),
                "{path:?} -> {to}"
            );
        }
        checked += 1;
    }
    assert!(checked >= 18);
}
