//! How the shared emitter writes arrays of integers in each language: the
//! literal, the array of n equal values, an element, the length, the type
//! and, where an array is declared differently from other values (C, C++,
//! Perl), the declaration. Languages without a filled array constructor get
//! the array and a fill loop from `expand_array_fills` (arrays.rs) instead,
//! and languages that count from 1 add 1 to every index here.
//!
//! C has no array that knows its own length, so an array is a local
//! variable-length array (`int a[n];`) whose length is `sizeof a / sizeof
//! a[0]`; that is why arrays are only ever local variables.

use super::arrays::offset;
use super::emitter::{Emitter, Result, field};
use crate::meta::GrammarError;
use crate::meta::Node;

/// An array literal of the written elements.
fn literal(id: &str, version: Option<&str>, elements: &str) -> Option<String> {
    // The [...] spelling of an array came with PHP 5.4.
    if (id, version) == ("php", Some("5")) {
        return Some(format!("array({elements})"));
    }
    Some(match id {
        "javascript" | "typescript" | "python" | "ruby" | "php" | "swift" | "dart" | "julia"
        | "groovy" | "d" | "pascal" | "fortran" | "matlab" | "gml" => format!("[{elements}]"),
        "lua" | "c" | "cpp" | "csharp" | "java" | "vb" => format!("{{{elements}}}"),
        "go" => format!("[]int{{{elements}}}"),
        "rust" => format!("vec![{elements}]"),
        "kotlin" => format!("intArrayOf({elements})"),
        "perl" => format!("({elements})"),
        "scala" => format!("Array({elements})"),
        "r" => format!("c({elements})"),
        "nim" => format!("@[{elements}]"),
        "zig" if elements.is_empty() => ".{}".into(),
        "zig" => format!(".{{ {elements} }}"),
        _ => return None,
    })
}

/// The array of `length` values `fill`, both written.
fn create(id: &str, version: Option<&str>, length: &str, fill: &str) -> Option<String> {
    // Array.prototype.fill is ES6: the array is created, then filled by a
    // loop.
    if (id, version) == ("javascript", Some("es5")) {
        return Some(format!("new Array({length})"));
    }
    Some(match id {
        "javascript" | "typescript" => format!("new Array({length}).fill({fill})"),
        "python" | "groovy" => format!("[{fill}] * {length}"),
        "ruby" => format!("Array.new({length}, {fill})"),
        "php" => format!("array_fill(0, {length}, {fill})"),
        "csharp" | "java" => format!("new int[{length}]"),
        "go" => format!("make([]int, {length})"),
        "rust" => format!("vec![{fill}; {length} as usize]"),
        "kotlin" => format!("IntArray({length}) {{ {fill} }}"),
        "swift" => format!("[Int](repeating: {fill}, count: {length})"),
        "perl" => format!("({fill}) x {length}"),
        "dart" => format!("List.filled({length}, {fill})"),
        "scala" => format!("Array.fill({length}.toInt)({fill})"),
        "julia" => format!("fill({fill}, {length})"),
        "r" => format!("rep({fill}, {length})"),
        "nim" => format!("newSeqWith({length}, {fill})"),
        "d" => format!("new long[{length}]"),
        "fortran" => format!("spread({fill}, 1, {length})"),
        "matlab" => format!("repmat({fill}, 1, {length})"),
        "gml" => format!("array_create({length}, {fill})"),
        _ => return None,
    })
}

/// The binding of a created array that is an operation: `[0] * n`.
fn create_parent(id: &str) -> Option<f64> {
    matches!(id, "python" | "perl" | "groovy").then_some(7.0)
}

/// The binding the length takes inside a conversion: `n as usize`.
fn conversion_parent(id: &str) -> Option<f64> {
    matches!(id, "rust" | "scala").then_some(8.0)
}

/// The conversion of a written index to the language's index type.
fn converted_index(id: &str, index: &str) -> Option<String> {
    match id {
        "rust" => Some(format!("{index} as usize")),
        "scala" => Some(format!("{index}.toInt")),
        "zig" => Some(format!("@intCast({index})")),
        _ => None,
    }
}

/// The length of the written array, binding like a unary operation or
/// tighter unless `loose` says it needs parentheses as an operand.
fn length(id: &str, array: &str) -> String {
    match id {
        "python" | "go" => format!("len({array})"),
        "lua" => format!("#{array}"),
        "php" => format!("count({array})"),
        "c" => format!("(int) (sizeof {array} / sizeof {array}[0])"),
        "cpp" => format!("(int) {array}.size()"),
        "csharp" | "vb" => format!("{array}.Length"),
        "rust" => format!("{array}.len() as i64"),
        "kotlin" => format!("{array}.size"),
        "swift" => format!("{array}.count"),
        "perl" => format!("scalar(@{})", &array[1..]),
        "julia" | "r" => format!("length({array})"),
        "groovy" => format!("{array}.size()"),
        "nim" => format!("{array}.len"),
        "d" => format!("cast(long) {array}.length"),
        "pascal" => format!("Length({array})"),
        "bash" => format!("${{#{array}[@]}}"),
        "ada" => format!("{array}'Length"),
        "zig" => format!("@as(i64, @intCast({array}.len))"),
        "fortran" => format!("size({array}, kind=8)"),
        "matlab" => format!("numel({array})"),
        "gml" => format!("array_length({array})"),
        _ => format!("{array}.length"),
    }
}

fn loose(id: &str) -> bool {
    matches!(id, "c" | "cpp" | "rust" | "d")
}

/// The symbols around an index.
fn brackets(id: &str) -> (&'static str, &'static str) {
    match id {
        "scala" | "vb" | "fortran" | "matlab" => ("(", ")"),
        "ada" => (" (", ")"),
        _ => ("[", "]"),
    }
}

/// The type of an array where a declaration or signature names it.
fn array_type(id: &str) -> Option<&'static str> {
    Some(match id {
        "typescript" => "number[]",
        "cpp" => "std::vector<int>",
        "csharp" | "java" => "int[]",
        "go" => "[]int",
        "rust" => "Vec<i64>",
        "kotlin" => "IntArray",
        "swift" => "[Int]",
        "dart" => "List<int>",
        "scala" => "Array[Long]",
        "groovy" => "List<Long>",
        "nim" => "seq[int]",
        "d" => "long[]",
        "pascal" => "array of Int64",
        "vb" => "Long()",
        "lean" => "Array Int",
        "rocq" => "list Z",
        _ => return None,
    })
}

/// Languages that declare an array whose elements change like a variable
/// that changes: `let mut`, `var`.
const MUTABLE_CONTAINERS: [&str; 3] = ["rust", "swift", "nim"];

/// Whether a declaration declares an array.
pub(crate) fn is_array_declaration(statement: &Node) -> bool {
    statement.is("Declaration")
        && (statement.str("type") == Some("array")
            || statement
                .node("value")
                .is_some_and(|value| value.is("ArrayLiteral") || value.is("NewArray")))
}

/// Languages written with another language's tables that spell arrays
/// their own way.
const OWN_ARRAYS: [&str; 1] = ["gml"];

impl Emitter {
    /// The language whose array spellings this one uses: its own, or those
    /// of its family.
    fn array_id(&self) -> &'static str {
        if OWN_ARRAYS.contains(&self.syntax.id) {
            self.syntax.id
        } else {
            self.id()
        }
    }

    /// The array type of the language, or `None` where arrays have no
    /// written type.
    pub(crate) fn array_type_name(&mut self) -> Option<String> {
        let written = array_type(self.id())?;
        if self.id() == "cpp" {
            self.uses.insert("vector");
        }
        Some(written.to_owned())
    }

    /// The array expressions, or `None` for any other expression.
    pub(crate) fn array_expression(
        &mut self,
        expression: &Node,
        parent: f64,
    ) -> Option<Result<String>> {
        Some(match expression.kind.as_str() {
            "ArrayLiteral" => self.array_literal(&expression.node_list("elements")),
            "NewArray" => self.new_array(expression, parent),
            "Index" => self.indexed(expression),
            "Length" => self.length_of(expression, parent),
            _ => return None,
        })
    }

    pub(crate) fn array_literal(&mut self, elements: &[Node]) -> Result<String> {
        let written = elements
            .iter()
            .map(|element| self.expression(element))
            .collect::<Result<Vec<_>>>()?
            .join(", ");
        literal(self.array_id(), self.syntax.version, &written).ok_or_else(|| {
            GrammarError::new(format!("{} cannot write an array literal", self.syntax.id))
        })
    }

    fn new_array(&mut self, expression: &Node, parent: f64) -> Result<String> {
        let id = self.array_id();
        let version = self.syntax.version;
        if create(id, version, "", "").is_none() {
            return Err(GrammarError::new(format!(
                "{} cannot write a filled array",
                self.syntax.id
            )));
        }
        if id == "nim" {
            self.uses.insert("sequtils");
        }
        let binding = conversion_parent(id).or(create_parent(id)).unwrap_or(0.0);
        let length = self.expression_in(field(expression, "length")?, binding)?;
        let fill = self.expression(field(expression, "fill")?)?;
        let result = create(id, version, &length, &fill).unwrap_or_default();
        Ok(if create_parent(id).is_some() && parent > 6.0 {
            format!("({result})")
        } else {
            result
        })
    }

    /// The written index of an element: counted from 1 where arrays start
    /// at 1.
    fn written_index(&mut self, index: &Node) -> Result<String> {
        let id = self.id();
        let shifted = offset(index.clone(), self.syntax.array_base);
        let written = self.expression_in(&shifted, conversion_parent(id).unwrap_or(0.0))?;
        // A number needs no conversion: a[0], not a[0 as usize].
        if shifted.is("Number") {
            return Ok(written);
        }
        Ok(converted_index(id, &written).unwrap_or(written))
    }

    pub(crate) fn element(&mut self, array: &str, index: &Node) -> Result<String> {
        let (open, close) = brackets(self.id());
        let written = self.written_index(index)?;
        Ok(format!("{}{open}{written}{close}", self.variable(array)))
    }

    fn indexed(&mut self, expression: &Node) -> Result<String> {
        let array = field(expression, "array")?.str("name").unwrap_or_default();
        self.element(array, field(expression, "index")?)
    }

    fn length_of(&mut self, expression: &Node, parent: f64) -> Result<String> {
        let array = field(expression, "array")?.str("name").unwrap_or_default();
        let id = self.array_id();
        let result = length(id, &self.variable(array));
        Ok(if loose(id) && parent > 7.0 {
            format!("({result})")
        } else {
            result
        })
    }

    /// Element assignments and array declarations, or `None` for any other
    /// statement.
    pub(crate) fn array_statement(&mut self, statement: &Node) -> Option<Result<()>> {
        let line = if statement.is("IndexAssignment") {
            self.index_assignment(statement)
        } else if is_array_declaration(statement) {
            self.array_declaration(statement)
        } else {
            return None;
        };
        Some(line.map(|line| self.line(&line)))
    }

    pub(crate) fn index_assignment(&mut self, statement: &Node) -> Result<String> {
        let operator = self.syntax.assignment.unwrap_or("=");
        let element = self.element(
            statement.str("name").unwrap_or_default(),
            field(statement, "index")?,
        )?;
        let value = self.expression(field(statement, "value")?)?;
        Ok(format!("{element} {operator} {value}{}", self.terminator()))
    }

    fn array_declaration(&mut self, statement: &Node) -> Result<String> {
        let name = statement.str("name").unwrap_or_default();
        let value = field(statement, "value")?;
        let created = value.is("NewArray");
        let mutable = statement.flag("mutable").unwrap_or(false);
        let changes = mutable || statement.flag("elementsAssigned").unwrap_or(false);
        match self.id() {
            "c" if created => {
                let length = self.expression(field(value, "length")?)?;
                return Ok(format!("int {name}[{length}];"));
            }
            "c" => return Ok(format!("int {name}[] = {};", self.expression(value)?)),
            "cpp" if created => {
                self.uses.insert("vector");
                let length = self.expression(field(value, "length")?)?;
                let fill = self.expression(field(value, "fill")?)?;
                return Ok(format!("std::vector<int> {name}({length}, {fill});"));
            }
            // SetLength fills the new elements with zeros.
            "pascal" if created => {
                let length = self.expression(field(value, "length")?)?;
                return Ok(format!("SetLength({name}, {length});"));
            }
            // Dim a(last) As Long: the bound is the last index, and the new
            // elements are zeros.
            "vb" if created => {
                let last = offset(field(value, "length")?.clone(), -1);
                let last = self.expression(&last)?;
                return Ok(format!(
                    "Dim {name}({last}) As {}",
                    self.type_name("integer")
                ));
            }
            "perl" => return Ok(format!("my @{name} = {};", self.expression(value)?)),
            "rust" => {
                return Ok(format!(
                    "let {}{name}: Vec<i64> = {};",
                    if changes { "mut " } else { "" },
                    self.expression(value)?
                ));
            }
            _ => {}
        }
        let declared = statement.clone().with("type", "array").with(
            "mutable",
            mutable || (changes && MUTABLE_CONTAINERS.contains(&self.id())),
        );
        self.declaration(&declared)
    }

    /// The prelude lines arrays need: `#include <vector>` after the other
    /// includes, `import std/sequtils` after the other imports.
    pub(crate) fn array_prelude(&self, lines: &mut Vec<String>) {
        let extra: [(&str, &str, &[&str]); 2] = [
            ("vector", "#include <vector>", &["#include ", "#import "]),
            ("sequtils", "import std/sequtils", &["import "]),
        ];
        for (used, line, starts) in extra {
            if !self.uses.contains(used) {
                continue;
            }
            let last = lines
                .iter()
                .rposition(|written| starts.iter().any(|start| written.starts_with(start)));
            match last {
                Some(last) => lines.insert(last + 1, line.to_owned()),
                None => {
                    lines.insert(0, String::new());
                    lines.insert(0, line.to_owned());
                }
            }
        }
    }
}
