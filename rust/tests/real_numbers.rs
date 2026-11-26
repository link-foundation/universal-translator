//! Real numbers and true division in the meta language. The JavaScript twin
//! is js/tests/real-numbers.test.js.

use universal_translator::meta::notation::format_meta;
use universal_translator::{Mode, Translator};

const HALVES: &str = "let x = 7 / 2;\nlet y = 1.5 * 2;\nconsole.log(x + y);\n";
const PYTHON: &str = "x = 7 / 2\nprint(x)\n";

fn translate(source: &str, from: &str, to: &str) -> String {
    Translator::new()
        .translate(source, from, to, Mode::default())
        .expect("a translation")
}

fn meta(source: &str, from: &str) -> String {
    format_meta(
        &Translator::new()
            .to_meta(source, from)
            .expect("a meta program"),
    )
}

#[test]
fn reads_literals_with_a_point_or_an_exponent_as_reals() {
    let meta = meta("let a = 1.5;\nlet b = 1e3;\nlet c = 2;\n", "javascript");
    assert!(meta.contains("number 1.5 (type real)"), "{meta}");
    assert!(meta.contains("number 1000 (type real)"), "{meta}");
    assert!(meta.contains("number 2 (type integer)"), "{meta}");
}

#[test]
fn reads_the_slash_of_javascript_and_python_3_as_true_division() {
    let meta = meta(PYTHON, "python");
    assert!(meta.contains("binary realDivide (type real)"), "{meta}");
    assert_eq!(
        translate(PYTHON, "python", "javascript"),
        "const x = 7 / 2;\nconsole.log(x);\n"
    );
}

#[test]
fn writes_a_true_division_with_real_operands_where_the_slash_divides_integers() {
    assert_eq!(
        translate(HALVES, "javascript", "python"),
        "x = 7 / 2\ny = 1.5 * 2\nprint(x + y)\n"
    );
    assert_eq!(
        translate(HALVES, "javascript", "rust"),
        "fn main() {\n    let x: f64 = 7.0 / 2.0;\n    let y: f64 = 1.5 * 2.0;\n    println!(\"{}\", x + y);\n}\n"
    );
    assert_eq!(
        translate(HALVES, "javascript", "c"),
        "#include <stdio.h>\n\nint main(void) {\n    double x = 7.0 / 2;\n    double y = 1.5 * 2;\n    printf(\"%g\\n\", x + y);\n}\n"
    );
    assert!(
        translate(HALVES, "javascript", "java")
            .contains("        double x = 7.0 / 2;\n        double y = 1.5 * 2;\n")
    );
    assert!(translate(HALVES, "javascript", "go").contains("x := 7.0 / 2.0"));
}

#[test]
fn converts_integer_variables_that_meet_a_real() {
    let source = "function average(total, count) {\n  return total / count;\n}\nconsole.log(average(7, 2));\n";
    assert!(
        translate(source, "javascript", "c")
            .contains("double average(int total, int count) {\n    return (double) total / count;")
    );
    assert!(translate(source, "javascript", "rust").contains("total as f64 / count as f64"));
    assert!(translate(source, "javascript", "go").contains("float64(total) / float64(count)"));
}

#[test]
fn keeps_integer_division_apart_from_true_division() {
    let source = "a = 17\nb = 5\nprint(a // b)\nprint(a / b)\n";
    let javascript = translate(source, "python", "javascript");
    assert!(
        javascript.contains("console.log(Math.trunc(a / b));"),
        "{javascript}"
    );
    assert!(javascript.contains("console.log(a / b);"), "{javascript}");
    let c = "int main(void) {\n    int a = 7 / 2;\n    return 0;\n}\n";
    assert!(translate(c, "c", "javascript").contains("const a = Math.trunc(7 / 2);"));
    assert!(translate(c, "c", "python").contains("a = 7 // 2"));
}

#[test]
fn reads_real_declarations_and_g_placeholders_of_c() {
    let source = "#include <stdio.h>\n\nint main(void) {\n    double y = 3;\n    printf(\"%g\\n\", y / 2);\n    return 0;\n}\n";
    assert!(
        translate(source, "c", "rust")
            .contains("let y: f64 = 3.0;\n    println!(\"{}\", y / 2.0);")
    );
    assert!(translate(source, "c", "python").contains("y = 3.0\nprint(y / 2)"));
}

#[test]
fn turns_slash_assignment_into_the_division_of_the_source_language() {
    let source = "y = 10\ny /= 4\nprint(y)\n";
    assert!(translate(source, "python", "rust").contains("let mut y: f64 = 10.0;\n    y /= 4.0;"));
}
