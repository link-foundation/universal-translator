//! Reading of LLVM IR back into the stack machine code described in
//! [`super::lowering`]. The IR keeps every stack slot in an alloca and every
//! intermediate value in a temporary, so the reader rebuilds expression trees
//! from the temporaries and writes them out in the order the stack machine
//! evaluates them: operands first, then the operation. A temporary that is
//! used more than once (an array literal being filled) stays on the stack,
//! with a dup before each use but the last. A value saved in a "%stack.N"
//! alloca around a jump or a label is a value that stays on the stack.

use std::collections::{HashMap, HashSet};

use regex::{Captures, Regex};

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::machine_reader_shared::{
    Result, decode_bytes, group, integer, leading_comments, pattern_regex, procedure, program,
    read_error, trimmed_lines,
};
use crate::emission_map::{
    Origins, active_origins, clone_source_line, current, line_origins, register_instructions,
};
use crate::meta::GrammarError;

fn llvm_relation(relation: &str) -> Option<&'static str> {
    Some(match relation {
        "eq" => "equal",
        "ne" => "notEqual",
        "slt" => "less",
        "sle" => "lessOrEqual",
        "sgt" => "greater",
        "sge" => "greaterOrEqual",
        _ => return None,
    })
}

fn llvm_arithmetic(operation: &str) -> &'static str {
    match operation {
        "add" => "add",
        "sub" => "subtract",
        "mul" => "multiply",
        "sdiv" => "divide",
        _ => "remainder",
    }
}

/// The bytes of a constant string, without the zero byte that ends it.
fn llvm_string(body: &str) -> String {
    let source = body.as_bytes();
    let mut bytes: Vec<u8> = Vec::new();
    let mut index = 0;
    while index < source.len() {
        if source[index] == b'\\' {
            let digits = body.get(index + 1..index + 3).unwrap_or("");
            bytes.push(u8::from_str_radix(digits, 16).unwrap_or(0));
            index += 3;
        } else {
            bytes.push(source[index]);
            index += 1;
        }
    }
    bytes.pop();
    decode_bytes(&bytes)
}

fn llvm_texts(lines: &[String]) -> HashMap<String, String> {
    let header = pattern_regex(r"^@(text\.\d+) = ");
    lines
        .iter()
        .filter_map(|line| {
            // `@text.0 = ... c"<body>"`: the body runs from the last ` c"`
            // to the closing quote (the JavaScript twin finds it the same way).
            let found = header.captures(line)?;
            let inner = line.strip_suffix('"')?;
            let start = inner.rfind(" c\"").filter(|&at| at >= found[0].len())?;
            Some((
                group(&found, 1).to_owned(),
                llvm_string(&inner[start + 3..]),
            ))
        })
        .collect()
}

/// How often each temporary is used.
fn use_counts(lines: &[String]) -> HashMap<String, i64> {
    let temporary = pattern_regex(r"%t\.\d+");
    let definition = pattern_regex(r"^(%t\.\d+) = ");
    let mut uses: HashMap<String, i64> = HashMap::new();
    for line in lines {
        for found in temporary.find_iter(line) {
            *uses.entry(found.as_str().to_owned()).or_insert(0) += 1;
        }
        if let Some(found) = definition.captures(line) {
            *uses.entry(group(&found, 1).to_owned()).or_insert(0) -= 1;
        }
    }
    uses
}

fn argument_list(text: &str) -> Vec<&str> {
    if text.is_empty() {
        Vec::new()
    } else {
        text.split(", ").collect()
    }
}

/// The value of an argument such as "i64 %t.1", without its type.
fn argument_value(text: &str) -> &str {
    match text.split_once(' ') {
        Some((first, rest)) if !first.is_empty() => rest,
        _ => text,
    }
}

#[derive(Clone)]
enum Operand {
    Push(f64),
    Temp(String),
}

#[derive(Clone)]
enum Node {
    OnStack,
    Load(usize),
    Binary(&'static str, Operand, Operand),
    Negate(Operand),
    Call(String, Vec<Operand>),
    NewArray(Vec<Operand>),
    LoadElement(String),
    ArrayLength(Operand),
    Gep(Operand, Operand),
    LengthAddress(Operand),
    Compare(&'static str, Operand, Operand),
}

#[derive(Clone, Copy)]
enum Line {
    Comment,
    Load,
    Negate,
    Binary,
    Compare,
    Gep,
    LengthAddress,
    CallValue,
    Store,
    CallVoid,
    Print,
    Branch,
    ConditionalBranch,
    ReturnNothing,
    ReturnValue,
    Unreachable,
    Label,
}

fn line_rules() -> Vec<(Line, Regex)> {
    let named = |pattern: &str| pattern_regex(&format!(r"^(%t\.\d+) = {pattern}$"));
    vec![
        (Line::Comment, pattern_regex(r"^; ?(.*)$")),
        (Line::Load, named(r"load (?:i64|ptr), ptr (\S+)")),
        (Line::Negate, named(r"sub nsw i64 0, (\S+)")),
        (
            Line::Binary,
            named(r"(add|sub|mul|sdiv|srem) i64 (\S+), (\S+)"),
        ),
        (Line::Compare, named(r"icmp (\w+) i64 (\S+), (\S+)")),
        (Line::Gep, named(r"getelementptr i64, ptr (\S+), i64 (\S+)")),
        (
            Line::LengthAddress,
            named(r"getelementptr i8, ptr (\S+), i64 -8"),
        ),
        (Line::CallValue, named(r"call (?:i64|ptr) @(\w+)\((.*)\)")),
        (
            Line::Store,
            pattern_regex(r"^store (?:i64|ptr) (\S+), ptr (\S+)$"),
        ),
        (Line::CallVoid, pattern_regex(r"^call void @(\w+)\((.*)\)$")),
        (
            Line::Print,
            pattern_regex(r"^call i32 \(ptr, \.\.\.\) @printf\((.*)\)$"),
        ),
        (Line::Branch, pattern_regex(r"^br label %(\S+)$")),
        (
            Line::ConditionalBranch,
            pattern_regex(r"^br i1 (\S+), label %(\S+), label %\S+$"),
        ),
        (Line::ReturnNothing, pattern_regex(r"^ret (?:void|i32 0)$")),
        (Line::ReturnValue, pattern_regex(r"^ret i64 (\S+)$")),
        (Line::Unreachable, pattern_regex(r"^unreachable$")),
        (Line::Label, pattern_regex(r"^([\w.]+):$")),
    ]
}

struct LlvmBody<'a> {
    lines: &'a [String],
    texts: &'a HashMap<String, String>,
    slots: &'a HashMap<String, usize>,
    parameters: &'a HashSet<String>,
    uses: HashMap<String, i64>,
    defs: HashMap<String, Node>,
    def_origins: HashMap<String, Origins>,
    emitted: HashSet<String>,
    remaining: HashMap<String, i64>,
    spills: Vec<(usize, Operand, Origins)>,
    code: Vec<Instruction>,
    code_origins: Vec<(usize, Origins)>,
    pending_origins: Origins,
    index: usize,
}

impl<'a> LlvmBody<'a> {
    fn new(
        lines: &'a [String],
        texts: &'a HashMap<String, String>,
        slots: &'a HashMap<String, usize>,
        parameters: &'a HashSet<String>,
    ) -> Self {
        LlvmBody {
            lines,
            texts,
            slots,
            parameters,
            uses: use_counts(lines),
            defs: HashMap::new(),
            def_origins: HashMap::new(),
            emitted: HashSet::new(),
            remaining: HashMap::new(),
            spills: Vec::new(),
            code: Vec::new(),
            code_origins: Vec::new(),
            pending_origins: Vec::new(),
            index: 0,
        }
    }

    fn push(&mut self, instruction: Instruction) {
        self.code_origins.push((self.code.len(), current()));
        self.code.push(instruction);
    }

    fn attach_last(&mut self, origins: Origins) {
        if let Some((_, previous)) = self.code_origins.last_mut() {
            previous.extend(origins);
        }
    }

    fn operand(&self, token: &str) -> Result<Operand> {
        if pattern_regex(r"^-?\d+$").is_match(token) {
            return Ok(Operand::Push(integer(token)?));
        }
        if self.defs.contains_key(token) {
            return Ok(Operand::Temp(token.to_owned()));
        }
        Err(read_error("llvm", token, "unknown value"))
    }

    fn slot(&self, address: &str) -> Result<usize> {
        address
            .strip_prefix('%')
            .and_then(|name| name.strip_suffix(".addr"))
            .and_then(|name| self.slots.get(name))
            .copied()
            .ok_or_else(|| read_error("llvm", address, "unknown stack slot"))
    }

    fn emit_operand(&mut self, operand: &Operand) -> Result<()> {
        match operand {
            Operand::Push(value) => self.push(Instruction::Push(*value)),
            Operand::Temp(name) => self.emit_temporary(name)?,
        }
        Ok(())
    }

    /// A temporary with a single use is written at that use; a temporary
    /// with several uses is written at the first and stays on the stack.
    fn emit_temporary(&mut self, name: &str) -> Result<()> {
        let enclosing = current();
        let _origin = active_origins(self.def_origins.get(name).cloned().unwrap_or_default());
        let node = self
            .defs
            .get(name)
            .cloned()
            .ok_or_else(|| read_error("llvm", name, "unknown value"))?;
        let total = self.uses.get(name).copied().unwrap_or(0);
        if total <= 1 {
            self.emit(&node)?;
            self.attach_last(enclosing);
            return Ok(());
        }
        if !self.emitted.contains(name) {
            self.emit(&node)?;
            self.emitted.insert(name.to_owned());
            self.remaining.insert(name.to_owned(), total);
        }
        let left = self.remaining.get(name).copied().unwrap_or(0) - 1;
        self.remaining.insert(name.to_owned(), left);
        if left > 0 {
            self.push(Instruction::Dup);
        }
        Ok(())
    }

    fn element(&mut self, address: &str) -> Result<()> {
        let _origin = active_origins(self.def_origins.get(address).cloned().unwrap_or_default());
        let Some(Node::Gep(array, index)) = self.defs.get(address).cloned() else {
            return Err(read_error("llvm", address, "not an element address"));
        };
        self.emit_operand(&array)?;
        self.emit_operand(&index)?;
        self.push(Instruction::ElementIndex);
        Ok(())
    }

    fn emit(&mut self, node: &Node) -> Result<()> {
        match node {
            Node::OnStack => self.attach_last(current()),
            Node::Gep(..) | Node::LengthAddress(_) | Node::Compare(..) => {}
            Node::Load(slot) => self.push(Instruction::Load(*slot)),
            Node::Binary(operation, left, right) => {
                self.emit_operand(left)?;
                self.emit_operand(right)?;
                self.push(Instruction::Arithmetic(operation));
            }
            Node::Negate(value) => {
                self.emit_operand(value)?;
                self.push(Instruction::Negate);
            }
            Node::Call(name, arguments) => {
                for argument in arguments {
                    self.emit_operand(argument)?;
                }
                self.push(Instruction::Call(name.clone(), arguments.len()));
            }
            Node::NewArray(arguments) => {
                for argument in arguments {
                    self.emit_operand(argument)?;
                }
                self.push(Instruction::NewArray);
            }
            Node::LoadElement(address) => {
                self.element(address)?;
                self.push(Instruction::LoadElement);
            }
            Node::ArrayLength(array) => {
                self.emit_operand(array)?;
                self.push(Instruction::ArrayLength);
            }
        }
        Ok(())
    }

    /// A value that is never used is dropped where it is made.
    fn define(&mut self, name: &str, node: Node) -> Result<()> {
        self.def_origins.insert(name.to_owned(), current());
        self.defs.insert(name.to_owned(), node.clone());
        let structural = matches!(
            node,
            // A spill reload creates no new stack value to drop.
            Node::Gep(..) | Node::LengthAddress(_) | Node::Compare(..) | Node::OnStack
        );
        if !structural && self.uses.get(name).copied().unwrap_or(0) == 0 {
            self.emit(&node)?;
            self.push(Instruction::Pop);
        }
        Ok(())
    }

    fn call_node(&self, name: &str, arguments: &str) -> Result<Node> {
        let values = argument_list(arguments)
            .into_iter()
            .map(|argument| self.operand(argument_value(argument)))
            .collect::<Result<Vec<_>>>()?;
        Ok(if name == "new_array" {
            Node::NewArray(values)
        } else {
            Node::Call(name.to_owned(), values)
        })
    }

    fn load(&mut self, name: &str, address: &str) -> Result<()> {
        if address.starts_with("%stack.") {
            return self.define(name, Node::OnStack);
        }
        let node = match self.defs.get(address) {
            Some(Node::Gep(..)) => Node::LoadElement(address.to_owned()),
            Some(Node::LengthAddress(array)) => Node::ArrayLength(array.clone()),
            _ => Node::Load(self.slot(address)?),
        };
        self.define(name, node)
    }

    fn store(&mut self, value: &str, address: &str) -> Result<()> {
        if self.parameters.contains(value) {
            return Ok(());
        }
        let spill = pattern_regex(r"^%stack\.(?:ptr\.)?(\d+)$");
        if let Some(found) = spill.captures(address) {
            let index = group(&found, 1).parse::<usize>().unwrap_or(0);
            let node = self.operand(value)?;
            self.spills.push((index, node, current()));
        } else if matches!(self.defs.get(address), Some(Node::Gep(..))) {
            self.element(address)?;
            let operand = self.operand(value)?;
            self.emit_operand(&operand)?;
            self.push(Instruction::StoreElement);
        } else {
            let operand = self.operand(value)?;
            self.emit_operand(&operand)?;
            self.push(Instruction::Store(self.slot(address)?));
        }
        Ok(())
    }

    /// The values saved around a jump go on the stack in the order of their
    /// positions.
    fn flush_spills(&mut self) -> Result<()> {
        let mut spills = std::mem::take(&mut self.spills);
        spills.sort_by_key(|(index, _, _)| *index);
        for (_, operand, origins) in spills {
            let _origin = active_origins(origins.clone());
            self.emit_operand(&operand)?;
            self.attach_last(origins);
        }
        Ok(())
    }

    fn branch(&mut self, target: &str) -> Result<()> {
        self.flush_spills()?;
        let next = format!("{target}:");
        if self.lines.get(self.index + 1) != Some(&next) {
            self.push(Instruction::Jump(target.to_owned()));
        } else {
            self.pending_origins.extend(current());
        }
        Ok(())
    }

    fn conditional_branch(&mut self, condition: &str, target: &str) -> Result<()> {
        let mut origins = current();
        origins.extend(self.def_origins.get(condition).cloned().unwrap_or_default());
        let _origin = active_origins(origins);
        self.flush_spills()?;
        let Some(Node::Compare(relation, left, right)) = self.defs.get(condition).cloned() else {
            return Err(read_error("llvm", condition, "not a comparison"));
        };
        self.emit_operand(&left)?;
        self.emit_operand(&right)?;
        self.push(Instruction::CompareJump(relation, target.to_owned()));
        Ok(())
    }

    fn print(&mut self, text: &str) -> Result<()> {
        let parts: Vec<&str> = text.split(", ").collect();
        if parts[0] == "ptr @integer_format" {
            let operand = self.operand(argument_value(parts.get(1).copied().unwrap_or("")))?;
            self.emit_operand(&operand)?;
            self.push(Instruction::PrintInteger);
        } else if parts[0] == "ptr @text_format" {
            let key = parts.get(1).and_then(|part| part.get(5..)).unwrap_or("");
            let text = self.texts.get(key).cloned().unwrap_or_default();
            self.push(Instruction::PrintText(text));
        } else {
            self.push(Instruction::PrintNewline);
        }
        Ok(())
    }

    fn run(&mut self, kind: Line, found: &Captures) -> Result<()> {
        let at = |index: usize| group(found, index);
        match kind {
            Line::Comment => self.push(Instruction::Comment(at(1).into())),
            Line::Load => self.load(at(1), at(2))?,
            Line::Negate => {
                let value = self.operand(at(2))?;
                self.define(at(1), Node::Negate(value))?;
            }
            Line::Binary => {
                let node = Node::Binary(
                    llvm_arithmetic(at(2)),
                    self.operand(at(3))?,
                    self.operand(at(4))?,
                );
                self.define(at(1), node)?;
            }
            Line::Compare => {
                let relation = llvm_relation(at(2))
                    .ok_or_else(|| read_error("llvm", at(0), "unknown comparison"))?;
                let node = Node::Compare(relation, self.operand(at(3))?, self.operand(at(4))?);
                self.define(at(1), node)?;
            }
            Line::Gep => {
                let node = Node::Gep(self.operand(at(2))?, self.operand(at(3))?);
                self.define(at(1), node)?;
            }
            Line::LengthAddress => {
                let node = Node::LengthAddress(self.operand(at(2))?);
                self.define(at(1), node)?;
            }
            Line::CallValue => {
                let node = self.call_node(at(2), at(3))?;
                self.define(at(1), node)?;
            }
            Line::Store => self.store(at(1), at(2))?,
            Line::CallVoid => {
                let node = self.call_node(at(1), at(2))?;
                self.emit(&node)?;
            }
            Line::Print => self.print(at(1))?,
            Line::Branch => self.branch(at(1))?,
            Line::ConditionalBranch => self.conditional_branch(at(1), at(2))?,
            Line::ReturnNothing => self.push(Instruction::ReturnNothing),
            Line::ReturnValue => {
                let operand = self.operand(at(1))?;
                self.emit_operand(&operand)?;
                self.push(Instruction::Return);
            }
            Line::Unreachable => {}
            Line::Label => {
                if !pattern_regex(r"^(entry|next|dead)\.\d+$").is_match(at(1)) {
                    self.push(Instruction::Label(at(1).into()));
                } else {
                    self.attach_last(current());
                }
            }
        }
        Ok(())
    }

    fn read(mut self) -> Result<Vec<Instruction>> {
        let rules = line_rules();
        let lines = self.lines;
        while self.index < lines.len() {
            let line = &lines[self.index];
            let _origin = active_origins(line_origins(line));
            let (kind, found) = rules
                .iter()
                .find_map(|(kind, pattern)| pattern.captures(line).map(|found| (*kind, found)))
                .ok_or_else(|| read_error("llvm", line, "unknown instruction"))?;
            let start = self.code.len();
            self.run(kind, &found)?;
            if self.code.len() > start
                && !self.pending_origins.is_empty()
                && let Some((_, origins)) = self.code_origins.get_mut(start)
            {
                origins.extend(std::mem::take(&mut self.pending_origins));
            }
            self.index += 1;
        }
        register_instructions(&self.code, self.code_origins);
        Ok(self.code)
    }
}

fn read_llvm_function(
    header: &Captures,
    comments: Vec<String>,
    lines: &[String],
    texts: &HashMap<String, String>,
) -> Result<Procedure> {
    let result = group(header, 1);
    let name = group(header, 2);
    let parameters: Vec<String> = argument_list(group(header, 3))
        .into_iter()
        .map(|item| argument_value(item).to_owned())
        .collect();
    let slot = pattern_regex(r"^%(.+)\.addr = alloca \w+$");
    let alloca = pattern_regex(r"^%\S+ = alloca \w+$");
    let mut slots: HashMap<String, usize> = HashMap::new();
    let mut slot_names: Vec<String> = Vec::new();
    let mut body: Vec<String> = Vec::new();
    for line in lines {
        if let Some(found) = slot.captures(line) {
            slots.insert(group(&found, 1).to_owned(), slots.len());
            slot_names.push(group(&found, 1).to_owned());
        } else if !alloca.is_match(line) {
            body.push(clone_source_line(line));
        }
    }
    let set: HashSet<String> = parameters.iter().cloned().collect();
    let code = LlvmBody::new(&body, texts, &slots, &set).read()?;
    Ok(procedure(
        name.to_owned(),
        parameters.len(),
        slot_names,
        result == "i64",
        comments,
        code,
    ))
}

/// Read LLVM IR written in the style of the LLVM writer.
pub fn read_llvm(source: &str) -> Result<LoweredProgram> {
    let lines = trimmed_lines(source);
    let (comments, rest) = leading_comments(&lines, ";", r"^declare i32 @printf");
    let texts = llvm_texts(&rest);
    let header = pattern_regex(r"^define (i32|i64|void) @(\w+)\((.*)\) \{$");
    let mut items = Vec::new();
    let mut pending: Vec<String> = Vec::new();
    let mut index = 0;
    while index < rest.len() {
        let line = &rest[index];
        if let Some(text) = line.strip_prefix(';') {
            pending.push(crate::emission_map::map_source_line(line, |_| {
                text.strip_prefix(' ').unwrap_or(text).to_owned()
            }));
        } else if let Some(found) = header.captures(line) {
            let end = rest[index..]
                .iter()
                .position(|item| item == "}")
                .map(|offset| index + offset)
                .ok_or_else(|| GrammarError::new("The LLVM function has no closing brace"))?;
            items.push(read_llvm_function(
                &found,
                std::mem::take(&mut pending),
                &rest[index + 1..end],
                &texts,
            )?);
            index = end;
        } else if !line.is_empty() {
            pending.clear();
        }
        index += 1;
    }
    program(comments, items)
}
