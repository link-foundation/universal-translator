//! Lowering of a typed meta program to a small stack machine, which the
//! machine writers spell as x86-64 assembly (NASM), CIL (ILAsm) or JVM
//! bytecode (Jasmin).
//!
//! The stack machine has these instructions:
//!
//! ```text
//! push n          load slot        store slot       pop
//! arithmetic op   (add subtract multiply divide remainder) negate
//! label L         jump L           compare-jump relation L
//! call name count return           return-nothing
//! print-integer   print-text value print-newline
//! comment text
//! new-array       (length, fill → array)       dup
//! element-index   (makes the integer on top an element index)
//! load-element    (array, index → value)       store-element (array,
//! array-length    (array → length)                 index, value → )
//! ```
//!
//! Integers are 64-bit. Text exists only as literal parts of printed values,
//! so every program that prints text, integers and their interpolations and
//! computes with integer functions, loops and conditions can be lowered.
//! Arrays of integers live in local slots; an array literal is a new array
//! of zeros whose elements are stored one by one.

use std::collections::HashMap;

use crate::meta::GrammarError;
use crate::meta::Node;

/// One stack machine instruction.
#[derive(Clone, Debug, PartialEq)]
pub enum Instruction {
    Comment(String),
    Push(f64),
    Load(usize),
    Store(usize),
    Pop,
    Arithmetic(&'static str),
    Negate,
    Label(String),
    Jump(String),
    CompareJump(&'static str, String),
    Call(String, usize),
    Return,
    ReturnNothing,
    PrintInteger,
    PrintText(String),
    PrintNewline,
    NewArray,
    Dup,
    ElementIndex,
    LoadElement,
    StoreElement,
    ArrayLength,
}

/// The stack machine code of one function (or of the main program).
#[derive(Clone, Debug, PartialEq)]
pub struct Procedure {
    pub name: String,
    pub parameter_count: usize,
    pub slot_count: usize,
    /// The variable name of each slot, in slot order.
    pub slot_names: Vec<String>,
    /// Whether each slot holds an array, in slot order.
    pub slot_arrays: Vec<bool>,
    pub returns: bool,
    pub max_depth: i64,
    pub comments: Vec<String>,
    pub code: Vec<Instruction>,
}

/// A lowered program: file comments, functions and the main procedure.
#[derive(Clone, Debug, PartialEq)]
pub struct LoweredProgram {
    pub comments: Vec<String>,
    pub functions: Vec<Procedure>,
    pub main: Procedure,
}

type Result<T> = std::result::Result<T, GrammarError>;

fn unsupported(what: &str) -> GrammarError {
    GrammarError::new(format!("Machine targets cannot lower {what}"))
}

fn is_relation(operator: &str) -> bool {
    matches!(
        operator,
        "equal" | "notEqual" | "less" | "lessOrEqual" | "greater" | "greaterOrEqual"
    )
}

fn opposite(relation: &str) -> &'static str {
    match relation {
        "equal" => "notEqual",
        "notEqual" => "equal",
        "less" => "greaterOrEqual",
        "lessOrEqual" => "greater",
        "greater" => "lessOrEqual",
        _ => "less",
    }
}

fn relation(operator: &str) -> &'static str {
    match operator {
        "equal" => "equal",
        "notEqual" => "notEqual",
        "less" => "less",
        "lessOrEqual" => "lessOrEqual",
        "greater" => "greater",
        _ => "greaterOrEqual",
    }
}

fn arithmetic(operator: &str) -> Option<&'static str> {
    match operator {
        "add" => Some("add"),
        "subtract" => Some("subtract"),
        "multiply" => Some("multiply"),
        "divide" | "integerDivide" => Some("divide"),
        "remainder" => Some("remainder"),
        _ => None,
    }
}

fn compound(operator: &str) -> Option<&'static str> {
    match operator {
        "+=" => Some("add"),
        "-=" => Some("subtract"),
        "*=" => Some("multiply"),
        "/=" => Some("divide"),
        "%=" => Some("remainder"),
        _ => None,
    }
}

fn is_array_value(value: &Node) -> bool {
    value.is("ArrayLiteral") || value.is("NewArray")
}

fn field<'a>(node: &'a Node, key: &str) -> Result<&'a Node> {
    node.node(key)
        .ok_or_else(|| unsupported(&format!("a {} without {key}", node.kind)))
}

struct FunctionLowering<'a> {
    name: String,
    returns: bool,
    functions: &'a HashMap<String, bool>,
    slots: HashMap<String, usize>,
    parameter_count: usize,
    arrays: std::collections::HashSet<String>,
    code: Vec<Instruction>,
    labels: usize,
    depth: i64,
    max_depth: i64,
}

impl<'a> FunctionLowering<'a> {
    fn new(
        name: &str,
        parameters: &[&Node],
        returns: bool,
        functions: &'a HashMap<String, bool>,
    ) -> Self {
        let mut slots = HashMap::new();
        for (index, parameter) in parameters.iter().enumerate() {
            slots.insert(parameter.str("name").unwrap_or_default().to_owned(), index);
        }
        FunctionLowering {
            name: name.to_owned(),
            returns,
            functions,
            parameter_count: parameters.len(),
            slots,
            arrays: std::collections::HashSet::new(),
            code: Vec::new(),
            labels: 0,
            depth: 0,
            max_depth: 0,
        }
    }

    fn emit(&mut self, instruction: Instruction) {
        let effect = match &instruction {
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
            Instruction::Call(callee, count) => {
                let returns = self.functions.get(callee).copied().unwrap_or(false);
                1 - *count as i64 - if returns { 0 } else { 1 }
            }
            _ => 0,
        };
        self.code.push(instruction);
        self.depth += effect;
        self.max_depth = self.max_depth.max(self.depth);
    }

    fn label(&mut self) -> String {
        self.labels += 1;
        format!("L{}", self.labels)
    }

    fn slot(&mut self, name: &str) -> usize {
        let next = self.slots.len();
        *self.slots.entry(name.to_owned()).or_insert(next)
    }

    fn known(&self, name: &str) -> Result<usize> {
        self.slots
            .get(name)
            .copied()
            .ok_or_else(|| GrammarError::new(format!("\"{name}\" is used before it is declared")))
    }

    fn block(&mut self, node: &Node) -> Result<()> {
        for statement in node.nodes("statements") {
            self.statement(statement)?;
        }
        Ok(())
    }

    fn statement(&mut self, node: &Node) -> Result<()> {
        match node.kind.as_str() {
            "Comment" => {
                self.emit(Instruction::Comment(
                    node.str("text").unwrap_or_default().to_owned(),
                ));
            }
            "Declaration" => {
                let value = field(node, "value")?;
                let name = node.str("name").unwrap_or_default();
                self.value(value)?;
                if node.str("type") == Some("array") || is_array_value(value) {
                    self.arrays.insert(name.to_owned());
                }
                let slot = self.slot(name);
                self.emit(Instruction::Store(slot));
            }
            "Assignment" => self.assignment(node)?,
            "IndexAssignment" => {
                let slot = self.known(node.str("name").unwrap_or_default())?;
                self.emit(Instruction::Load(slot));
                self.value(field(node, "index")?)?;
                self.emit(Instruction::ElementIndex);
                self.value(field(node, "value")?)?;
                self.emit(Instruction::StoreElement);
            }
            "If" => {
                let otherwise = self.label();
                let done = self.label();
                self.when_false(field(node, "condition")?, &otherwise)?;
                self.block(field(node, "then")?)?;
                self.emit(Instruction::Jump(done.clone()));
                self.emit(Instruction::Label(otherwise));
                if let Some(otherwise) = node.node("otherwise") {
                    if otherwise.is("Block") {
                        self.block(otherwise)?;
                    } else {
                        self.statement(otherwise)?;
                    }
                }
                self.emit(Instruction::Label(done));
            }
            "While" => {
                let top = self.label();
                let done = self.label();
                self.emit(Instruction::Label(top.clone()));
                self.when_false(field(node, "condition")?, &done)?;
                self.block(field(node, "body")?)?;
                self.emit(Instruction::Jump(top));
                self.emit(Instruction::Label(done));
            }
            "CountingLoop" => self.counting_loop(node)?,
            "Return" => match node.node("value") {
                Some(value) => {
                    self.value(value)?;
                    self.emit(Instruction::Return);
                }
                None => self.emit(Instruction::ReturnNothing),
            },
            "Print" => self.print(node)?,
            "Evaluate" => {
                let expression = field(node, "expression")?;
                self.value(expression)?;
                if !expression.is("Call") || self.returns_value(expression) {
                    self.emit(Instruction::Pop);
                }
            }
            kind => return Err(unsupported(&format!("the {kind} statement"))),
        }
        Ok(())
    }

    fn assignment(&mut self, node: &Node) -> Result<()> {
        let slot = self.known(node.str("name").unwrap_or_default())?;
        let operator = node.str("operator").unwrap_or("undefined");
        if operator == "=" {
            self.value(field(node, "value")?)?;
        } else if let Some(operation) = compound(operator) {
            self.emit(Instruction::Load(slot));
            self.value(field(node, "value")?)?;
            self.emit(Instruction::Arithmetic(operation));
        } else {
            return Err(unsupported(&format!("the {operator} assignment")));
        }
        self.emit(Instruction::Store(slot));
        Ok(())
    }

    /// `[a, b]` is a new array of two zeros whose elements become a and b.
    fn array_literal(&mut self, node: &Node) -> Result<()> {
        let elements = node.nodes("elements");
        self.emit(Instruction::Push(elements.len() as f64));
        self.emit(Instruction::Push(0.0));
        self.emit(Instruction::NewArray);
        for (index, element) in elements.into_iter().enumerate() {
            self.emit(Instruction::Dup);
            self.emit(Instruction::Push(index as f64));
            self.emit(Instruction::ElementIndex);
            self.value(element)?;
            self.emit(Instruction::StoreElement);
        }
        Ok(())
    }

    fn counting_loop(&mut self, node: &Node) -> Result<()> {
        let slot = self.slot(node.str("variable").unwrap_or_default());
        let top = self.label();
        let done = self.label();
        self.value(field(node, "start")?)?;
        self.emit(Instruction::Store(slot));
        self.emit(Instruction::Label(top.clone()));
        self.emit(Instruction::Load(slot));
        self.value(field(node, "end")?)?;
        self.emit(Instruction::CompareJump("greaterOrEqual", done.clone()));
        self.block(field(node, "body")?)?;
        self.emit(Instruction::Load(slot));
        self.emit(Instruction::Push(1.0));
        self.emit(Instruction::Arithmetic("add"));
        self.emit(Instruction::Store(slot));
        self.emit(Instruction::Jump(top));
        self.emit(Instruction::Label(done));
        Ok(())
    }

    fn print(&mut self, node: &Node) -> Result<()> {
        let value = field(node, "value")?;
        let parts = if value.is("Interpolation") {
            value.nodes("parts")
        } else {
            vec![value]
        };
        for part in parts {
            if part.is("Text") {
                let text = part.str("value").unwrap_or_default();
                if !text.is_empty() {
                    self.emit(Instruction::PrintText(text.to_owned()));
                }
            } else if part.str("type") == Some("integer") {
                self.value(part)?;
                self.emit(Instruction::PrintInteger);
            } else {
                let kind = part.str("type").unwrap_or("untyped");
                return Err(unsupported(&format!("printing a {kind} value")));
            }
        }
        if node.flag("newline").unwrap_or(false) {
            self.emit(Instruction::PrintNewline);
        }
        Ok(())
    }

    fn returns_value(&self, call: &Node) -> bool {
        call.str("callee")
            .and_then(|callee| self.functions.get(callee))
            .copied()
            .unwrap_or(false)
    }

    /// Push the value of an integer or boolean expression.
    fn value(&mut self, node: &Node) -> Result<()> {
        match node.kind.as_str() {
            "Number" => {
                let value = node.number("value").unwrap_or(0.0);
                if value.fract() != 0.0 || !value.is_finite() {
                    return Err(unsupported(&format!(
                        "the number {}",
                        crate::meta::format_number(value)
                    )));
                }
                self.emit(Instruction::Push(value));
            }
            "Boolean" => {
                let value = if node.flag("value").unwrap_or(false) {
                    1.0
                } else {
                    0.0
                };
                self.emit(Instruction::Push(value));
            }
            "Name" => {
                let slot = self.known(node.str("name").unwrap_or_default())?;
                self.emit(Instruction::Load(slot));
            }
            "Call" => {
                let callee = node.str("callee").unwrap_or_default();
                if !self.functions.contains_key(callee) {
                    return Err(unsupported(&format!(
                        "a call to the unknown function \"{callee}\""
                    )));
                }
                let arguments = node.nodes("arguments");
                for argument in &arguments {
                    self.value(argument)?;
                }
                self.emit(Instruction::Call(callee.to_owned(), arguments.len()));
            }
            "Unary" => {
                if node.str("operator") == Some("negate") {
                    self.value(field(node, "operand")?)?;
                    self.emit(Instruction::Negate);
                } else {
                    self.boolean_value(node)?;
                }
            }
            "Binary" => match arithmetic(node.str("operator").unwrap_or_default()) {
                Some(operation) => {
                    self.value(field(node, "left")?)?;
                    self.value(field(node, "right")?)?;
                    self.emit(Instruction::Arithmetic(operation));
                }
                None => self.boolean_value(node)?,
            },
            "ArrayLiteral" => self.array_literal(node)?,
            "NewArray" => {
                self.value(field(node, "length")?)?;
                self.value(field(node, "fill")?)?;
                self.emit(Instruction::NewArray);
            }
            "Index" => {
                self.value(field(node, "array")?)?;
                self.value(field(node, "index")?)?;
                self.emit(Instruction::ElementIndex);
                self.emit(Instruction::LoadElement);
            }
            "Length" => {
                self.value(field(node, "array")?)?;
                self.emit(Instruction::ArrayLength);
            }
            kind => return Err(unsupported(&format!("a {kind} value"))),
        }
        Ok(())
    }

    /// A condition used as a value becomes 1 or 0.
    fn boolean_value(&mut self, node: &Node) -> Result<()> {
        let otherwise = self.label();
        let done = self.label();
        self.when_false(node, &otherwise)?;
        self.emit(Instruction::Push(1.0));
        self.emit(Instruction::Jump(done.clone()));
        self.emit(Instruction::Label(otherwise));
        self.depth -= 1;
        self.emit(Instruction::Push(0.0));
        self.emit(Instruction::Label(done));
        Ok(())
    }

    /// Jump to the label when the condition is false; fall through otherwise.
    fn when_false(&mut self, node: &Node, target: &str) -> Result<()> {
        self.branch(node, target, false)
    }

    fn branch(&mut self, node: &Node, target: &str, jump_when: bool) -> Result<()> {
        let operator = node.str("operator").unwrap_or_default();
        if node.is("Binary") && is_relation(operator) {
            self.value(field(node, "left")?)?;
            self.value(field(node, "right")?)?;
            let chosen = if jump_when {
                relation(operator)
            } else {
                opposite(operator)
            };
            self.emit(Instruction::CompareJump(chosen, target.to_owned()));
        } else if node.is("Unary") && operator == "not" {
            self.branch(field(node, "operand")?, target, !jump_when)?;
        } else if node.is("Binary") && (operator == "and" || operator == "or") {
            // "a and b" is false when either part is false; "a or b" is true
            // when either part is true. Otherwise the second part decides.
            let short_circuit = (operator == "and") != jump_when;
            if short_circuit {
                self.branch(field(node, "left")?, target, jump_when)?;
                self.branch(field(node, "right")?, target, jump_when)?;
            } else {
                let skip = self.label();
                self.branch(field(node, "left")?, &skip, !jump_when)?;
                self.branch(field(node, "right")?, target, jump_when)?;
                self.emit(Instruction::Label(skip));
            }
        } else {
            self.value(node)?;
            self.emit(Instruction::Push(0.0));
            let chosen = if jump_when { "notEqual" } else { "equal" };
            self.emit(Instruction::CompareJump(chosen, target.to_owned()));
        }
        Ok(())
    }

    fn finish(mut self, comments: Vec<String>) -> Procedure {
        if !self.returns && self.code.last() != Some(&Instruction::ReturnNothing) {
            self.emit(Instruction::ReturnNothing);
        }
        let mut named: Vec<(usize, String)> = self
            .slots
            .into_iter()
            .map(|(name, slot)| (slot, name))
            .collect();
        named.sort();
        let slot_names: Vec<String> = named.into_iter().map(|(_, name)| name).collect();
        let slot_arrays = slot_names
            .iter()
            .map(|name| self.arrays.contains(name))
            .collect();
        Procedure {
            name: self.name,
            parameter_count: self.parameter_count,
            slot_count: slot_names.len(),
            slot_names,
            slot_arrays,
            returns: self.returns,
            max_depth: self.max_depth,
            comments,
            code: self.code,
        }
    }
}

/// Lower a typed meta program (after the context rules) to stack machine
/// code.
pub fn lower_program(program: &Node) -> Result<LoweredProgram> {
    let items = program.nodes("functions");
    let functions: HashMap<String, bool> = items
        .iter()
        .map(|item| {
            let returns = item
                .str("returnType")
                .is_some_and(|kind| !kind.is_empty() && kind != "nothing");
            (item.str("name").unwrap_or_default().to_owned(), returns)
        })
        .collect();
    for item in &items {
        if item.str("returnType") == Some("array") {
            return Err(unsupported(&format!(
                "the array returned by \"{}\"",
                item.str("name").unwrap_or_default()
            )));
        }
        for parameter in item.nodes("parameters") {
            if let Some(kind) = parameter.str("type")
                && !kind.is_empty()
                && kind != "integer"
            {
                return Err(unsupported(&format!(
                    "the {kind} parameter \"{}\"",
                    parameter.str("name").unwrap_or_default()
                )));
            }
        }
    }
    let mut lowered = Vec::new();
    for item in &items {
        let name = item.str("name").unwrap_or_default();
        let returns = functions.get(name).copied().unwrap_or(false);
        let mut lowering =
            FunctionLowering::new(name, &item.nodes("parameters"), returns, &functions);
        lowering.block(field(item, "body")?)?;
        lowered.push(lowering.finish(item.texts("comments")));
    }
    let mut main = FunctionLowering::new("main", &[], false, &functions);
    main.block(field(program, "main")?)?;
    Ok(LoweredProgram {
        comments: program.texts("comments"),
        functions: lowered,
        main: main.finish(program.texts("mainComments")),
    })
}
