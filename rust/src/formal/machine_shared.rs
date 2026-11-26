//! Helpers shared by the machine code writers (`machine` and the dialect
//! modules next to it).

use std::collections::HashMap;

use super::lowering::{Instruction, LoweredProgram, Procedure};

/// Whether a lowered program creates arrays, and so needs the helper that
/// allocates and fills them.
pub fn creates_arrays(program: &LoweredProgram) -> bool {
    all_functions(program).any(|item| item.code.contains(&Instruction::NewArray))
}

/// Comment lines in a target's comment syntax.
pub fn comments(prefix: &str, texts: &[String], indent: &str) -> Vec<String> {
    texts
        .iter()
        .flat_map(|text| {
            text.split('\n')
                .map(|line| format!("{indent}{prefix} {line}").trim_end().to_owned())
                .collect::<Vec<_>>()
        })
        .collect()
}

/// Every function of a lowered program, with "main" last.
pub fn all_functions(program: &LoweredProgram) -> impl Iterator<Item = &Procedure> {
    program.functions.iter().chain([&program.main])
}

/// Whether each function returns a value, by name.
pub fn returns_by_name(program: &LoweredProgram) -> HashMap<String, bool> {
    program
        .functions
        .iter()
        .map(|item| (item.name.clone(), item.returns))
        .collect()
}

/// The names of the labels of a function in the order they appear.
pub fn label_names(item: &Procedure) -> Vec<String> {
    item.code
        .iter()
        .filter_map(|instruction| match instruction {
            Instruction::Label(name) => Some(name.clone()),
            _ => None,
        })
        .collect()
}

/// A byte is printable when it is ASCII other than a quote or a backslash.
pub fn printable(byte: u8) -> bool {
    (0x20..0x7f).contains(&byte) && byte != b'"' && byte != b'\\'
}

/// The index of a text among the texts a program prints, adding it when it
/// is new.
pub fn text_index(texts: &mut Vec<String>, text: &str) -> usize {
    match texts.iter().position(|known| known == text) {
        Some(index) => index,
        None => {
            texts.push(text.to_owned());
            texts.len() - 1
        }
    }
}
