//! Reading of x86-64 assembly (NASM), CIL (ILAsm) and JVM bytecode (Jasmin)
//! back into the stack machine code described in [`super::lowering`]. Each
//! reader matches the instruction sequences that [`super::machine`] writes,
//! so any program the translator lowered (or a hand-written program in the
//! same style) can be lifted into the meta language again.
//!
//! A reader returns a [`LoweredProgram`] whose procedures carry their name,
//! parameter count, slot names, comments and code. Readers do not compute
//! stack depths, so `max_depth` is zero.

use std::collections::HashMap;

use regex::{Captures, Regex};

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::machine::jasmin_variable;
use crate::meta::GrammarError;

type Result<T> = std::result::Result<T, GrammarError>;

/// A read instruction, or `None` for the "push rax" that keeps the result
/// of the call before it.
type Raw = Option<Instruction>;

type Build<'a> = Box<dyn Fn(&[Captures]) -> Result<Option<Vec<Raw>>> + 'a>;

/// Patterns that match consecutive lines, and the instructions they mean.
/// `build` may decline a match by returning `None`.
struct ReadRule<'a> {
    patterns: Vec<Regex>,
    build: Build<'a>,
}

fn rule<'a>(
    patterns: &[&str],
    build: impl Fn(&[Captures]) -> Result<Option<Vec<Raw>>> + 'a,
) -> ReadRule<'a> {
    ReadRule {
        patterns: patterns
            .iter()
            .map(|pattern| pattern_regex(pattern))
            .collect(),
        build: Box::new(build),
    }
}

/// A rule that always yields the same instructions.
fn fixed<'a>(patterns: &[&str], code: Vec<Instruction>) -> ReadRule<'a> {
    rule(patterns, move |_| {
        Ok(Some(code.iter().cloned().map(Some).collect()))
    })
}

fn pattern_regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("reader patterns are valid regular expressions")
}

fn read_error(target: &str, line: &str, message: &str) -> GrammarError {
    GrammarError::new(format!("Cannot read {target} line \"{line}\": {message}"))
}

/// Read instructions with a list of rules. The first rule that matches
/// wins, so longer sequences come first.
fn read_instructions(lines: &[String], rules: &[ReadRule], target: &str) -> Result<Vec<Raw>> {
    let mut code = Vec::new();
    let mut index = 0;
    'lines: while index < lines.len() {
        for rule in rules {
            let matches: Option<Vec<Captures>> = rule
                .patterns
                .iter()
                .enumerate()
                .map(|(offset, pattern)| {
                    lines
                        .get(index + offset)
                        .and_then(|line| pattern.captures(line))
                })
                .collect();
            if let Some(matches) = matches
                && let Some(built) = (rule.build)(&matches)?
            {
                code.extend(built);
                index += rule.patterns.len();
                continue 'lines;
            }
        }
        return Err(read_error(target, &lines[index], "unknown instruction"));
    }
    Ok(code)
}

fn without_results(code: Vec<Raw>) -> Vec<Instruction> {
    code.into_iter().flatten().collect()
}

/// Split a file into the program comments (before the first line that
/// starts the program) and the rest.
fn leading_comments(lines: &[String], prefix: &str, start: &str) -> (Vec<String>, Vec<String>) {
    let start = pattern_regex(start);
    match lines.iter().position(|line| start.is_match(line)) {
        Some(first) => {
            let comments = lines[..first]
                .iter()
                .filter_map(|line| line.strip_prefix(prefix))
                .map(|text| text.strip_prefix(' ').unwrap_or(text).to_owned())
                .collect();
            (comments, lines[first..].to_vec())
        }
        None => (Vec::new(), lines.last().cloned().into_iter().collect()),
    }
}

fn integer(text: &str) -> Result<f64> {
    const SAFE: f64 = 9_007_199_254_740_991.0;
    match text.parse::<f64>() {
        Ok(value) if value.abs() <= SAFE => Ok(value),
        _ => Err(GrammarError::new(format!(
            "The integer {text} is outside the supported range"
        ))),
    }
}

fn group<'t>(captures: &'t Captures, index: usize) -> &'t str {
    captures.get(index).map_or("", |found| found.as_str())
}

fn trimmed_lines(source: &str) -> Vec<String> {
    source
        .split('\n')
        .map(|line| line.trim().to_owned())
        .collect()
}

/// The program after reading: "main" is the entry point.
fn program(comments: Vec<String>, mut items: Vec<Procedure>) -> Result<LoweredProgram> {
    let position = items
        .iter()
        .position(|item| item.name == "main")
        .ok_or_else(|| GrammarError::new("The machine program has no entry point"))?;
    let main = items.remove(position);
    Ok(LoweredProgram {
        comments,
        functions: items,
        main,
    })
}

fn procedure(
    name: String,
    parameter_count: usize,
    slot_names: Vec<String>,
    returns: bool,
    comments: Vec<String>,
    code: Vec<Instruction>,
) -> Procedure {
    Procedure {
        name,
        parameter_count,
        slot_count: slot_names.len(),
        slot_arrays: vec![false; slot_names.len()],
        slot_names,
        returns,
        max_depth: 0,
        comments,
        code,
    }
}

fn arithmetic(operation: &str) -> Option<&'static str> {
    Some(match operation {
        "add" | "ladd" => "add",
        "sub" | "lsub" => "subtract",
        "mul" | "lmul" => "multiply",
        "div" | "ldiv" => "divide",
        "rem" | "lrem" => "remainder",
        _ => return None,
    })
}

fn relation(jump: &str) -> Option<&'static str> {
    Some(match jump {
        "je" | "beq" | "ifeq" => "equal",
        "jne" | "bne.un" | "ifne" => "notEqual",
        "jl" | "blt" | "iflt" => "less",
        "jle" | "ble" | "ifle" => "lessOrEqual",
        "jg" | "bgt" | "ifgt" => "greater",
        "jge" | "bge" | "ifge" => "greaterOrEqual",
        _ => return None,
    })
}

const ARGUMENT_REGISTERS: [&str; 6] = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];

// ---------------------------------------------------------------------------
// x86-64 NASM
// ---------------------------------------------------------------------------

fn nasm_texts(lines: &[String]) -> HashMap<String, String> {
    let declaration = pattern_regex(r"^(text_\d+): db (.*), 0$");
    let part = pattern_regex(r#""[^"]*"|\d+"#);
    let mut texts = HashMap::new();
    for line in lines {
        let Some(found) = declaration.captures(line) else {
            continue;
        };
        let mut bytes = Vec::new();
        for piece in part.find_iter(group(&found, 2)) {
            let piece = piece.as_str();
            if let Some(quoted) = piece.strip_prefix('"') {
                bytes.extend(quoted[..quoted.len() - 1].chars().map(|c| c as u32 as u8));
            } else {
                bytes.push(piece.parse::<u32>().unwrap_or(0) as u8);
            }
        }
        texts.insert(
            group(&found, 1).to_owned(),
            String::from_utf8_lossy(&bytes).into_owned(),
        );
    }
    texts
}

fn nasm_rules<'a>(
    texts: &'a HashMap<String, String>,
    slots: &'a HashMap<String, usize>,
) -> Vec<ReadRule<'a>> {
    let slot = move |name: &str| {
        slots
            .get(name)
            .copied()
            .ok_or_else(|| GrammarError::new(format!("Unknown stack slot \"{name}\"")))
    };
    let mut rules = vec![
        rule(&[r"^; ?(.*)$"], |m| {
            Ok(Some(vec![Some(Instruction::Comment(
                group(&m[0], 1).into(),
            ))]))
        }),
        rule(&[r"^push (-?\d+)$"], |m| {
            Ok(Some(vec![Some(Instruction::Push(integer(group(
                &m[0], 1,
            ))?))]))
        }),
        rule(&[r"^mov rax, (-?\d+)$", r"^push rax$"], |m| {
            Ok(Some(vec![Some(Instruction::Push(integer(group(
                &m[0], 1,
            ))?))]))
        }),
        rule(&[r"^push %\$(\w+)$"], move |m| {
            Ok(Some(vec![Some(Instruction::Load(slot(group(&m[0], 1))?))]))
        }),
        rule(&[r"^pop rax$", r"^mov %\$(\w+), rax$"], move |m| {
            Ok(Some(vec![Some(Instruction::Store(slot(group(&m[1], 1))?))]))
        }),
        fixed(
            &[r"^pop rax$", r"^leave$", r"^ret$"],
            vec![Instruction::Return],
        ),
        // Arrays: new_array(length, fill) and the elements after the address.
        fixed(
            &[
                r"^pop rsi$",
                r"^pop rdi$",
                r"^call new_array$",
                r"^push rax$",
            ],
            vec![Instruction::NewArray],
        ),
        fixed(&[r"^push qword \[rsp\]$"], vec![Instruction::Dup]),
        fixed(
            &[
                r"^pop rcx$",
                r"^pop rax$",
                r"^push qword \[rax \+ rcx \* 8\]$",
            ],
            vec![Instruction::ElementIndex, Instruction::LoadElement],
        ),
        fixed(
            &[
                r"^pop rdx$",
                r"^pop rcx$",
                r"^pop rax$",
                r"^mov \[rax \+ rcx \* 8\], rdx$",
            ],
            vec![Instruction::StoreElement],
        ),
        fixed(
            &[r"^pop rax$", r"^push qword \[rax - 8\]$"],
            vec![Instruction::ArrayLength],
        ),
        fixed(&[r"^add rsp, 8$"], vec![Instruction::Pop]),
    ];
    let operations: [(&[&str], &'static str); 5] = [
        (&["add rax, rcx"], "add"),
        (&["sub rax, rcx"], "subtract"),
        (&["imul rax, rcx"], "multiply"),
        (&["cqo", "idiv rcx", "mov rax, rdx"], "remainder"),
        (&["cqo", "idiv rcx"], "divide"),
    ];
    for (lines, operation) in operations {
        let mut patterns = vec![r"^pop rcx$".to_owned(), r"^pop rax$".to_owned()];
        patterns.extend(lines.iter().map(|line| format!("^{line}$")));
        patterns.push(r"^push rax$".into());
        let patterns: Vec<&str> = patterns.iter().map(String::as_str).collect();
        rules.push(fixed(&patterns, vec![Instruction::Arithmetic(operation)]));
    }
    rules.extend([
        rule(
            &[
                r"^pop rcx$",
                r"^pop rax$",
                r"^cmp rax, rcx$",
                r"^(j\w+) \.(\w+)$",
            ],
            |m| {
                Ok(relation(group(&m[3], 1)).map(|relation| {
                    vec![Some(Instruction::CompareJump(
                        relation,
                        group(&m[3], 2).into(),
                    ))]
                }))
            },
        ),
        fixed(&[r"^neg qword \[rsp\]$"], vec![Instruction::Negate]),
        rule(&[r"^\.(\w+):$"], |m| {
            Ok(Some(vec![Some(Instruction::Label(group(&m[0], 1).into()))]))
        }),
        rule(&[r"^jmp \.(\w+)$"], |m| {
            Ok(Some(vec![Some(Instruction::Jump(group(&m[0], 1).into()))]))
        }),
        rule(
            &[r"^lea rdi, \[(text_\d+)\]$", r"^call print_text$"],
            move |m| {
                let text = texts.get(group(&m[0], 1)).cloned().unwrap_or_default();
                Ok(Some(vec![Some(Instruction::PrintText(text))]))
            },
        ),
        fixed(&[r"^call print_newline$"], vec![Instruction::PrintNewline]),
        fixed(
            &[r"^xor eax, eax$", r"^leave$", r"^ret$"],
            vec![Instruction::ReturnNothing],
        ),
        fixed(&[r"^leave$", r"^ret$"], vec![Instruction::ReturnNothing]),
    ]);
    for count in (0..=6).rev() {
        let mut patterns: Vec<String> = ARGUMENT_REGISTERS[..count]
            .iter()
            .rev()
            .map(|register| format!("^pop {register}$"))
            .collect();
        patterns.push(r"^call (\w+)$".into());
        let patterns: Vec<&str> = patterns.iter().map(String::as_str).collect();
        rules.push(rule(&patterns, move |m| {
            let name = group(&m[count], 1);
            if name.starts_with("print_") {
                return Ok((count == 1 && name == "print_integer")
                    .then(|| vec![Some(Instruction::PrintInteger)]));
            }
            Ok(Some(vec![Some(Instruction::Call(name.into(), count))]))
        }));
    }
    // "call f" followed by "push rax" keeps the result of f.
    rules.push(rule(&[r"^push rax$"], |_| Ok(Some(vec![None]))));
    rules
}

fn read_nasm_procedure(
    name: &str,
    comments: Vec<String>,
    lines: &[String],
    texts: &HashMap<String, String>,
) -> Result<Procedure> {
    let mut slots: HashMap<String, usize> = HashMap::new();
    let mut slot_names = Vec::new();
    let mut index = 0;
    let expect = |index: &mut usize, pattern: &str| -> Result<Vec<String>> {
        let line = lines.get(*index).map_or("", String::as_str);
        let found = pattern_regex(pattern)
            .captures(line)
            .ok_or_else(|| read_error("nasm", line, &format!("expected /{pattern}/")))?;
        *index += 1;
        Ok(found
            .iter()
            .map(|part| part.map_or("", |part| part.as_str()).to_owned())
            .collect())
    };
    expect(&mut index, r"^%push \w+$")?;
    while lines
        .get(index)
        .is_some_and(|line| line.starts_with("%define"))
    {
        let found = expect(&mut index, r"^%define %\$(\w+) qword \[rbp - \d+\]$")?;
        slots.insert(found[1].clone(), slots.len());
        slot_names.push(found[1].clone());
    }
    expect(&mut index, r"^push rbp$")?;
    expect(&mut index, r"^mov rbp, rsp$")?;
    if lines
        .get(index)
        .is_some_and(|line| pattern_regex(r"^sub rsp, \d+$").is_match(line))
    {
        index += 1;
    }
    let argument = pattern_regex(r"^mov %\$\w+, (\w+)$");
    let mut parameter_count = 0;
    while let Some(found) = lines.get(index).and_then(|line| argument.captures(line))
        && ARGUMENT_REGISTERS.get(parameter_count) == Some(&group(&found, 1))
    {
        parameter_count += 1;
        index += 1;
    }
    let end = lines
        .iter()
        .rposition(|line| line == "%pop")
        .unwrap_or(lines.len());
    let raw = read_instructions(
        lines.get(index..end).unwrap_or_default(),
        &nasm_rules(texts, &slots),
        "nasm",
    )?;
    // "call f; push rax" is a call whose result stays on the stack. A call
    // without "push rax" is a call to a procedure that returns nothing.
    let mut code: Vec<Instruction> = Vec::new();
    for instruction in raw {
        match instruction {
            Some(instruction) => code.push(instruction),
            None if matches!(code.last(), Some(Instruction::Call(..))) => {}
            None => return Err(read_error("nasm", "push rax", "not after a call")),
        }
    }
    let returns = code.contains(&Instruction::Return);
    Ok(procedure(
        name.to_owned(),
        parameter_count,
        slot_names,
        returns,
        comments,
        code,
    ))
}

/// Read NASM source written in the style of the NASM writer.
pub fn read_nasm(source: &str) -> Result<LoweredProgram> {
    let lines = trimmed_lines(source);
    let (comments, rest) = leading_comments(&lines, ";", r"^default rel$");
    let texts = nasm_texts(&rest);
    let text = match rest.iter().position(|line| line == "section .text") {
        Some(position) => &rest[position + 1..],
        None => &rest[..],
    };
    let label = pattern_regex(r"^(\w+):$");
    let mut items = Vec::new();
    let mut pending: Vec<String> = Vec::new();
    let mut index = 0;
    while index < text.len() {
        let line = &text[index];
        if let Some(comment) = line.strip_prefix(';') {
            pending.push(comment.strip_prefix(' ').unwrap_or(comment).to_owned());
        } else if let Some(found) = label.captures(line)
            && text
                .get(index + 1)
                .is_some_and(|next| next.starts_with("%push"))
        {
            let end = text[index..]
                .iter()
                .position(|line| line == "%pop")
                .map(|offset| index + offset);
            let body = match end {
                Some(end) => &text[index + 1..=end],
                None => &[],
            };
            items.push(read_nasm_procedure(
                group(&found, 1),
                std::mem::take(&mut pending),
                body,
                &texts,
            )?);
            index = end.unwrap_or(index);
        } else if !line.is_empty() {
            pending.clear();
        }
        index += 1;
    }
    program(comments, items)
}

// ---------------------------------------------------------------------------
// CIL (ILAsm)
// ---------------------------------------------------------------------------

fn cil_string(literal: &str) -> String {
    let bytes = pattern_regex(r"^bytearray \(([0-9a-f ]*)\)$");
    if let Some(found) = bytes.captures(literal) {
        let values: Vec<u16> = group(&found, 1)
            .split(' ')
            .map(|byte| u16::from_str_radix(byte, 16).unwrap_or(0))
            .collect();
        let units: Vec<u16> = values
            .chunks(2)
            .map(|pair| pair[0] | (pair.get(1).copied().unwrap_or(0) << 8))
            .collect();
        return String::from_utf16_lossy(&units);
    }
    let inner = literal
        .get(1..literal.len().saturating_sub(1))
        .unwrap_or_default();
    pattern_regex(r#"\\(["\\])"#)
        .replace_all(inner, "$1")
        .into_owned()
}

fn cil_rules<'a>(parameter_count: usize, returns: bool) -> Vec<ReadRule<'a>> {
    let access = move |kind: &str, index: &str| {
        let index = index.parse::<usize>().unwrap_or(0);
        if kind.ends_with("arg") {
            index
        } else {
            parameter_count + index
        }
    };
    let console = r"call void \[System\.Console\]System\.Console::";
    let write_integer = format!(r"^{console}Write\(int64\)$");
    let write_text = format!(r"^{console}Write\(string\)$");
    let write_line = format!(r"^{console}WriteLine\(\)$");
    vec![
        rule(&[r"^// ?(.*)$"], |m| {
            Ok(Some(vec![Some(Instruction::Comment(
                group(&m[0], 1).into(),
            ))]))
        }),
        rule(&[r"^ldc\.i8 (-?\d+)$"], |m| {
            Ok(Some(vec![Some(Instruction::Push(integer(group(
                &m[0], 1,
            ))?))]))
        }),
        rule(&[r"^(ldarg|ldloc) (\d+)$"], move |m| {
            let slot = access(group(&m[0], 1), group(&m[0], 2));
            Ok(Some(vec![Some(Instruction::Load(slot))]))
        }),
        rule(&[r"^(starg|stloc) (\d+)$"], move |m| {
            let slot = access(group(&m[0], 1), group(&m[0], 2));
            Ok(Some(vec![Some(Instruction::Store(slot))]))
        }),
        fixed(&[r"^pop$"], vec![Instruction::Pop]),
        fixed(&[r"^dup$"], vec![Instruction::Dup]),
        fixed(&[r"^conv\.ovf\.i$"], vec![Instruction::ElementIndex]),
        fixed(&[r"^ldelem\.i8$"], vec![Instruction::LoadElement]),
        fixed(&[r"^stelem\.i8$"], vec![Instruction::StoreElement]),
        fixed(&[r"^ldlen$", r"^conv\.i8$"], vec![Instruction::ArrayLength]),
        fixed(
            &[r"^call int64\[\] Program::NewArray\(int64, int64\)$"],
            vec![Instruction::NewArray],
        ),
        rule(&[r"^(add|sub|mul|div|rem)$"], |m| {
            Ok(arithmetic(group(&m[0], 1))
                .map(|operation| vec![Some(Instruction::Arithmetic(operation))]))
        }),
        fixed(&[r"^neg$"], vec![Instruction::Negate]),
        rule(&[r"^(\w+):$"], |m| {
            Ok(Some(vec![Some(Instruction::Label(group(&m[0], 1).into()))]))
        }),
        rule(&[r"^br (\w+)$"], |m| {
            Ok(Some(vec![Some(Instruction::Jump(group(&m[0], 1).into()))]))
        }),
        rule(&[r"^(beq|bne\.un|blt|ble|bgt|bge) (\w+)$"], |m| {
            Ok(relation(group(&m[0], 1)).map(|relation| {
                vec![Some(Instruction::CompareJump(
                    relation,
                    group(&m[0], 2).into(),
                ))]
            }))
        }),
        fixed(&[&write_integer], vec![Instruction::PrintInteger]),
        rule(&[r"^ldstr (.*)$", &write_text], |m| {
            Ok(Some(vec![Some(Instruction::PrintText(cil_string(group(
                &m[0], 1,
            ))))]))
        }),
        fixed(&[&write_line], vec![Instruction::PrintNewline]),
        rule(&[r"^call (?:int64|void) Program::(\w+)\(([^)]*)\)$"], |m| {
            let parameters = group(&m[0], 2);
            let count = if parameters.is_empty() {
                0
            } else {
                parameters.split(',').count()
            };
            Ok(Some(vec![Some(Instruction::Call(
                group(&m[0], 1).into(),
                count,
            ))]))
        }),
        fixed(
            &[r"^ret$"],
            vec![if returns {
                Instruction::Return
            } else {
                Instruction::ReturnNothing
            }],
        ),
    ]
}

/// The second word of each comma separated "type name" item.
fn declared_names(list: &str) -> Vec<String> {
    list.split(',')
        .map(|item| item.trim().split(' ').nth(1).unwrap_or_default().to_owned())
        .collect()
}

/// Read ILAsm source written in the style of the CIL writer.
pub fn read_cil(source: &str) -> Result<LoweredProgram> {
    let lines = trimmed_lines(source);
    let (comments, rest) = leading_comments(&lines, "//", r"^\.assembly");
    let header =
        pattern_regex(r"^\.method public static (int64|void) (\w+)\(([^)]*)\) cil managed$");
    let directive = pattern_regex(r"^\.(entrypoint|maxstack)");
    let locals_line = pattern_regex(r"^\.locals init \((.*)\)$");
    let mut items = Vec::new();
    let mut pending: Vec<String> = Vec::new();
    let mut index = 0;
    while index < rest.len() {
        let line = &rest[index];
        if let Some(comment) = line.strip_prefix("//") {
            pending.push(comment.strip_prefix(' ').unwrap_or(comment).to_owned());
            index += 1;
            continue;
        }
        let Some(found) = header.captures(line) else {
            pending.clear();
            index += 1;
            continue;
        };
        let returns = group(&found, 1) == "int64";
        let method_name = group(&found, 2);
        let parameter_list = group(&found, 3);
        let parameters = if parameter_list.is_empty() {
            Vec::new()
        } else {
            declared_names(parameter_list)
        };
        let end = rest[index..]
            .iter()
            .position(|line| line == "}")
            .map_or(rest.len(), |offset| index + offset);
        let mut body: Vec<String> = rest
            .get(index + 2..end)
            .unwrap_or_default()
            .iter()
            .filter(|item| !directive.is_match(item))
            .cloned()
            .collect();
        let mut slot_names = parameters.clone();
        if body.first().is_some_and(|line| line.starts_with(".locals")) {
            let first = body.remove(0);
            let list = locals_line
                .captures(&first)
                .map(|found| group(&found, 1).to_owned())
                .ok_or_else(|| read_error("cil", &first, "unknown locals"))?;
            slot_names.extend(declared_names(&list));
        }
        let code = read_instructions(&body, &cil_rules(parameters.len(), returns), "cil")?;
        items.push(procedure(
            if method_name == "Main" {
                "main".into()
            } else {
                method_name.into()
            },
            parameters.len(),
            slot_names,
            returns,
            std::mem::take(&mut pending),
            without_results(code),
        ));
        index = end + 1;
    }
    program(comments, items)
}

// ---------------------------------------------------------------------------
// JVM bytecode (Jasmin)
// ---------------------------------------------------------------------------

fn jvm_string(literal: &str) -> String {
    let inner: Vec<char> = literal
        .get(1..literal.len().saturating_sub(1))
        .unwrap_or_default()
        .chars()
        .collect();
    let mut units: Vec<u16> = Vec::new();
    let mut index = 0;
    while index < inner.len() {
        let character = inner[index];
        if character == '\\' {
            let code: String = inner.iter().skip(index + 2).take(4).collect();
            if inner.get(index + 1) == Some(&'u')
                && code.len() == 4
                && code.chars().all(|c| matches!(c, '0'..='9' | 'a'..='f'))
            {
                units.push(u16::from_str_radix(&code, 16).unwrap_or(0));
                index += 6;
                continue;
            }
            if let Some(escaped @ ('"' | '\\')) = inner.get(index + 1) {
                units.push(*escaped as u16);
                index += 2;
                continue;
            }
        }
        let mut buffer = [0u16; 2];
        units.extend_from_slice(character.encode_utf16(&mut buffer));
        index += 1;
    }
    String::from_utf16_lossy(&units)
}

fn jvm_rules<'a>(base: usize) -> Vec<ReadRule<'a>> {
    let slot_of = move |number: &str| number.parse::<usize>().unwrap_or(0).saturating_sub(base) / 2;
    let out = r"^getstatic java/lang/System/out Ljava/io/PrintStream;$";
    vec![
        rule(&[r"^; ?(.*)$"], |m| {
            Ok(Some(vec![Some(Instruction::Comment(
                group(&m[0], 1).into(),
            ))]))
        }),
        rule(&[r"^ldc2_w (-?\d+)$"], |m| {
            Ok(Some(vec![Some(Instruction::Push(integer(group(
                &m[0], 1,
            ))?))]))
        }),
        rule(&[r"^[la]load (\d+)$"], move |m| {
            Ok(Some(vec![Some(Instruction::Load(slot_of(group(
                &m[0], 1,
            ))))]))
        }),
        rule(&[r"^[la]store (\d+)$"], move |m| {
            Ok(Some(vec![Some(Instruction::Store(slot_of(group(
                &m[0], 1,
            ))))]))
        }),
        fixed(&[r"^dup$"], vec![Instruction::Dup]),
        fixed(&[r"^l2i$"], vec![Instruction::ElementIndex]),
        fixed(&[r"^laload$"], vec![Instruction::LoadElement]),
        fixed(&[r"^lastore$"], vec![Instruction::StoreElement]),
        fixed(
            &[r"^arraylength$", r"^i2l$"],
            vec![Instruction::ArrayLength],
        ),
        fixed(
            &[r"^invokestatic Program/newArray\(JJ\)\[J$"],
            vec![Instruction::NewArray],
        ),
        fixed(&[r"^pop2$"], vec![Instruction::Pop]),
        rule(&[r"^(ladd|lsub|lmul|ldiv|lrem)$"], |m| {
            Ok(arithmetic(group(&m[0], 1))
                .map(|operation| vec![Some(Instruction::Arithmetic(operation))]))
        }),
        fixed(&[r"^lneg$"], vec![Instruction::Negate]),
        rule(&[r"^(\w+):$"], |m| {
            Ok(Some(vec![Some(Instruction::Label(group(&m[0], 1).into()))]))
        }),
        rule(&[r"^goto (\w+)$"], |m| {
            Ok(Some(vec![Some(Instruction::Jump(group(&m[0], 1).into()))]))
        }),
        rule(&[r"^lcmp$", r"^(if\w+) (\w+)$"], |m| {
            Ok(relation(group(&m[1], 1)).map(|relation| {
                vec![Some(Instruction::CompareJump(
                    relation,
                    group(&m[1], 2).into(),
                ))]
            }))
        }),
        rule(&[r"^invokestatic Program/(\w+)\((J*)\)[JV]$"], |m| {
            Ok(Some(vec![Some(Instruction::Call(
                group(&m[0], 1).into(),
                group(&m[0], 2).len(),
            ))]))
        }),
        fixed(&[r"^lreturn$"], vec![Instruction::Return]),
        fixed(&[r"^return$"], vec![Instruction::ReturnNothing]),
        fixed(
            &[
                out,
                r"^dup_x2$",
                r"^pop$",
                r"^invokevirtual java/io/PrintStream/print\(J\)V$",
            ],
            vec![Instruction::PrintInteger],
        ),
        rule(
            &[
                out,
                r#"^ldc (".*")$"#,
                r"^invokevirtual java/io/PrintStream/print\(Ljava/lang/String;\)V$",
            ],
            |m| {
                Ok(Some(vec![Some(Instruction::PrintText(jvm_string(group(
                    &m[1], 1,
                ))))]))
            },
        ),
        fixed(
            &[out, r"^invokevirtual java/io/PrintStream/println\(\)V$"],
            vec![Instruction::PrintNewline],
        ),
    ]
}

/// Read Jasmin source written in the style of the JVM writer.
pub fn read_jvm(source: &str) -> Result<LoweredProgram> {
    let lines = trimmed_lines(source);
    let (comments, rest) = leading_comments(&lines, ";", r"^\.class");
    let header = pattern_regex(r"^\.method public static (\w+)\(([^)]*)\)([JV])$");
    let variable = pattern_regex(r"^\.var (\d+) is (\w+) \[?J$");
    let mut items = Vec::new();
    let mut pending: Vec<String> = Vec::new();
    let mut index = 0;
    while index < rest.len() {
        let line = &rest[index];
        if let Some(comment) = line.strip_prefix(';') {
            pending.push(comment.strip_prefix(' ').unwrap_or(comment).to_owned());
            index += 1;
            continue;
        }
        let Some(found) = header.captures(line) else {
            pending.clear();
            index += 1;
            continue;
        };
        let method_name = group(&found, 1);
        let is_main = method_name == "main";
        let base = usize::from(is_main);
        let end = rest[index..]
            .iter()
            .position(|line| line == ".end method")
            .map_or(rest.len(), |offset| index + offset);
        let mut body: Vec<String> = rest
            .get(index + 1..end)
            .unwrap_or_default()
            .iter()
            .filter(|item| !item.starts_with(".limit"))
            .cloned()
            .collect();
        let mut named: Vec<Option<String>> = Vec::new();
        while body.first().is_some_and(|line| line.starts_with(".var")) {
            let first = body.remove(0);
            let declared = variable
                .captures(&first)
                .ok_or_else(|| read_error("jvm", &first, "unknown variable"))?;
            let slot = group(&declared, 1)
                .parse::<usize>()
                .unwrap_or(0)
                .saturating_sub(base)
                / 2;
            if named.len() <= slot {
                named.resize(slot + 1, None);
            }
            named[slot] = Some(jasmin_variable(group(&declared, 2)).to_owned());
        }
        let code = read_instructions(&body, &jvm_rules(base), "jvm")?;
        items.push(procedure(
            method_name.into(),
            if is_main { 0 } else { group(&found, 2).len() },
            named.into_iter().map(Option::unwrap_or_default).collect(),
            group(&found, 3) == "J",
            std::mem::take(&mut pending),
            without_results(code),
        ));
        index = end + 1;
    }
    program(comments, items)
}

/// Read machine code of a machine target.
pub fn read_machine(source: &str, target: &str) -> Result<LoweredProgram> {
    match target {
        "nasm" => read_nasm(source),
        "cil" => read_cil(source),
        "jvm" => read_jvm(source),
        other => Err(GrammarError::new(format!(
            "The grammar translator does not read \"{other}\" machine code"
        ))),
    }
}
