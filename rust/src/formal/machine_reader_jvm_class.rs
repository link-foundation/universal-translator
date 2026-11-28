//! Java class files, JVMS §4, with a straight-line subset of §6 instructions.

use super::lowering::{Instruction, LoweredProgram, Procedure};
use crate::meta::GrammarError;

const MAX_BYTES: usize = 4 * 1024 * 1024;
const MAX_CONSTANTS: usize = 4096;
const MAX_INSTRUCTIONS: usize = 512;
const PRINT_STREAM: &str = "Ljava/io/PrintStream;";
type Result<T> = std::result::Result<T, GrammarError>;

struct Reader<'a> {
    source: &'a [u8],
    offset: usize,
    end: usize,
}

impl<'a> Reader<'a> {
    fn error(&self, message: impl AsRef<str>) -> GrammarError {
        GrammarError::new(format!(
            "Cannot read JVM class at byte {}: {}",
            self.offset,
            message.as_ref()
        ))
    }

    fn take(&mut self, length: usize) -> Result<&'a [u8]> {
        if length > self.end - self.offset {
            return Err(self.error("truncated field"));
        }
        let start = self.offset;
        self.offset += length;
        Ok(&self.source[start..self.offset])
    }

    fn bytes<const N: usize>(&mut self) -> Result<[u8; N]> {
        let mut bytes = [0; N];
        bytes.copy_from_slice(self.take(N)?);
        Ok(bytes)
    }

    fn u1(&mut self) -> Result<u8> {
        Ok(self.bytes::<1>()?[0])
    }

    fn u2(&mut self) -> Result<usize> {
        Ok(u16::from_be_bytes(self.bytes()?).into())
    }

    fn u4(&mut self) -> Result<u32> {
        Ok(u32::from_be_bytes(self.bytes()?))
    }

    fn field(&mut self, length: usize) -> Result<Self> {
        let start = self.offset;
        self.take(length)?;
        Ok(Self {
            source: self.source,
            offset: start,
            end: self.offset,
        })
    }

    fn sized_field(&mut self) -> Result<Self> {
        let size = self.u4()? as usize;
        self.field(size)
    }

    fn expect(&self, condition: bool, message: &str) -> Result<()> {
        if !condition {
            return Err(self.error(message));
        }
        Ok(())
    }

    fn finish(&self) -> Result<()> {
        self.expect(
            self.offset == self.end,
            "unexpected bytes after the declared contents",
        )
    }
}

fn modified_utf8(reader: &mut Reader<'_>) -> Result<String> {
    let length = reader.u2()?;
    let mut bytes = reader.field(length)?;
    let mut units = Vec::new();
    while bytes.offset < bytes.end {
        let first = bytes.u1()?;
        if (1..=0x7f).contains(&first) {
            units.push(u16::from(first));
            continue;
        }
        let second = bytes.u1()?;
        if second & 0xc0 == 0x80 {
            if first & 0xe0 == 0xc0 {
                let code = (u16::from(first & 0x1f) << 6) | u16::from(second & 0x3f);
                if code == 0 || code >= 0x80 {
                    units.push(code);
                    continue;
                }
            } else if first & 0xf0 == 0xe0 {
                let third = bytes.u1()?;
                let code = (u16::from(first & 0x0f) << 12)
                    | (u16::from(second & 0x3f) << 6)
                    | u16::from(third & 0x3f);
                if third & 0xc0 == 0x80 && code >= 0x800 {
                    units.push(code);
                    continue;
                }
            }
        }
        return Err(bytes.error("invalid modified UTF-8"));
    }
    String::from_utf16(&units).map_err(|_| bytes.error("unpaired UTF-16 surrogate"))
}

enum Constant {
    Empty,
    Utf8(String),
    Integer(i32),
    Long(i64),
    Class(usize),
    Text(usize),
    Member(u8, usize, usize),
    NameAndType(usize, usize),
}

struct Pool(Vec<Constant>);

impl Pool {
    fn read(reader: &mut Reader<'_>) -> Result<Self> {
        let count = reader.u2()?;
        reader.expect(
            (1..=MAX_CONSTANTS).contains(&count),
            "unsupported constant pool length",
        )?;
        let mut entries = Vec::with_capacity(count);
        entries.push(Constant::Empty);
        while entries.len() < count {
            let tag = reader.u1()?;
            let entry = match tag {
                1 => Constant::Utf8(modified_utf8(reader)?),
                3 => Constant::Integer(i32::from_be_bytes(reader.bytes()?)),
                5 => Constant::Long(i64::from_be_bytes(reader.bytes()?)),
                7 => Constant::Class(reader.u2()?),
                8 => Constant::Text(reader.u2()?),
                9 | 10 => Constant::Member(tag, reader.u2()?, reader.u2()?),
                12 => Constant::NameAndType(reader.u2()?, reader.u2()?),
                _ => return Err(reader.error(format!("unsupported constant pool tag {tag}"))),
            };
            let wide = matches!(entry, Constant::Long(_));
            entries.push(entry);
            if wide {
                reader.expect(
                    entries.len() < count,
                    "missing second constant pool entry for long",
                )?;
                entries.push(Constant::Empty);
            }
        }
        Ok(Self(entries))
    }

    fn get(&self, index: usize) -> &Constant {
        self.0.get(index).unwrap_or(&Constant::Empty)
    }

    fn invalid(reader: &Reader<'_>, index: usize) -> GrammarError {
        reader.error(format!("invalid constant pool reference {index}"))
    }

    fn text(&self, reader: &Reader<'_>, index: usize) -> Result<&str> {
        match self.get(index) {
            Constant::Utf8(value) => Ok(value),
            _ => Err(Self::invalid(reader, index)),
        }
    }

    fn name(&self, reader: &mut Reader<'_>) -> Result<&str> {
        let index = reader.u2()?;
        self.text(reader, index)
    }

    fn class_name(&self, reader: &Reader<'_>, index: usize) -> Result<&str> {
        match self.get(index) {
            Constant::Class(name) => self.text(reader, *name),
            _ => Err(Self::invalid(reader, index)),
        }
    }

    fn member(&self, reader: &mut Reader<'_>, tag: u8) -> Result<(&str, &str, &str)> {
        let index = reader.u2()?;
        let Constant::Member(kind, owner, name_and_type) = self.get(index) else {
            return Err(Self::invalid(reader, index));
        };
        if *kind != tag {
            return Err(Self::invalid(reader, index));
        }
        let Constant::NameAndType(name, descriptor) = self.get(*name_and_type) else {
            return Err(Self::invalid(reader, *name_and_type));
        };
        Ok((
            self.class_name(reader, *owner)?,
            self.text(reader, *name)?,
            self.text(reader, *descriptor)?,
        ))
    }
}

fn debug_attributes(reader: &mut Reader<'_>, pool: &Pool, code: bool) -> Result<()> {
    let count = reader.u2()?;
    reader.expect(count <= 16, "too many attributes")?;
    let mut seen = Vec::new();
    for _ in 0..count {
        let name = pool.name(reader)?;
        let mut body = reader.sized_field()?;
        if seen.contains(&name) {
            return Err(body.error(format!("duplicate attribute {name}")));
        }
        seen.push(name);
        match (code, name) {
            (false, "SourceFile") => {
                pool.name(&mut body)?;
            }
            (true, "LineNumberTable" | "LocalVariableTable") => {
                let count = body.u2()?;
                let size = if name == "LineNumberTable" { 4 } else { 10 };
                body.take(count * size)?;
            }
            _ => {
                let location = if code { "code" } else { "class" };
                return Err(body.error(format!("unsupported {location} attribute {name}")));
            }
        }
        body.finish()?;
    }
    Ok(())
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Int,
    Long,
    Text,
    Stdout,
}

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Self::Int => "int",
            Self::Long => "long",
            Self::Text => "text",
            Self::Stdout => "stdout",
        }
    }

    fn width(self) -> usize {
        if self == Self::Long { 2 } else { 1 }
    }
}

#[derive(Clone, Copy)]
enum Value<'a> {
    Number(Kind, i64),
    Text(&'a str),
    Stdout,
}

impl Value<'_> {
    fn kind(self) -> Kind {
        match self {
            Self::Number(kind, _) => kind,
            Self::Text(_) => Kind::Text,
            Self::Stdout => Kind::Stdout,
        }
    }
}

#[derive(Clone, Copy)]
enum Local {
    Empty,
    Reserved,
    Integer(Kind, i64),
}

fn local_operation(reader: &mut Reader<'_>, opcode: u8) -> Result<Option<(usize, Kind, bool)>> {
    for (generic, compact, kind, write) in [
        (0x15, 0x1a, Kind::Int, false),
        (0x16, 0x1e, Kind::Long, false),
        (0x36, 0x3b, Kind::Int, true),
        (0x37, 0x3f, Kind::Long, true),
    ] {
        if opcode == generic {
            return Ok(Some((reader.u1()?.into(), kind, write)));
        }
        if (compact..compact + 4).contains(&opcode) {
            return Ok(Some(((opcode - compact).into(), kind, write)));
        }
    }
    Ok(None)
}

struct MainBody<'source, 'pool> {
    reader: Reader<'source>,
    pool: &'pool Pool,
    stack: Vec<Value<'pool>>,
    depth: usize,
    stack_limit: usize,
    locals: Vec<Local>,
    slot_names: Vec<String>,
    code: Vec<Instruction>,
}

impl<'pool> MainBody<'_, 'pool> {
    fn push(&mut self, value: Value<'pool>) -> Result<()> {
        self.depth += value.kind().width();
        self.reader.expect(
            self.depth <= self.stack_limit,
            "instruction stack exceeds max_stack",
        )?;
        self.stack.push(value);
        Ok(())
    }

    fn pop(&mut self, kind: Kind) -> Result<Value<'pool>> {
        let value = self
            .stack
            .pop()
            .filter(|value| value.kind() == kind)
            .ok_or_else(|| {
                self.reader
                    .error(format!("expected {} on the instruction stack", kind.name()))
            })?;
        self.depth -= kind.width();
        Ok(value)
    }

    fn number(&mut self, kind: Kind) -> Result<i64> {
        match self.pop(kind)? {
            Value::Number(_, value) => Ok(value),
            _ => Err(self.reader.error("expected an integer")),
        }
    }

    fn push_integer(
        &mut self,
        kind: Kind,
        value: i64,
        instruction: Instruction,
        materialize: bool,
    ) -> Result<()> {
        self.reader.expect(
            (-2147483647..=2147483647).contains(&value),
            "integer result exceeds the portable signed range",
        )?;
        self.push(Value::Number(kind, value))?;
        self.code.push(instruction);
        if materialize {
            let slot = self.slot_names.len();
            self.slot_names.push(format!("jvm_value{slot}"));
            self.code
                .extend([Instruction::Store(slot), Instruction::Load(slot)]);
        }
        Ok(())
    }

    fn local(&mut self, (slot, kind, write): (usize, Kind, bool)) -> Result<()> {
        let invalid = || self.reader.error("invalid or retyped local slot");
        let previous = self.locals.get(slot).copied().ok_or_else(invalid)?;
        if matches!(previous, Local::Reserved)
            || matches!(previous, Local::Integer(other, _) if other != kind)
            || (kind == Kind::Long
                && !matches!(
                    self.locals.get(slot + 1),
                    Some(Local::Empty | Local::Reserved)
                ))
        {
            return Err(invalid());
        }
        if write {
            let value = self.number(kind)?;
            self.locals[slot] = Local::Integer(kind, value);
            if kind == Kind::Long {
                self.locals[slot + 1] = Local::Reserved;
            }
            self.code.push(Instruction::Store(slot));
        } else if let Local::Integer(_, value) = previous {
            self.push_integer(kind, value, Instruction::Load(slot), true)?;
        } else {
            return Err(self.reader.error("load before local initialization"));
        }
        Ok(())
    }

    fn literal(&mut self, opcode: u8) -> Result<()> {
        let (kind, value) = match opcode {
            0x02..=0x08 => (Kind::Int, i64::from(opcode) - 3),
            0x09..=0x0a => (Kind::Long, i64::from(opcode) - 9),
            0x10 => (
                Kind::Int,
                i64::from(i8::from_be_bytes(self.reader.bytes()?)),
            ),
            0x11 => (
                Kind::Int,
                i64::from(i16::from_be_bytes(self.reader.bytes()?)),
            ),
            0x12..=0x14 => {
                let index = if opcode == 0x12 {
                    self.reader.u1()?.into()
                } else {
                    self.reader.u2()?
                };
                match self.pool.get(index) {
                    Constant::Integer(value) if opcode != 0x14 => (Kind::Int, i64::from(*value)),
                    Constant::Long(value) if opcode == 0x14 => (Kind::Long, *value),
                    Constant::Text(index) if opcode != 0x14 => {
                        let text = self.pool.text(&self.reader, *index)?;
                        return self.push(Value::Text(text));
                    }
                    _ => return Err(Pool::invalid(&self.reader, index)),
                }
            }
            _ => return Err(self.reader.error("unknown literal instruction")),
        };
        self.push_integer(kind, value, Instruction::Push(value as f64), false)
    }

    fn arithmetic(&mut self, opcode: u8) -> Result<()> {
        let kind = if opcode & 1 == 0 {
            Kind::Int
        } else {
            Kind::Long
        };
        let right = self.number(kind)?;
        if matches!(opcode, 0x74 | 0x75) {
            return self.push_integer(kind, -right, Instruction::Negate, true);
        }
        let left = self.number(kind)?;
        let (name, value) = match opcode & !1 {
            0x60 => ("add", left + right),
            0x64 => ("subtract", left - right),
            0x68 => ("multiply", left * right),
            0x6c if right != 0 => ("divide", left / right),
            0x70 if right != 0 => ("remainder", left % right),
            _ => {
                return Err(self
                    .reader
                    .error("division by zero is outside the supported subset"));
            }
        };
        self.push_integer(kind, value, Instruction::Arithmetic(name), true)
    }

    fn output(&mut self) -> Result<()> {
        let (owner, name, descriptor) = self.pool.member(&mut self.reader, 10)?;
        let invalid = || {
            self.reader.error(format!(
                "unsupported virtual method {owner}.{name}{descriptor}"
            ))
        };
        if owner != "java/io/PrintStream" || !matches!(name, "print" | "println") {
            return Err(invalid());
        }
        let value = match descriptor {
            "(I)V" => Some(self.pop(Kind::Int)?),
            "(J)V" => Some(self.pop(Kind::Long)?),
            "(Ljava/lang/String;)V" => Some(self.pop(Kind::Text)?),
            "()V" if name == "println" => None,
            _ => return Err(invalid()),
        };
        self.pop(Kind::Stdout)?;
        match value {
            Some(Value::Text(text)) => {
                if text
                    .bytes()
                    .any(|byte| byte < b' ' && !matches!(byte, b'\t' | b'\n' | b'\r'))
                {
                    return Err(self
                        .reader
                        .error("printed string contains an unsupported control character"));
                }
                self.code.push(Instruction::PrintText(text.to_owned()));
            }
            Some(Value::Number(..)) => self.code.push(Instruction::PrintInteger),
            _ => {}
        }
        if name == "println" {
            self.code.push(Instruction::PrintNewline);
        }
        Ok(())
    }

    fn read(mut self) -> Result<Procedure> {
        for _ in 0..MAX_INSTRUCTIONS {
            let opcode = self.reader.u1()?;
            if let Some(local) = local_operation(&mut self.reader, opcode)? {
                self.local(local)?;
                continue;
            }
            match opcode {
                0x02..=0x0a | 0x10..=0x14 => self.literal(opcode)?,
                0x60..=0x61
                | 0x64..=0x65
                | 0x68..=0x69
                | 0x6c..=0x6d
                | 0x70..=0x71
                | 0x74..=0x75 => self.arithmetic(opcode)?,
                0x85 => {
                    let value = self.number(Kind::Int)?;
                    self.push(Value::Number(Kind::Long, value))?;
                }
                0xb2 => {
                    let field = self.pool.member(&mut self.reader, 9)?;
                    if field != ("java/lang/System", "out", PRINT_STREAM) {
                        return Err(self
                            .reader
                            .error(format!("unsupported static field {}.{}", field.0, field.1)));
                    }
                    self.push(Value::Stdout)?;
                }
                0xb6 => self.output()?,
                0xb1 => {
                    self.reader.finish()?;
                    self.reader.expect(
                        self.stack.is_empty(),
                        "unexpected values on the instruction stack at return",
                    )?;
                    self.code.push(Instruction::ReturnNothing);
                    return Ok(Procedure {
                        name: "main".into(),
                        parameter_count: 0,
                        slot_count: self.slot_names.len(),
                        slot_arrays: vec![false; self.slot_names.len()],
                        slot_names: self.slot_names,
                        returns: false,
                        max_depth: self.stack_limit as i64,
                        comments: Vec::new(),
                        code: self.code,
                    });
                }
                _ => {
                    return Err(self
                        .reader
                        .error(format!("unsupported opcode 0x{opcode:x}")));
                }
            }
        }
        Err(self
            .reader
            .error("too many instructions in a straight-line method"))
    }
}

fn default_constructor(mut reader: Reader<'_>, pool: &Pool, stack_limit: usize) -> Result<()> {
    if stack_limit < 1
        || reader.u1()? != 0x2a
        || reader.u1()? != 0xb7
        || pool.member(&mut reader, 10)? != ("java/lang/Object", "<init>", "()V")
        || reader.u1()? != 0xb1
    {
        return Err(reader.error("unsupported constructor"));
    }
    reader.finish()
}

fn read_methods(reader: &mut Reader<'_>, pool: &Pool) -> Result<Procedure> {
    let count = reader.u2()?;
    reader.expect(
        (1..=2).contains(&count),
        "expected main and an optional default constructor",
    )?;
    let mut main = None;
    let mut constructor = false;
    for _ in 0..count {
        let flags = reader.u2()?;
        let name = pool.name(reader)?;
        let descriptor = pool.name(reader)?;
        let is_main = name == "main"
            && flags == 9
            && descriptor == "([Ljava/lang/String;)V"
            && main.is_none();
        let is_constructor = name == "<init>"
            && matches!(flags, 0 | 1 | 2 | 4)
            && descriptor == "()V"
            && !constructor;
        if !is_main && !is_constructor {
            return Err(reader.error(format!(
                "unsupported or duplicate method {name}{descriptor}"
            )));
        }
        let attributes = reader.u2()?;
        reader.expect(attributes == 1, "expected exactly one method attribute")?;
        let name = pool.name(reader)?;
        reader.expect(name == "Code", "expected a Code attribute")?;
        let mut body = reader.sized_field()?;
        let stack_limit = body.u2()?;
        let slot_count = body.u2()?;
        body.expect(
            (1..=256).contains(&slot_count) && stack_limit <= 256,
            "unsupported max_stack or max_locals",
        )?;
        let code = body.sized_field()?;
        if is_main {
            let mut locals = vec![Local::Empty; slot_count];
            locals[0] = Local::Reserved;
            main = Some(
                MainBody {
                    reader: code,
                    pool,
                    stack: Vec::new(),
                    depth: 0,
                    stack_limit,
                    locals,
                    slot_names: (0..slot_count)
                        .map(|slot| format!("jvm_local{slot}"))
                        .collect(),
                    code: Vec::new(),
                }
                .read()?,
            );
        } else {
            default_constructor(code, pool, stack_limit)?;
            constructor = true;
        }
        let exceptions = body.u2()?;
        body.expect(exceptions == 0, "exception handlers are unsupported")?;
        debug_attributes(&mut body, pool, true)?;
        body.finish()?;
    }
    main.ok_or_else(|| reader.error("the machine program has no entry point"))
}

/// Decode the supported straight-line subset of JVM class files.
pub fn read_jvm_class(source: &[u8]) -> Result<LoweredProgram> {
    let mut reader = Reader {
        source,
        offset: 0,
        end: source.len(),
    };
    reader.expect(
        source.len() <= MAX_BYTES,
        "class exceeds the supported size",
    )?;
    let magic = reader.u4()?;
    reader.expect(magic == 0xcafebabe, "expected JVM class file magic")?;
    let minor = reader.u2()?;
    let major = reader.u2()?;
    if minor != 0 || !(52..=65).contains(&major) {
        return Err(reader.error(format!("unsupported class file version {major}.{minor}")));
    }
    let pool = Pool::read(&mut reader)?;
    let flags = reader.u2()?;
    reader.expect(
        matches!(flags, 0x20 | 0x21 | 0x30 | 0x31),
        "unsupported class flags",
    )?;
    let class = reader.u2()?;
    pool.class_name(&reader, class)?;
    let superclass = reader.u2()?;
    reader.expect(
        pool.class_name(&reader, superclass)? == "java/lang/Object",
        "unsupported superclass",
    )?;
    let interfaces = reader.u2()?;
    reader.expect(interfaces == 0, "interfaces are unsupported")?;
    let fields = reader.u2()?;
    reader.expect(fields == 0, "fields are unsupported")?;
    let main = read_methods(&mut reader, &pool)?;
    debug_attributes(&mut reader, &pool, false)?;
    reader.finish()?;
    Ok(LoweredProgram {
        comments: Vec::new(),
        functions: Vec::new(),
        main,
    })
}
