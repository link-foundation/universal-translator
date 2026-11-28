//! Real numbers and the two divisions of the meta language. The operator
//! "divide" is integer division (it truncates), "realDivide" is true division
//! and gives a real. What a language's `/` means depends on the language:
//! true division in the languages below, and in the others integer division
//! of two integers and true division as soon as one operand is real.

use super::emitter::{Emitter, Result};
use super::languages::Syntax;
use crate::meta::{Node, format_number};

/// Binary operators by precedence level, loosest first, with their spellings.
pub(crate) const BINARY_LEVELS: [&[(&str, &[&str])]; 6] = [
    &[("or", &["||", "or"])],
    &[("and", &["&&", "and"])],
    &[
        ("equal", &["==", "==="]),
        ("notEqual", &["!=", "!==", "~="]),
    ],
    &[
        ("less", &["<"]),
        ("lessOrEqual", &["<="]),
        ("greater", &[">"]),
        ("greaterOrEqual", &[">="]),
    ],
    &[("add", &["+", ".."]), ("subtract", &["-"])],
    &[
        ("multiply", &["*"]),
        ("divide", &["/", "//"]),
        ("remainder", &["%"]),
    ],
];

pub(crate) fn symbol(operator: &str) -> &str {
    match operator {
        "stream" => "<<",
        "rightShift" => ">>",
        "add" => "+",
        "subtract" => "-",
        "multiply" => "*",
        "divide" | "floorDivide" | "realDivide" => "/",
        "remainder" | "modulo" => "%",
        "less" => "<",
        "lessOrEqual" => "<=",
        "greater" => ">",
        "greaterOrEqual" => ">=",
        "equal" => "==",
        "notEqual" => "!=",
        other => other,
    }
}

const TRUE_DIVISION: &[&str] = &[
    "javascript",
    "typescript",
    "python",
    "lua",
    "php",
    "perl",
    "julia",
    "r",
    "groovy",
    "matlab",
    "pascal",
    "nim",
    "dart",
    "vb",
    "gml",
];

/// Whether `/` of two integers gives a real (Python 2 divides integers).
pub fn slash_is_real(syntax: &Syntax) -> bool {
    TRUE_DIVISION.contains(&syntax.id) && !(syntax.id == "python" && syntax.version == Some("2"))
}

/// The meta operator a language's `/` stands for.
pub fn slash_operator(syntax: &Syntax) -> &'static str {
    if slash_is_real(syntax) {
        "realDivide"
    } else if crate::meta::integer_arithmetic::floor_division(syntax.id) {
        "floorDivide"
    } else {
        "divide"
    }
}

pub(crate) fn arithmetic_operator(
    syntax: &Syntax,
    surface: &str,
    operator: &'static str,
) -> &'static str {
    if operator == "divide" {
        if surface == "/" {
            slash_operator(syntax)
        } else if crate::meta::integer_arithmetic::floor_division(syntax.id) {
            "floorDivide"
        } else {
            "divide"
        }
    } else if operator == "remainder" && crate::meta::integer_arithmetic::floor_modulo(syntax.id) {
        "modulo"
    } else {
        operator
    }
}

/// How a language turns an integer into a real: `{}` stands for the integer.
fn cast(id: &str) -> Option<&'static str> {
    Some(match id {
        "c" | "cpp" | "objc" | "csharp" | "java" => "(double) {}",
        "d" => "cast(double) {}",
        "kotlin" | "dart" => "{}.toDouble()",
        "scala" => "{}.toDouble",
        "ruby" => "{}.to_f",
        "fortran" => "real({}, 8)",
        "python" | "nim" => "float({})",
        "go" => "float64({})",
        "rust" => "{} as f64",
        "swift" => "Double({})",
        "zig" => "@as(f64, @floatFromInt({}))",
        "ada" => "Long_Float ({})",
        "lean" => "Float.ofInt {}",
        _ => return None,
    })
}

/// Languages with one type for all numbers write 2.0 as 2.
fn one_number_type(id: &str) -> bool {
    matches!(id, "javascript" | "typescript")
}

/// Languages that never mix integers and reals in one operation.
fn strict(id: &str) -> bool {
    matches!(id, "go" | "rust" | "swift" | "zig" | "ada" | "lean" | "nim")
}

/// Languages whose variables take the type of their first value, so a real
/// variable starts from a real.
fn typed_by_value(id: &str) -> bool {
    strict(id) || matches!(id, "kotlin" | "dart")
}

/// How each typed language spells the meta type "real".
pub fn real_type(id: &str) -> Option<&'static str> {
    Some(match id {
        "typescript" | "lua" => "number",
        "python" | "nim" => "float",
        "ruby" => "Float",
        "php" => "float",
        "c" | "cpp" | "csharp" | "java" | "dart" | "groovy" | "objc" | "d" | "matlab" => "double",
        "go" => "float64",
        "rust" | "zig" => "f64",
        "kotlin" | "swift" | "scala" | "pascal" | "vb" => "Double",
        "julia" => "Float64",
        "r" => "numeric",
        "fortran" => "real(8)",
        "ada" => "Long_Float",
        "lean" => "Float",
        _ => return None,
    })
}

fn arithmetic_or_comparison(operator: &str) -> bool {
    matches!(
        operator,
        "add"
            | "subtract"
            | "multiply"
            | "divide"
            | "floorDivide"
            | "realDivide"
            | "remainder"
            | "modulo"
            | "equal"
            | "notEqual"
            | "less"
            | "lessOrEqual"
            | "greater"
            | "greaterOrEqual"
    )
}

/// The written form of a real literal: 2 is written 2.0, so it stays real.
pub fn real_text(value: f64) -> String {
    if value == 0.0 && value.is_sign_negative() {
        "-0.0".into()
    } else if value.fract() == 0.0 && value.abs() < 1e21 {
        format!("{}.0", format_number(value))
    } else {
        format_number(value)
    }
}

/// Whether a meta expression is a real.
pub fn is_real(expression: &Node) -> bool {
    expression.str("type") == Some("real")
        || (expression.is("Number")
            && expression
                .number("value")
                .is_some_and(|value| value.fract() != 0.0))
}

/// A number the writer adds, such as the 0 of `let t;`, has no type yet.
fn is_integer(expression: &Node) -> bool {
    let kind = expression.str("type");
    !is_real(expression) && (kind == Some("integer") || (expression.is("Number") && kind.is_none()))
}

/// The integer operand as a real: a literal becomes a real literal, another
/// expression is converted.
fn as_real(operand: &Node) -> Node {
    if operand.is("Number") {
        operand.clone().with("type", "real")
    } else {
        Node::new("ToReal")
            .with("operand", operand.clone())
            .with("type", "real")
    }
}

/// Which operands of a binary operation a language must write as reals:
/// both integer operands of a true division (only the left one where one
/// real operand is enough), and in strict languages every integer operand
/// that meets a real.
fn converted_sides(expression: &Node, syntax: &Syntax) -> (bool, bool) {
    let operator = expression.str("operator").unwrap_or_default();
    let (Some(left), Some(right)) = (expression.node("left"), expression.node("right")) else {
        return (false, false);
    };
    let id = syntax.id;
    if operator == "realDivide" && !slash_is_real(syntax) {
        if strict(id) {
            return (is_integer(left), is_integer(right));
        }
        return (is_integer(left) && is_integer(right), false);
    }
    let mixed = arithmetic_or_comparison(operator) && (is_real(left) || is_real(right));
    if strict(id) && mixed {
        return (is_integer(left), is_integer(right));
    }
    (false, false)
}

/// A binary operation with the operands the language needs as reals marked.
pub fn with_real_operands(expression: &Node, syntax: &Syntax) -> Option<Node> {
    if !expression.is("Binary") {
        return None;
    }
    cast(syntax.id)?;
    let (left, right) = converted_sides(expression, syntax);
    if !left && !right {
        return None;
    }
    let mut converted = expression.clone();
    for (side, convert) in [("left", left), ("right", right)] {
        if convert && let Some(operand) = expression.node(side) {
            converted.set(side, as_real(operand));
        }
    }
    Some(converted)
}

/// The first value of a real variable: an integer literal is written as a
/// real literal, and another integer expression is converted where the
/// language would otherwise give the variable an integer type.
pub fn real_value(value: &Node, kind: &str, syntax: &Syntax) -> Option<Node> {
    if kind != "real" || !is_integer(value) {
        return None;
    }
    (value.is("Number") || typed_by_value(syntax.id)).then(|| as_real(value))
}

/// How Rust declares the type of a variable.
pub(crate) fn rust_type(kind: &str) -> &'static str {
    match kind {
        "integer" => ": i64",
        "real" => ": f64",
        _ => "",
    }
}

impl Emitter {
    /// Whether `x = x / v` may be written `x /= v`. Languages that spell
    /// integer division as a call or a wrapper, or with an operator of its
    /// own, would lose the truncation with `/=`; `/=` of an integer variable
    /// divides integers where `/` depends on the types.
    pub(crate) fn plain_division(&self, value: &Node) -> bool {
        match value.str("operator") {
            Some("divide") => {
                self.syntax.integer_division.is_none()
                    && self.syntax.operators.integer_divide.is_none()
            }
            Some("realDivide") => {
                slash_is_real(&self.syntax) || value.node("left").is_some_and(is_real)
            }
            _ => true,
        }
    }

    /// The real expressions: real literals and conversions, or `None` for
    /// any other expression.
    pub(crate) fn real_expression(
        &mut self,
        expression: &Node,
        parent: f64,
    ) -> Option<Result<String>> {
        if expression.is("ToReal") {
            let operand = expression.node("operand")?;
            return Some(self.converted_to_real(operand, parent));
        }
        if !expression.is("Number") || expression.str("type") != Some("real") {
            return None;
        }
        let value = expression.number("value").unwrap_or(0.0);
        let negative_zero = value == 0.0 && value.is_sign_negative();
        if one_number_type(self.syntax.id) && !negative_zero {
            return None;
        }
        let mut written = real_text(value);
        if self.syntax.id == "fortran" {
            written = if written.contains('e') {
                written.replace('e', "d")
            } else {
                format!("{written}d0")
            };
        }
        Some(Ok(if (value < 0.0 || negative_zero) && parent > 6.0 {
            format!("({written})")
        } else {
            written
        }))
    }

    /// The real type of a typed language, or `None` for other types.
    pub(crate) fn real_type_name(&self, meta: &str) -> Option<String> {
        if meta != "real" {
            return None;
        }
        let types = self.syntax.types?;
        Some(
            real_type(self.syntax.id)
                .unwrap_or(types.integer)
                .to_owned(),
        )
    }

    /// An integer expression converted to a real; an expression before a
    /// suffix or after a prefix word is kept whole with parentheses.
    fn converted_to_real(&mut self, operand: &Node, parent: f64) -> Result<String> {
        let template = cast(self.syntax.id).unwrap_or("{}");
        let tight = template.starts_with("{}") || template.ends_with(" {}");
        let inner = if tight {
            self.expression_in(operand, 8.0)?
        } else {
            self.expression(operand)?
        };
        let written = template.replace("{}", &inner);
        // Rust reads `a as f64 < b` as the start of a generic type.
        Ok(if self.syntax.id == "rust" && parent == 4.0 {
            format!("({written})")
        } else {
            written
        })
    }

    /// The first value of a declaration, as the language writes it for the
    /// declared type.
    pub(crate) fn initial_value(&mut self, value: &Node, kind: &str) -> Result<String> {
        match real_value(value, kind, &self.syntax) {
            Some(real) => self.expression(&real),
            None => self.expression(value),
        }
    }
}
