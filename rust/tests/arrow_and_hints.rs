//! Two more surface forms of familiar concepts: a JavaScript arrow function
//! bound to a name reads as the Function a `function` declaration reads as,
//! and Python type hints give the meta types of parameters, results and
//! assignments. The JavaScript twin is js/tests/arrow-and-hints.test.js.

use universal_translator::meta::Node;
use universal_translator::translator::{Translator, meaning_difference};
use universal_translator::{Mode, Options, check_equivalence};

const FUNCTION: &str = "function square(n) { return n * n; }\nconsole.log(square(3));\n";

const PARENTHESIZED: &str = "const square = (n) => n * n;\nconsole.log(square(3));\n";
const BARE: &str = "const square = n => n * n;\nconsole.log(square(3));\n";
const BLOCK: &str = "const square = (n) => {\n  return n * n;\n};\nconsole.log(square(3));\n";
const TYPED: &str = "const square = (n: number): number => n * n;\nconsole.log(square(3));\n";

const HINTED: &str = "def square(n: int) -> int:
    return n * n

total: int = 0
print(square(3) + total)
";

const UNHINTED: &str = "def square(n):
    return n * n

total = 0
print(square(3) + total)
";

fn meta(source: &str, language: &str) -> Node {
    Translator::new()
        .to_meta(source, language)
        .unwrap_or_else(|error| panic!("{language}: {error}"))
}

fn translate(source: &str, from: &str, to: &str) -> String {
    Translator::new()
        .translate(source, from, to, Mode::ContextDependent)
        .unwrap_or_else(|error| panic!("{from} -> {to}: {error}"))
}

fn equivalent(source: (&str, &str), translation: (Option<&str>, &str)) -> bool {
    check_equivalence(&Translator::new(), source, translation, Options::default())
        .expect("both texts read")
        .equivalent
}

fn function_names(meta: &Node) -> Vec<&str> {
    meta.nodes("functions")
        .iter()
        .filter_map(|function| function.str("name"))
        .collect()
}

fn parameter_types(meta: &Node) -> Vec<Option<String>> {
    meta.nodes("functions")[0]
        .nodes("parameters")
        .iter()
        .map(|parameter| parameter.str("type").map(str::to_owned))
        .collect()
}

#[test]
fn arrows_read_as_the_function_a_declaration_reads_as() {
    let declared = meta(FUNCTION, "javascript");
    for source in [PARENTHESIZED, BARE, BLOCK] {
        let arrow = meta(source, "javascript");
        assert_eq!(function_names(&arrow), ["square"]);
        assert_eq!(meaning_difference(&arrow, &declared), None, "{source}");
    }
    assert_eq!(function_names(&meta(TYPED, "typescript")), ["square"]);
}

#[test]
fn arrows_read_with_two_parameters_and_statements_before_the_result() {
    let arrow = "const add = (a, b) => {\n  const sum = a + b;\n  return sum;\n};\nconsole.log(add(1, 2));\n";
    let declared =
        "function add(a, b) {\n  const sum = a + b;\n  return sum;\n}\nconsole.log(add(1, 2));\n";
    assert_eq!(
        meaning_difference(&meta(arrow, "javascript"), &meta(declared, "javascript")),
        None
    );
}

#[test]
fn arrows_translate_to_python_as_the_function_declaration_does() {
    let python = translate(FUNCTION, "javascript", "python");
    assert!(python.contains("def square(n):"));
    for source in [PARENTHESIZED, BARE] {
        assert_eq!(translate(source, "javascript", "python"), python);
    }
}

#[test]
fn arrows_are_written_back_as_function_declarations() {
    let javascript = translate(PARENTHESIZED, "javascript", "javascript");
    assert!(javascript.contains("function square(n) {"));
}

#[test]
fn arrows_leave_other_declarations_to_the_expression_reader() {
    let read = meta("const size = (3);\nconsole.log(size);\n", "javascript");
    assert!(read.nodes("functions").is_empty());
}

#[test]
fn arrows_do_what_the_function_declaration_does() {
    assert!(equivalent(
        (PARENTHESIZED, "javascript"),
        (Some(FUNCTION), "javascript")
    ));
    assert!(equivalent((BLOCK, "javascript"), (None, "python")));
}

#[test]
fn hints_give_the_meta_types_of_parameters_results_and_assignments() {
    let read = meta(HINTED, "python");
    let square = read.nodes("functions")[0];
    assert_eq!(parameter_types(&read), [Some("integer".to_owned())]);
    assert_eq!(square.str("returnType"), Some("integer"));
    let main = read.node("main").expect("a main block");
    let total = main.nodes("statements")[0];
    assert!(total.is("Declaration"));
    assert_eq!(total.str("type"), Some("integer"));
}

#[test]
fn hints_map_str_bool_and_list_and_leave_the_others_to_inference() {
    let hinted = parameter_types(&meta(
        "def show(name: str, shown: bool, sizes: list[int], ratio: float, table: dict[str, int]) -> None:\n    print(name)\n",
        "python",
    ));
    let plain = parameter_types(&meta(
        "def show(name, shown, sizes, ratio, table):\n    print(name)\n",
        "python",
    ));
    let mapped: Vec<Option<String>> = ["text", "boolean", "array"]
        .iter()
        .map(|kind| Some((*kind).to_owned()))
        .collect();
    assert_eq!(hinted[..3], mapped[..]);
    assert_eq!(hinted[3..], plain[3..]);
}

#[test]
fn a_hint_without_a_value_is_nothing_to_do() {
    let read = meta("total: int\ntotal = 1\n", "python");
    let main = read.node("main").expect("a main block");
    let kinds: Vec<&str> = main
        .nodes("statements")
        .iter()
        .map(|statement| statement.kind.as_str())
        .collect();
    assert_eq!(kinds, ["Declaration"]);
}

#[test]
fn hints_translate_as_the_unhinted_program_does() {
    for language in ["javascript", "python", "ruby", "rust", "go"] {
        assert_eq!(
            translate(HINTED, "python", language),
            translate(UNHINTED, "python", language),
            "{language}"
        );
    }
}

#[test]
fn hints_leave_what_the_program_does_unchanged() {
    assert!(equivalent((HINTED, "python"), (Some(UNHINTED), "python")));
    assert!(equivalent((HINTED, "python"), (None, "javascript")));
}
