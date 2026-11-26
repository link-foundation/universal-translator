//! JavaScript and TypeScript functions without the `function` keyword:
//! arrow functions assigned to a constant and the static methods of a class.
//! The JavaScript twin is js/tests/arrow-functions.test.js.

use universal_translator::{Mode, Translator};

fn translate(source: &str, from: &str, to: &str) -> String {
    Translator::new()
        .translate(source, from, to, Mode::default())
        .unwrap()
}

#[test]
fn reads_expression_and_block_bodies_with_or_without_parentheses() {
    let source = "const add = (a, b) => a + b;\nconst twice = n => {\n  return n * 2;\n};\nconsole.log(add(2, twice(3)));\n";
    assert_eq!(
        translate(source, "javascript", "python"),
        "def add(a, b):\n    return a + b\ndef twice(n):\n    return n * 2\nprint(add(2, twice(3)))\n"
    );
}

#[test]
fn keeps_the_typescript_parameter_and_return_types() {
    let source = "const add = (a: number, b: number): number => a + b;\nconsole.log(add(2, 3));\n";
    assert_eq!(
        translate(source, "typescript", "rust"),
        "fn add(a: i64, b: i64) -> i64 {\n    return a + b;\n}\n\nfn main() {\n    println!(\"{}\", add(2, 3));\n}\n"
    );
}

#[test]
fn leaves_a_constant_that_holds_a_value_a_variable() {
    assert_eq!(
        translate("const total = (2 + 3);\n", "javascript", "python"),
        "total = 2 + 3\n"
    );
}

#[test]
fn reads_a_javascript_class_of_static_methods_as_functions() {
    let source = "class Program {\n  static square(n) {\n    return n * n;\n  }\n}\nconsole.log(Program.square(3));\n";
    assert_eq!(
        translate(source, "javascript", "python"),
        "def square(n):\n    return n * n\nprint(square(3))\n"
    );
}

#[test]
fn calls_a_function_of_the_program_by_its_own_name() {
    let source = "public class Program {\n    static int square(int n) {\n        return n * n;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(Program.square(3));\n    }\n}\n";
    assert!(translate(source, "java", "csharp").contains("System.Console.WriteLine(Square(3));"));
}
