//! Machine targets: x86-64 assembly (NASM, System V, libc printf), CIL
//! (ILAsm for .NET) and JVM bytecode (Jasmin); the GNU as, ARM64, LLVM IR and
//! WebAssembly text writers live in modules of their own. Each writer spells the stack
//! machine code from the lowering; the target descriptions live with the
//! language descriptions, where the context rules read them.

use crate::emission_map::{SourceLines, active_instruction};
use std::collections::HashMap;

use super::lowering::{Instruction, LoweredProgram, Procedure, lower_program};
use super::machine_assembly::{write_arm64, write_gas};
use super::machine_llvm::write_llvm;
use super::machine_shared::{comments, creates_arrays};
use super::machine_wasm::write_wat;
use crate::meta::GrammarError;
use crate::meta::{Node, format_number};

type Result<T> = std::result::Result<T, GrammarError>;

fn is_label(line: &str) -> bool {
    line.strip_suffix(':').is_some_and(|name| {
        !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
    })
}

// ---------------------------------------------------------------------------
// x86-64 NASM, Linux System V calling convention.
// ---------------------------------------------------------------------------

/// Printable ASCII runs stay readable; other bytes are written as numbers.
fn nasm_text(text: &str) -> String {
    let mut parts: Vec<String> = Vec::new();
    let mut last_is_text = false;
    for byte in text.bytes() {
        let printable = (0x20..0x7f).contains(&byte) && byte != b'"';
        if printable && last_is_text {
            if let Some(last) = parts.last_mut() {
                last.insert(last.len() - 1, byte as char);
            }
        } else if printable {
            parts.push(format!("\"{}\"", byte as char));
        } else {
            parts.push(byte.to_string());
        }
        last_is_text = printable;
    }
    parts.join(", ")
}

fn nasm_jump(relation: &str) -> &'static str {
    match relation {
        "equal" => "je",
        "notEqual" => "jne",
        "less" => "jl",
        "lessOrEqual" => "jle",
        "greater" => "jg",
        _ => "jge",
    }
}

fn nasm_arithmetic(operation: &str) -> &'static [&'static str] {
    match operation {
        "add" => &["add rax, rcx"],
        "subtract" => &["sub rax, rcx"],
        "multiply" => &["imul rax, rcx"],
        "divide" => &["cqo", "idiv rcx"],
        _ => &["cqo", "idiv rcx", "mov rax, rdx"],
    }
}

const ARGUMENT_REGISTERS: [&str; 6] = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];

fn nasm_procedure(
    item: &Procedure,
    calls: &HashMap<String, bool>,
    texts: &mut Vec<String>,
) -> Result<SourceLines> {
    // Each procedure names its stack slots with context-local macros, such
    // as "%$remainder", so the names cannot clash with labels or procedures.
    let offset = |slot: usize| format!("%${}", item.slot_names[slot]);
    let frame = item.slot_count.div_ceil(2) * 16;
    let mut lines: SourceLines = comments(";", &item.comments, "");
    lines.push(format!("{}:", item.name));
    let mut body: SourceLines = vec![format!("%push {}", item.name)].into();
    body.extend(
        item.slot_names
            .iter()
            .enumerate()
            .map(|(slot, name)| format!("%define %${name} qword [rbp - {}]", 8 * (slot + 1))),
    );
    body.extend(["push rbp", "mov rbp, rsp"].map(String::from));
    if frame != 0 {
        body.push(format!("sub rsp, {frame}"));
    }
    if item.parameter_count > ARGUMENT_REGISTERS.len() {
        return Err(GrammarError::new(format!(
            "\"{}\" has more than six parameters",
            item.name
        )));
    }
    for (index, register) in ARGUMENT_REGISTERS
        .iter()
        .enumerate()
        .take(item.parameter_count)
    {
        body.push(format!("mov {}, {register}", offset(index)));
    }
    for instruction in &item.code {
        let _origin = active_instruction(instruction);
        match instruction {
            Instruction::Comment(text) => {
                body.extend(comments(";", std::slice::from_ref(text), ""))
            }
            Instruction::Push(value) => {
                if value.abs() < 2f64.powi(31) {
                    body.push(format!("push {}", format_number(*value)));
                } else {
                    body.push(format!("mov rax, {}", format_number(*value)));
                    body.push("push rax".into());
                }
            }
            Instruction::Load(slot) => body.push(format!("push {}", offset(*slot))),
            Instruction::Store(slot) => {
                body.push("pop rax".into());
                body.push(format!("mov {}, rax", offset(*slot)));
            }
            Instruction::Pop => body.push("add rsp, 8".into()),
            Instruction::Arithmetic(operation) => {
                body.push("pop rcx".into());
                body.push("pop rax".into());
                body.extend(
                    nasm_arithmetic(operation)
                        .iter()
                        .map(|line| (*line).to_owned()),
                );
                body.push("push rax".into());
            }
            Instruction::Negate => body.push("neg qword [rsp]".into()),
            Instruction::Label(name) => body.push(format!(".{name}:")),
            Instruction::Jump(name) => body.push(format!("jmp .{name}")),
            Instruction::CompareJump(relation, name) => {
                body.push("pop rcx".into());
                body.push("pop rax".into());
                body.push("cmp rax, rcx".into());
                body.push(format!("{} .{name}", nasm_jump(relation)));
            }
            Instruction::Call(name, count) => {
                for register in ARGUMENT_REGISTERS.iter().take(*count).rev() {
                    body.push(format!("pop {register}"));
                }
                body.push(format!("call {name}"));
                if calls.get(name).copied().unwrap_or(false) {
                    body.push("push rax".into());
                }
            }
            Instruction::Return => {
                body.extend(["pop rax", "leave", "ret"].map(String::from));
            }
            Instruction::ReturnNothing => {
                if item.name == "main" {
                    body.push("xor eax, eax".into());
                }
                body.extend(["leave", "ret"].map(String::from));
            }
            Instruction::PrintInteger => {
                body.extend(["pop rdi", "call print_integer"].map(String::from));
            }
            Instruction::PrintText(text) => {
                let index = match texts.iter().position(|known| known == text) {
                    Some(index) => index,
                    None => {
                        texts.push(text.clone());
                        texts.len() - 1
                    }
                };
                body.push(format!("lea rdi, [text_{index}]"));
                body.push("call print_text".into());
            }
            Instruction::PrintNewline => body.push("call print_newline".into()),
            // An array is a pointer to its first element, with its length
            // stored in the eight bytes before it.
            Instruction::NewArray => {
                body.extend(["pop rsi", "pop rdi", "call new_array", "push rax"].map(String::from))
            }
            Instruction::Dup => body.push("push qword [rsp]".into()),
            Instruction::ElementIndex => {}
            Instruction::LoadElement => {
                body.extend(["pop rcx", "pop rax", "push qword [rax + rcx * 8]"].map(String::from))
            }
            Instruction::StoreElement => body.extend(
                ["pop rdx", "pop rcx", "pop rax", "mov [rax + rcx * 8], rdx"].map(String::from),
            ),
            Instruction::ArrayLength => {
                body.extend(["pop rax", "push qword [rax - 8]"].map(String::from))
            }
        }
    }
    body.push("%pop".into());
    lines.extend(body.map_text(|line| {
        if line.starts_with('.') || line.starts_with(';') {
            line
        } else {
            format!("    {line}")
        }
    }));
    Ok(lines)
}

fn nasm_helper(name: &str, format: &str, load: &[&str]) -> Vec<String> {
    let mut lines = vec![
        format!("{name}:"),
        "    push rbp".into(),
        "    mov rbp, rsp".into(),
        "    and rsp, -16".into(),
    ];
    lines.extend(load.iter().map(|line| format!("    {line}")));
    lines.extend([
        format!("    lea rdi, [{format}]"),
        "    xor eax, eax".into(),
        "    call printf wrt ..plt".into(),
        "    leave".into(),
        "    ret".into(),
    ]);
    lines
}

/// new_array(length, fill): malloc room for the length and the elements,
/// then fill them. The memory lives until the program ends.
const NASM_NEW_ARRAY: [&str; 22] = [
    "new_array:",
    "    push rbp",
    "    mov rbp, rsp",
    "    and rsp, -16",
    "    push rdi",
    "    push rsi",
    "    lea rdi, [rdi * 8 + 8]",
    "    call malloc wrt ..plt",
    "    pop rsi",
    "    pop rdi",
    "    mov [rax], rdi",
    "    add rax, 8",
    "    xor ecx, ecx",
    ".fill:",
    "    cmp rcx, rdi",
    "    jge .done",
    "    mov [rax + rcx * 8], rsi",
    "    inc rcx",
    "    jmp .fill",
    ".done:",
    "    leave",
    "    ret",
];

fn write_nasm(program: &LoweredProgram) -> Result<String> {
    let arrays = creates_arrays(program);
    let mut texts = Vec::new();
    let returns: HashMap<String, bool> = program
        .functions
        .iter()
        .map(|item| (item.name.clone(), item.returns))
        .collect();
    let mut procedures = Vec::new();
    for item in program.functions.iter().chain([&program.main]) {
        procedures.push(nasm_procedure(item, &returns, &mut texts)?);
    }
    let mut lines: SourceLines = comments(";", &program.comments, "");
    if !program.comments.is_empty() {
        lines.push(String::new());
    }
    lines.push("default rel".into());
    lines.push("extern printf".into());
    if arrays {
        lines.push("extern malloc".into());
    }
    lines.extend(
        [
            "global main",
            "",
            "section .data",
            "integer_format: db \"%lld\", 0",
            "text_format: db \"%s\", 0",
            "newline_format: db 10, 0",
        ]
        .map(String::from),
    );
    for (index, text) in texts.iter().enumerate() {
        lines.push(format!("text_{index}: db {}, 0", nasm_text(text)));
    }
    lines.push(String::new());
    lines.push("section .text".into());
    for procedure in procedures {
        lines.extend(procedure);
        lines.push(String::new());
    }
    if arrays {
        lines.extend(NASM_NEW_ARRAY.map(String::from));
        lines.push(String::new());
    }
    lines.extend(nasm_helper(
        "print_integer",
        "integer_format",
        &["mov rsi, rdi"],
    ));
    lines.push(String::new());
    lines.extend(nasm_helper("print_text", "text_format", &["mov rsi, rdi"]));
    lines.push(String::new());
    lines.extend(nasm_helper("print_newline", "newline_format", &[]));
    lines.push(String::new());
    lines.push("section .note.GNU-stack noalloc noexec nowrite progbits".into());
    lines.push(String::new());
    Ok(lines.render_ending("nasm", ""))
}

// ---------------------------------------------------------------------------
// CIL as ILAsm source for .NET.
// ---------------------------------------------------------------------------

fn cil_jump(relation: &str) -> &'static str {
    match relation {
        "equal" => "beq",
        "notEqual" => "bne.un",
        "less" => "blt",
        "lessOrEqual" => "ble",
        "greater" => "bgt",
        _ => "bge",
    }
}

fn cil_arithmetic(operation: &str) -> &'static str {
    match operation {
        "add" => "add",
        "subtract" => "sub",
        "multiply" => "mul",
        "divide" => "div",
        _ => "rem",
    }
}

fn cil_text(text: &str) -> String {
    if text.chars().all(|c| (' '..='~').contains(&c)) {
        return format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\""));
    }
    let hex: Vec<String> = text
        .encode_utf16()
        .flat_map(|unit| [unit & 0xff, unit >> 8])
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("bytearray ({})", hex.join(" "))
}

fn int64_list(count: usize) -> String {
    vec!["int64"; count].join(", ")
}

fn cil_method(
    item: &Procedure,
    signatures: &HashMap<String, String>,
    entry_name: &str,
) -> SourceLines {
    let is_main = item.name == "main";
    let name = if is_main {
        entry_name
    } else {
        item.name.as_str()
    };
    let named = |names: &[String]| {
        names
            .iter()
            .map(|name| format!("int64 {name}"))
            .collect::<Vec<_>>()
            .join(", ")
    };
    let locals: Vec<String> = item
        .slot_names
        .iter()
        .enumerate()
        .skip(item.parameter_count)
        .map(|(slot, name)| {
            let kind = if item.slot_arrays.get(slot) == Some(&true) {
                "int64[]"
            } else {
                "int64"
            };
            format!("{kind} {name}")
        })
        .collect();
    let access = |slot: usize, argument: &str, local: &str| {
        if slot < item.parameter_count {
            format!("{argument} {slot}")
        } else {
            format!("{local} {}", slot - item.parameter_count)
        }
    };
    let mut body = SourceLines::default();
    if is_main {
        body.push(".entrypoint".into());
    }
    body.push(format!(".maxstack {}", item.max_depth.max(1)));
    if !locals.is_empty() {
        body.push(format!(".locals init ({})", locals.join(", ")));
    }
    for instruction in &item.code {
        let _origin = active_instruction(instruction);
        match instruction {
            Instruction::Comment(text) => {
                body.extend(comments("//", std::slice::from_ref(text), ""))
            }
            Instruction::Push(value) => body.push(format!("ldc.i8 {}", format_number(*value))),
            Instruction::Load(slot) => body.push(access(*slot, "ldarg", "ldloc")),
            Instruction::Store(slot) => body.push(access(*slot, "starg", "stloc")),
            Instruction::Pop => body.push("pop".into()),
            Instruction::Arithmetic(operation) => body.push(cil_arithmetic(operation).into()),
            Instruction::Negate => body.push("neg".into()),
            Instruction::Label(label) => body.push(format!("{label}:")),
            Instruction::Jump(label) => body.push(format!("br {label}")),
            Instruction::CompareJump(relation, label) => {
                body.push(format!("{} {label}", cil_jump(relation)));
            }
            Instruction::Call(callee, _) => body.push(format!(
                "call {}",
                signatures.get(callee).map_or("undefined", String::as_str)
            )),
            Instruction::Return | Instruction::ReturnNothing => body.push("ret".into()),
            Instruction::PrintInteger => {
                body.push("call void [System.Console]System.Console::Write(int64)".into());
            }
            Instruction::PrintText(text) => {
                body.push(format!("ldstr {}", cil_text(text)));
                body.push("call void [System.Console]System.Console::Write(string)".into());
            }
            Instruction::PrintNewline => {
                body.push("call void [System.Console]System.Console::WriteLine()".into());
            }
            Instruction::NewArray => {
                body.push(format!(
                    "call int64[] Program::{CIL_NEW_ARRAY}(int64, int64)"
                ));
            }
            Instruction::Dup => body.push("dup".into()),
            Instruction::ElementIndex => body.push("conv.ovf.i".into()),
            Instruction::LoadElement => body.push("ldelem.i8".into()),
            Instruction::StoreElement => body.push("stelem.i8".into()),
            Instruction::ArrayLength => body.extend(["ldlen", "conv.i8"].map(String::from)),
        }
    }
    let mut lines: SourceLines = comments("//", &item.comments, "    ");
    lines.push(format!(
        "    .method public static {} {name}({}) cil managed",
        if item.returns { "int64" } else { "void" },
        named(&item.slot_names[..item.parameter_count])
    ));
    lines.push("    {".into());
    lines.extend(body.map_text(|line| {
        if is_label(&line) {
            format!("      {line}")
        } else {
            format!("        {line}")
        }
    }));
    lines.push("    }".into());
    lines
}

const FRAMEWORK_KEY: &str = "(B0 3F 5F 7F 11 D5 0A 3A)";

/// NewArray(length, fill): a new array filled by Array.Fill.
const CIL_NEW_ARRAY: &str = "NewArray";

fn cil_new_array_method() -> Vec<String> {
    let mut lines = vec![
        String::new(),
        format!(
            "    .method private static int64[] {CIL_NEW_ARRAY}(int64 length, int64 fill) cil managed"
        ),
    ];
    lines.extend(
        [
            "    {",
            "        .maxstack 3",
            "        ldarg 0",
            "        conv.ovf.i",
            "        newarr [System.Runtime]System.Int64",
            "        dup",
            "        ldarg 1",
            "        call void [System.Runtime]System.Array::Fill<int64>(!!0[], !!0)",
            "        ret",
            "    }",
        ]
        .map(String::from),
    );
    lines
}

fn write_cil(program: &LoweredProgram) -> String {
    let signatures: HashMap<String, String> = program
        .functions
        .iter()
        .map(|item| {
            let signature = format!(
                "{} Program::{}({})",
                if item.returns { "int64" } else { "void" },
                item.name,
                int64_list(item.parameter_count)
            );
            (item.name.clone(), signature)
        })
        .collect();
    let mut lines: SourceLines = comments("//", &program.comments, "");
    if !program.comments.is_empty() {
        lines.push(String::new());
    }
    lines.push(format!(
        ".assembly extern System.Runtime {{ .publickeytoken = {FRAMEWORK_KEY} .ver 4:0:0:0 }}"
    ));
    lines.push(format!(
        ".assembly extern System.Console {{ .publickeytoken = {FRAMEWORK_KEY} .ver 4:0:0:0 }}"
    ));
    lines.extend(
        [
            ".assembly Program { }",
            "",
            ".class public abstract sealed auto ansi Program",
            "  extends [System.Runtime]System.Object",
            "{",
        ]
        .map(String::from),
    );
    for (index, item) in program.functions.iter().chain([&program.main]).enumerate() {
        if index != 0 {
            lines.push(String::new());
        }
        lines.extend(cil_method(item, &signatures, "Main"));
    }
    if creates_arrays(program) {
        lines.extend(cil_new_array_method());
    }
    lines.push("}".into());
    lines.push(String::new());
    lines.render_ending("cil", "")
}

// ---------------------------------------------------------------------------
// JVM bytecode as Jasmin source. Longs take two local slots.
// ---------------------------------------------------------------------------

fn jvm_jump(relation: &str) -> &'static str {
    match relation {
        "equal" => "ifeq",
        "notEqual" => "ifne",
        "less" => "iflt",
        "lessOrEqual" => "ifle",
        "greater" => "ifgt",
        _ => "ifge",
    }
}

fn jvm_arithmetic(operation: &str) -> &'static str {
    match operation {
        "add" => "ladd",
        "subtract" => "lsub",
        "multiply" => "lmul",
        "divide" => "ldiv",
        _ => "lrem",
    }
}

const PRINT_STREAM: &str = "java/lang/System/out Ljava/io/PrintStream;";

fn jvm_text(text: &str) -> String {
    let mut out = String::from("\"");
    for character in text.chars() {
        if character == '"' || character == '\\' {
            out.push('\\');
            out.push(character);
        } else if (' '..='~').contains(&character) {
            out.push(character);
        } else {
            let mut units = [0u16; 2];
            for unit in character.encode_utf16(&mut units) {
                out.push_str(&format!("\\u{unit:04x}"));
            }
        }
    }
    out.push('"');
    out
}

/// Jasmin reads these words as instructions or keywords, so a variable named
/// like one (swap, pop, new) is written with a trailing underscore, which the
/// reader removes again.
const JASMIN_WORDS: &str = "
    aaload aastore abstract aconst_null aload aload_0 aload_1 aload_2 aload_3 anewarray
    annotation areturn arraylength astore astore_0 astore_1 astore_2 astore_3 athrow baload
    bastore bipush breakpoint caload castore checkcast d2f d2i d2l dadd daload dastore dcmpg
    dcmpl dconst_0 dconst_1 ddiv default dload dload_0 dload_1 dload_2 dload_3 dmul dneg drem
    dreturn dstore dstore_0 dstore_1 dstore_2 dstore_3 dsub dup dup2 dup2_x1 dup2_x2 dup_x1
    dup_x2 enum f2d f2i f2l fadd faload fastore fcmpg fcmpl fconst_0 fconst_1 fconst_2 fdiv
    final fload fload_0 fload_1 fload_2 fload_3 fmul fneg frem freturn from fstore fstore_0
    fstore_1 fstore_2 fstore_3 fsub getfield getstatic goto goto_w i2b i2c i2d i2f i2l i2s iadd
    iaload iand iastore iconst_0 iconst_1 iconst_2 iconst_3 iconst_4 iconst_5 iconst_m1 idiv
    if_acmpeq if_acmpne if_icmpeq if_icmpge if_icmpgt if_icmple if_icmplt if_icmpne ifeq ifge
    ifgt ifle iflt ifne ifnonnull ifnull iinc iload iload_0 iload_1 iload_2 iload_3 imul ineg
    instanceof int2byte int2char int2short interface invokedynamic invokeinterface
    invokenonvirtual invokespecial invokestatic invokevirtual ior irem ireturn is ishl ishr
    istore istore_0 istore_1 istore_2 istore_3 isub iushr ixor jsr jsr_w l2d l2f l2i ladd
    laload land lastore lcmp lconst_0 lconst_1 ldc ldc2_w ldc_w ldiv lload lload_0 lload_1
    lload_2 lload_3 lmul lneg lookupswitch lor lrem lreturn lshl lshr lstore lstore_0 lstore_1
    lstore_2 lstore_3 lsub lushr lxor method monitorenter monitorexit multianewarray native new
    newarray nop pop pop2 private public putfield putstatic ret ret_w return saload sastore
    sipush static strictfp swap synchronized tableswitch to using volatile wide
";

fn is_jasmin_word(name: &str) -> bool {
    JASMIN_WORDS.split_whitespace().any(|word| word == name)
}

fn jasmin_name(name: &str) -> String {
    if is_jasmin_word(name) {
        format!("{name}_")
    } else {
        name.to_owned()
    }
}

pub(crate) fn jasmin_variable(name: &str) -> &str {
    match name.strip_suffix('_') {
        Some(word) if is_jasmin_word(word) => word,
        _ => name,
    }
}

fn jvm_method(item: &Procedure, descriptors: &HashMap<String, String>) -> SourceLines {
    let is_main = item.name == "main";
    let base = usize::from(is_main);
    let slot = |index: usize| base + 2 * index;
    // Arrays are references, loaded with aload; integers are longs.
    let is_array = |index: usize| item.slot_arrays.get(index) == Some(&true);
    let prefix = |index: usize| if is_array(index) { "a" } else { "l" };
    let mut body: SourceLines = vec![
        format!(".limit stack {}", 2 * item.max_depth + 3),
        format!(".limit locals {}", base + 2 * item.slot_count),
    ]
    .into();
    body.extend(item.slot_names.iter().enumerate().map(|(index, name)| {
        let kind = if is_array(index) { "[J" } else { "J" };
        format!(".var {} is {} {kind}", slot(index), jasmin_name(name))
    }));
    let descriptor = |callee: &str| {
        descriptors
            .get(callee)
            .map_or("undefined", String::as_str)
            .to_owned()
    };
    for instruction in &item.code {
        let _origin = active_instruction(instruction);
        match instruction {
            Instruction::Comment(text) => {
                body.extend(comments(";", std::slice::from_ref(text), ""))
            }
            Instruction::Push(value) => body.push(format!("ldc2_w {}", format_number(*value))),
            Instruction::Load(index) => {
                body.push(format!("{}load {}", prefix(*index), slot(*index)));
            }
            Instruction::Store(index) => {
                body.push(format!("{}store {}", prefix(*index), slot(*index)));
            }
            Instruction::Pop => body.push("pop2".into()),
            Instruction::Arithmetic(operation) => body.push(jvm_arithmetic(operation).into()),
            Instruction::Negate => body.push("lneg".into()),
            Instruction::Label(label) => body.push(format!("{label}:")),
            Instruction::Jump(label) => body.push(format!("goto {label}")),
            Instruction::CompareJump(relation, label) => {
                body.push("lcmp".into());
                body.push(format!("{} {label}", jvm_jump(relation)));
            }
            Instruction::Call(callee, _) => {
                body.push(format!("invokestatic Program/{}", descriptor(callee)));
            }
            Instruction::Return => body.push("lreturn".into()),
            Instruction::ReturnNothing => body.push("return".into()),
            Instruction::PrintInteger => body.extend([
                format!("getstatic {PRINT_STREAM}"),
                "dup_x2".into(),
                "pop".into(),
                "invokevirtual java/io/PrintStream/print(J)V".into(),
            ]),
            Instruction::PrintText(text) => body.extend([
                format!("getstatic {PRINT_STREAM}"),
                format!("ldc {}", jvm_text(text)),
                "invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V".into(),
            ]),
            Instruction::PrintNewline => body.extend([
                format!("getstatic {PRINT_STREAM}"),
                "invokevirtual java/io/PrintStream/println()V".into(),
            ]),
            Instruction::NewArray => body.push("invokestatic Program/newArray(JJ)[J".into()),
            Instruction::Dup => body.push("dup".into()),
            Instruction::ElementIndex => body.push("l2i".into()),
            Instruction::LoadElement => body.push("laload".into()),
            Instruction::StoreElement => body.push("lastore".into()),
            Instruction::ArrayLength => body.extend(["arraylength", "i2l"].map(String::from)),
        }
    }
    let mut lines: SourceLines = comments(";", &item.comments, "");
    lines.push(format!(
        ".method public static {}",
        if is_main {
            "main([Ljava/lang/String;)V".to_owned()
        } else {
            descriptor(&item.name)
        }
    ));
    lines.extend(body.map_text(|line| {
        if is_label(&line) {
            line
        } else {
            format!("    {line}")
        }
    }));
    lines.push(".end method".into());
    lines
}

/// newArray(length, fill): a new array filled by Arrays.fill.
const JVM_NEW_ARRAY_METHOD: [&str; 12] = [
    ".method private static newArray(JJ)[J",
    "    .limit stack 5",
    "    .limit locals 4",
    "    lload 0",
    "    l2i",
    "    newarray long",
    "    dup",
    "    lload 2",
    "    invokestatic java/util/Arrays/fill([JJ)V",
    "    areturn",
    ".end method",
    "",
];

fn write_jvm(program: &LoweredProgram) -> String {
    let descriptors: HashMap<String, String> = program
        .functions
        .iter()
        .map(|item| {
            let descriptor = format!(
                "{}({}){}",
                item.name,
                "J".repeat(item.parameter_count),
                if item.returns { "J" } else { "V" }
            );
            (item.name.clone(), descriptor)
        })
        .collect();
    let mut lines: SourceLines = comments(";", &program.comments, "");
    if !program.comments.is_empty() {
        lines.push(String::new());
    }
    lines.extend([".class public Program", ".super java/lang/Object", ""].map(String::from));
    for item in program.functions.iter().chain([&program.main]) {
        lines.extend(jvm_method(item, &descriptors));
        lines.push(String::new());
    }
    if creates_arrays(program) {
        lines.extend(JVM_NEW_ARRAY_METHOD.map(String::from));
    }
    lines.render_ending("jvm", "")
}

/// Write lowered stack machine code for a machine target.
pub fn write_machine(program: &LoweredProgram, target: &str) -> Result<String> {
    match target {
        "nasm" => write_nasm(program),
        "gas" => write_gas(program),
        "arm64" => write_arm64(program),
        "cil" => Ok(write_cil(program)),
        "jvm" => Ok(write_jvm(program)),
        "llvm" => write_llvm(program),
        "wat" => write_wat(program),
        other => Err(GrammarError::new(format!(
            "The grammar translator does not describe \"{other}\""
        ))),
    }
}

/// Lower an adapted meta program and write it for a machine target.
pub fn emit_machine(program: &Node, target: &str) -> Result<String> {
    write_machine(&lower_program(program)?, target)
}
