use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use universal_translator::Mode;
use universal_translator::formal::languages::Convention;
use universal_translator::formal::lowering::{Instruction, lower_program};
use universal_translator::formal::names::{name_words, spell_name};
use universal_translator::formal::rules::{context_rules, understanding_rules};
use universal_translator::meta::Rule;
use universal_translator::meta::{Node, rewrite};
use universal_translator::translator::{
    Translator, language_ids, machine_target_ids, meaning_difference,
};

/// Every task with goldens under `examples/programs/translated`.
fn tasks() -> Vec<String> {
    let folder = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs/translated");
    let mut names: Vec<String> = fs::read_dir(folder)
        .expect("the goldens folder")
        .map(|entry| {
            entry
                .expect("a golden entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    names.sort();
    names
}

fn programs() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs")
}

fn read(path: PathBuf) -> String {
    fs::read_to_string(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

fn source(task: &str) -> String {
    read(programs().join(format!("{task}.js")))
}

fn extension(target: &str) -> &'static str {
    match target {
        "javascript" => "js",
        "typescript" => "ts",
        "python" => "py",
        "ruby" => "rb",
        "lua" => "lua",
        "php" => "php",
        "c" => "c",
        "cpp" => "cpp",
        "csharp" => "cs",
        "java" => "java",
        "go" => "go",
        "rust" => "rs",
        "kotlin" => "kt",
        "swift" => "swift",
        "perl" => "pl",
        "dart" => "dart",
        "scala" => "scala",
        "julia" => "jl",
        "r" => "R",
        "groovy" => "groovy",
        "objc" => "m",
        "nim" => "nim",
        "d" => "d",
        "pascal" => "pas",
        "fortran" => "f90",
        "ada" => "adb",
        "vb" => "vb",
        "bash" => "sh",
        "matlab" => "matlab",
        "zig" => "zig",
        "lean" => "lean",
        "rocq" => "v",
        "nasm" => "asm",
        "cil" => "il",
        "jvm" => "j",
        other => panic!("no extension for {other}"),
    }
}

fn language_of(extension_text: &str) -> Option<&'static str> {
    language_ids()
        .into_iter()
        .find(|language| extension(language) == extension_text)
}

fn golden(task: &str, target: &str) -> PathBuf {
    programs()
        .join("translated")
        .join(task)
        .join(format!("{task}.{}", extension(target)))
}

const ISSUE_C: &str = "// Hello World in C

#include <stdio.h>

int main() {
    // print \"Hello World!\" into console followed by new line symbol by function call
    printf(\"Hello World!\\n\");
    return 0;
}
";

fn translate(source: &str, from: &str, to: &str) -> String {
    Translator::new()
        .translate(source, from, to, Mode::ContextDependent)
        .unwrap_or_else(|error| panic!("{from} -> {to}: {error}"))
}

// ---- shared golden translations ----

#[test]
fn matches_every_golden_file_for_all_targets() {
    let translator = Translator::new();
    let targets: Vec<&str> = language_ids()
        .into_iter()
        .chain(machine_target_ids())
        .collect();
    assert_eq!(targets.len(), 35);
    let mut mismatches = Vec::new();
    for task in tasks() {
        let task = task.as_str();
        let meta = translator.to_meta(&source(task), "javascript").unwrap();
        for target in &targets {
            let written = translator
                .from_meta(&meta, target, Some("javascript"), Mode::ContextDependent)
                .unwrap_or_else(|error| panic!("{task} -> {target}: {error}"));
            if written != read(golden(task, target)) {
                mismatches.push(format!("{task} -> {target}"));
            }
        }
    }
    assert!(mismatches.is_empty(), "golden mismatches: {mismatches:?}");
}

// ---- meaning is preserved ----

#[test]
fn every_translation_returns_to_the_same_meta_program() {
    let translator = Translator::new();
    for task in tasks() {
        let task = task.as_str();
        let meta = translator.to_meta(&source(task), "javascript").unwrap();
        for language in language_ids() {
            let target = translator
                .from_meta(&meta, language, Some("javascript"), Mode::ContextDependent)
                .unwrap();
            let back = translator
                .to_meta(&target, language)
                .unwrap_or_else(|error| panic!("{task} in {language}: {error}"));
            assert_eq!(
                (task, language, meaning_difference(&meta, &back)),
                (task, language, None)
            );
            let from_golden = translator
                .to_meta(&read(golden(task, language)), language)
                .unwrap();
            assert_eq!(
                (task, language, meaning_difference(&meta, &from_golden)),
                (task, language, None)
            );
        }
    }
}

#[test]
fn hand_written_programs_mean_the_same_as_the_javascript_programs() {
    let translator = Translator::new();
    let mut count = 0;
    for entry in fs::read_dir(programs().join("hand-written")).unwrap() {
        let path = entry.unwrap().path();
        let task = path.file_stem().unwrap().to_str().unwrap().to_owned();
        let Some(language) = path
            .extension()
            .and_then(|e| e.to_str())
            .and_then(language_of)
        else {
            continue;
        };
        let expected = translator.to_meta(&source(&task), "javascript").unwrap();
        let actual = translator.to_meta(&read(path.clone()), language).unwrap();
        assert_eq!(
            (
                path.display().to_string(),
                meaning_difference(&expected, &actual)
            ),
            (path.display().to_string(), None)
        );
        count += 1;
    }
    assert!(count >= 6);
}

// ---- the issue example ----

#[test]
fn adapts_comments_to_the_target_language_by_default() {
    let csharp = translate(ISSUE_C, "c", "csharp");
    assert!(csharp.contains("Hello World in C#"));
    assert!(csharp.contains("by method call"));
    assert!(csharp.contains("System.Console.WriteLine(\"Hello World!\");"));
    assert!(csharp.contains("static void Main()"));
}

#[test]
fn keeps_comments_word_for_word_in_literal_mode() {
    let csharp = Translator::new()
        .translate(ISSUE_C, "c", "csharp", Mode::Literal)
        .unwrap();
    assert!(csharp.contains("Hello World in C "));
    assert!(csharp.contains("by function call"));
}

#[test]
fn keeps_only_the_behaviour_in_same_effect_mode() {
    let csharp = Translator::new()
        .translate(ISSUE_C, "c", "csharp", Mode::SameEffect)
        .unwrap();
    assert!(!csharp.contains("Hello World in"));
    assert!(csharp.contains("System.Console.WriteLine(\"Hello World!\");"));
}

#[test]
fn rejects_unknown_modes_and_languages() {
    let error = "loose".parse::<Mode>().unwrap_err();
    assert!(error.contains("Unsupported mode"));
    let error = Translator::new()
        .translate(ISSUE_C, "c", "cobol", Mode::ContextDependent)
        .unwrap_err();
    assert!(error.to_string().contains("does not describe"));
}

// ---- target conventions ----

#[test]
fn spells_declared_names_in_each_language_convention() {
    let gcd = source("greatest-common-divisor");
    assert!(
        translate(&gcd, "javascript", "python")
            .contains("def greatest_common_divisor(first, second):")
    );
    assert!(
        translate(&gcd, "javascript", "csharp")
            .contains("static int GreatestCommonDivisor(int first, int second)")
    );
    assert!(
        translate(&gcd, "javascript", "go")
            .contains("func greatestCommonDivisor(first int, second int) int {")
    );
    assert_eq!(
        name_words("greatestCommonDivisor"),
        ["greatest", "common", "divisor"]
    );
    assert_eq!(name_words("HTTPServer_port"), ["http", "server", "port"]);
    assert_eq!(
        spell_name("greatest-common-divisor", Convention::Pascal),
        "GreatestCommonDivisor"
    );
}

#[test]
fn copies_reassigned_parameters_where_parameters_are_immutable() {
    let gcd = source("greatest-common-divisor");
    assert!(translate(&gcd, "javascript", "rust").contains("let mut first: i64 = first;"));
    assert!(translate(&gcd, "javascript", "kotlin").contains("var first = first"));
    assert!(!translate(&gcd, "javascript", "python").contains("first = first"));
}

#[test]
fn writes_compound_assignment_only_where_the_language_has_it() {
    let squares = source("sum-of-squares");
    assert!(translate(&squares, "javascript", "lua").contains("total = total + number * number"));
    assert!(translate(&squares, "javascript", "python").contains("total += number * number"));
}

#[test]
fn turns_text_concatenation_into_each_language_interpolation() {
    let factorial = source("factorial");
    assert!(
        translate(&factorial, "javascript", "python")
            .contains("print(f\"{number}! = {factorial(number)}\")")
    );
    assert!(
        translate(&factorial, "javascript", "swift")
            .contains("print(\"\\(number)! = \\(factorial(number))\")")
    );
    assert!(
        translate(&factorial, "javascript", "c")
            .contains("printf(\"%d! = %d\\n\", number, factorial(number));")
    );
}

// ---- replaceable rule layers ----

#[test]
fn applies_custom_meta_layers_before_the_context_rules() {
    let shout = Rule {
        name: "shout".into(),
        apply: Arc::new(|program, _| {
            rewrite(program, |current: Node| {
                if current.is("Text") {
                    let value = current.str("value").unwrap_or_default().to_uppercase();
                    current.with("value", value)
                } else {
                    current
                }
            })
        }),
    };
    let custom = Translator::new().with_layer(vec![shout]);
    let python = custom
        .translate(
            &source("hello-world"),
            "javascript",
            "python",
            Mode::ContextDependent,
        )
        .unwrap();
    assert!(python.contains("print(\"HELLO WORLD!\")"));
}

#[test]
fn lets_callers_remove_or_decorate_a_rule() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let context: Vec<Rule> = context_rules()
        .into_iter()
        .filter(|rule| rule.name != "adaptComments")
        .map(|rule| {
            let calls = Arc::clone(&calls);
            let inner = Arc::clone(&rule.apply);
            Rule {
                name: rule.name.clone(),
                apply: Arc::new(move |program, settings| {
                    calls.lock().unwrap().push(rule.name.clone());
                    inner(program, settings)
                }),
            }
        })
        .collect();
    let without_comments = Translator {
        context,
        ..Translator::new()
    };
    let ruby = without_comments
        .translate(
            &source("hello-world"),
            "javascript",
            "ruby",
            Mode::ContextDependent,
        )
        .unwrap();
    assert!(ruby.contains("# Hello World in JavaScript"));
    assert_eq!(
        *calls.lock().unwrap(),
        [
            "copyReassignedParameters",
            "expandArrayFills",
            "expandForEach",
            "spellNames",
            "spellCommonLibrary"
        ]
    );
    assert!(
        understanding_rules()
            .iter()
            .any(|rule| rule.name == "recognizePrint")
    );
}

#[test]
fn reports_every_stage_through_the_trace_hook() {
    let stages = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&stages);
    Translator::new()
        .with_trace(move |stage, _| seen.lock().unwrap().push(stage.to_owned()))
        .translate(
            &source("hello-world"),
            "javascript",
            "go",
            Mode::ContextDependent,
        )
        .unwrap();
    assert_eq!(
        *stages.lock().unwrap(),
        ["parsed", "understood", "typed", "transformed", "adapted"]
    );
}

#[test]
fn explains_syntax_errors_with_the_line_number() {
    let error = Translator::new()
        .to_meta("let = ;", "javascript")
        .unwrap_err();
    assert!(error.to_string().contains("line 1"), "{error}");
}

// ---- machine targets ----

fn lower(code: &str) -> Vec<Instruction> {
    let meta = Translator::new().to_meta(code, "javascript").unwrap();
    lower_program(&meta).unwrap().main.code
}

#[test]
fn adapts_comments_and_spells_names_for_assembly_cil_and_jvm() {
    let gcd = source("greatest-common-divisor");
    let nasm = translate(&gcd, "javascript", "nasm");
    assert!(nasm.contains("; Greatest common divisor in x86-64 assembly"));
    assert!(nasm.contains("call greatest_common_divisor"));
    let cil = translate(&gcd, "javascript", "cil");
    assert!(cil.contains("call int64 Program::GreatestCommonDivisor"));
    let jvm = Translator::new()
        .translate(&gcd, "javascript", "jvm", Mode::SameEffect)
        .unwrap();
    assert!(jvm.contains("invokestatic Program/greatestCommonDivisor(JJ)J"));
    assert!(!jvm.contains("; Greatest"));
}

#[test]
fn short_circuits_conditions_with_jumps() {
    use Instruction::*;
    let label = |name: &str| name.to_owned();
    assert_eq!(
        lower("let a = 1;\nif (a > 0 && !(a === 2)) {\n  console.log(a);\n}\n"),
        [
            Push(1.0),
            Store(0),
            Load(0),
            Push(0.0),
            CompareJump("lessOrEqual", label("L1")),
            Load(0),
            Push(2.0),
            CompareJump("equal", label("L1")),
            Load(0),
            PrintInteger,
            PrintNewline,
            Jump(label("L2")),
            Label(label("L1")),
            Label(label("L2")),
            ReturnNothing,
        ]
    );
    let either = lower("let a = 1;\nwhile (a < 0 || a === 1) {\n  a += 1;\n}\n");
    assert_eq!(
        either[2..10],
        [
            Label(label("L1")),
            Load(0),
            Push(0.0),
            CompareJump("less", label("L3")),
            Load(0),
            Push(1.0),
            CompareJump("notEqual", label("L2")),
            Label(label("L3")),
        ]
    );
}

#[test]
fn refuses_programs_it_cannot_lower() {
    let translator = Translator::new();
    let error = translator
        .translate(
            "let name = \"Ada\";\n",
            "javascript",
            "nasm",
            Mode::ContextDependent,
        )
        .unwrap_err();
    assert!(error.to_string().contains("cannot lower"), "{error}");
}

// ---- comments inside indented blocks ----

#[test]
fn keeps_a_comment_that_opens_an_indented_block() {
    let python = "def sq(n):\n    # square it\n    return n * n\n\nprint(sq(2))\n";
    let javascript = translate(python, "python", "javascript");
    assert_eq!(
        javascript,
        "function sq(n) {\n    // square it\n    return n * n;\n}\n\nconsole.log(sq(2));\n"
    );
    assert_eq!(translate(&javascript, "javascript", "python"), python);
}

#[test]
fn keeps_comments_that_close_an_indented_block() {
    let python = "def sq(n):\n    return n * n\n    # inside\n# outside\nprint(sq(2))\n";
    let javascript = translate(python, "python", "javascript");
    assert_eq!(
        javascript,
        "function sq(n) {\n    return n * n;\n    // inside\n}\n// outside\nconsole.log(sq(2));\n"
    );
    assert_eq!(translate(&javascript, "javascript", "python"), python);
    assert_eq!(translate("// only\n", "javascript", "python"), "# only\n");
}

// ---- empty lines around functions ----

#[test]
fn keeps_a_comment_right_above_a_function_with_that_function() {
    let python = "# square it\ndef sq(n):\n    return n * n\n\nprint(sq(2))\n";
    assert_eq!(
        translate(python, "python", "javascript"),
        "// square it\nfunction sq(n) {\n    return n * n;\n}\n\nconsole.log(sq(2));\n"
    );
}

#[test]
fn keeps_a_comment_right_above_an_import_as_a_file_comment() {
    let c = "/* Hello World in C */\n#include <stdio.h>\n\nint main(void)\n{\n    printf(\"Hi\\n\");\n    return 0;\n}\n";
    assert_eq!(
        translate(c, "c", "python"),
        "# Hello World in Python\n\nprint(\"Hi\")\n"
    );
}

#[test]
fn keeps_functions_without_an_empty_line_between_them_in_every_language() {
    let tight = "function one(n) {\n    return n + 1;\n}\nfunction two(n) {\n    return n + 2;\n}\n\nconsole.log(one(two(1)));\n";
    for language in universal_translator::formal::languages::language_ids() {
        let text = translate(tight, "javascript", language);
        assert_eq!(
            translate(&text, language, "javascript"),
            tight,
            "{language}"
        );
    }
}

#[test]
fn reads_a_lone_return_1_back_as_a_number() {
    let perl = "sub one {\n    return 1;\n}\n\nprint 2 . \"\\n\";\n";
    assert_eq!(
        translate(perl, "perl", "javascript"),
        "function one() {\n    return 1;\n}\n\nconsole.log(2);\n"
    );
}

// ---- the meta view ----

#[test]
fn shows_the_meta_program_as_links_notation() {
    let meta = Translator::new()
        .to_meta("# hi\n\nx = 'a b'\nprint(x * 3)\n", "python")
        .expect("python");
    assert_eq!(
        universal_translator::meta::notation::format_meta(&meta),
        "program (comments hi)
  declaration x (mutable false) (type text)
    text 'a b' (type text)
  call print-line (library standard)
    binary multiply (type integer)
      name x (type text)
      number 3 (type integer)
"
    );
}

#[test]
fn nests_meta_parameters_and_names_a_field_after_a_block() {
    let source = "def twice(n):\n    if n > 1:\n        return n * 2\n    else:\n        return 0\n\nprint(twice(3))\n";
    let meta = Translator::new().to_meta(source, "python").expect("python");
    assert_eq!(
        universal_translator::meta::notation::format_meta(&meta),
        "program
  function twice (blank-after true) (return-type integer)
    parameter n (type integer)
    if
      binary greater (type boolean)
        name n (type integer)
        number 1 (type integer)
      return
        binary multiply (type integer)
          name n (type integer)
          number 2 (type integer)
      otherwise
        return
          number 0 (type integer)
  call print-line (library standard)
    call twice (type integer)
      number 3 (type integer)
"
    );
}
