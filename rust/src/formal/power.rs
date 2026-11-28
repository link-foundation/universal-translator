//! Exponentiation binds tighter than unary negation and associates right.

use super::emitter::{Emitter, field};
use crate::meta::{GrammarError, Node};

pub(crate) fn power_symbol(id: &str) -> Option<&'static str> {
    match id {
        "lua" | "julia" | "r" | "matlab" | "vb" => Some("^"),
        "javascript" | "typescript" | "python" | "ruby" | "php" | "perl" | "d" | "groovy"
        | "fortran" | "ada" | "bash" => Some("**"),
        _ => None,
    }
}

pub(crate) fn write_power(
    emitter: &mut Emitter,
    expression: &Node,
    parent: f64,
) -> Result<String, GrammarError> {
    let left = field(expression, "left")?;
    let right = field(expression, "right")?;
    if emitter.id() == "rust" {
        return Ok(if expression.str("type") == Some("real") {
            format!(
                "({} as f64).powf({} as f64)",
                emitter.expression(left)?,
                emitter.expression(right)?
            )
        } else {
            format!(
                "({} as i64).pow({} as u32)",
                emitter.expression(left)?,
                emitter.expression(right)?
            )
        });
    }
    let symbol = power_symbol(emitter.id()).ok_or_else(|| {
        GrammarError::new(format!(
            "Exponentiation is not supported in {}",
            emitter.id()
        ))
    })?;
    if emitter.id() == "javascript" && emitter.syntax.version == Some("es5") {
        return Ok(format!(
            "Math.pow({}, {})",
            emitter.expression(left)?,
            emitter.expression(right)?
        ));
    }
    let result = format!(
        "{} {symbol} {}",
        emitter.expression_in(left, 9.0)?,
        emitter.expression_in(right, 8.0)?
    );
    Ok(if parent > 8.0 {
        format!("({result})")
    } else {
        result
    })
}
