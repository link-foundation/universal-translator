//! The forms the programs of the Hello World Collection use (issue 1, item
//! 1.3): fixed-form Fortran with format statements, Fortran 90 write
//! statements, Lua and Groovy calls without parentheses, the PHP closing
//! tag, Scala's `extends App`, a Visual Basic class after Imports
//! System.Console and Zig before 0.1. The JavaScript twin is
//! js/tests/hello-world-dialects.test.js.

use universal_translator::{Mode, translate};

fn to_javascript(source: &str, from: &str) -> String {
    translate(source, from, "javascript", Mode::default())
        .unwrap_or_else(|error| panic!("{from}: {error}"))
}

fn error(source: &str, from: &str) -> String {
    translate(source, from, "javascript", Mode::default())
        .expect_err(source)
        .to_string()
}

#[test]
fn reads_write_control_lists_new_line_and_concatenation() {
    let source = "program p\nwrite (*, '(a)', advance='no') 'a'\nwrite (*, *) 'b', 1\nprint *, 'x' // new_line('a') // 'y'\nprint *, 'a' // 'b'\nend program p\n";
    assert_eq!(
        to_javascript(source, "fortran"),
        "process.stdout.write(\"a\");\nconsole.log(`b${1}`);\nconsole.log(\"x\\ny\");\nconsole.log(\"ab\");\n"
    );
}

#[test]
fn writes_a_line_end_inside_fortran_text_with_new_line() {
    let output = translate(
        "console.log(\"a\\nb\");\n",
        "javascript",
        "fortran",
        Mode::default(),
    )
    .unwrap();
    assert!(output.contains("'a' // new_line('a') // 'b'"), "{output}");
}

#[test]
fn reads_fixed_form_comments_labelled_formats_and_a_final_stop() {
    let source = "*     Star comment\n      PROGRAM P\nc     lower comment\n      WRITE (*,10)\n      STOP\n   10 FORMAT ('a' // 'b' /)\n      END\n";
    assert_eq!(
        to_javascript(source, "fortran"),
        "//     Star comment\n//     lower comment\nconsole.log(\"a\\n\\nb\\n\");\n"
    );
}

#[test]
fn keeps_an_assignment_to_c_a_statement() {
    let source = "program p\ninteger :: c\nc = 1\nprint *, c\nend program p\n";
    assert_eq!(
        to_javascript(source, "fortran"),
        "const c = 1;\nconsole.log(c);\n"
    );
}

#[test]
fn reports_formats_it_cannot_print() {
    let cases = [
        ("      WRITE (*,200)\n", "No format statement labelled 200"),
        (
            "      WRITE (*,100) 1\n  100 FORMAT ('a')\n",
            "Items written with a format statement",
        ),
        (
            "      WRITE (*,100)\n  100 FORMAT (I5)\n",
            "Edit descriptor \"I5\" in a format statement",
        ),
    ];
    for (body, message) in cases {
        let source = format!("      PROGRAM P\n{body}      END\n");
        let found = error(&source, "fortran");
        assert!(found.contains(message), "{found}");
    }
}

#[test]
fn reads_php_up_to_its_closing_tag() {
    assert_eq!(
        to_javascript("<?php\necho 'a';\n?>\n", "php"),
        "process.stdout.write(\"a\");\n"
    );
    let found = error("<?php\necho 'a';\n?>\ntext\n", "php");
    assert!(
        found.contains("Text after the closing \"?>\" tag"),
        "{found}"
    );
}

#[test]
fn reads_a_lua_hash_bang_line_and_a_call_with_one_text_argument() {
    assert_eq!(
        to_javascript("#!/usr/bin/lua\nprint \"a\"\n", "lua"),
        "// !/usr/bin/lua\nconsole.log(\"a\");\n"
    );
}

#[test]
fn reads_groovy_println_without_parentheses() {
    assert_eq!(
        to_javascript("println \"a\"\n", "groovy"),
        "console.log(\"a\");\n"
    );
}

#[test]
fn reads_a_scala_object_that_extends_app() {
    assert_eq!(
        to_javascript("object Main extends App {\n  println(\"a\")\n}\n", "scala"),
        "console.log(\"a\");\n"
    );
}

#[test]
fn reads_a_visual_basic_class_after_imports_system_console() {
    let source = "Imports System.Console\nClass C\n    Public Shared Sub Main()\n        WriteLine(\"a\")\n        Write(\"b\")\n    End Sub\nEnd Class\n";
    assert_eq!(
        to_javascript(source, "vb"),
        "console.log(\"a\");\nprocess.stdout.write(\"b\");\n"
    );
    let module = "Module M\n    Sub Main()\n        WriteLine(\"a\")\n    End Sub\nEnd Module\n";
    assert_eq!(to_javascript(module, "vb"), "WriteLine(\"a\");\n");
}

#[test]
fn reads_zig_before_0_1() {
    let source = "const io = @import(\"std\").io;\npub fn main(args: [][]u8) -> %void {\n    %%io.stdout.printf(\"a {}\\n\", 1);\n}\n";
    assert_eq!(to_javascript(source, "zig"), "console.log(`a ${1}`);\n");
}
