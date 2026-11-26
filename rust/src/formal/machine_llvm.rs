//! LLVM IR (opaque pointers, LLVM 15 or later) written from the stack machine
//! code of the lowering. Every stack slot is an alloca, so the code stays in
//! SSA form without phi nodes; the writer keeps the machine's stack as a list
//! of operands, and a stack that is not empty at a jump or a label is saved
//! in "%stack.N" allocas around it.

use crate::emission_map::{SourceLines, active_instruction};
use std::collections::HashMap;

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::machine_shared::{all_functions, comments, creates_arrays, printable, returns_by_name};
use crate::meta::{GrammarError, format_number};

type Result<T> = std::result::Result<T, GrammarError>;

fn llvm_relation(relation: &str) -> &'static str {
    match relation {
        "equal" => "eq",
        "notEqual" => "ne",
        "less" => "slt",
        "lessOrEqual" => "sle",
        "greater" => "sgt",
        _ => "sge",
    }
}

fn llvm_arithmetic(operation: &str) -> &'static str {
    match operation {
        "add" => "add",
        "subtract" => "sub",
        "multiply" => "mul",
        "divide" => "sdiv",
        _ => "srem",
    }
}

/// A constant string and its size: printable ASCII stays readable, other
/// bytes are hexadecimal escapes. Every string ends with a zero byte.
pub fn llvm_text(text: &str) -> String {
    let bytes = text.as_bytes();
    let body: String = bytes
        .iter()
        .map(|&byte| {
            if printable(byte) {
                (byte as char).to_string()
            } else {
                format!("\\{byte:02X}")
            }
        })
        .collect();
    format!("[{} x i8] c\"{body}\\00\"", bytes.len() + 1)
}

const PRINTF: &str = "call i32 (ptr, ...) @printf";

#[derive(Clone)]
struct Operand {
    value: String,
    kind: &'static str,
    reload: i64,
}

struct LlvmFunction<'a> {
    item: &'a Procedure,
    calls: &'a HashMap<String, bool>,
    texts: &'a mut Vec<String>,
    lines: SourceLines,
    stack: Vec<Operand>,
    temporaries: usize,
    blocks: usize,
    terminated: bool,
    label_types: HashMap<String, Vec<&'static str>>,
    spilled: Vec<String>,
}

fn spill_address(kind: &str, index: usize) -> String {
    if kind == "ptr" {
        format!("%stack.ptr.{index}")
    } else {
        format!("%stack.{index}")
    }
}

impl<'a> LlvmFunction<'a> {
    fn new(
        item: &'a Procedure,
        calls: &'a HashMap<String, bool>,
        texts: &'a mut Vec<String>,
    ) -> Self {
        LlvmFunction {
            item,
            calls,
            texts,
            lines: SourceLines::default(),
            stack: Vec::new(),
            temporaries: 0,
            blocks: 0,
            terminated: false,
            label_types: HashMap::new(),
            spilled: Vec::new(),
        }
    }

    fn temporary(&mut self) -> String {
        self.temporaries += 1;
        format!("%t.{}", self.temporaries)
    }

    fn open(&mut self, name: &str) {
        self.lines.push(format!("{name}:"));
        self.terminated = false;
    }

    /// An instruction after a branch or a return starts a block that nothing
    /// jumps to.
    fn emit(&mut self, line: &str, terminates: bool) {
        if self.terminated {
            self.blocks += 1;
            let name = format!("dead.{}", self.blocks);
            self.open(&name);
        }
        self.lines.push(format!("  {line}"));
        self.terminated = terminates;
    }

    fn slot_type(&self, slot: usize) -> &'static str {
        if self.item.slot_arrays.get(slot) == Some(&true) {
            "ptr"
        } else {
            "i64"
        }
    }

    fn slot_address(&self, slot: usize) -> String {
        format!("%{}.addr", self.item.slot_names[slot])
    }

    fn push(&mut self, value: String, kind: &'static str) {
        self.stack.push(Operand {
            value,
            kind,
            reload: -1,
        });
    }

    fn define(&mut self, instruction: &str, kind: &'static str) {
        let result = self.temporary();
        self.emit(&format!("{result} = {instruction}"), false);
        self.push(result, kind);
    }

    fn pop(&mut self) -> String {
        self.stack
            .pop()
            .map(|entry| entry.value)
            .unwrap_or_default()
    }

    fn stack_types(&self) -> Vec<&'static str> {
        self.stack.iter().map(|entry| entry.kind).collect()
    }

    /// Save the stack in allocas so that a label can bring it back.
    fn save(&mut self, label: &str) {
        let types = self.stack_types();
        self.label_types.entry(label.to_owned()).or_insert(types);
        for (index, entry) in self.stack.clone().iter().enumerate() {
            if entry.reload != index as i64 {
                let address = spill_address(entry.kind, index);
                if !self.spilled.contains(&address) {
                    self.spilled.push(address.clone());
                }
                self.emit(
                    &format!("store {} {}, ptr {address}", entry.kind, entry.value),
                    false,
                );
            }
        }
    }

    fn restore(&mut self, types: &[&'static str]) {
        self.stack = Vec::new();
        for (index, kind) in types.iter().enumerate() {
            let result = self.temporary();
            self.emit(
                &format!("{result} = load {kind}, ptr {}", spill_address(kind, index)),
                false,
            );
            self.stack.push(Operand {
                value: result,
                kind,
                reload: index as i64,
            });
        }
    }

    fn label(&mut self, name: &str) {
        let mut types = self.label_types.get(name).cloned().unwrap_or_default();
        if !self.terminated {
            self.save(name);
            types = self.label_types.get(name).cloned().unwrap_or_default();
            self.emit(&format!("br label %{name}"), true);
        }
        self.open(name);
        self.restore(&types);
    }

    fn compare_jump(&mut self, relation: &str, label: &str) {
        let right = self.pop();
        let left = self.pop();
        let condition = self.temporary();
        self.emit(
            &format!(
                "{condition} = icmp {} i64 {left}, {right}",
                llvm_relation(relation)
            ),
            false,
        );
        self.save(label);
        let types = self.stack_types();
        self.blocks += 1;
        let next = format!("next.{}", self.blocks);
        self.emit(
            &format!("br i1 {condition}, label %{label}, label %{next}"),
            true,
        );
        self.open(&next);
        self.restore(&types);
    }

    fn call(&mut self, name: &str, count: usize) {
        let values = self.stack.split_off(self.stack.len().saturating_sub(count));
        let arguments = values
            .iter()
            .map(|entry| format!("i64 {}", entry.value))
            .collect::<Vec<_>>()
            .join(", ");
        if self.calls.get(name).copied().unwrap_or(false) {
            self.define(&format!("call i64 @{name}({arguments})"), "i64");
        } else {
            self.emit(&format!("call void @{name}({arguments})"), false);
        }
    }

    fn element(&mut self, array: &str, index: &str) -> String {
        let address = self.temporary();
        self.emit(
            &format!("{address} = getelementptr i64, ptr {array}, i64 {index}"),
            false,
        );
        address
    }

    fn text_name(&mut self, text: &str) -> String {
        let index = match self.texts.iter().position(|known| known == text) {
            Some(index) => index,
            None => {
                self.texts.push(text.to_owned());
                self.texts.len() - 1
            }
        };
        format!("text.{index}")
    }

    fn instruction(&mut self, instruction: &Instruction) {
        match instruction {
            Instruction::Comment(text) => {
                self.lines
                    .extend(comments(";", std::slice::from_ref(text), "  "));
            }
            Instruction::Push(value) => self.push(format_number(*value), "i64"),
            Instruction::Load(slot) => {
                let kind = self.slot_type(*slot);
                let address = self.slot_address(*slot);
                self.define(&format!("load {kind}, ptr {address}"), kind);
            }
            Instruction::Store(slot) => {
                let kind = self.slot_type(*slot);
                let address = self.slot_address(*slot);
                let value = self.pop();
                self.emit(&format!("store {kind} {value}, ptr {address}"), false);
            }
            Instruction::Pop => {
                self.pop();
            }
            Instruction::Arithmetic(name) => {
                let right = self.pop();
                let left = self.pop();
                self.define(
                    &format!("{} i64 {left}, {right}", llvm_arithmetic(name)),
                    "i64",
                );
            }
            Instruction::Negate => {
                let value = self.pop();
                self.define(&format!("sub nsw i64 0, {value}"), "i64");
            }
            Instruction::Label(name) => self.label(name),
            Instruction::Jump(name) => {
                self.save(name);
                self.emit(&format!("br label %{name}"), true);
            }
            Instruction::CompareJump(relation, name) => self.compare_jump(relation, name),
            Instruction::Call(name, count) => self.call(name, *count),
            Instruction::Return => {
                let value = self.pop();
                self.emit(&format!("ret i64 {value}"), true);
            }
            Instruction::ReturnNothing => {
                let line = if self.item.name == "main" {
                    "ret i32 0"
                } else {
                    "ret void"
                };
                self.emit(line, true);
            }
            Instruction::PrintInteger => {
                let value = self.pop();
                self.emit(
                    &format!("{PRINTF}(ptr @integer_format, i64 {value})"),
                    false,
                );
            }
            Instruction::PrintText(text) => {
                let name = self.text_name(text);
                self.emit(&format!("{PRINTF}(ptr @text_format, ptr @{name})"), false);
            }
            Instruction::PrintNewline => {
                self.emit(&format!("{PRINTF}(ptr @newline_format)"), false)
            }
            Instruction::NewArray => {
                let fill = self.pop();
                let length = self.pop();
                self.define(
                    &format!("call ptr @new_array(i64 {length}, i64 {fill})"),
                    "ptr",
                );
            }
            Instruction::Dup => {
                if let Some(top) = self.stack.last().cloned() {
                    self.stack.push(Operand { reload: -1, ..top });
                }
            }
            Instruction::ElementIndex => {}
            Instruction::LoadElement => {
                let index = self.pop();
                let array = self.pop();
                let address = self.element(&array, &index);
                self.define(&format!("load i64, ptr {address}"), "i64");
            }
            Instruction::StoreElement => {
                let value = self.pop();
                let index = self.pop();
                let array = self.pop();
                let address = self.element(&array, &index);
                self.emit(&format!("store i64 {value}, ptr {address}"), false);
            }
            Instruction::ArrayLength => {
                let address = self.temporary();
                let array = self.pop();
                self.emit(
                    &format!("{address} = getelementptr i8, ptr {array}, i64 -8"),
                    false,
                );
                self.define(&format!("load i64, ptr {address}"), "i64");
            }
        }
    }

    fn write(mut self) -> SourceLines {
        let item = self.item;
        let is_main = item.name == "main";
        for instruction in &item.code {
            let _origin = active_instruction(instruction);
            self.instruction(instruction);
        }
        if !self.terminated {
            self.emit("unreachable", true);
        }
        let names = &item.slot_names[..item.parameter_count];
        let parameters = names
            .iter()
            .map(|name| format!("i64 %{name}"))
            .collect::<Vec<_>>()
            .join(", ");
        let result = if is_main {
            "i32"
        } else if item.returns {
            "i64"
        } else {
            "void"
        };
        let mut lines: SourceLines = comments(";", &item.comments, "").into();
        lines.push(format!("define {result} @{}({parameters}) {{", item.name));
        lines.push("entry.0:".into());
        for (slot, name) in item.slot_names.iter().enumerate() {
            lines.push(format!("  %{name}.addr = alloca {}", self.slot_type(slot)));
        }
        for address in &self.spilled {
            let kind = if address.starts_with("%stack.ptr") {
                "ptr"
            } else {
                "i64"
            };
            lines.push(format!("  {address} = alloca {kind}"));
        }
        for name in names {
            lines.push(format!("  store i64 %{name}, ptr %{name}.addr"));
        }
        lines.extend(self.lines);
        lines.push("}".into());
        lines
    }
}

/// new_array(length, fill): malloc room for the length and the elements,
/// then fill them. The memory lives until the program ends.
const LLVM_NEW_ARRAY: [&str; 21] = [
    "define private ptr @new_array(i64 %length, i64 %fill) {",
    "entry.0:",
    "  %bytes = shl i64 %length, 3",
    "  %size = add i64 %bytes, 8",
    "  %block = call ptr @malloc(i64 %size)",
    "  store i64 %length, ptr %block",
    "  %elements = getelementptr i64, ptr %block, i64 1",
    "  br label %fill.test",
    "fill.test:",
    "  %index = phi i64 [ 0, %entry.0 ], [ %next, %fill.body ]",
    "  %more = icmp slt i64 %index, %length",
    "  br i1 %more, label %fill.body, label %fill.done",
    "fill.body:",
    "  %address = getelementptr i64, ptr %elements, i64 %index",
    "  store i64 %fill, ptr %address",
    "  %next = add i64 %index, 1",
    "  br label %fill.test",
    "fill.done:",
    "  ret ptr %elements",
    "}",
    "",
];

pub fn write_llvm(program: &LoweredProgram) -> Result<String> {
    let mut texts = Vec::new();
    let calls = returns_by_name(program);
    let mut functions = Vec::new();
    for item in all_functions(program) {
        functions.push(LlvmFunction::new(item, &calls, &mut texts).write());
    }
    let constant = |name: &str, text: &str| {
        format!(
            "@{name} = private unnamed_addr constant {}",
            llvm_text(text)
        )
    };
    let mut lines: SourceLines = comments(";", &program.comments, "").into();
    if !program.comments.is_empty() {
        lines.push(String::new());
    }
    lines.push("declare i32 @printf(ptr, ...)".into());
    if creates_arrays(program) {
        lines.push("declare ptr @malloc(i64)".into());
    }
    lines.push(String::new());
    lines.push(constant("integer_format", "%lld"));
    lines.push(constant("text_format", "%s"));
    lines.push(constant("newline_format", "\n"));
    for (index, text) in texts.iter().enumerate() {
        lines.push(constant(&format!("text.{index}"), text));
    }
    lines.push(String::new());
    for function in functions {
        lines.extend(function);
        lines.push(String::new());
    }
    if creates_arrays(program) {
        lines.extend(LLVM_NEW_ARRAY.map(String::from));
    }
    let text = lines.render_ending("llvm", "");
    Ok(format!("{}\n", text.trim_end_matches('\n')))
}
