//! GameMaker Language: a script with JavaScript's statements and
//! functions, whose output is `show_debug_message` and whose template
//! strings are `$"text {value}"`. Arrays are spelled in array_spellings.rs.

use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Format, Result, field};
use crate::meta::{GrammarError, Node};

pub(crate) struct GameMaker;

impl ParserDialect for GameMaker {}

impl EmitterDialect for GameMaker {
    /// `show_debug_message` ends every line it writes.
    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        if statement.flag("newline") != Some(true) {
            return Err(GrammarError::new(format!(
                "{} writes whole lines only (show_debug_message)",
                e.syntax.label
            )));
        }
        let value = e.expression(field(statement, "value")?)?;
        Ok(format!("show_debug_message({value});"))
    }

    /// A template string has no way to write a literal brace, so text with
    /// braces is joined with string() conversions.
    fn interpolation(&self, e: &mut Emitter, parts: &[Node]) -> Result<String> {
        let braced = parts.iter().any(|part| {
            part.is("Text")
                && part
                    .str("value")
                    .is_some_and(|value| value.contains(['{', '}']))
        });
        if braced {
            return e.concatenation(parts);
        }
        Ok(format!("${}", e.render(parts, "{", "}", Format::None)?))
    }
}
