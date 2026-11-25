//! Lifting of stack machine code (see [`super::lowering`]) back into a meta
//! program. This is the inverse of lowering: it rebuilds expressions with a
//! symbolic stack and recognizes the jump patterns that lowering writes for
//! conditions, "if", "while", counting loops and boolean values.
//!
//! Lowering patterns, with "→ X" meaning "compare-jump to X":
//!
//! ```text
//! while    label T; condition → F; body; jump T; label F
//! if       condition → O; then; jump D; label O; otherwise; label D
//! boolean  condition → F; push 1; jump D; label F; push 0; label D
//! ```
//!
//! A condition is a run of comparisons. Each comparison jumps to the false
//! label F or to a "skip" label placed right after the run (for "or" inside
//! "and", for example). The condition is rebuilt from the last comparison
//! back to the first.

use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::names::neutral_name;
use crate::meta::GrammarError;
use crate::meta::truth::raise_truth_functions;
use crate::meta::{Node, Value, binary, block, name, number, text, walk};

type Result<T> = std::result::Result<T, GrammarError>;

fn lift_error(message: impl AsRef<str>) -> GrammarError {
    GrammarError::new(format!("Cannot lift machine code: {}", message.as_ref()))
}

fn opposite(operator: &str) -> Option<&'static str> {
    Some(match operator {
        "equal" => "notEqual",
        "notEqual" => "equal",
        "less" => "greaterOrEqual",
        "lessOrEqual" => "greater",
        "greater" => "lessOrEqual",
        "greaterOrEqual" => "less",
        _ => return None,
    })
}

fn negate(condition: &Node) -> Node {
    let operator = condition.str("operator").unwrap_or_default();
    if condition.is("Binary") {
        if let Some(flipped) = opposite(operator) {
            return condition.clone().with("operator", flipped);
        }
        if operator == "and" || operator == "or" {
            let side = |key| negate(condition.node(key).expect("binary operand"));
            let swapped = if operator == "and" { "or" } else { "and" };
            return binary(swapped, side("left"), side("right"));
        }
    }
    if condition.is("Unary")
        && operator == "not"
        && let Some(operand) = condition.node("operand")
    {
        return operand.clone();
    }
    Node::new("Unary")
        .with("operator", "not")
        .with("operand", condition.clone())
}

/// A condition while it is rebuilt. Conditions are compared by identity
/// (`Rc::ptr_eq`), because one condition object stands for one label.
enum Part {
    Always,
    Leaf(Node),
    Binary(&'static str, Cond, Cond),
}

type Cond = Rc<Part>;

fn leaf(test: Node) -> Cond {
    Rc::new(Part::Leaf(test))
}

fn both(left: Cond, right: Cond) -> Cond {
    if matches!(*right, Part::Always) {
        left
    } else {
        Rc::new(Part::Binary("and", left, right))
    }
}

fn either(left: Cond, right: Cond) -> Cond {
    if matches!(*right, Part::Always) {
        right
    } else {
        Rc::new(Part::Binary("or", left, right))
    }
}

fn cond_node(condition: &Part) -> Node {
    match condition {
        Part::Always => Node::new("Always"),
        Part::Leaf(node) => node.clone(),
        Part::Binary(operator, left, right) => binary(operator, cond_node(left), cond_node(right)),
    }
}

/// What holds at a label: the false label of the whole condition, or a
/// rebuilt condition.
#[derive(Clone)]
enum AtLabel {
    False,
    Cond(Cond),
}

/// The condition under which execution continues after the comparison "if
/// test, jump to target" and later passes the end of the whole condition.
fn fall_through(test: &Node, when_target: &AtLabel, next: Cond) -> Cond {
    let when_target = match when_target {
        AtLabel::False => return both(leaf(negate(test)), next),
        AtLabel::Cond(condition) => condition.clone(),
    };
    if Rc::ptr_eq(&when_target, &next) {
        return next;
    }
    if matches!(*when_target, Part::Always) {
        return either(leaf(test.clone()), next);
    }
    // next = Y or P(target): reaching the target means P(target) decides.
    if let Part::Binary(operator, left, right) = &*next
        && Rc::ptr_eq(right, &when_target)
    {
        if *operator == "or" {
            return either(both(leaf(negate(test)), left.clone()), when_target);
        }
        return both(either(leaf(test.clone()), left.clone()), when_target);
    }
    either(
        both(leaf(test.clone()), when_target),
        both(leaf(negate(test)), next),
    )
}

#[derive(Clone)]
struct Comparison {
    test: Node,
    target: String,
    next: usize,
}

enum Step {
    Compare(Comparison),
    Label(String),
}

struct Found {
    condition: Node,
    false_label: String,
    end: usize,
}

/// The statements of one block while they are lifted: the symbolic stack,
/// the names declared so far and the parts of a print without its newline.
struct BlockLifting {
    scope: HashSet<String>,
    statements: Vec<Node>,
    stack: Vec<Node>,
    prints: Vec<Node>,
    /// Array literals whose elements are still being stored: their places
    /// on the stack and their lengths.
    building: Vec<(usize, usize)>,
}

impl BlockLifting {
    fn new(outer: &HashSet<String>) -> Self {
        Self {
            scope: outer.clone(),
            statements: Vec::new(),
            stack: Vec::new(),
            prints: Vec::new(),
            building: Vec::new(),
        }
    }

    fn pop(&mut self) -> Result<Node> {
        self.stack
            .pop()
            .ok_or_else(|| lift_error("a statement needs a value on the stack"))
    }

    fn flush(&mut self, newline: bool) {
        if self.prints.is_empty() && !newline {
            return;
        }
        let prints = std::mem::take(&mut self.prints);
        let value = match prints.len() {
            0 => text(""),
            1 => prints.into_iter().next().expect("one print"),
            _ => Node::new("Interpolation").with("parts", prints),
        };
        self.statements.push(
            Node::new("Print")
                .with("value", value)
                .with("newline", newline),
        );
    }

    fn add(&mut self, statement: Node) {
        self.flush(false);
        self.statements.push(statement);
    }

    fn store(&mut self, lifting: &FunctionLifting, variable: String, value: Node) {
        if lifting.is_boolean(&value) {
            lifting.booleans.borrow_mut().insert(variable.clone());
        }
        if self.scope.contains(&variable) {
            self.add(
                Node::new("Assignment")
                    .with("name", variable)
                    .with("operator", "=")
                    .with("value", value),
            );
        } else {
            self.scope.insert(variable.clone());
            self.add(
                Node::new("Declaration")
                    .with("name", variable)
                    .with("value", value),
            );
        }
    }

    /// An array literal is lowered as a new array of zeros whose elements are
    /// stored one by one, each after a dup of the array.
    fn duplicate(&mut self) -> Result<()> {
        let size = self.stack.len();
        self.building.retain(|&(at, _)| at < size);
        let Some(top) = self.stack.last() else {
            return Err(lift_error("a dup that does not build an array literal"));
        };
        let at = size - 1;
        if self.building.iter().any(|&(place, _)| place == at) && top.is("ArrayLiteral") {
            self.stack.push(building(at));
            return Ok(());
        }
        let length = top.node("length");
        let length = match (length, top.node("fill")) {
            (Some(length), Some(fill))
                if top.is("NewArray") && length.is("Number") && fill.is_number(0.0) =>
            {
                length.number("value").unwrap_or_default()
            }
            _ => return Err(lift_error("a dup that does not build an array literal")),
        };
        self.stack[at] = Node::new("ArrayLiteral").with("elements", Vec::<Node>::new());
        if length > 0.0 {
            self.building.push((at, length as usize));
        }
        self.stack.push(building(at));
        Ok(())
    }

    fn store_element(&mut self) -> Result<()> {
        let value = self.pop()?;
        let index = self.pop()?;
        let array = self.pop()?;
        if array.is("Building") {
            let at = array.number("at").unwrap_or_default() as usize;
            let literal = self
                .stack
                .get_mut(at)
                .filter(|literal| literal.is("ArrayLiteral"))
                .ok_or_else(|| lift_error("array literal elements out of order"))?;
            let count = literal.nodes("elements").len();
            if !index.is_number(count as f64) {
                return Err(lift_error("array literal elements out of order"));
            }
            if let Some(Value::List(elements)) = literal.fields.get_mut("elements") {
                elements.push(Value::Node(value));
            }
            // A full literal is no longer being built.
            self.building
                .retain(|&(place, length)| place != at || count + 1 < length);
            return Ok(());
        }
        if !array.is("Name") {
            return Err(lift_error("an element stored into an unnamed array"));
        }
        self.add(
            Node::new("IndexAssignment")
                .with("name", array.str("name").unwrap_or_default())
                .with("index", index)
                .with("value", value),
        );
        Ok(())
    }

    fn print_text(&mut self, value: &str) {
        if let Some(last) = self.prints.last_mut()
            && last.is("Text")
        {
            let joined = format!("{}{value}", last.str("value").unwrap_or_default());
            *last = text(joined);
        } else {
            self.prints.push(text(value));
        }
    }

    fn instruction(&mut self, lifting: &FunctionLifting, instruction: &Instruction) -> Result<()> {
        match instruction {
            Instruction::Comment(comment) => {
                self.add(Node::new("Comment").with("text", comment.as_str()));
            }
            Instruction::Store(slot) => {
                let value = self.pop()?;
                self.store(lifting, lifting.name(*slot), value);
            }
            Instruction::Pop => {
                let expression = self.pop()?;
                self.add(Node::new("Evaluate").with("expression", expression));
            }
            Instruction::Return => {
                let value = self.pop()?;
                self.add(Node::new("Return").with("value", value));
            }
            Instruction::ReturnNothing => self.add(Node::new("Return")),
            Instruction::PrintInteger => {
                let value = self.pop()?;
                self.prints.push(value);
            }
            Instruction::PrintText(value) => self.print_text(value),
            Instruction::PrintNewline => self.flush(true),
            Instruction::Dup => self.duplicate()?,
            Instruction::StoreElement => self.store_element()?,
            Instruction::Jump(label) => {
                return Err(lift_error(format!("an unexpected jump to \"{label}\"")));
            }
            other => {
                lifting.expression(&mut self.stack, other)?;
                // A call to a procedure that returns nothing is a statement.
                if let Instruction::Call(callee, _) = other
                    && !lifting.returns(callee)
                {
                    let expression = self.stack.pop().expect("the call result");
                    self.add(Node::new("Evaluate").with("expression", expression));
                }
            }
        }
        Ok(())
    }

    fn finish(mut self) -> Result<Node> {
        self.flush(false);
        if !self.stack.is_empty() {
            return Err(lift_error("values are left on the stack"));
        }
        Ok(block(counting_loops(self.statements)))
    }
}

struct FunctionLifting<'a> {
    item: &'a Procedure,
    functions: &'a HashMap<String, bool>,
    boolean_functions: &'a HashSet<String>,
    names: Vec<String>,
    labels: HashMap<String, usize>,
    booleans: RefCell<HashSet<String>>,
}

impl<'a> FunctionLifting<'a> {
    fn new(
        item: &'a Procedure,
        functions: &'a HashMap<String, bool>,
        boolean_functions: &'a HashSet<String>,
    ) -> Self {
        let labels = item
            .code
            .iter()
            .enumerate()
            .filter_map(|(index, instruction)| match instruction {
                Instruction::Label(label) => Some((label.clone(), index)),
                _ => None,
            })
            .collect();
        Self {
            item,
            functions,
            boolean_functions,
            names: item
                .slot_names
                .iter()
                .map(|slot| neutral_name(slot))
                .collect(),
            labels,
            booleans: RefCell::new(HashSet::new()),
        }
    }

    fn at(&self, index: usize) -> Option<&Instruction> {
        self.item.code.get(index)
    }

    fn name(&self, slot: usize) -> String {
        self.names.get(slot).cloned().unwrap_or_default()
    }

    fn returns(&self, callee: &str) -> bool {
        self.functions.get(callee).copied().unwrap_or(false)
    }

    fn label_index(&self, label: &str) -> Result<usize> {
        self.labels
            .get(label)
            .copied()
            .ok_or_else(|| lift_error(format!("the label \"{label}\" is missing")))
    }

    /// Read a pure expression that ends with a comparison jump, starting at
    /// `index`.
    fn comparison(&self, index: usize) -> Result<Option<Comparison>> {
        let mut values = Vec::new();
        let mut position = index;
        loop {
            match self.at(position) {
                Some(Instruction::CompareJump(relation, target)) if values.len() == 2 => {
                    let right = values.pop().expect("two values");
                    let left = values.pop().expect("two values");
                    return Ok(Some(Comparison {
                        test: self.relation(relation, left, right),
                        target: target.clone(),
                        next: position + 1,
                    }));
                }
                Some(
                    instruction @ (Instruction::Push(_)
                    | Instruction::Load(_)
                    | Instruction::Arithmetic(_)
                    | Instruction::Negate
                    | Instruction::ElementIndex
                    | Instruction::LoadElement
                    | Instruction::ArrayLength),
                ) => self.expression(&mut values, instruction)?,
                Some(instruction @ Instruction::Call(callee, _)) if self.returns(callee) => {
                    self.expression(&mut values, instruction)?
                }
                _ => return Ok(None),
            }
            position += 1;
        }
    }

    /// "flag != 0" is how lowering tests a boolean value.
    fn relation(&self, operator: &str, left: Node, right: Node) -> Node {
        if right.is("Number")
            && right.is_number(0.0)
            && self.is_boolean(&left)
            && (operator == "equal" || operator == "notEqual")
        {
            return if operator == "notEqual" {
                left
            } else {
                negate(&left)
            };
        }
        binary(operator, left, right)
    }

    fn is_boolean(&self, expression: &Node) -> bool {
        if expression.is("Name") {
            return self
                .booleans
                .borrow()
                .contains(expression.str("name").unwrap_or_default());
        }
        is_truth_value(expression, self.boolean_functions)
    }

    /// Read the whole condition that starts with the comparison at `index`
    /// (or with the comparison already read as `first`).
    fn condition(&self, index: usize, first: Option<Comparison>) -> Result<Found> {
        let mut steps: Vec<Step> = Vec::new();
        let mut open: HashMap<String, usize> = HashMap::new();
        let mut best: Option<(usize, usize, String)> = None;
        let mut position = index;
        let mut comparison = match first {
            Some(first) => Some(first),
            None => self.comparison(position)?,
        };
        if comparison.is_none() {
            return Err(lift_error(format!("no condition at instruction {index}")));
        }
        loop {
            if let Some(found) = comparison.take() {
                *open.entry(found.target.clone()).or_insert(0) += 1;
                position = found.next;
                steps.push(Step::Compare(found));
            } else {
                let label = match self.at(position) {
                    Some(Instruction::Label(label)) => label.clone(),
                    _ => String::new(),
                };
                open.remove(&label);
                steps.push(Step::Label(label));
                position += 1;
            }
            if open.len() == 1 {
                let false_label = open.keys().next().cloned().expect("one open label");
                best = Some((steps.len(), position, false_label));
            }
            if let Some(Instruction::Label(label)) = self.at(position)
                && open.contains_key(label)
            {
                continue;
            }
            comparison = self.comparison(position)?;
            if comparison.is_none() {
                break;
            }
        }
        let (count, end, false_label) = best.ok_or_else(|| {
            lift_error(format!(
                "the condition at instruction {index} has no single false label"
            ))
        })?;
        steps.truncate(count);
        Ok(Found {
            condition: rebuild(&steps, &false_label)?,
            false_label,
            end,
        })
    }

    fn expression(&self, stack: &mut Vec<Node>, instruction: &Instruction) -> Result<()> {
        let operation = operation_name(instruction);
        let pop = |stack: &mut Vec<Node>| {
            stack
                .pop()
                .ok_or_else(|| lift_error(format!("\"{operation}\" needs a value on the stack")))
        };
        match instruction {
            Instruction::Push(value) => stack.push(number(*value)),
            Instruction::Load(slot) => stack.push(name(self.name(*slot))),
            Instruction::Arithmetic(operator) => {
                let right = pop(stack)?;
                let left = pop(stack)?;
                stack.push(binary(operator, left, right));
            }
            Instruction::Negate => {
                let operand = pop(stack)?;
                stack.push(
                    Node::new("Unary")
                        .with("operator", "negate")
                        .with("operand", operand),
                );
            }
            Instruction::ElementIndex => {}
            Instruction::NewArray => {
                let fill = pop(stack)?;
                let length = pop(stack)?;
                stack.push(if length.is_number(0.0) {
                    Node::new("ArrayLiteral").with("elements", Vec::<Node>::new())
                } else {
                    Node::new("NewArray")
                        .with("length", length)
                        .with("fill", fill)
                });
            }
            Instruction::LoadElement => {
                let index = pop(stack)?;
                let array = pop(stack)?;
                stack.push(Node::new("Index").with("array", array).with("index", index));
            }
            Instruction::ArrayLength => {
                let array = pop(stack)?;
                stack.push(Node::new("Length").with("array", array));
            }
            Instruction::Call(callee, count) => {
                if stack.len() < *count {
                    return Err(lift_error(format!(
                        "the call to \"{callee}\" needs {count} values"
                    )));
                }
                let arguments = stack.split_off(stack.len() - count);
                stack.push(
                    Node::new("Call")
                        .with("callee", neutral_name(callee))
                        .with("arguments", arguments),
                );
            }
            _ => return Err(lift_error(format!("\"{operation}\" is not an expression"))),
        }
        Ok(())
    }

    /// Lift the instructions in `start..end` into a block.
    fn block(&self, start: usize, end: usize, outer: &HashSet<String>) -> Result<Node> {
        let mut lifted = BlockLifting::new(outer);
        let mut index = start;
        while index < end {
            let Some(instruction) = self.at(index) else {
                break;
            };
            match instruction {
                Instruction::Label(_) => index = self.while_loop(index, &mut lifted)?,
                Instruction::CompareJump(relation, target) => {
                    let right = lifted.pop()?;
                    let left = lifted.pop()?;
                    let first = Comparison {
                        test: self.relation(relation, left, right),
                        target: target.clone(),
                        next: index + 1,
                    };
                    let found = self.condition(index, Some(first))?;
                    if self.is_boolean_value(&found) {
                        index = found.end + 5;
                        lifted.stack.push(found.condition);
                    } else {
                        index = self.branch(found, &mut lifted)?;
                    }
                }
                other => {
                    lifted.instruction(self, other)?;
                    index += 1;
                }
            }
        }
        lifted.finish()
    }

    fn is_boolean_value(&self, found: &Found) -> bool {
        let at = |offset: usize| self.at(found.end + offset);
        matches!(
            (at(0), at(1), at(2), at(3), at(4)),
            (
                Some(Instruction::Push(one)),
                Some(Instruction::Jump(done)),
                Some(Instruction::Label(otherwise)),
                Some(Instruction::Push(zero)),
                Some(Instruction::Label(end)),
            ) if *one == 1.0 && *zero == 0.0 && *otherwise == found.false_label && end == done
        )
    }

    /// condition → O; then; jump D; label O; otherwise; label D
    fn branch(&self, found: Found, lifted: &mut BlockLifting) -> Result<usize> {
        let otherwise = self.label_index(&found.false_label)?;
        let Some(Instruction::Jump(done)) = otherwise.checked_sub(1).and_then(|at| self.at(at))
        else {
            return Err(lift_error(format!(
                "the \"if\" before \"{}\" has no jump to its end",
                found.false_label
            )));
        };
        let done_index = self.label_index(done)?;
        let then = self.block(found.end, otherwise - 1, &lifted.scope)?;
        let rest = self.block(otherwise + 1, done_index, &lifted.scope)?;
        let mut statement = Node::new("If")
            .with("condition", found.condition)
            .with("then", then);
        let mut rest_statements = rest.node_list("statements");
        if rest_statements.len() == 1 && rest_statements[0].is("If") {
            statement.set("otherwise", rest_statements.remove(0));
        } else if !rest_statements.is_empty() {
            statement.set("otherwise", rest);
        }
        lifted.add(statement);
        Ok(done_index + 1)
    }

    /// label T; condition → F; body; jump T; label F
    fn while_loop(&self, index: usize, lifted: &mut BlockLifting) -> Result<usize> {
        let top = match self.at(index) {
            Some(Instruction::Label(label)) => label.clone(),
            _ => String::new(),
        };
        let found = self.condition(index + 1, None)?;
        let exit = self.label_index(&found.false_label)?;
        match exit.checked_sub(1).and_then(|at| self.at(at)) {
            Some(Instruction::Jump(target)) if *target == top => {}
            _ => {
                return Err(lift_error(format!(
                    "the label \"{top}\" does not start a loop"
                )));
            }
        }
        let body = self.block(found.end, exit - 1, &lifted.scope)?;
        lifted.add(
            Node::new("While")
                .with("condition", found.condition)
                .with("body", body),
        );
        Ok(exit + 1)
    }

    fn lift(&self) -> Result<(Vec<Node>, Node)> {
        let parameters: Vec<String> = self
            .names
            .iter()
            .take(self.item.parameter_count)
            .cloned()
            .collect();
        let mut body = self.block(
            0,
            self.item.code.len(),
            &parameters.iter().cloned().collect(),
        )?;
        let mut statements = body.node_list("statements");
        if statements
            .last()
            .is_some_and(|last| last.is("Return") && last.get("value").is_none())
        {
            statements.pop();
            body.set("statements", statements);
        }
        let parameters = parameters
            .into_iter()
            .map(|parameter| {
                Node::new("Parameter")
                    .with("name", parameter)
                    .with("type", "integer")
            })
            .collect();
        Ok((parameters, body))
    }
}

fn rebuild(steps: &[Step], false_label: &str) -> Result<Node> {
    let mut at_label: HashMap<String, AtLabel> =
        HashMap::from([(false_label.to_owned(), AtLabel::False)]);
    let mut next: Cond = Rc::new(Part::Always);
    for step in steps.iter().rev() {
        match step {
            Step::Label(label) => {
                at_label.insert(label.clone(), AtLabel::Cond(next.clone()));
            }
            Step::Compare(comparison) => {
                let when_target = at_label.get(&comparison.target).ok_or_else(|| {
                    lift_error(format!(
                        "the jump to \"{}\" leaves the condition",
                        comparison.target
                    ))
                })?;
                next = fall_through(&comparison.test, when_target, next);
            }
        }
    }
    if matches!(*next, Part::Always) {
        return Err(lift_error("a condition that is always true"));
    }
    Ok(cond_node(&next))
}

/// The marker a dup leaves on the stack while an array literal is built:
/// it stands for the literal at the place `at`.
fn building(at: usize) -> Node {
    Node::new("Building").with("at", at as f64)
}

fn operation_name(instruction: &Instruction) -> &'static str {
    match instruction {
        Instruction::Comment(_) => "comment",
        Instruction::Push(_) => "push",
        Instruction::Load(_) => "load",
        Instruction::Store(_) => "store",
        Instruction::Pop => "pop",
        Instruction::Arithmetic(_) => "arithmetic",
        Instruction::Negate => "negate",
        Instruction::Label(_) => "label",
        Instruction::Jump(_) => "jump",
        Instruction::CompareJump(..) => "compare-jump",
        Instruction::Call(..) => "call",
        Instruction::Return => "return",
        Instruction::ReturnNothing => "return-nothing",
        Instruction::PrintInteger => "print-integer",
        Instruction::PrintText(_) => "print-text",
        Instruction::PrintNewline => "print-newline",
        Instruction::NewArray => "new-array",
        Instruction::Dup => "dup",
        Instruction::ElementIndex => "element-index",
        Instruction::LoadElement => "load-element",
        Instruction::StoreElement => "store-element",
        Instruction::ArrayLength => "array-length",
    }
}

fn is_name(expression: Option<&Node>, variable: &str) -> bool {
    expression.is_some_and(|expression| expression.is("Name") && expression.is_name(variable))
}

/// Whether any node of the trees has the name `variable`.
fn mentions<'n>(trees: impl IntoIterator<Item = &'n Node>, variable: &str) -> bool {
    trees.into_iter().any(|tree| {
        let mut found = false;
        walk(tree, |node| found |= node.str("name") == Some(variable));
        found
    })
}

/// "i = i + 1"
fn is_step(step: Option<&Node>, variable: &str) -> bool {
    let Some(step) = step else { return false };
    let Some(value) = step.node("value") else {
        return false;
    };
    step.is("Assignment")
        && step.str("name") == Some(variable)
        && value.is("Binary")
        && value.str("operator") == Some("add")
        && is_name(value.node("left"), variable)
        && value
            .node("right")
            .is_some_and(|right| right.is("Number") && right.is_number(1.0))
}

/// "while (i < end)" where end does not depend on i.
fn is_bound(lifted: Option<&Node>, variable: &str) -> bool {
    let Some(condition) = lifted
        .filter(|lifted| lifted.is("While"))
        .and_then(|lifted| lifted.node("condition"))
    else {
        return false;
    };
    condition.is("Binary")
        && condition.str("operator") == Some("less")
        && is_name(condition.node("left"), variable)
        && condition
            .node("right")
            .is_some_and(|right| !mentions([right], variable))
}

/// "i = start; while (i < end) { ...; i = i + 1 }" is a counting loop when
/// the loop body does not change i otherwise and i is not used afterwards.
fn is_counting_loop(start: &Node, lifted: Option<&Node>, after: &[Node]) -> bool {
    let variable = start.str("name").unwrap_or_default();
    if !start.is("Declaration") || !is_bound(lifted, variable) {
        return false;
    }
    let body = lifted
        .and_then(|lifted| lifted.node("body"))
        .map(|body| body.node_list("statements"))
        .unwrap_or_default();
    let Some((last, before)) = body.split_last() else {
        return false;
    };
    if !is_step(Some(last), variable) {
        return false;
    }
    // A counting loop computes its bound once, so the body must not change it.
    let mut bound_names: Vec<String> = Vec::new();
    if let Some(bound) = lifted
        .and_then(|lifted| lifted.node("condition"))
        .and_then(|condition| condition.node("right"))
    {
        walk(bound, |node| {
            if node.is("Name")
                && let Some(identifier) = node.str("name")
            {
                bound_names.push(identifier.to_owned());
            }
        });
    }
    let mut assigned_in_body = false;
    for statement in before {
        walk(statement, |node| {
            assigned_in_body |= node.is("Assignment")
                && node.str("name").is_some_and(|assigned| {
                    assigned == variable || bound_names.iter().any(|bound| bound == assigned)
                });
        });
    }
    !assigned_in_body && !mentions(after, variable)
}

pub(crate) fn counting_loops(statements: Vec<Node>) -> Vec<Node> {
    let mut result = Vec::new();
    let mut index = 0;
    while index < statements.len() {
        let start = &statements[index];
        let lifted = statements.get(index + 1);
        let after = statements.get(index + 2..).unwrap_or_default();
        if !is_counting_loop(start, lifted, after) {
            result.push(start.clone());
            index += 1;
            continue;
        }
        let lifted = lifted.expect("the loop");
        let mut body = lifted.node("body").cloned().expect("the loop body");
        let mut inner = body.node_list("statements");
        inner.pop();
        body.set("statements", inner);
        let end = lifted
            .node("condition")
            .and_then(|condition| condition.node("right"))
            .cloned()
            .expect("the loop bound");
        let mut counting = Node::new("CountingLoop")
            .with("variable", start.str("name").unwrap_or_default())
            .with("end", end)
            .with("body", body);
        if let Some(value) = start.get("value") {
            counting.set("start", value.clone());
        }
        result.push(counting);
        index += 2;
    }
    result
}

/// Lift a machine program read by [`super::machine_reader`] into a meta
/// program before type inference.
/// A comparison, a logical operation or a call to a function that returns
/// one. Machine code keeps all of them as the integers 0 and 1.
fn is_truth_value(expression: &Node, boolean_functions: &HashSet<String>) -> bool {
    let operator = expression.str("operator").unwrap_or_default();
    match expression.kind.as_str() {
        "Boolean" => true,
        "Unary" => operator == "not",
        "Call" => boolean_functions.contains(expression.str("callee").unwrap_or_default()),
        "Binary" => opposite(operator).is_some() || operator == "and" || operator == "or",
        _ => false,
    }
}

/// A function whose every returned value is a truth value returns a boolean.
fn returns_truth_value(body: &Node, boolean_functions: &HashSet<String>) -> bool {
    let mut values = 0;
    let mut all = true;
    walk(body, |node| {
        if node.is("Return") {
            values += 1;
            all &= node
                .node("value")
                .is_some_and(|value| is_truth_value(value, boolean_functions));
        }
    });
    values > 0 && all
}

pub fn lift_program(machine: &LoweredProgram) -> Result<Node> {
    let functions: HashMap<String, bool> = machine
        .functions
        .iter()
        .map(|item| (item.name.clone(), item.returns))
        .collect();
    // Machine code returns booleans as integers. Which functions return truth
    // values decides how their callers are read, so lifting repeats until
    // that set no longer changes.
    let mut boolean_functions: HashSet<String> = HashSet::new();
    let lift_all = |boolean_functions: &HashSet<String>| -> Result<Vec<(Vec<Node>, Node)>> {
        machine
            .functions
            .iter()
            .map(|item| FunctionLifting::new(item, &functions, boolean_functions).lift())
            .collect()
    };
    let mut lifted = lift_all(&boolean_functions)?;
    for _ in 0..=machine.functions.len() {
        let found: HashSet<String> = machine
            .functions
            .iter()
            .zip(&lifted)
            .filter(|(item, (_, body))| {
                item.returns && returns_truth_value(body, &boolean_functions)
            })
            .map(|(item, _)| neutral_name(&item.name))
            .collect();
        if found == boolean_functions {
            break;
        }
        boolean_functions = found;
        lifted = lift_all(&boolean_functions)?;
    }
    let mut lifted_functions = Vec::new();
    for (item, (parameters, body)) in machine.functions.iter().zip(lifted) {
        let return_type = if !item.returns {
            "nothing"
        } else if boolean_functions.contains(&neutral_name(&item.name)) {
            "boolean"
        } else {
            "integer"
        };
        lifted_functions.push(
            Node::new("Function")
                .with("name", neutral_name(&item.name))
                .with("parameters", parameters)
                .with("body", body)
                .with("returnType", return_type)
                .with("comments", item.comments.clone()),
        );
    }
    let (_, main) = FunctionLifting::new(&machine.main, &functions, &boolean_functions).lift()?;
    Ok(raise_truth_functions(
        Node::new("Program")
            .with("comments", machine.comments.clone())
            .with("imports", Value::List(Vec::new()))
            .with("functions", lifted_functions)
            .with("main", main)
            .with("mainComments", machine.main.comments.clone()),
    ))
}
