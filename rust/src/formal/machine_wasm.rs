//! WebAssembly text (WAT) written from the stack machine code of the
//! lowering. Every value is an i64; an array is the address of its first
//! element, with its length in the eight bytes before it. A label is a block
//! that ends where its code starts, so a forward jump is a branch out of that
//! block. A program with a backward jump runs inside a loop that re-enters
//! the blocks through a br_table on the label number. A value on the stack at
//! a jump or a label is kept in a "$.stack.N" local, because a block starts
//! with an empty stack. The host provides print_integer, print_text and
//! print_newline.

use crate::emission_map::{SourceLines, active_instruction};
use std::collections::{BTreeSet, HashMap};

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::machine_shared::{
    all_functions, comments, creates_arrays, label_names, printable, returns_by_name,
};
use crate::meta::{GrammarError, format_number};

type Result<T> = std::result::Result<T, GrammarError>;

fn wat_relation(relation: &str) -> &'static str {
    match relation {
        "equal" => "i64.eq",
        "notEqual" => "i64.ne",
        "less" => "i64.lt_s",
        "lessOrEqual" => "i64.le_s",
        "greater" => "i64.gt_s",
        _ => "i64.ge_s",
    }
}

fn wat_arithmetic(operation: &str) -> &'static str {
    match operation {
        "add" => "i64.add",
        "subtract" => "i64.sub",
        "multiply" => "i64.mul",
        "divide" => "i64.div_s",
        _ => "i64.rem_s",
    }
}

/// How much each instruction changes the stack depth.
fn stack_effect(instruction: &Instruction) -> i64 {
    match instruction {
        Instruction::Push(_) | Instruction::Load(_) | Instruction::Dup => 1,
        Instruction::Store(_)
        | Instruction::Pop
        | Instruction::Arithmetic(_)
        | Instruction::Return
        | Instruction::PrintInteger
        | Instruction::NewArray
        | Instruction::LoadElement => -1,
        Instruction::CompareJump(..) => -2,
        Instruction::StoreElement => -3,
        _ => 0,
    }
}

/// The bytes of a string literal: printable ASCII stays readable, the other
/// bytes are hexadecimal escapes.
pub fn wat_text(text: &str) -> String {
    let body: String = text
        .bytes()
        .map(|byte| {
            if printable(byte) {
                (byte as char).to_string()
            } else {
                format!("\\{byte:02X}")
            }
        })
        .collect();
    format!("\"{body}\"")
}

fn spill_lines(depth: usize) -> Vec<String> {
    (0..depth)
        .rev()
        .map(|index| format!("local.set $.stack.{index}"))
        .collect()
}

fn reload(depth: usize) -> Vec<String> {
    (0..depth)
        .map(|index| format!("local.get $.stack.{index}"))
        .collect()
}

/// A jump to a label before the code that is being written needs the loop.
fn has_backward_jump(item: &Procedure) -> bool {
    let labels = label_names(item);
    let number = |label: &str| {
        labels
            .iter()
            .position(|name| name == label)
            .map_or(0, |i| i + 1)
    };
    let mut section = 0;
    item.code.iter().any(|instruction| match instruction {
        Instruction::Label(_) => {
            section += 1;
            false
        }
        Instruction::Jump(label) | Instruction::CompareJump(_, label) => number(label) <= section,
        _ => false,
    })
}

/// The position of each text in memory: its offset and its length.
#[derive(Default)]
struct Texts {
    entries: Vec<(String, usize, usize)>,
    size: usize,
}

impl Texts {
    fn place(&mut self, text: &str) -> (usize, usize) {
        if let Some((_, offset, length)) = self.entries.iter().find(|(known, ..)| known == text) {
            return (*offset, *length);
        }
        let length = text.len();
        self.entries.push((text.to_owned(), self.size, length));
        self.size += length;
        (self.size - length, length)
    }
}

struct WatFunction<'a> {
    item: &'a Procedure,
    calls: &'a HashMap<String, bool>,
    texts: &'a mut Texts,
    labels: Vec<String>,
    dispatch: bool,
    body: SourceLines,
    depth: usize,
    spilled: usize,
    terminated: bool,
    section: usize,
    label_depths: HashMap<String, usize>,
    helpers: BTreeSet<&'static str>,
}

impl<'a> WatFunction<'a> {
    fn new(item: &'a Procedure, calls: &'a HashMap<String, bool>, texts: &'a mut Texts) -> Self {
        WatFunction {
            item,
            calls,
            texts,
            labels: label_names(item),
            dispatch: has_backward_jump(item),
            body: SourceLines::default(),
            depth: 0,
            spilled: 0,
            terminated: false,
            section: 0,
            label_depths: HashMap::new(),
            helpers: BTreeSet::new(),
        }
    }

    /// Lines that move the stack into its locals.
    fn spill(&mut self, depth: usize) -> Vec<String> {
        self.spilled = self.spilled.max(depth);
        spill_lines(depth)
    }

    fn add(&mut self, lines: Vec<String>) {
        self.body
            .extend(lines.into_iter().map(|line| format!("    {line}")));
    }

    fn change(&mut self, effect: i64) {
        self.depth = (self.depth as i64 + effect).max(0) as usize;
    }

    fn number(&self, label: &str) -> usize {
        self.labels
            .iter()
            .position(|name| name == label)
            .map_or(0, |index| index + 1)
    }

    /// Where a jump to the label with the stack as it is now ends up.
    fn record_depth(&mut self, label: &str) {
        let depth = self.depth;
        self.label_depths.entry(label.to_owned()).or_insert(depth);
    }

    fn backward(&mut self, label: &str) -> Vec<String> {
        self.helpers.insert(".pc");
        vec![
            format!("i32.const {}", self.number(label)),
            "local.set $.pc".into(),
            "br $dispatch".into(),
        ]
    }

    fn jump(&mut self, label: &str) {
        self.record_depth(label);
        let forward = self.number(label) > self.section;
        let mut lines = self.spill(self.depth);
        if forward {
            lines.push(format!("br ${label}"));
        } else {
            lines.extend(self.backward(label));
        }
        self.add(lines);
        self.terminated = true;
    }

    fn compare_jump(&mut self, relation: &str, label: &str) {
        self.change(-2);
        let depth = self.depth;
        self.record_depth(label);
        let kept = depth > 0;
        if kept {
            self.helpers.insert(".cond");
        }
        let condition: Vec<String> = if kept {
            vec!["local.get $.cond".into()]
        } else {
            Vec::new()
        };
        let mut lines = vec![wat_relation(relation).to_owned()];
        if kept {
            lines.push("local.set $.cond".into());
            lines.extend(self.spill(depth));
        }
        self.add(lines);
        let mut lines = Vec::new();
        if self.number(label) > self.section {
            lines.extend(reload(depth));
            lines.extend(condition);
            lines.push(format!("br_if ${label}"));
        } else {
            lines.extend(condition);
            lines.push("if".into());
            lines.extend(self.backward(label));
            lines.push("end".into());
            lines.extend(reload(depth));
        }
        self.add(lines);
    }

    fn label(&mut self, name: &str) {
        if !self.terminated {
            self.record_depth(name);
            let lines = self.spill(self.depth);
            self.add(lines);
        }
        self.add(vec![format!("end ;; {name}")]);
        self.section += 1;
        self.depth = self.label_depths.get(name).copied().unwrap_or(0);
        self.add(reload(self.depth));
        self.terminated = false;
    }

    fn print_text(&mut self, text: &str) {
        let (offset, length) = self.texts.place(text);
        self.add(vec![
            format!("i32.const {offset}"),
            format!("i32.const {length}"),
            "call $print_text".into(),
        ]);
    }

    fn instruction(&mut self, instruction: &Instruction) {
        let slot_name = |slot: usize| format!("${}", self.item.slot_names[slot]);
        let lines: Vec<String> = match instruction {
            Instruction::Comment(text) => comments(";;", std::slice::from_ref(text), ""),
            Instruction::Load(slot) => vec![format!("local.get {}", slot_name(*slot))],
            Instruction::Store(slot) => vec![format!("local.set {}", slot_name(*slot))],
            Instruction::Label(name) => {
                self.label(name);
                Vec::new()
            }
            Instruction::Jump(name) => {
                self.jump(name);
                Vec::new()
            }
            Instruction::CompareJump(relation, name) => {
                self.compare_jump(relation, name);
                Vec::new()
            }
            Instruction::Return | Instruction::ReturnNothing => vec!["return".into()],
            Instruction::PrintText(text) => {
                self.print_text(text);
                Vec::new()
            }
            Instruction::Push(value) => vec![format!("i64.const {}", format_number(*value))],
            Instruction::Pop => vec!["drop".into()],
            Instruction::Arithmetic(name) => vec![wat_arithmetic(name).into()],
            Instruction::Negate => ["i64.const -1", "i64.xor", "i64.const 1", "i64.add"]
                .map(String::from)
                .to_vec(),
            Instruction::Call(name, _) => vec![format!("call ${name}")],
            Instruction::PrintInteger => vec!["call $print_integer".into()],
            Instruction::PrintNewline => vec!["call $print_newline".into()],
            Instruction::NewArray => vec!["call $new_array".into()],
            Instruction::Dup => {
                self.helpers.insert(".dup");
                vec!["local.tee $.dup".into(), "local.get $.dup".into()]
            }
            Instruction::ElementIndex => vec!["i64.const 3".into(), "i64.shl".into()],
            Instruction::LoadElement => ["i64.add", "i32.wrap_i64", "i64.load"]
                .map(String::from)
                .to_vec(),
            Instruction::StoreElement => {
                self.helpers.insert(".value");
                [
                    "local.set $.value",
                    "i64.add",
                    "i32.wrap_i64",
                    "local.get $.value",
                    "i64.store",
                ]
                .map(String::from)
                .to_vec()
            }
            Instruction::ArrayLength => ["i64.const 8", "i64.sub", "i32.wrap_i64", "i64.load"]
                .map(String::from)
                .to_vec(),
        };
        if !lines.is_empty() {
            self.add(lines);
        }
        if let Instruction::Call(name, count) = instruction {
            let returns = i64::from(!self.calls.get(name).copied().unwrap_or(false));
            self.change(1 - *count as i64 - returns);
        } else {
            self.change(stack_effect(instruction));
        }
        if matches!(
            instruction,
            Instruction::Return | Instruction::ReturnNothing
        ) {
            self.terminated = true;
        }
    }

    fn opening(&self) -> Vec<String> {
        let mut lines: Vec<String> = self
            .labels
            .iter()
            .rev()
            .map(|name| format!("block ${name}"))
            .collect();
        if !self.dispatch {
            return lines;
        }
        let mut targets = vec!["$start".to_owned()];
        targets.extend(self.labels.iter().map(|name| format!("${name}")));
        let mut opening = vec!["loop $dispatch".to_owned()];
        opening.append(&mut lines);
        opening.extend([
            "block $start".to_owned(),
            "local.get $.pc".to_owned(),
            format!("br_table {} $start", targets.join(" ")),
            "end ;; start".to_owned(),
        ]);
        opening
    }

    fn declarations(&self) -> Vec<String> {
        let item = self.item;
        let mut lines: Vec<String> = item.slot_names[item.parameter_count..]
            .iter()
            .map(|name| format!("(local ${name} i64)"))
            .collect();
        for name in [".pc", ".cond", ".dup", ".value"] {
            if self.helpers.contains(name) {
                let kind = if name == ".pc" || name == ".cond" {
                    "i32"
                } else {
                    "i64"
                };
                lines.push(format!("(local ${name} {kind})"));
            }
        }
        lines.extend((0..self.spilled).map(|index| format!("(local $.stack.{index} i64)")));
        lines
    }

    fn write(mut self) -> SourceLines {
        let item = self.item;
        let prologue = self.opening();
        for instruction in &item.code {
            let _origin = active_instruction(instruction);
            self.instruction(instruction);
        }
        let last_is_return = matches!(item.code.last(), Some(Instruction::Return));
        let needs_end = item.returns && (self.dispatch || !last_is_return);
        let parameters: String = item.slot_names[..item.parameter_count]
            .iter()
            .map(|name| format!(" (param ${name} i64)"))
            .collect();
        let result = if item.returns { " (result i64)" } else { "" };
        let exported = if item.name == "main" {
            " (export \"main\")"
        } else {
            ""
        };
        let mut lines: SourceLines = comments(";;", &item.comments, "  ").into();
        lines.push(format!(
            "  (func ${}{exported}{parameters}{result}",
            item.name
        ));
        lines.extend(
            self.declarations()
                .into_iter()
                .map(|line| format!("    {line}")),
        );
        lines.extend(prologue.into_iter().map(|line| format!("    {line}")));
        lines.extend(self.body);
        if self.dispatch {
            lines.push("    end ;; dispatch".into());
        }
        if needs_end {
            lines.push("    unreachable".into());
        }
        lines.push("  )".into());
        lines
    }
}

/// new_array(length, fill): the next free memory holds the length and then the
/// elements; the memory is never freed. It returns the address of the first
/// element.
const WAT_NEW_ARRAY: [&str; 43] = [
    "  (func $new_array (param $length i64) (param $fill i64) (result i64)",
    "    (local $block i32)",
    "    (local $index i64)",
    "    global.get $heap",
    "    local.set $block",
    "    global.get $heap",
    "    local.get $length",
    "    i32.wrap_i64",
    "    i32.const 3",
    "    i32.shl",
    "    i32.const 8",
    "    i32.add",
    "    i32.add",
    "    global.set $heap",
    "    local.get $block",
    "    local.get $length",
    "    i64.store",
    "    loop $fill",
    "      local.get $index",
    "      local.get $length",
    "      i64.lt_s",
    "      if",
    "        local.get $block",
    "        local.get $index",
    "        i32.wrap_i64",
    "        i32.const 3",
    "        i32.shl",
    "        i32.add",
    "        local.get $fill",
    "        i64.store offset=8",
    "        local.get $index",
    "        i64.const 1",
    "        i64.add",
    "        local.set $index",
    "        br $fill",
    "      end",
    "    end",
    "    local.get $block",
    "    i32.const 8",
    "    i32.add",
    "    i64.extend_i32_u",
    "  )",
    "",
];

pub fn write_wat(program: &LoweredProgram) -> Result<String> {
    let mut texts = Texts::default();
    let calls = returns_by_name(program);
    let functions: Vec<SourceLines> = all_functions(program)
        .map(|item| WatFunction::new(item, &calls, &mut texts).write())
        .collect();
    let arrays = creates_arrays(program);
    let heap = texts.size.div_ceil(8) * 8;
    let mut lines: SourceLines = comments(";;", &program.comments, "").into();
    if !program.comments.is_empty() {
        lines.push(String::new());
    }
    lines.extend(
        [
            "(module",
            "  (import \"env\" \"print_integer\" (func $print_integer (param i64)))",
            "  (import \"env\" \"print_text\" (func $print_text (param i32 i32)))",
            "  (import \"env\" \"print_newline\" (func $print_newline))",
            "  (memory (export \"memory\") 256)",
        ]
        .map(String::from),
    );
    for (text, offset, _) in &texts.entries {
        lines.push(format!("  (data (i32.const {offset}) {})", wat_text(text)));
    }
    if arrays {
        lines.push(format!("  (global $heap (mut i32) (i32.const {heap}))"));
    }
    lines.push(String::new());
    for (index, function) in functions.into_iter().enumerate() {
        if index > 0 {
            lines.push(String::new());
        }
        lines.extend(function);
    }
    if arrays {
        lines.push(String::new());
        lines.extend(
            WAT_NEW_ARRAY[..WAT_NEW_ARRAY.len() - 1]
                .iter()
                .map(|line| (*line).to_owned()),
        );
    }
    lines.push(")".into());
    lines.push(String::new());
    Ok(lines.render_ending("wat", ""))
}
