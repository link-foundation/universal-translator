//! Reading of WebAssembly text (WAT) back into the stack machine code
//! described in [`super::lowering`]. WebAssembly is a stack machine too, so
//! most instructions map one to one. What the writer adds around the code is
//! undone first: the blocks that end at the labels, the dispatch loop with its
//! br_table, and the "$.stack.N" locals that carry the stack across a jump.

use std::collections::HashMap;

use regex::Captures;

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::machine_reader_shared::{
    ReadRule, Result, decode_bytes, fixed, group, integer, leading_comments, pattern_regex,
    procedure, program, read_error, read_instructions, rule, trimmed_lines, without_results,
};
use crate::emission_map::{clone_source_line, include_source_line};
use crate::meta::GrammarError;

const RELATION_PATTERN: &str = r"^(i64\.(?:eq|ne|lt_s|le_s|gt_s|ge_s))$";
const HEADER: &str =
    r#"^\(func \$(\S+?)(?: \(export "main"\))?((?: \(param \$\S+ i64\))*)( \(result i64\))?$"#;

fn wat_relation(relation: &str) -> &'static str {
    match relation {
        "i64.eq" => "equal",
        "i64.ne" => "notEqual",
        "i64.lt_s" => "less",
        "i64.le_s" => "lessOrEqual",
        "i64.gt_s" => "greater",
        _ => "greaterOrEqual",
    }
}

fn wat_arithmetic(operation: &str) -> &'static str {
    match operation {
        "i64.add" => "add",
        "i64.sub" => "subtract",
        "i64.mul" => "multiply",
        "i64.div_s" => "divide",
        _ => "remainder",
    }
}

/// The bytes of a string literal with hexadecimal escapes.
fn wat_string(literal: &str) -> String {
    let body = literal
        .get(1..literal.len().saturating_sub(1))
        .unwrap_or("");
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
    decode_bytes(&bytes)
}

/// The texts of the data segments by offset and length.
fn wat_texts(lines: &[String]) -> HashMap<String, String> {
    let declaration = pattern_regex(r#"^\(data \(i32\.const (\d+)\) (".*")\)$"#);
    lines
        .iter()
        .filter_map(|line| declaration.captures(line))
        .map(|found| {
            let text = wat_string(group(&found, 2));
            (format!("{}:{}", group(&found, 1), text.len()), text)
        })
        .collect()
}

/// What the writer wraps around the instructions is not part of the stack
/// machine code: blocks, the dispatch loop and its table, the unreachable
/// after the last return, and the locals that save the stack at a jump.
fn strip_frame(lines: &[String]) -> (Vec<String>, Vec<String>) {
    let block = pattern_regex(r"^(?:block|loop) \$\S+$");
    let end = pattern_regex(r"^end ;; (?:start|dispatch)$");
    let saved = pattern_regex(r"^local\.(?:set|get) \$\.stack\.\d+$");
    for (index, line) in lines.iter().enumerate() {
        let neighbor = if line.starts_with("local.set $.stack.") {
            index.checked_sub(1).and_then(|at| lines.get(at))
        } else if line.starts_with("local.get $.stack.") {
            lines.get(index + 1)
        } else {
            None
        };
        if let Some(neighbor) = neighbor {
            include_source_line(neighbor, line);
        }
    }
    let mut kept = Vec::new();
    let mut labels = Vec::new();
    for (index, line) in lines.iter().enumerate() {
        if let Some(table) = line.strip_prefix("br_table ") {
            let targets: Vec<&str> = table.split(' ').collect();
            labels = targets
                .get(1..targets.len().saturating_sub(1))
                .unwrap_or_default()
                .iter()
                .map(|target| target.get(1..).unwrap_or("").to_owned())
                .collect();
        }
        let frame = block.is_match(line)
            || end.is_match(line)
            || line == "unreachable"
            || line.starts_with("br_table ")
            || lines
                .get(index + 1)
                .is_some_and(|next| next.starts_with("br_table "))
            || saved.is_match(line);
        if !frame {
            kept.push(clone_source_line(line));
        }
    }
    (labels, kept)
}

fn jump_target(labels: &[String], number: &str) -> Result<String> {
    number
        .parse::<usize>()
        .ok()
        .and_then(|number| number.checked_sub(1))
        .and_then(|index| labels.get(index))
        .cloned()
        .ok_or_else(|| GrammarError::new(format!("Unknown jump target {number}")))
}

fn one(instruction: Instruction) -> Result<Option<Vec<Option<Instruction>>>> {
    Ok(Some(vec![Some(instruction)]))
}

struct Frame<'a> {
    texts: &'a HashMap<String, String>,
    slot_names: &'a [String],
    labels: &'a [String],
    returns: bool,
    counts: &'a HashMap<String, usize>,
}

fn compare_jumps<'a>(labels: &'a [String]) -> Vec<ReadRule<'a>> {
    let backward = [
        r"^i32\.const (\d+)$",
        r"^local\.set \$\.pc$",
        r"^br \$dispatch$",
    ];
    let mut rules = Vec::new();
    for kept in [false, true] {
        let condition: Vec<&str> = if kept {
            vec![r"^local\.set \$\.cond$", r"^local\.get \$\.cond$"]
        } else {
            Vec::new()
        };
        let mut forward = vec![RELATION_PATTERN];
        forward.extend(&condition);
        forward.push(r"^br_if \$(\S+)$");
        let last = forward.len() - 1;
        rules.push(rule(&forward, move |m| {
            Ok(Some(vec![Some(Instruction::CompareJump(
                wat_relation(group(&m[0], 1)),
                group(&m[last], 1).into(),
            ))]))
        }));
        let mut loop_back = vec![RELATION_PATTERN];
        loop_back.extend(&condition);
        loop_back.push(r"^if$");
        loop_back.extend(backward);
        loop_back.push(r"^end$");
        let number = loop_back.len() - 4;
        rules.push(rule(&loop_back, move |m| {
            Ok(Some(vec![Some(Instruction::CompareJump(
                wat_relation(group(&m[0], 1)),
                jump_target(labels, group(&m[number], 1))?,
            ))]))
        }));
    }
    rules
}

fn wat_rules<'a>(frame: &Frame<'a>) -> Vec<ReadRule<'a>> {
    let Frame {
        texts,
        slot_names,
        labels,
        returns,
        counts,
    } = *frame;
    let slot_of = move |name: &str| slot_names.iter().position(|known| known == name);
    let mut rules = vec![
        rule(&[r"^;; ?(.*)$"], |m| {
            one(Instruction::Comment(group(&m[0], 1).into()))
        }),
        fixed(
            &[
                r"^i64\.const -1$",
                r"^i64\.xor$",
                r"^i64\.const 1$",
                r"^i64\.add$",
            ],
            vec![Instruction::Negate],
        ),
        fixed(
            &[
                r"^i64\.const 8$",
                r"^i64\.sub$",
                r"^i32\.wrap_i64$",
                r"^i64\.load$",
            ],
            vec![Instruction::ArrayLength],
        ),
        fixed(
            &[r"^i64\.const 3$", r"^i64\.shl$"],
            vec![Instruction::ElementIndex],
        ),
        fixed(
            &[r"^i64\.add$", r"^i32\.wrap_i64$", r"^i64\.load$"],
            vec![Instruction::LoadElement],
        ),
        fixed(
            &[
                r"^local\.set \$\.value$",
                r"^i64\.add$",
                r"^i32\.wrap_i64$",
                r"^local\.get \$\.value$",
                r"^i64\.store$",
            ],
            vec![Instruction::StoreElement],
        ),
        fixed(
            &[r"^local\.tee \$\.dup$", r"^local\.get \$\.dup$"],
            vec![Instruction::Dup],
        ),
        rule(&[r"^i64\.const (-?\d+)$"], |m| {
            one(Instruction::Push(integer(group(&m[0], 1))?))
        }),
        rule(&[r"^local\.get \$(\S+)$"], move |m| {
            Ok(slot_of(group(&m[0], 1)).map(|index| vec![Some(Instruction::Load(index))]))
        }),
        rule(&[r"^local\.set \$(\S+)$"], move |m| {
            Ok(slot_of(group(&m[0], 1)).map(|index| vec![Some(Instruction::Store(index))]))
        }),
        fixed(&[r"^drop$"], vec![Instruction::Pop]),
        rule(&[r"^(i64\.(?:add|sub|mul|div_s|rem_s))$"], |m| {
            one(Instruction::Arithmetic(wat_arithmetic(group(&m[0], 1))))
        }),
    ];
    rules.extend(compare_jumps(labels));
    rules.extend([
        rule(
            &[
                r"^i32\.const (\d+)$",
                r"^local\.set \$\.pc$",
                r"^br \$dispatch$",
            ],
            move |m| one(Instruction::Jump(jump_target(labels, group(&m[0], 1))?)),
        ),
        rule(&[r"^br \$(\S+)$"], |m| {
            one(Instruction::Jump(group(&m[0], 1).into()))
        }),
        rule(&[r"^end ;; (\S+)$"], |m| {
            one(Instruction::Label(group(&m[0], 1).into()))
        }),
        fixed(
            &[r"^return$"],
            vec![if returns {
                Instruction::Return
            } else {
                Instruction::ReturnNothing
            }],
        ),
        fixed(&[r"^call \$new_array$"], vec![Instruction::NewArray]),
        fixed(
            &[r"^call \$print_integer$"],
            vec![Instruction::PrintInteger],
        ),
        fixed(
            &[r"^call \$print_newline$"],
            vec![Instruction::PrintNewline],
        ),
        rule(
            &[
                r"^i32\.const (\d+)$",
                r"^i32\.const (\d+)$",
                r"^call \$print_text$",
            ],
            move |m| {
                let key = format!("{}:{}", group(&m[0], 1), group(&m[1], 1));
                let text = texts.get(&key).cloned().unwrap_or_default();
                one(Instruction::PrintText(text))
            },
        ),
        rule(&[r"^call \$(\S+)$"], move |m| {
            let name = group(&m[0], 1);
            one(Instruction::Call(
                name.into(),
                counts.get(name).copied().unwrap_or(0),
            ))
        }),
    ]);
    rules
}

fn read_wat_function(
    found: &Captures,
    comments: Vec<String>,
    lines: &[String],
    texts: &HashMap<String, String>,
    counts: &HashMap<String, usize>,
) -> Result<Procedure> {
    let name = group(found, 1);
    let returns = found.get(3).is_some();
    let parameter = pattern_regex(r"\(param \$(\S+) i64\)");
    let parameters: Vec<String> = parameter
        .captures_iter(group(found, 2))
        .map(|item| group(&item, 1).to_owned())
        .collect();
    let local = pattern_regex(r"^\(local \$(\S+) i64\)$");
    let helper = pattern_regex(r"^\(local \$\.pc i32\)$|^\(local \$\.cond i32\)$");
    let mut slot_names = parameters.clone();
    let mut body = Vec::new();
    for line in lines {
        if let Some(declared) = local.captures(line) {
            if !group(&declared, 1).starts_with('.') {
                slot_names.push(group(&declared, 1).to_owned());
            }
        } else if !helper.is_match(line) {
            body.push(clone_source_line(line));
        }
    }
    let (labels, instructions) = strip_frame(&body);
    let frame = Frame {
        texts,
        slot_names: &slot_names,
        labels: &labels,
        returns,
        counts,
    };
    let code = read_instructions(&instructions, &wat_rules(&frame), "wat")?;
    Ok(procedure(
        name.to_owned(),
        parameters.len(),
        slot_names,
        returns,
        comments,
        without_results(code),
    ))
}

/// Read WebAssembly text written in the style of the WAT writer.
pub fn read_wat(source: &str) -> Result<LoweredProgram> {
    let lines = trimmed_lines(source);
    let (comments, rest) = leading_comments(&lines, ";;", r"^\(module$");
    let texts = wat_texts(&rest);
    let header = pattern_regex(HEADER);
    let mut counts: HashMap<String, usize> = HashMap::new();
    for line in &rest {
        if let Some(found) = header.captures(line) {
            counts.insert(
                group(&found, 1).to_owned(),
                group(&found, 2).matches("(param ").count(),
            );
        }
    }
    let mut items = Vec::new();
    let mut pending: Vec<String> = Vec::new();
    let mut index = 0;
    while index < rest.len() {
        let line = &rest[index];
        let found = header.captures(line);
        if let Some(text) = line.strip_prefix(";;") {
            pending.push(text.strip_prefix(' ').unwrap_or(text).to_owned());
        } else if let Some(found) = found.filter(|found| group(found, 1) != "new_array") {
            let end = rest[index..]
                .iter()
                .position(|item| item == ")")
                .map(|offset| index + offset)
                .ok_or_else(|| read_error("wat", line, "the function is not closed"))?;
            items.push(read_wat_function(
                &found,
                std::mem::take(&mut pending),
                &rest[index + 1..end],
                &texts,
                &counts,
            )?);
            index = end;
        } else if !line.is_empty() {
            pending.clear();
        }
        index += 1;
    }
    if !items.iter().any(|item| item.name == "main") {
        return Err(read_error("wat", "", "no main function"));
    }
    program(comments, items)
}
