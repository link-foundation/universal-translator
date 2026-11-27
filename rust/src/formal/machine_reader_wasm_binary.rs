//! Reader for the straight-line i64 subset of the WebAssembly 1.0 binary format.

use std::collections::HashSet;

use super::lowering::{Instruction, LoweredProgram, Procedure};
use super::machine_reader_shared::{Result, integer, procedure, program};
use crate::meta::GrammarError;

const MAX_ITEMS: usize = 256;
const MAX_INSTRUCTIONS: usize = 512;
const MAX_BYTES: usize = 4 * 1024 * 1024;

struct Reader<'a> {
    source: &'a [u8],
    offset: usize,
    end: usize,
}

impl<'a> Reader<'a> {
    fn error(&self, message: impl AsRef<str>) -> GrammarError {
        GrammarError::new(format!(
            "Cannot read WebAssembly at byte {}: {}",
            self.offset,
            message.as_ref()
        ))
    }

    fn byte(&mut self) -> Result<u8> {
        if self.offset == self.end {
            return Err(self.error("unexpected end of input"));
        }
        let byte = self.source[self.offset];
        self.offset += 1;
        Ok(byte)
    }

    fn leb(&mut self, bits: u32, signed: bool) -> Result<i128> {
        let mut value = 0i128;
        for shift in (0..bits).step_by(7) {
            let byte = self.byte()?;
            value |= i128::from(byte & 0x7f) << shift;
            if byte & 0x80 == 0 {
                if signed && byte & 0x40 != 0 {
                    value -= 1i128 << (shift + 7);
                }
                let (start, end) = if signed {
                    let bound = 1i128 << (bits - 1);
                    (-bound, bound)
                } else {
                    (0, 1i128 << bits)
                };
                if (start..end).contains(&value) {
                    return Ok(value);
                }
                break;
            }
        }
        Err(self.error(if signed {
            "invalid signed LEB128 integer"
        } else {
            "invalid unsigned LEB128 integer"
        }))
    }

    fn uint(&mut self) -> Result<usize> {
        Ok(self.leb(32, false)? as usize)
    }

    fn expect(&mut self, value: u8, message: &str) -> Result<()> {
        if self.byte()? != value {
            return Err(self.error(message));
        }
        Ok(())
    }

    fn vector<T>(&mut self, mut read: impl FnMut(&mut Self) -> Result<T>) -> Result<Vec<T>> {
        let count = self.uint()?;
        if count > MAX_ITEMS || count > self.end - self.offset {
            return Err(self.error("invalid or unsupported vector length"));
        }
        (0..count).map(|_| read(self)).collect()
    }

    fn slice(&mut self) -> Result<Self> {
        let length = self.uint()?;
        if length > self.end - self.offset {
            return Err(self.error("truncated length-delimited field"));
        }
        let offset = self.offset;
        self.offset += length;
        Ok(Self {
            source: self.source,
            offset,
            end: self.offset,
        })
    }

    fn name(&mut self) -> Result<&'a str> {
        let field = self.slice()?;
        std::str::from_utf8(&field.source[field.offset..field.end])
            .map_err(|_| field.error("invalid UTF-8 name"))
    }

    fn finish(&self) -> Result<()> {
        if self.offset != self.end {
            return Err(self.error("unexpected bytes after the declared contents"));
        }
        Ok(())
    }
}

fn sections<'a>(reader: &mut Reader<'a>) -> Result<[Option<Reader<'a>>; 11]> {
    let mut result = std::array::from_fn(|_| None);
    let mut previous = 0;
    while reader.offset < reader.end {
        let id = reader.byte()?;
        let mut content = reader.slice()?;
        if id == 0 {
            content.name()?;
            continue;
        }
        if id <= previous || !matches!(id, 1 | 2 | 3 | 7 | 10) {
            return Err(content.error(format!("unsupported or out-of-order section {id}")));
        }
        result[usize::from(id)] = Some(content);
        previous = id;
    }
    Ok(result)
}

fn read_vector<'a, T>(
    reader: Option<Reader<'a>>,
    read: impl FnMut(&mut Reader<'a>) -> Result<T>,
) -> Result<Vec<T>> {
    let Some(mut reader) = reader else {
        return Ok(Vec::new());
    };
    let values = reader.vector(read)?;
    reader.finish()?;
    Ok(values)
}

#[derive(Clone, Copy)]
struct Signature {
    params: usize,
    results: usize,
}

fn read_type(reader: &mut Reader<'_>) -> Result<Signature> {
    reader.expect(0x60, "expected a function type")?;
    let i64_type =
        |reader: &mut Reader<'_>| reader.expect(0x7e, "only i64 value types are supported");
    let params = reader.vector(i64_type)?.len();
    let results = reader.vector(i64_type)?.len();
    if results > 1 {
        return Err(reader.error("multiple function results are unsupported"));
    }
    Ok(Signature { params, results })
}

fn signature(reader: &mut Reader<'_>, types: &[Signature]) -> Result<Signature> {
    types
        .get(reader.uint()?)
        .copied()
        .ok_or_else(|| reader.error("unknown function type"))
}

fn read_import(reader: &mut Reader<'_>, types: &[Signature]) -> Result<(Signature, Instruction)> {
    let module = reader.name()?;
    let field = reader.name()?;
    reader.expect(0, "only function imports are supported")?;
    let signature = signature(reader, types)?;
    match (module, field, signature.params, signature.results) {
        ("env", "print_integer", 1, 0) => Ok((signature, Instruction::PrintInteger)),
        ("env", "print_newline", 0, 0) => Ok((signature, Instruction::PrintNewline)),
        _ => Err(reader.error(format!("unsupported function import {module}.{field}"))),
    }
}

fn fresh_name(mut name: String, used: &mut HashSet<String>) -> String {
    while !used.insert(name.clone()) {
        name.push_str("_private");
    }
    name
}

fn valid_name(name: &str) -> bool {
    name.split('_').all(|word| {
        let mut bytes = word.bytes();
        bytes.next().is_some_and(|first| first.is_ascii_lowercase())
            && bytes.all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    })
}

fn function_names(
    reader: Option<Reader<'_>>,
    imports: usize,
    functions: usize,
) -> Result<Vec<String>> {
    let mut names = vec![None; functions];
    let mut used = HashSet::new();
    read_vector(reader, |entry| {
        let name = entry.name()?;
        entry.expect(0, "only function exports are supported")?;
        let index = entry.uint()?.checked_sub(imports);
        let slot = index.and_then(|index| names.get_mut(index));
        match slot {
            Some(slot) if slot.is_none() && valid_name(name) && used.insert(name.to_owned()) => {
                *slot = Some(name.to_owned());
                Ok(())
            }
            _ => Err(entry.error(format!("unsupported or duplicate export {name}"))),
        }
    })?;
    if !used.contains("main") {
        return Err(GrammarError::new("WebAssembly module must export main"));
    }
    Ok(names
        .into_iter()
        .enumerate()
        .map(|(index, name)| {
            name.unwrap_or_else(|| fresh_name(format!("wasm_internal{index}"), &mut used))
        })
        .collect())
}

struct Calls<'a> {
    imports: &'a [(Signature, Instruction)],
    signatures: &'a [Signature],
    names: &'a [String],
}

impl Calls<'_> {
    fn read(&self, reader: &mut Reader<'_>) -> Result<(Instruction, usize, usize)> {
        let index = reader.uint()?;
        if let Some((signature, instruction)) = self.imports.get(index) {
            return Ok((instruction.clone(), signature.params, signature.results));
        }
        let index = index - self.imports.len();
        if let Some(name) = self.names.get(index).filter(|name| *name != "main") {
            let signature = self.signatures[index];
            return Ok((
                Instruction::Call(name.clone(), signature.params),
                signature.params,
                signature.results,
            ));
        }
        Err(reader.error("unsupported call target"))
    }
}

fn read_operation(
    reader: &mut Reader<'_>,
    opcode: u8,
    slots: usize,
    calls: &Calls<'_>,
) -> Result<(Instruction, usize, usize)> {
    match opcode {
        0x42 => Ok((
            Instruction::Push(integer(&reader.leb(64, true)?.to_string())?),
            0,
            1,
        )),
        0x20 | 0x21 => {
            let index = reader.uint()?;
            if index >= slots {
                return Err(reader.error("unknown local index"));
            }
            if opcode == 0x20 {
                Ok((Instruction::Load(index), 0, 1))
            } else {
                Ok((Instruction::Store(index), 1, 0))
            }
        }
        0x10 => calls.read(reader),
        0x1a => Ok((Instruction::Pop, 1, 0)),
        _ => {
            let operator = match opcode {
                0x7c => "add",
                0x7d => "subtract",
                0x7e => "multiply",
                0x7f => "divide",
                0x81 => "remainder",
                _ => return Err(reader.error(format!("unsupported opcode 0x{opcode:x}"))),
            };
            Ok((Instruction::Arithmetic(operator), 2, 1))
        }
    }
}

fn local_slots(reader: &mut Reader<'_>, params: usize) -> Result<usize> {
    let locals = reader.vector(|reader| {
        let count = reader.uint()?;
        reader.expect(0x7e, "only i64 locals are supported")?;
        if count > MAX_ITEMS {
            return Err(reader.error("too many local slots"));
        }
        Ok(count)
    })?;
    let slots = params + locals.into_iter().sum::<usize>();
    if slots > MAX_ITEMS {
        return Err(reader.error("too many local slots"));
    }
    Ok(slots)
}

fn read_body(mut reader: Reader<'_>, index: usize, calls: &Calls<'_>) -> Result<Procedure> {
    let name = &calls.names[index];
    let Signature { params, results } = calls.signatures[index];
    if name == "main" && (params != 0 || results != 0) {
        return Err(reader.error("main must have no parameters or results"));
    }
    let slots = local_slots(&mut reader, params)?;
    let mut used = calls.names.iter().cloned().collect();
    let mut slot_names = (0..slots)
        .map(|slot| fresh_name(format!("wasm_local{slot}"), &mut used))
        .collect::<Vec<_>>();
    let mut code = Vec::new();
    // WebAssembly initializes declared locals to zero before entering the body.
    for slot in params..slots {
        code.extend([Instruction::Push(0.0), Instruction::Store(slot)]);
    }
    let mut depth = 0;
    for step in 0..MAX_INSTRUCTIONS {
        let opcode = reader.byte()?;
        if matches!(opcode, 0x0f | 0x0b) {
            if opcode == 0x0f {
                reader.expect(0x0b, "unsupported instructions after return")?;
            }
            reader.finish()?;
            if depth != results {
                return Err(reader.error("unexpected values on the function stack"));
            }
            code.push(if results == 0 {
                Instruction::ReturnNothing
            } else {
                Instruction::Return
            });
            return Ok(procedure(
                name.clone(),
                params,
                slot_names,
                results != 0,
                Vec::new(),
                code,
            ));
        }
        let (instruction, consumed, produced) = read_operation(&mut reader, opcode, slots, calls)?;
        if depth < consumed {
            return Err(reader.error("instruction stack underflow"));
        }
        depth = depth - consumed + produced;
        code.push(instruction);
        // Materialize values when the machine evaluates them, before changes
        // to locals or other calls that could affect the lifted expression.
        if produced != 0 && opcode != 0x42 {
            let slot = slot_names.len();
            slot_names.push(fresh_name(format!("wasm_value{step}"), &mut used));
            code.extend([Instruction::Store(slot), Instruction::Load(slot)]);
        }
    }
    Err(reader.error("too many instructions in a straight-line function"))
}

/// Decode a bounded version-1 module using the translator's i64 print ABI.
pub fn read_wasm_binary(source: &[u8]) -> Result<LoweredProgram> {
    let mut reader = Reader {
        source,
        offset: 0,
        end: source.len(),
    };
    if source.len() > MAX_BYTES {
        return Err(reader.error("module exceeds the supported size"));
    }
    for byte in [0, 0x61, 0x73, 0x6d, 1, 0, 0, 0] {
        reader.expect(byte, "expected WebAssembly binary version 1")?;
    }
    let mut parts = sections(&mut reader)?;
    let types = read_vector(parts[1].take(), read_type)?;
    let imports = read_vector(parts[2].take(), |item| read_import(item, &types))?;
    let signatures = read_vector(parts[3].take(), |item| signature(item, &types))?;
    let names = function_names(parts[7].take(), imports.len(), signatures.len())?;
    let calls = Calls {
        imports: &imports,
        signatures: &signatures,
        names: &names,
    };
    let bodies = read_vector(parts[10].take(), Reader::slice)?;
    if names.len() != bodies.len() {
        return Err(reader.error("function and code counts differ"));
    }
    let procedures = bodies
        .into_iter()
        .enumerate()
        .map(|(index, body)| read_body(body, index, &calls))
        .collect::<Result<Vec<_>>>()?;
    program(Vec::new(), procedures)
}
