use std::fs;
use std::path::{Path, PathBuf};

use universal_translator::formal::lowering::{Instruction, LoweredProgram};
use universal_translator::formal::machine_reader_assembly::{read_arm64, read_gas};
use universal_translator::formal::machine_reader_jvm_class::read_jvm_class;
use universal_translator::formal::machine_reader_llvm::read_llvm;
use universal_translator::formal::machine_reader_wasm::read_wat;
use universal_translator::formal::machine_reader_wasm_binary::read_wasm_binary;
use universal_translator::translator::{Translator, languages, machine_target_ids};
use universal_translator::{GrammarError, Mode, Options, translate_fragment};

/// A reader of one machine dialect.
type Reader = fn(&str) -> Result<LoweredProgram, GrammarError>;

/// The dialects added after NASM, CIL and JVM bytecode.
const DIALECTS: [&str; 4] = ["gas", "arm64", "llvm", "wat"];
const WASM_FIXTURE: &[u8] = include_bytes!("../../examples/programs/binary/wasm-stack.wasm");

#[test]
fn reads_and_translates_a_webassembly_binary() {
    let machine = read_wasm_binary(WASM_FIXTURE).unwrap();
    assert_eq!(machine.functions[0].parameter_count, 2);
    assert_eq!(machine.functions[1].parameter_count, 0);
    assert!(machine.main.code.contains(&Instruction::Push(-130.0)));
    let translator = Translator::new();
    assert!(translator.to_meta_wasm(WASM_FIXTURE).unwrap().is("Program"));
    let javascript = translator
        .translate_wasm(WASM_FIXTURE, "javascript", Options::default())
        .unwrap();
    assert!(
        javascript
            .find("const wasmValue7 = wasmInternal0(")
            .unwrap()
            < javascript.find("wasmInternal1();").unwrap()
    );
    assert!(javascript.contains("Math.trunc(-1 / 2) + 0"));
}

#[test]
fn rejects_invalid_webassembly_binary() {
    let wrong_version = [0, 0x61, 0x73, 0x6d, 2, 0, 0, 0];
    let invalid_size = [
        0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 1, 0x80, 0x80, 0x80, 0x80, 0x10,
    ];
    for (input, message) in [
        (&wrong_version[..], "expected WebAssembly binary version 1"),
        (
            &WASM_FIXTURE[..WASM_FIXTURE.len() - 1],
            "truncated length-delimited field",
        ),
        (&invalid_size[..], "invalid unsigned LEB128 integer"),
    ] {
        let error = read_wasm_binary(input).unwrap_err().to_string();
        assert!(error.contains(message), "{error}");
    }
}

const JVM_FIXTURE: &[u8] = include_bytes!("../../examples/programs/binary/StackArithmetic.class");

fn replace_bytes(original: &[u8], replacement: &[u8]) -> Vec<u8> {
    let mut source = JVM_FIXTURE.to_vec();
    let offset = JVM_FIXTURE
        .windows(original.len())
        .position(|window| window == original)
        .unwrap();
    source[offset..offset + replacement.len()].copy_from_slice(replacement);
    source
}

#[test]
fn lifts_jvm_class_instructions_into_the_translation_pipeline() {
    let machine = read_jvm_class(JVM_FIXTURE).unwrap();
    for instruction in [
        Instruction::Push(-130.0),
        Instruction::Arithmetic("divide"),
        Instruction::Arithmetic("remainder"),
        Instruction::PrintText("Café 😀 ".into()),
    ] {
        assert!(machine.main.code.contains(&instruction));
    }
    let translator = Translator::new();
    assert!(
        translator
            .to_meta_jvm_class(JVM_FIXTURE)
            .unwrap()
            .is("Program")
    );
    let javascript = translator
        .translate_jvm_class(JVM_FIXTURE, "javascript", Options::default())
        .unwrap();
    assert!(javascript.contains("Math.trunc("));
    assert!(javascript.contains("Café 😀 "));
}

#[test]
fn rejects_unsupported_and_malformed_jvm_classes() {
    let mut invalid_version = JVM_FIXTURE.to_vec();
    invalid_version[7] = 66;
    for (source, message) in [
        (invalid_version, "unsupported class file version 66.0"),
        (
            JVM_FIXTURE[..JVM_FIXTURE.len() - 1].to_vec(),
            "truncated field",
        ),
        (
            replace_bytes(&[0x11, 0xff, 0x7e, 0x3c], &[0xff]),
            "unsupported opcode 0xff",
        ),
        (
            replace_bytes(&[0x11, 0xff, 0x7e, 0x3c], &[0x75]),
            "expected long on the instruction stack",
        ),
        (
            replace_bytes(&[3, 0, 0, 0x9c, 0x40], &[3, 0x80, 0, 0, 1]),
            "exceeds the portable signed range",
        ),
        (
            replace_bytes(&[0xc3, 0xa9, 0x20, 0xed], &[0xc0, 0x80]),
            "printed string contains an unsupported control character",
        ),
    ] {
        let error = read_jvm_class(&source).unwrap_err().to_string();
        assert!(error.contains(message), "{error}");
    }
}

#[test]
fn assembly_labels_stay_local_to_their_procedure() {
    for (dialect, read) in [("gas", read_gas as Reader), ("arm64", read_arm64 as Reader)] {
        let source = golden("factorial", dialect);
        let renamed = source.replace("factorial", "f_é");
        let machine = read(&renamed).unwrap();
        assert_eq!(machine.functions[0].name, "f_é");
        assert!(
            machine.functions[0]
                .code
                .contains(&Instruction::Label("L1".into()))
        );
        for suffix in ["foreign_L1", "f_é_"] {
            let invalid = renamed.replace(".Lf_é_L1", &format!(".L{suffix}"));
            assert!(read(&invalid).is_err(), "{dialect}: {suffix}");
        }
    }
}

fn programs() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs")
}

fn read(path: PathBuf) -> String {
    fs::read_to_string(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

/// Every task with goldens under `examples/programs/translated`.
fn tasks() -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(programs().join("translated"))
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
        "jvm" => "j",
        "llvm" => "ll",
        "wat" => "wat",
        other => panic!("not a machine target: {other}"),
    }
}

fn source(task: &str) -> String {
    read(programs().join(format!("{task}.js")))
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

/// A program without its comments, which name the language they are
/// written in.
fn without_comments(text: &str) -> String {
    text.lines()
        .filter(|line| {
            let line = line.trim_start();
            !(line.starts_with("//") || line.starts_with(';') || line.starts_with('#'))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn lists_every_dialect_after_the_grammar_languages_flagged_as_machine() {
    let listing = languages();
    let machine: Vec<&str> = listing
        .iter()
        .filter(|language| language.machine)
        .map(|language| language.id)
        .collect();
    assert_eq!(machine, machine_target_ids());
    assert_eq!(
        machine,
        ["nasm", "gas", "arm64", "cil", "jvm", "llvm", "wat"]
    );
    let tail: Vec<&str> = listing[listing.len() - machine.len()..]
        .iter()
        .map(|language| language.id)
        .collect();
    assert_eq!(tail, machine);
    assert_eq!(
        listing
            .iter()
            .filter(|language| !language.machine && !language.query)
            .count(),
        33
    );
    for language in listing.iter().filter(|language| language.machine) {
        assert!(language.versions.is_empty(), "{}", language.id);
    }
}

#[test]
fn labels_the_dialects() {
    let label = |id: &str| {
        languages()
            .into_iter()
            .find(|language| language.id == id)
            .unwrap_or_else(|| panic!("{id} is listed"))
            .label
    };
    assert_eq!(label("nasm"), "x86-64 assembly (NASM)");
    assert_eq!(label("gas"), "x86-64 assembly (GNU as, AT&T)");
    assert_eq!(label("arm64"), "ARM64 assembly");
    assert_eq!(label("llvm"), "LLVM IR");
    assert_eq!(label("wat"), "WebAssembly text");
}

#[test]
fn writes_every_task_in_every_dialect_as_the_committed_translation() {
    let mut mismatches = Vec::new();
    for task in tasks() {
        let code = source(&task);
        for target in machine_target_ids() {
            if translate(&code, "javascript", target) != golden(&task, target) {
                mismatches.push(format!("{task} -> {target}"));
            }
        }
    }
    assert!(mismatches.is_empty(), "{mismatches:#?}");
}

#[test]
fn spells_each_dialect_in_its_own_syntax() {
    let gcd = source("greatest-common-divisor");
    let gas = translate(&gcd, "javascript", "gas");
    assert!(gas.contains("# Greatest common divisor in x86-64 assembly"));
    assert!(gas.contains(".type greatest_common_divisor, @function"));
    assert!(gas.contains("call greatest_common_divisor"));
    let arm64 = translate(&gcd, "javascript", "arm64");
    assert!(arm64.contains("// Greatest common divisor in ARM64 assembly"));
    assert!(arm64.contains("stp x29, x30, [sp, #-16]!"));
    assert!(arm64.contains("bl greatest_common_divisor"));
    let llvm = translate(&gcd, "javascript", "llvm");
    assert!(llvm.contains("; Greatest common divisor in LLVM IR"));
    assert!(llvm.contains("define i64 @greatest_common_divisor("));
    let wat = translate(&gcd, "javascript", "wat");
    assert!(wat.contains(";; Greatest common divisor in WebAssembly text"));
    assert!(wat.contains("(func $greatest_common_divisor"));
    assert!(wat.contains("(export \"main\")"));
}

#[test]
fn refuses_statements_on_their_own_for_the_new_dialects() {
    for target in DIALECTS {
        let error = translate_fragment("x = x + 1;", "javascript", target, Options::default())
            .unwrap_err()
            .to_string();
        assert!(
            error.contains("Machine targets hold whole programs only"),
            "{error}"
        );
    }
}

#[test]
fn lifts_every_task_from_every_dialect_to_the_program_lifted_from_nasm() {
    for task in tasks() {
        let expected = without_comments(&translate(&golden(&task, "nasm"), "nasm", "javascript"));
        for target in DIALECTS {
            let lifted = translate(&golden(&task, target), target, "javascript");
            assert_eq!(without_comments(&lifted), expected, "{task}: {target}");
        }
    }
}

#[test]
fn writes_every_task_again_from_its_own_lifted_program_in_every_dialect() {
    for task in tasks() {
        for target in DIALECTS {
            let lifted = translate(&golden(&task, target), target, "javascript");
            assert_eq!(
                translate(&lifted, "javascript", target),
                golden(&task, target),
                "{task}: {target}"
            );
        }
    }
}

#[test]
fn translates_between_every_pair_of_dialects() {
    let task = "greatest-common-divisor";
    for from in machine_target_ids() {
        for to in machine_target_ids() {
            assert_eq!(
                translate(&golden(task, from), from, to),
                golden(task, to),
                "{from} -> {to}"
            );
        }
    }
}

#[test]
fn reads_procedures_slots_and_text() {
    let readers: [(&str, Reader); 4] = [
        ("gas", read_gas),
        ("arm64", read_arm64),
        ("llvm", read_llvm),
        ("wat", read_wat),
    ];
    for (target, read_program) in readers {
        let program = read_program(&golden("greatest-common-divisor", target)).unwrap();
        assert_eq!(program.comments.len(), 1, "{target}");
        assert_eq!(program.functions[0].name, "greatest_common_divisor");
        assert_eq!(
            program.functions[0].slot_names,
            ["first", "second", "remainder"]
        );
        assert_eq!(program.functions[0].parameter_count, 2);
        assert!(
            program.main.code.contains(&Instruction::PrintText(
                "The greatest common divisor of 1071 and 462 is ".into()
            )),
            "{target}"
        );
    }
}

#[test]
fn decodes_text_that_is_not_plain_ascii() {
    let text = "console.log(\"Привет, мир! ✓ \\\"quoted\\\"\");\n";
    for target in DIALECTS {
        let machine = translate(text, "javascript", target);
        let lifted = translate(&machine, target, "javascript");
        assert!(lifted.contains("Привет, мир! ✓ \\\"quoted\\\""), "{target}");
    }
}

#[test]
fn reports_code_it_does_not_recognize() {
    let translator = Translator::new();
    for target in DIALECTS {
        assert!(
            translator
                .translate("nonsense", target, "c", Mode::ContextDependent)
                .is_err(),
            "{target}"
        );
    }
    let broken = golden("factorial", "gas").replacen("imulq", "mulqq", 1);
    let error = translator
        .translate(&broken, "gas", "c", Mode::ContextDependent)
        .unwrap_err();
    assert!(
        error.to_string().contains("Cannot read gas line"),
        "{error}"
    );
}
