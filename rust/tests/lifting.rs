use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use universal_translator::Mode;
use universal_translator::formal::lowering::Instruction;
use universal_translator::formal::machine_reader::{read_cil, read_jvm, read_nasm};
use universal_translator::translator::{Translator, machine_target_ids};

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

fn extension(target: &str) -> &'static str {
    match target {
        "nasm" => "asm",
        "gas" => "s",
        "arm64" => "arm64",
        "cil" => "il",
        "llvm" => "ll",
        "wat" => "wat",
        _ => "j",
    }
}

fn programs() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs")
}

fn read(path: PathBuf) -> String {
    fs::read_to_string(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

fn golden(task: &str, target: &str) -> String {
    read(
        programs()
            .join("translated")
            .join(task)
            .join(format!("{task}.{}", extension(target))),
    )
}

fn translate(source: &str, from: &str, to: &str) -> String {
    Translator::new()
        .translate(source, from, to, Mode::ContextDependent)
        .unwrap_or_else(|error| panic!("{from} -> {to}: {error}"))
}

/// What JavaScript source prints, or `None` when Node.js is not installed.
fn run(source: &str) -> Option<String> {
    let mut child = Command::new("node")
        .arg("--input-type=module")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    child
        .stdin
        .take()
        .expect("standard input")
        .write_all(source.as_bytes())
        .expect("write the program");
    let output = child.wait_with_output().expect("run node");
    assert_eq!(String::from_utf8_lossy(&output.stderr), "");
    Some(String::from_utf8(output.stdout).expect("UTF-8 output"))
}

/// The same meaning as the JavaScript source, and the same output when
/// Node.js is available.
fn assert_same_program(lifted: &str, original: &str) {
    let translator = Translator::new();
    let expected = translator.to_meta(original, "javascript").unwrap();
    let actual = translator.to_meta(lifted, "javascript").unwrap();
    if let Some(difference) =
        universal_translator::translator::meaning_difference(&expected, &actual)
    {
        // Lifting may spell an equivalent program differently, so the
        // printed output decides when Node.js can run both.
        let (Some(expected), Some(actual)) = (run(original), run(lifted)) else {
            panic!("{difference}\n{lifted}");
        };
        assert_eq!(actual, expected, "{lifted}");
    }
}

// Programs that use every condition and statement form lowering writes.
const CONDITIONS: &str = r#"function sign(value) {
  if (value < 0) {
    return -1;
  } else if (value === 0) {
    return 0;
  }
  return 1;
}

function report(value) {
  console.log(`value ${value}`);
}

let count = 0;
let index = -3;
while (index < 4 && !(index === 2 || count > 5)) {
  const small = index < 1 || index > 2;
  if ((index > -3 || count === 0) && small) {
    count += sign(index) + 2;
  }
  if (!(index > 0 && count !== 1)) {
    report(index * count);
  }
  index += 1;
}
for (let step = 0; step < 3; step++) {
  console.log(step);
}
console.log(`count ${count}, ${Math.trunc(count / 2)}, ${count % 3}`);
"#;

#[test]
fn reads_procedures_slots_comments_and_text() {
    let nasm = read_nasm(&golden("greatest-common-divisor", "nasm")).unwrap();
    assert_eq!(nasm.comments.len(), 1);
    assert_eq!(nasm.functions[0].name, "greatest_common_divisor");
    assert_eq!(
        nasm.functions[0].slot_names,
        ["first", "second", "remainder"]
    );
    assert_eq!(nasm.functions[0].parameter_count, 2);
    assert!(nasm.main.code.contains(&Instruction::PrintText(
        "The greatest common divisor of 1071 and 462 is ".into()
    )));
    let cil = read_cil(&golden("greatest-common-divisor", "cil")).unwrap();
    assert_eq!(cil.functions[0].name, "GreatestCommonDivisor");
    assert_eq!(cil.functions[0].code, nasm.functions[0].code);
    let jvm = read_jvm(&golden("greatest-common-divisor", "jvm")).unwrap();
    let operations = |code: &[Instruction]| -> Vec<std::mem::Discriminant<Instruction>> {
        code.iter().map(std::mem::discriminant).collect()
    };
    assert_eq!(operations(&jvm.main.code), operations(&cil.main.code));
}

#[test]
fn decodes_text_that_is_not_plain_ascii() {
    let source = "console.log(\"Привет, мир! ✓ \\\"quoted\\\"\");\n";
    for target in machine_target_ids() {
        let machine = translate(source, "javascript", target);
        let lifted = translate(&machine, target, "javascript");
        assert_eq!(translate(&lifted, "javascript", "javascript"), lifted);
        assert_eq!(
            lifted,
            translate(source, "javascript", "javascript"),
            "{target}"
        );
        if let Some(output) = run(&lifted) {
            assert_eq!(output, "Привет, мир! ✓ \"quoted\"\n");
        }
    }
}

#[test]
fn reports_code_it_does_not_recognize() {
    let translator = Translator::new();
    let error = translator
        .translate("ret", "nasm", "c", Mode::ContextDependent)
        .unwrap_err();
    assert!(error.to_string().contains("no entry point"), "{error}");
    let broken = golden("factorial", "jvm").replacen("lmul", "dmul", 1);
    let error = translator
        .translate(&broken, "jvm", "c", Mode::ContextDependent)
        .unwrap_err();
    assert!(
        error.to_string().contains("Cannot read jvm line \"dmul\""),
        "{error}"
    );
}

#[test]
fn translates_between_assembly_cil_and_jvm_bytecode() {
    for task in tasks() {
        let task = task.as_str();
        let original = read(programs().join(format!("{task}.js")));
        for from in machine_target_ids() {
            let source = golden(task, from);
            for to in machine_target_ids() {
                assert_eq!(
                    translate(&source, from, to),
                    golden(task, to),
                    "{task}: {from} -> {to}"
                );
            }
            assert_same_program(&translate(&source, from, "javascript"), &original);
        }
    }
}

#[test]
fn rebuilds_nested_conditions_loops_and_boolean_values() {
    let expected = run(&translate(CONDITIONS, "javascript", "javascript"));
    for target in machine_target_ids() {
        let machine = translate(CONDITIONS, "javascript", target);
        let lifted = translate(&machine, target, "javascript");
        assert_eq!(
            translate(&lifted, "javascript", target),
            machine,
            "{lifted}"
        );
        assert!(
            lifted.contains("for (let step = 0; step < 3; step++)"),
            "{lifted}"
        );
        assert!(
            lifted.contains("const small = index < 1 || index > 2;"),
            "{lifted}"
        );
        if expected.is_some() {
            assert_eq!(run(&lifted), expected, "{lifted}");
        }
    }
}

#[test]
fn gives_the_lifted_program_readable_names_and_types() {
    let meta = Translator::new()
        .to_meta(&golden("factorial", "cil"), "cil")
        .unwrap();
    let factorial = &meta.nodes("functions")[0];
    assert_eq!(factorial.str("name"), Some("factorial"));
    let parameters = factorial.nodes("parameters");
    assert_eq!(parameters.len(), 1);
    assert_eq!(parameters[0].str("name"), Some("number"));
    assert_eq!(parameters[0].str("type"), Some("integer"));
    assert_eq!(factorial.str("returnType"), Some("integer"));
    let python = translate(&golden("greatest-common-divisor", "jvm"), "jvm", "python");
    assert!(python.contains("def greatest_common_divisor(first, second):"));
    assert!(python.contains("# Greatest common divisor in Python"));
}

#[test]
fn traces_every_pipeline_stage() {
    let stages = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&stages);
    let translator = Translator::new().with_trace(move |stage, _| {
        seen.lock().unwrap().push(stage.to_owned());
    });
    translator
        .translate("print(1)\n", "python", "ruby", Mode::ContextDependent)
        .unwrap();
    translator
        .translate(
            &golden("factorial", "nasm"),
            "nasm",
            "python",
            Mode::ContextDependent,
        )
        .unwrap();
    assert_eq!(
        *stages.lock().unwrap(),
        [
            "parsed",
            "understood",
            "typed",
            "transformed",
            "adapted",
            "parsed",
            "lifted",
            "typed",
            "transformed",
            "adapted",
        ]
    );
}

#[test]
fn command_line_traces_with_the_trace_flag() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_universal-translator"))
        .args(["translate", "python", "ruby", "-", "--trace"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("start the command line");
    child
        .stdin
        .take()
        .expect("standard input")
        .write_all(b"print(1)\n")
        .expect("write the program");
    let output = child.wait_with_output().expect("run the command line");
    assert_eq!(String::from_utf8_lossy(&output.stdout), "puts 1\n");
    let errors = String::from_utf8_lossy(&output.stderr);
    let stages: Vec<&str> = errors
        .lines()
        .map(|line| {
            assert!(line.contains("] {"), "{line}");
            &line[1..line.find(']').expect("a stage")]
        })
        .collect();
    assert_eq!(
        stages,
        ["parsed", "understood", "typed", "transformed", "adapted"]
    );
}
