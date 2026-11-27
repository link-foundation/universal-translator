//! Assembly dialects written from the stack machine code of the lowering:
//! x86-64 in GNU as (AT&T syntax, System V, libc printf) and AArch64 in GNU
//! as (AAPCS64, libc printf). Both mirror the NASM writer in `machine`.

use crate::emission_map::{SourceLines, active_instruction};
use std::collections::HashMap;

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::machine_shared::{
    all_functions, comments, creates_arrays, printable, returns_by_name, text_index,
};
use crate::meta::{GrammarError, format_number};

type Result<T> = std::result::Result<T, GrammarError>;

/// A string for ".asciz": printable ASCII stays readable, everything else is
/// an octal escape.
pub fn gas_text(text: &str) -> String {
    let mut body = String::new();
    for byte in text.bytes() {
        if byte == b'"' || byte == b'\\' {
            body.push('\\');
            body.push(byte as char);
        } else if printable(byte) {
            body.push(byte as char);
        } else {
            body.push_str(&format!("\\{byte:03o}"));
        }
    }
    format!("\"{body}\"")
}

/// The symbol of a stack slot.
pub fn slot_symbol(item: &Procedure, slot: usize) -> String {
    format!("{}.{}", item.name, item.slot_names[slot])
}

/// The label of a jump target.
pub fn jump_label(item: &Procedure, label: &str) -> String {
    format!(".L{}_{label}", item.name)
}

/// The read-only data both dialects share: the printf formats and the texts.
fn data_section(texts: &[String]) -> Vec<String> {
    let mut lines: Vec<String> = [
        "    .section .rodata",
        "integer_format: .asciz \"%lld\"",
        "text_format: .asciz \"%s\"",
        "newline_format: .asciz \"\\n\"",
    ]
    .map(String::from)
    .to_vec();
    lines.extend(
        texts
            .iter()
            .enumerate()
            .map(|(index, text)| format!("text_{index}: .asciz {}", gas_text(text))),
    );
    lines
}

/// Instructions are indented; labels and comments are not.
fn indent(line: String) -> String {
    let label = line.strip_suffix(':').is_some_and(|name| {
        !name.is_empty()
            && name
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.')
    });
    if label || line.starts_with('#') || line.starts_with("//") {
        line
    } else {
        format!("    {line}")
    }
}

fn strings(lines: &[&str]) -> Vec<String> {
    lines.iter().map(|line| (*line).to_owned()).collect()
}

// ---------------------------------------------------------------------------
// x86-64 in GNU as, AT&T syntax.
// ---------------------------------------------------------------------------

fn gas_jump(relation: &str) -> &'static str {
    match relation {
        "equal" => "je",
        "notEqual" => "jne",
        "less" => "jl",
        "lessOrEqual" => "jle",
        "greater" => "jg",
        _ => "jge",
    }
}

fn gas_arithmetic(operation: &str) -> Vec<String> {
    strings(match operation {
        "add" => &["addq %rcx, %rax"][..],
        "subtract" => &["subq %rcx, %rax"],
        "multiply" => &["imulq %rcx, %rax"],
        "divide" => &["cqto", "idivq %rcx"],
        _ => &["cqto", "idivq %rcx", "movq %rdx, %rax"],
    })
}

const GAS_ARGUMENTS: [&str; 6] = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];

/// Each function names its stack slots with symbols, such as
/// "remainder.divisor", so the names cannot clash with labels or functions.
fn gas_function(
    item: &Procedure,
    calls: &HashMap<String, bool>,
    texts: &mut Vec<String>,
) -> Result<SourceLines> {
    let symbol = |slot: usize| format!("{}(%rbp)", slot_symbol(item, slot));
    let frame = item.slot_count.div_ceil(2) * 16;
    if item.parameter_count > GAS_ARGUMENTS.len() {
        return Err(GrammarError::new(format!(
            "\"{}\" has more than six parameters",
            item.name
        )));
    }
    let mut body: SourceLines = (0..item.slot_names.len())
        .map(|slot| {
            format!(
                ".set {}, {}",
                slot_symbol(item, slot),
                -8 * (slot as i64 + 1)
            )
        })
        .collect();
    body.extend(["pushq %rbp", "movq %rsp, %rbp"].map(String::from));
    if frame != 0 {
        body.push(format!("subq ${frame}, %rsp"));
    }
    for (index, register) in GAS_ARGUMENTS.iter().enumerate().take(item.parameter_count) {
        body.push(format!("movq %{register}, {}", symbol(index)));
    }
    for instruction in &item.code {
        let _origin = active_instruction(instruction);
        match instruction {
            Instruction::Comment(text) => {
                body.extend(comments("#", std::slice::from_ref(text), ""))
            }
            Instruction::Push(value) => {
                if value.abs() < 2f64.powi(31) {
                    body.push(format!("pushq ${}", format_number(*value)));
                } else {
                    body.push(format!("movabsq ${}, %rax", format_number(*value)));
                    body.push("pushq %rax".into());
                }
            }
            Instruction::Load(slot) => body.push(format!("pushq {}", symbol(*slot))),
            Instruction::Store(slot) => {
                body.push("popq %rax".into());
                body.push(format!("movq %rax, {}", symbol(*slot)));
            }
            Instruction::Pop => body.push("addq $8, %rsp".into()),
            Instruction::Arithmetic(operation) => {
                body.extend(["popq %rcx", "popq %rax"].map(String::from));
                body.extend(gas_arithmetic(operation));
                body.push("pushq %rax".into());
            }
            Instruction::Negate => body.push("negq (%rsp)".into()),
            Instruction::Label(label) => body.push(format!("{}:", jump_label(item, label))),
            Instruction::Jump(label) => body.push(format!("jmp {}", jump_label(item, label))),
            Instruction::CompareJump(relation, label) => {
                body.extend(["popq %rcx", "popq %rax", "cmpq %rcx, %rax"].map(String::from));
                body.push(format!(
                    "{} {}",
                    gas_jump(relation),
                    jump_label(item, label)
                ));
            }
            Instruction::Call(name, count) => {
                for register in GAS_ARGUMENTS.iter().take(*count).rev() {
                    body.push(format!("popq %{register}"));
                }
                body.push(format!("call {name}"));
                if calls.get(name).copied().unwrap_or(false) {
                    body.push("pushq %rax".into());
                }
            }
            Instruction::Return => body.extend(["popq %rax", "leave", "ret"].map(String::from)),
            Instruction::ReturnNothing => {
                if item.name == "main" {
                    body.push("xorl %eax, %eax".into());
                }
                body.extend(["leave", "ret"].map(String::from));
            }
            Instruction::PrintInteger => {
                body.extend(["popq %rdi", "call print_integer"].map(String::from))
            }
            Instruction::PrintText(text) => {
                let index = text_index(texts, text);
                body.push(format!("leaq text_{index}(%rip), %rdi"));
                body.push("call print_text".into());
            }
            Instruction::PrintNewline => body.push("call print_newline".into()),
            // An array is a pointer to its first element, with its length
            // stored in the eight bytes before it.
            Instruction::NewArray => body.extend(
                ["popq %rsi", "popq %rdi", "call new_array", "pushq %rax"].map(String::from),
            ),
            Instruction::Dup => body.push("pushq (%rsp)".into()),
            Instruction::ElementIndex => {}
            Instruction::LoadElement => {
                body.extend(["popq %rcx", "popq %rax", "pushq (%rax,%rcx,8)"].map(String::from))
            }
            Instruction::StoreElement => body.extend(
                [
                    "popq %rdx",
                    "popq %rcx",
                    "popq %rax",
                    "movq %rdx, (%rax,%rcx,8)",
                ]
                .map(String::from),
            ),
            Instruction::ArrayLength => {
                body.extend(["popq %rax", "pushq -8(%rax)"].map(String::from))
            }
        }
    }
    let mut lines: SourceLines = comments("#", &item.comments, "");
    lines.push(format!(".type {}, @function", item.name));
    lines.push(format!("{}:", item.name));
    lines.extend(body.map_text(indent));
    lines.push(format!(".size {}, .-{}", item.name, item.name));
    Ok(lines)
}

/// new_array(length, fill): malloc room for the length and the elements,
/// then fill them. The memory lives until the program ends.
const GAS_NEW_ARRAY: [&str; 23] = [
    "new_array:",
    "    pushq %rbp",
    "    movq %rsp, %rbp",
    "    andq $-16, %rsp",
    "    pushq %rdi",
    "    pushq %rsi",
    "    leaq 8(,%rdi,8), %rdi",
    "    call malloc@PLT",
    "    popq %rsi",
    "    popq %rdi",
    "    movq %rdi, (%rax)",
    "    addq $8, %rax",
    "    xorl %ecx, %ecx",
    ".Lnew_array_fill:",
    "    cmpq %rdi, %rcx",
    "    jge .Lnew_array_done",
    "    movq %rsi, (%rax,%rcx,8)",
    "    incq %rcx",
    "    jmp .Lnew_array_fill",
    ".Lnew_array_done:",
    "    leave",
    "    ret",
    "",
];

fn gas_helper(name: &str, load: &[&str]) -> Vec<String> {
    let mut lines = strings(&[
        &format!("{name}:"),
        "    pushq %rbp",
        "    movq %rsp, %rbp",
        "    andq $-16, %rsp",
    ]);
    lines.extend(load.iter().map(|line| format!("    {line}")));
    lines.extend(strings(&[
        &format!("    leaq {}_format(%rip), %rdi", &name[6..]),
        "    xorl %eax, %eax",
        "    call printf@PLT",
        "    leave",
        "    ret",
    ]));
    lines
}

pub fn write_gas(program: &LoweredProgram) -> Result<String> {
    let mut texts = Vec::new();
    let calls = returns_by_name(program);
    let mut functions = Vec::new();
    for item in all_functions(program) {
        functions.push(gas_function(item, &calls, &mut texts)?);
    }
    let mut lines: SourceLines = comments("#", &program.comments, "");
    if !program.comments.is_empty() {
        lines.push(String::new());
    }
    lines.push("    .globl main".into());
    lines.extend(data_section(&texts));
    lines.push(String::new());
    lines.push("    .text".into());
    for function in functions {
        lines.extend(function);
        lines.push(String::new());
    }
    if creates_arrays(program) {
        lines.extend(GAS_NEW_ARRAY.map(String::from));
    }
    lines.extend(gas_helper("print_integer", &["movq %rdi, %rsi"]));
    lines.push(String::new());
    lines.extend(gas_helper("print_text", &["movq %rdi, %rsi"]));
    lines.push(String::new());
    lines.extend(gas_helper("print_newline", &[]));
    lines.push(String::new());
    lines.push("    .section .note.GNU-stack,\"\",@progbits".into());
    lines.push(String::new());
    Ok(lines.render_ending("gas", ""))
}

// ---------------------------------------------------------------------------
// AArch64 in GNU as. Every stack cell takes 16 bytes so the stack pointer
// stays aligned; the frame pointer x29 addresses the slots upwards.
// ---------------------------------------------------------------------------

fn arm_condition(relation: &str) -> &'static str {
    match relation {
        "equal" => "eq",
        "notEqual" => "ne",
        "less" => "lt",
        "lessOrEqual" => "le",
        "greater" => "gt",
        _ => "ge",
    }
}

fn arm_arithmetic(operation: &str) -> Vec<String> {
    strings(match operation {
        "add" => &["add x0, x0, x1"][..],
        "subtract" => &["sub x0, x0, x1"],
        "multiply" => &["mul x0, x0, x1"],
        "divide" => &["sdiv x0, x0, x1"],
        _ => &["sdiv x2, x0, x1", "msub x0, x2, x1, x0"],
    })
}

const ARM_PUSH: &str = "str x0, [sp, #-16]!";

fn arm_pop(register: &str) -> String {
    format!("ldr {register}, [sp], #16")
}

fn arm_function(
    item: &Procedure,
    calls: &HashMap<String, bool>,
    texts: &mut Vec<String>,
) -> Result<SourceLines> {
    let offset = |slot: usize| format!("[x29, #{}]", slot_symbol(item, slot));
    let frame = item.slot_count.div_ceil(2) * 16;
    if item.parameter_count > 8 {
        return Err(GrammarError::new(format!(
            "\"{}\" has more than eight parameters",
            item.name
        )));
    }
    let epilogue = [
        "mov sp, x29".to_owned(),
        format!("add sp, sp, #{frame}"),
        "ldp x29, x30, [sp], #16".to_owned(),
        "ret".to_owned(),
    ];
    let mut body: SourceLines = (0..item.slot_names.len())
        .map(|slot| format!(".set {}, {}", slot_symbol(item, slot), 8 * slot))
        .collect();
    body.push("stp x29, x30, [sp, #-16]!".into());
    body.push(format!("sub sp, sp, #{frame}"));
    body.push("mov x29, sp".into());
    for index in 0..item.parameter_count {
        body.push(format!("str x{index}, {}", offset(index)));
    }
    for instruction in &item.code {
        let _origin = active_instruction(instruction);
        match instruction {
            Instruction::Comment(text) => {
                body.extend(comments("//", std::slice::from_ref(text), ""))
            }
            Instruction::Push(value) => {
                if (-65536.0..=65535.0).contains(value) {
                    body.push(format!("mov x0, #{}", format_number(*value)));
                } else {
                    body.push(format!("ldr x0, ={}", format_number(*value)));
                }
                body.push(ARM_PUSH.into());
            }
            Instruction::Load(slot) => {
                body.push(format!("ldr x0, {}", offset(*slot)));
                body.push(ARM_PUSH.into());
            }
            Instruction::Store(slot) => {
                body.push(arm_pop("x0"));
                body.push(format!("str x0, {}", offset(*slot)));
            }
            Instruction::Pop => body.push("add sp, sp, #16".into()),
            Instruction::Arithmetic(operation) => {
                body.push(arm_pop("x1"));
                body.push(arm_pop("x0"));
                body.extend(arm_arithmetic(operation));
                body.push(ARM_PUSH.into());
            }
            Instruction::Negate => {
                body.extend(["ldr x0, [sp]", "neg x0, x0", "str x0, [sp]"].map(String::from))
            }
            Instruction::Label(label) => body.push(format!("{}:", jump_label(item, label))),
            Instruction::Jump(label) => body.push(format!("b {}", jump_label(item, label))),
            Instruction::CompareJump(relation, label) => {
                body.push(arm_pop("x1"));
                body.push(arm_pop("x0"));
                body.push("cmp x0, x1".into());
                body.push(format!(
                    "b.{} {}",
                    arm_condition(relation),
                    jump_label(item, label)
                ));
            }
            Instruction::Call(name, count) => {
                for index in 0..*count {
                    body.push(arm_pop(&format!("x{}", count - 1 - index)));
                }
                body.push(format!("bl {name}"));
                if calls.get(name).copied().unwrap_or(false) {
                    body.push(ARM_PUSH.into());
                }
            }
            Instruction::Return => {
                body.push(arm_pop("x0"));
                body.extend(epilogue.iter().cloned());
            }
            Instruction::ReturnNothing => {
                if item.name == "main" {
                    body.push("mov x0, #0".into());
                }
                body.extend(epilogue.iter().cloned());
            }
            Instruction::PrintInteger => {
                body.push(arm_pop("x0"));
                body.push("bl print_integer".into());
            }
            Instruction::PrintText(text) => {
                let index = text_index(texts, text);
                body.push(format!("adrp x0, text_{index}"));
                body.push(format!("add x0, x0, :lo12:text_{index}"));
                body.push("bl print_text".into());
            }
            Instruction::PrintNewline => body.push("bl print_newline".into()),
            // An array is a pointer to its first element, with its length
            // stored in the eight bytes before it.
            Instruction::NewArray => {
                body.push(arm_pop("x1"));
                body.push(arm_pop("x0"));
                body.push("bl new_array".into());
                body.push(ARM_PUSH.into());
            }
            Instruction::Dup => {
                body.push("ldr x0, [sp]".into());
                body.push(ARM_PUSH.into());
            }
            Instruction::ElementIndex => {}
            Instruction::LoadElement => {
                body.push(arm_pop("x1"));
                body.push(arm_pop("x0"));
                body.push("ldr x0, [x0, x1, lsl #3]".into());
                body.push(ARM_PUSH.into());
            }
            Instruction::StoreElement => {
                body.push(arm_pop("x2"));
                body.push(arm_pop("x1"));
                body.push(arm_pop("x0"));
                body.push("str x2, [x0, x1, lsl #3]".into());
            }
            Instruction::ArrayLength => {
                body.push(arm_pop("x0"));
                body.push("ldr x0, [x0, #-8]".into());
                body.push(ARM_PUSH.into());
            }
        }
    }
    let mut lines: SourceLines = comments("//", &item.comments, "");
    lines.push(format!(".type {}, %function", item.name));
    lines.push(format!("{}:", item.name));
    lines.extend(body.map_text(indent));
    lines.push(format!(".size {}, .-{}", item.name, item.name));
    Ok(lines)
}

const ARM_NEW_ARRAY: [&str; 21] = [
    "new_array:",
    "    stp x29, x30, [sp, #-32]!",
    "    mov x29, sp",
    "    stp x0, x1, [sp, #16]",
    "    lsl x0, x0, #3",
    "    add x0, x0, #8",
    "    bl malloc",
    "    ldp x1, x2, [sp, #16]",
    "    str x1, [x0]",
    "    add x0, x0, #8",
    "    mov x3, #0",
    ".Lnew_array_fill:",
    "    cmp x3, x1",
    "    b.ge .Lnew_array_done",
    "    str x2, [x0, x3, lsl #3]",
    "    add x3, x3, #1",
    "    b .Lnew_array_fill",
    ".Lnew_array_done:",
    "    ldp x29, x30, [sp], #32",
    "    ret",
    "",
];

fn arm_helper(name: &str, load: &[&str]) -> Vec<String> {
    let mut lines = strings(&[
        &format!("{name}:"),
        "    stp x29, x30, [sp, #-16]!",
        "    mov x29, sp",
    ]);
    lines.extend(load.iter().map(|line| format!("    {line}")));
    lines.extend(strings(&[
        &format!("    adrp x0, {}_format", &name[6..]),
        &format!("    add x0, x0, :lo12:{}_format", &name[6..]),
        "    bl printf",
        "    ldp x29, x30, [sp], #16",
        "    ret",
    ]));
    lines
}

pub fn write_arm64(program: &LoweredProgram) -> Result<String> {
    let mut texts = Vec::new();
    let calls = returns_by_name(program);
    let mut functions = Vec::new();
    for item in all_functions(program) {
        functions.push(arm_function(item, &calls, &mut texts)?);
    }
    let mut lines: SourceLines = comments("//", &program.comments, "");
    if !program.comments.is_empty() {
        lines.push(String::new());
    }
    lines.push("    .global main".into());
    lines.extend(data_section(&texts));
    lines.push(String::new());
    lines.push("    .text".into());
    for function in functions {
        lines.extend(function);
        lines.push(String::new());
    }
    if creates_arrays(program) {
        lines.extend(ARM_NEW_ARRAY.map(String::from));
    }
    lines.extend(arm_helper("print_integer", &["mov x1, x0"]));
    lines.push(String::new());
    lines.extend(arm_helper("print_text", &["mov x1, x0"]));
    lines.push(String::new());
    lines.extend(arm_helper("print_newline", &[]));
    lines.push(String::new());
    lines.push("    .section .note.GNU-stack,\"\",%progbits".into());
    lines.push(String::new());
    Ok(lines.render_ending("arm64", ""))
}
