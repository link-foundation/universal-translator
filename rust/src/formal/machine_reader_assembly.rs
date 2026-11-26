//! Reading of x86-64 (AT&T syntax) and AArch64 assembly in GNU as back into
//! the stack machine code described in [`super::lowering`]. The readers match
//! the instruction sequences that [`super::machine_assembly`] writes.

use std::collections::HashMap;

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::machine_reader_shared::{
    ReadRule, Result, decode_bytes, exact, fixed, group, integer, leading_comments, pattern_regex,
    procedure, program, read_error, read_instructions, resolve_results, rule, trimmed_lines,
};
use crate::meta::GrammarError;

const GAS_ARGUMENTS: [&str; 6] = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];

fn gas_relation(jump: &str) -> Option<&'static str> {
    Some(match jump {
        "je" => "equal",
        "jne" => "notEqual",
        "jl" => "less",
        "jle" => "lessOrEqual",
        "jg" => "greater",
        "jge" => "greaterOrEqual",
        _ => return None,
    })
}

fn arm_relation(condition: &str) -> Option<&'static str> {
    Some(match condition {
        "eq" => "equal",
        "ne" => "notEqual",
        "lt" => "less",
        "le" => "lessOrEqual",
        "gt" => "greater",
        "ge" => "greaterOrEqual",
        _ => return None,
    })
}

const GAS_ARITHMETIC: [(&[&str], &str); 5] = [
    (&["addq %rcx, %rax"], "add"),
    (&["subq %rcx, %rax"], "subtract"),
    (&["imulq %rcx, %rax"], "multiply"),
    (&["cqto", "idivq %rcx", "movq %rdx, %rax"], "remainder"),
    (&["cqto", "idivq %rcx"], "divide"),
];

const ARM_ARITHMETIC: [(&[&str], &str); 5] = [
    (&["add x0, x0, x1"], "add"),
    (&["sub x0, x0, x1"], "subtract"),
    (&["mul x0, x0, x1"], "multiply"),
    (&["sdiv x2, x0, x1", "msub x0, x2, x1, x0"], "remainder"),
    (&["sdiv x0, x0, x1"], "divide"),
];

fn arm_push() -> String {
    exact("str x0, [sp, #-16]!")
}

fn arm_pop(register: &str) -> String {
    exact(&format!("ldr {register}, [sp], #16"))
}

fn arm_epilogue() -> Vec<String> {
    vec![
        exact("mov sp, x29"),
        r"^add sp, sp, #\d+$".into(),
        exact("ldp x29, x30, [sp], #16"),
        exact("ret"),
    ]
}

/// The bytes of a ".asciz" string, with its escapes undone.
fn asciiz(literal: &str) -> String {
    let characters: Vec<char> = literal.chars().collect();
    let mut bytes: Vec<u8> = Vec::new();
    let mut index = 0;
    while index < characters.len() {
        let character = characters[index];
        index += 1;
        if character != '\\' {
            bytes.extend(character.to_string().as_bytes());
            continue;
        }
        let digits: String = characters[index..]
            .iter()
            .take(3)
            .take_while(|digit| ('0'..='7').contains(digit))
            .collect();
        if digits.is_empty() {
            if let Some(&escaped) = characters.get(index) {
                let mapped = match escaped {
                    'n' => '\n',
                    't' => '\t',
                    other => other,
                };
                bytes.extend(mapped.to_string().as_bytes());
                index += 1;
            }
        } else {
            bytes.push(u8::from_str_radix(&digits, 8).unwrap_or(0));
            index += digits.len();
        }
    }
    decode_bytes(&bytes)
}

fn assembly_texts(lines: &[String]) -> HashMap<String, String> {
    let declaration = pattern_regex(r#"^(text_\d+): \.asciz "(.*)"$"#);
    lines
        .iter()
        .filter_map(|line| declaration.captures(line))
        .map(|found| (group(&found, 1).to_owned(), asciiz(group(&found, 2))))
        .collect()
}

struct AssemblyFunction {
    name: String,
    comments: Vec<String>,
    body: Vec<String>,
}

/// The functions of a file: ".type name, @function" (or %function), the label
/// and the lines up to ".size name".
fn assembly_functions(
    lines: &[String],
    prefix: &str,
    target: &str,
) -> Result<Vec<AssemblyFunction>> {
    let header = pattern_regex(r"^\.type (\w+), [@%]function$");
    let mut items = Vec::new();
    let mut pending: Vec<String> = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        let line = &lines[index];
        if let Some(text) = line.strip_prefix(prefix) {
            pending.push(text.strip_prefix(' ').unwrap_or(text).to_owned());
        } else if let Some(found) = header.captures(line) {
            let name = group(&found, 1).to_owned();
            let size = format!(".size {name},");
            let end = (index + 1..lines.len())
                .find(|&at| lines[at].starts_with(&size))
                .ok_or_else(|| read_error(target, line, "no .size for the function"))?;
            items.push(AssemblyFunction {
                name,
                comments: std::mem::take(&mut pending),
                body: lines[(index + 2).min(end)..end].to_vec(),
            });
            index = end;
        } else if !line.is_empty() {
            pending.clear();
        }
        index += 1;
    }
    Ok(items)
}

/// The stack slots are the ".set name.slot, offset" lines at the top of a
/// function, in slot order; a symbol is the function name, a dot and the slot.
fn read_slots(
    name: &str,
    body: &[String],
    target: &str,
) -> Result<(Vec<String>, HashMap<String, usize>, usize)> {
    let declaration = pattern_regex(r"^\.set ([\w.]+), -?\d+$");
    let mut symbols = Vec::new();
    let mut slots = HashMap::new();
    let mut index = 0;
    while let Some(line) = body.get(index).filter(|line| line.starts_with(".set ")) {
        let symbol = declaration
            .captures(line)
            .map(|found| group(&found, 1).to_owned())
            .filter(|symbol| symbol.starts_with(&format!("{name}.")))
            .ok_or_else(|| read_error(target, line, "expected a stack slot"))?;
        slots.insert(symbol.clone(), slots.len());
        symbols.push(symbol);
        index += 1;
    }
    Ok((symbols, slots, index))
}

fn slot_lookup(slots: &HashMap<String, usize>) -> impl Fn(&str) -> Result<usize> + Copy + '_ {
    move |symbol| {
        slots
            .get(symbol)
            .copied()
            .ok_or_else(|| GrammarError::new(format!("Unknown stack slot \"{symbol}\"")))
    }
}

struct Finished<'a> {
    name: &'a str,
    comments: Vec<String>,
    symbols: Vec<String>,
    parameter_count: usize,
    raw: Vec<Option<Instruction>>,
    target: &'a str,
    marker: &'a str,
}

fn finish_function(parts: Finished) -> Result<Procedure> {
    let code = resolve_results(parts.raw, parts.target, parts.marker)?;
    let returns = code.contains(&Instruction::Return);
    let prefix = parts.name.len() + 1;
    Ok(procedure(
        parts.name.to_owned(),
        parts.parameter_count,
        parts
            .symbols
            .iter()
            .map(|symbol| symbol[prefix..].to_owned())
            .collect(),
        returns,
        parts.comments,
        code,
    ))
}

fn local_label(name: &str) -> String {
    format!(r"\.L{}_(\w+)", regex::escape(name))
}

fn call_rule<'a>(patterns: Vec<String>, count: usize) -> ReadRule<'a> {
    rule(&patterns, move |m| {
        let callee = group(&m[count], 1);
        if callee.starts_with("print_") {
            return Ok((count == 1 && callee == "print_integer")
                .then(|| vec![Some(Instruction::PrintInteger)]));
        }
        Ok(Some(vec![Some(Instruction::Call(callee.into(), count))]))
    })
}

fn single<'a>(pattern: &str, build: impl Fn(&regex::Captures) -> Instruction + 'a) -> ReadRule<'a> {
    rule(&[pattern], move |m| Ok(Some(vec![Some(build(&m[0]))])))
}

// ---------------------------------------------------------------------------
// x86-64 in GNU as, AT&T syntax
// ---------------------------------------------------------------------------

fn gas_rules<'a>(
    name: &str,
    texts: &'a HashMap<String, String>,
    slots: &'a HashMap<String, usize>,
) -> Vec<ReadRule<'a>> {
    let slot = slot_lookup(slots);
    let label = local_label(name);
    let mut rules = vec![
        rule(&[r"^# ?(.*)$"], |m| {
            Ok(Some(vec![Some(Instruction::Comment(
                group(&m[0], 1).into(),
            ))]))
        }),
        rule(&[r"^pushq \$(-?\d+)$"], |m| {
            Ok(Some(vec![Some(Instruction::Push(integer(group(
                &m[0], 1,
            ))?))]))
        }),
        rule(
            &[r"^movabsq \$(-?\d+), %rax$".to_owned(), exact("pushq %rax")],
            |m| {
                Ok(Some(vec![Some(Instruction::Push(integer(group(
                    &m[0], 1,
                ))?))]))
            },
        ),
        rule(&[r"^pushq ([\w.]+)\(%rbp\)$"], move |m| {
            Ok(Some(vec![Some(Instruction::Load(slot(group(&m[0], 1))?))]))
        }),
        rule(
            &[
                exact("popq %rax"),
                r"^movq %rax, ([\w.]+)\(%rbp\)$".to_owned(),
            ],
            move |m| Ok(Some(vec![Some(Instruction::Store(slot(group(&m[1], 1))?))])),
        ),
        fixed(
            &[exact("popq %rax"), exact("leave"), exact("ret")],
            vec![Instruction::Return],
        ),
        fixed(
            &[
                exact("popq %rsi"),
                exact("popq %rdi"),
                exact("call new_array"),
                exact("pushq %rax"),
            ],
            vec![Instruction::NewArray],
        ),
        fixed(&[exact("pushq (%rsp)")], vec![Instruction::Dup]),
        fixed(
            &[
                exact("popq %rcx"),
                exact("popq %rax"),
                exact("pushq (%rax,%rcx,8)"),
            ],
            vec![Instruction::ElementIndex, Instruction::LoadElement],
        ),
        fixed(
            &[
                exact("popq %rdx"),
                exact("popq %rcx"),
                exact("popq %rax"),
                exact("movq %rdx, (%rax,%rcx,8)"),
            ],
            vec![Instruction::StoreElement],
        ),
        fixed(
            &[exact("popq %rax"), exact("pushq -8(%rax)")],
            vec![Instruction::ArrayLength],
        ),
        fixed(&[exact("addq $8, %rsp")], vec![Instruction::Pop]),
    ];
    for (lines, operation) in GAS_ARITHMETIC {
        let mut patterns = vec![exact("popq %rcx"), exact("popq %rax")];
        patterns.extend(lines.iter().map(|line| exact(line)));
        patterns.push(exact("pushq %rax"));
        rules.push(fixed(&patterns, vec![Instruction::Arithmetic(operation)]));
    }
    rules.extend([
        rule(
            &[
                exact("popq %rcx"),
                exact("popq %rax"),
                exact("cmpq %rcx, %rax"),
                format!(r"^(j\w+) {label}$"),
            ],
            |m| {
                Ok(gas_relation(group(&m[3], 1)).map(|relation| {
                    vec![Some(Instruction::CompareJump(
                        relation,
                        group(&m[3], 2).into(),
                    ))]
                }))
            },
        ),
        fixed(&[exact("negq (%rsp)")], vec![Instruction::Negate]),
        single(&format!("^{label}:$"), |m| {
            Instruction::Label(group(m, 1).into())
        }),
        single(&format!("^jmp {label}$"), |m| {
            Instruction::Jump(group(m, 1).into())
        }),
        rule(
            &[
                r"^leaq (text_\d+)\(%rip\), %rdi$".to_owned(),
                exact("call print_text"),
            ],
            move |m| {
                let text = texts.get(group(&m[0], 1)).cloned().unwrap_or_default();
                Ok(Some(vec![Some(Instruction::PrintText(text))]))
            },
        ),
        fixed(
            &[exact("call print_newline")],
            vec![Instruction::PrintNewline],
        ),
        fixed(
            &[exact("xorl %eax, %eax"), exact("leave"), exact("ret")],
            vec![Instruction::ReturnNothing],
        ),
        fixed(
            &[exact("leave"), exact("ret")],
            vec![Instruction::ReturnNothing],
        ),
    ]);
    for count in (0..=6).rev() {
        let mut patterns: Vec<String> = GAS_ARGUMENTS[..count]
            .iter()
            .rev()
            .map(|register| exact(&format!("popq %{register}")))
            .collect();
        patterns.push(r"^call (\w+)$".into());
        rules.push(call_rule(patterns, count));
    }
    rules.push(rule(&[exact("pushq %rax")], |_| Ok(Some(vec![None]))));
    rules
}

fn read_gas_function(item: AssemblyFunction, texts: &HashMap<String, String>) -> Result<Procedure> {
    let AssemblyFunction {
        name,
        comments,
        body,
    } = item;
    let (symbols, slots, first) = read_slots(&name, &body, "gas")?;
    let mut index = first;
    for line in ["pushq %rbp", "movq %rsp, %rbp"] {
        let found = body.get(index).map_or("", String::as_str);
        if found != line {
            return Err(read_error("gas", found, &format!("expected {line}")));
        }
        index += 1;
    }
    if body
        .get(index)
        .is_some_and(|line| pattern_regex(r"^subq \$\d+, %rsp$").is_match(line))
    {
        index += 1;
    }
    let argument = pattern_regex(r"^movq %(\w+), [\w.]+\(%rbp\)$");
    let mut parameter_count = 0;
    while let Some(found) = body.get(index).and_then(|line| argument.captures(line))
        && GAS_ARGUMENTS.get(parameter_count) == Some(&group(&found, 1))
    {
        parameter_count += 1;
        index += 1;
    }
    let raw = read_instructions(
        body.get(index..).unwrap_or_default(),
        &gas_rules(&name, texts, &slots),
        "gas",
    )?;
    finish_function(Finished {
        name: &name,
        comments,
        symbols,
        parameter_count,
        raw,
        target: "gas",
        marker: "pushq %rax",
    })
}

/// Read x86-64 GNU as (AT&T) source written in the style of the gas writer.
pub fn read_gas(source: &str) -> Result<LoweredProgram> {
    let lines = trimmed_lines(source);
    let (comments, rest) = leading_comments(&lines, "#", r"^\.globl main$");
    let texts = assembly_texts(&rest);
    let items = assembly_functions(&rest, "#", "gas")?
        .into_iter()
        .map(|item| read_gas_function(item, &texts))
        .collect::<Result<Vec<_>>>()?;
    program(comments, items)
}

// ---------------------------------------------------------------------------
// AArch64 in GNU as
// ---------------------------------------------------------------------------

fn arm_rules<'a>(
    name: &str,
    texts: &'a HashMap<String, String>,
    slots: &'a HashMap<String, usize>,
) -> Vec<ReadRule<'a>> {
    let slot = slot_lookup(slots);
    let label = local_label(name);
    let with_epilogue = |first: Vec<String>| {
        let mut patterns = first;
        patterns.extend(arm_epilogue());
        patterns
    };
    let mut rules = vec![
        rule(&[r"^// ?(.*)$"], |m| {
            Ok(Some(vec![Some(Instruction::Comment(
                group(&m[0], 1).into(),
            ))]))
        }),
        rule(
            &[r"^(?:mov x0, #|ldr x0, =)(-?\d+)$".to_owned(), arm_push()],
            |m| {
                Ok(Some(vec![Some(Instruction::Push(integer(group(
                    &m[0], 1,
                ))?))]))
            },
        ),
        rule(
            &[r"^ldr x0, \[x29, #([\w.]+)\]$".to_owned(), arm_push()],
            move |m| Ok(Some(vec![Some(Instruction::Load(slot(group(&m[0], 1))?))])),
        ),
        rule(
            &[arm_pop("x0"), r"^str x0, \[x29, #([\w.]+)\]$".to_owned()],
            move |m| Ok(Some(vec![Some(Instruction::Store(slot(group(&m[1], 1))?))])),
        ),
        fixed(
            &with_epilogue(vec![arm_pop("x0")]),
            vec![Instruction::Return],
        ),
        fixed(
            &with_epilogue(vec![exact("mov x0, #0")]),
            vec![Instruction::ReturnNothing],
        ),
        fixed(&arm_epilogue(), vec![Instruction::ReturnNothing]),
        fixed(
            &[
                arm_pop("x1"),
                arm_pop("x0"),
                exact("bl new_array"),
                arm_push(),
            ],
            vec![Instruction::NewArray],
        ),
        fixed(&[exact("ldr x0, [sp]"), arm_push()], vec![Instruction::Dup]),
        fixed(
            &[
                arm_pop("x1"),
                arm_pop("x0"),
                exact("ldr x0, [x0, x1, lsl #3]"),
                arm_push(),
            ],
            vec![Instruction::ElementIndex, Instruction::LoadElement],
        ),
        fixed(
            &[
                arm_pop("x2"),
                arm_pop("x1"),
                arm_pop("x0"),
                exact("str x2, [x0, x1, lsl #3]"),
            ],
            vec![Instruction::StoreElement],
        ),
        fixed(
            &[arm_pop("x0"), exact("ldr x0, [x0, #-8]"), arm_push()],
            vec![Instruction::ArrayLength],
        ),
        fixed(&[exact("add sp, sp, #16")], vec![Instruction::Pop]),
    ];
    for (lines, operation) in ARM_ARITHMETIC {
        let mut patterns = vec![arm_pop("x1"), arm_pop("x0")];
        patterns.extend(lines.iter().map(|line| exact(line)));
        patterns.push(arm_push());
        rules.push(fixed(&patterns, vec![Instruction::Arithmetic(operation)]));
    }
    rules.extend([
        rule(
            &[
                arm_pop("x1"),
                arm_pop("x0"),
                exact("cmp x0, x1"),
                format!(r"^b\.(\w+) {label}$"),
            ],
            |m| {
                Ok(arm_relation(group(&m[3], 1)).map(|relation| {
                    vec![Some(Instruction::CompareJump(
                        relation,
                        group(&m[3], 2).into(),
                    ))]
                }))
            },
        ),
        fixed(
            &[
                exact("ldr x0, [sp]"),
                exact("neg x0, x0"),
                exact("str x0, [sp]"),
            ],
            vec![Instruction::Negate],
        ),
        single(&format!("^{label}:$"), |m| {
            Instruction::Label(group(m, 1).into())
        }),
        single(&format!("^b {label}$"), |m| {
            Instruction::Jump(group(m, 1).into())
        }),
        rule(
            &[
                r"^adrp x0, (text_\d+)$".to_owned(),
                r"^add x0, x0, :lo12:text_\d+$".to_owned(),
                exact("bl print_text"),
            ],
            move |m| {
                let text = texts.get(group(&m[0], 1)).cloned().unwrap_or_default();
                Ok(Some(vec![Some(Instruction::PrintText(text))]))
            },
        ),
        fixed(
            &[exact("bl print_newline")],
            vec![Instruction::PrintNewline],
        ),
    ]);
    for count in (0..=8).rev() {
        let mut patterns: Vec<String> = (0..count)
            .map(|index| arm_pop(&format!("x{}", count - 1 - index)))
            .collect();
        patterns.push(r"^bl (\w+)$".into());
        rules.push(call_rule(patterns, count));
    }
    rules.push(rule(&[arm_push()], |_| Ok(Some(vec![None]))));
    rules
}

fn read_arm64_function(
    item: AssemblyFunction,
    texts: &HashMap<String, String>,
) -> Result<Procedure> {
    let AssemblyFunction {
        name,
        comments,
        body,
    } = item;
    let (symbols, slots, first) = read_slots(&name, &body, "arm64")?;
    let mut index = first;
    for pattern in [
        exact("stp x29, x30, [sp, #-16]!"),
        r"^sub sp, sp, #\d+$".to_owned(),
        exact("mov x29, sp"),
    ] {
        let found = body.get(index).map_or("", String::as_str);
        if !pattern_regex(&pattern).is_match(found) {
            return Err(read_error("arm64", found, &format!("expected /{pattern}/")));
        }
        index += 1;
    }
    let argument = pattern_regex(r"^str x(\d+), \[x29, #[\w.]+\]$");
    let mut parameter_count = 0;
    while let Some(found) = body.get(index).and_then(|line| argument.captures(line))
        && group(&found, 1) == parameter_count.to_string()
    {
        parameter_count += 1;
        index += 1;
    }
    let raw = read_instructions(
        body.get(index..).unwrap_or_default(),
        &arm_rules(&name, texts, &slots),
        "arm64",
    )?;
    finish_function(Finished {
        name: &name,
        comments,
        symbols,
        parameter_count,
        raw,
        target: "arm64",
        marker: "str x0, [sp, #-16]!",
    })
}

/// Read AArch64 GNU as source written in the style of the arm64 writer.
pub fn read_arm64(source: &str) -> Result<LoweredProgram> {
    let lines = trimmed_lines(source);
    let (comments, rest) = leading_comments(&lines, "//", r"^\.global main$");
    let texts = assembly_texts(&rest);
    let items = assembly_functions(&rest, "//", "arm64")?
        .into_iter()
        .map(|item| read_arm64_function(item, &texts))
        .collect::<Result<Vec<_>>>()?;
    program(comments, items)
}
