//! How the emitter writes text: interpolations, concatenations, format
//! arguments and print statements.

use super::emitter::{Emitter, Format, Result, embedding, field, merge_texts};
use crate::meta::{GrammarError, Node, text};

impl Emitter {
    /// Render an interpolation where literal parts are escaped and computed
    /// parts sit between `open` and `close`.
    pub(crate) fn render(
        &mut self,
        parts: &[Node],
        open: &str,
        close: &str,
        format: Format,
    ) -> Result<String> {
        let mut out = String::from("\"");
        for part in parts {
            if part.is("Text") {
                out.push_str(&self.escape(part.str("value").unwrap_or_default(), format));
            } else {
                out.push_str(open);
                out.push_str(&self.expression(part)?);
                out.push_str(close);
            }
        }
        out.push('"');
        Ok(out)
    }

    pub(crate) fn joined(&mut self, parts: &[Node], separator: &str) -> Result<String> {
        let pieces = parts
            .iter()
            .map(|part| {
                if part.is("Text") {
                    Ok(self.quote(part.str("value").unwrap_or_default()))
                } else {
                    self.expression_in(part, 6.0)
                }
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(pieces.join(separator))
    }

    /// Text built from literal and computed parts, outside of output calls.
    pub(crate) fn interpolation(&mut self, parts: &[Node]) -> Result<String> {
        let dialect = self.dialect;
        dialect.interpolation(self, parts)
    }

    /// Text joined with `+`, computed parts converted with the language's
    /// conversion (Python 2: `str(value)`).
    pub(crate) fn concatenation(&mut self, parts: &[Node]) -> Result<String> {
        let convert = self
            .syntax
            .text_conversions
            .first()
            .copied()
            .unwrap_or("str");
        let pieces = parts
            .iter()
            .map(|part| {
                if part.is("Text") {
                    Ok(self.quote(part.str("value").unwrap_or_default()))
                } else if part.str("type") == Some("text") {
                    self.expression_in(part, 6.0)
                } else {
                    Ok(format!("{convert}({})", self.expression(part)?))
                }
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(pieces.join(" + "))
    }

    pub(crate) fn base_interpolation(&mut self, parts: &[Node]) -> Result<String> {
        if self.syntax.text_join_concatenation {
            return self.concatenation(parts);
        }
        if let Some((prefix, open, close, format)) = embedding(self.id()) {
            if self.id() == "nim" {
                self.uses.insert("strformat");
            }
            return Ok(format!(
                "{prefix}{}",
                self.render(parts, open, close, format)?
            ));
        }
        match self.id() {
            "javascript" | "typescript" => {
                let mut out = String::from("`");
                for part in parts {
                    if part.is("Text") {
                        let value = part.str("value").unwrap_or_default();
                        out.push_str(
                            &value
                                .replace('\\', "\\\\")
                                .replace('`', "\\`")
                                .replace("${", "\\${")
                                .replace('\n', "\\n"),
                        );
                    } else {
                        out.push_str(&format!("${{{}}}", self.expression(part)?));
                    }
                }
                out.push('`');
                Ok(out)
            }
            "r" => {
                let pieces = parts
                    .iter()
                    .map(|part| self.expression(part))
                    .collect::<Result<Vec<_>>>()?;
                Ok(format!("paste0({})", pieces.join(", ")))
            }
            // PHP and Perl interpolate only variables, so computed parts are
            // concatenated.
            "php" | "perl" => self.joined(parts, " . "),
            "d" => {
                self.uses.insert("std.conv");
                let pieces = parts
                    .iter()
                    .map(|part| self.expression(part))
                    .collect::<Result<Vec<_>>>()?;
                Ok(format!("text({})", pieces.join(", ")))
            }
            "rust" => Ok(format!(
                "format!({})",
                self.format_arguments(parts, Format::Braces)?
            )),
            "go" => {
                self.uses.insert("fmt");
                Ok(format!(
                    "fmt.Sprintf({})",
                    self.format_arguments(parts, Format::Percent)?
                ))
            }
            "lua" => self.joined(parts, " .. "),
            "cpp" => {
                self.uses.insert("string");
                let pieces = parts
                    .iter()
                    .enumerate()
                    .map(|(index, part)| {
                        if part.is("Text") {
                            let quoted = self.quote(part.str("value").unwrap_or_default());
                            Ok(if index == 0 {
                                format!("std::string({quoted})")
                            } else {
                                quoted
                            })
                        } else if part.str("type") == Some("text") {
                            self.expression_in(part, 6.0)
                        } else {
                            Ok(format!("std::to_string({})", self.expression(part)?))
                        }
                    })
                    .collect::<Result<Vec<_>>>()?;
                Ok(pieces.join(" + "))
            }
            "java" => {
                let joined = self.joined(parts, " + ")?;
                Ok(if parts.first().is_some_and(|part| part.is("Text")) {
                    joined
                } else if joined.is_empty() {
                    "\"\"".to_owned()
                } else {
                    format!("\"\" + {joined}")
                })
            }
            _ => Err(GrammarError::new(format!(
                "{} has no text interpolation in this translator",
                self.syntax.label
            ))),
        }
    }

    /// "format string", value, value  — for printf-like and format!-like calls.
    pub(crate) fn format_arguments(&mut self, parts: &[Node], style: Format) -> Result<String> {
        let mut format = String::new();
        let mut values = Vec::new();
        for part in parts {
            if part.is("Text") {
                format.push_str(&self.escape(part.str("value").unwrap_or_default(), style));
                continue;
            }
            if style == Format::Braces {
                format.push_str("{}");
            } else {
                format.push_str(match part.str("type") {
                    Some("text") => "%s",
                    Some("real") => "%g",
                    Some("boolean") if self.id() == "go" => "%t",
                    _ => "%d",
                });
            }
        }
        for part in parts.iter().filter(|part| !part.is("Text")) {
            values.push(self.expression(part)?);
        }
        let mut all = vec![format!("\"{format}\"")];
        all.extend(values);
        Ok(all.join(", "))
    }

    // ---- statements ----
    pub(crate) fn print(&mut self, statement: &Node) -> Result<String> {
        let dialect = self.dialect;
        dialect.print(self, statement)
    }

    pub(crate) fn base_print(&mut self, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let newline = statement.flag("newline").unwrap_or(false);
        let parts = if value.is("Interpolation") {
            value.node_list("parts")
        } else {
            vec![value.clone()]
        };
        let mut line_parts = parts.clone();
        if newline {
            line_parts.push(text("\n"));
        }
        let pick = |yes: &'static str, no: &'static str| if newline { yes } else { no };
        Ok(match self.id() {
            "javascript" | "typescript" => {
                let single = self.expression(value)?;
                if newline {
                    format!("console.log({single});")
                } else if value.str("type") == Some("text") {
                    format!("process.stdout.write({single});")
                } else {
                    format!("process.stdout.write(String({single}));")
                }
            }
            "python" if !self.syntax.print_statement => {
                let single = self.expression(value)?;
                if newline {
                    format!("print({single})")
                } else {
                    format!("print({single}, end=\"\")")
                }
            }
            // Python 2: print is a statement.
            "python" => {
                if newline && value.is("Text") && value.str("value") == Some("") {
                    "print".to_owned()
                } else if newline {
                    format!("print {}", self.expression(value)?)
                } else {
                    self.uses.insert("sys");
                    let single = self.expression(value)?;
                    if value.str("type") == Some("text") {
                        format!("sys.stdout.write({single})")
                    } else {
                        format!("sys.stdout.write(str({single}))")
                    }
                }
            }
            "ruby" => format!("{} {}", pick("puts", "print"), self.expression(value)?),
            "lua" => format!("{}({})", pick("print", "io.write"), self.expression(value)?),
            "php" => format!("echo {};", self.interpolation_or_text(&line_parts)?),
            "c" => {
                self.uses.insert("stdio");
                format!(
                    "printf({});",
                    self.format_arguments(&line_parts, Format::Percent)?
                )
            }
            "cpp" => {
                self.uses.insert("iostream");
                let pieces = parts
                    .iter()
                    .map(|part| self.expression_in(part, 6.0))
                    .collect::<Result<Vec<_>>>()?;
                format!(
                    "std::cout << {}{};",
                    pieces.join(" << "),
                    pick(" << std::endl", "")
                )
            }
            "go" => {
                self.uses.insert("fmt");
                if parts.len() == 1 {
                    format!(
                        "fmt.{}({})",
                        pick("Println", "Print"),
                        self.expression(value)?
                    )
                } else {
                    format!(
                        "fmt.Printf({})",
                        self.format_arguments(&line_parts, Format::Percent)?
                    )
                }
            }
            "rust" => format!(
                "{}({});",
                pick("println!", "print!"),
                self.format_arguments(&parts, Format::Braces)?
            ),
            "csharp" => format!(
                "System.Console.{}({});",
                pick("WriteLine", "Write"),
                self.expression(value)?
            ),
            "java" => format!(
                "System.out.{}({});",
                pick("println", "print"),
                self.expression(value)?
            ),
            "kotlin" | "scala" | "groovy" | "julia" => {
                format!("{}({})", pick("println", "print"), self.expression(value)?)
            }
            "perl" => format!("print({});", self.interpolation_or_text(&line_parts)?),
            "dart" => {
                let single = self.expression(value)?;
                if newline {
                    format!("print({single});")
                } else {
                    self.uses.insert("dart:io");
                    format!("stdout.write({single});")
                }
            }
            "r" => {
                let pieces = merge_texts(&line_parts)
                    .iter()
                    .map(|part| self.expression(part))
                    .collect::<Result<Vec<_>>>()?;
                format!("cat({}, sep = \"\")", pieces.join(", "))
            }
            "swift" => {
                let single = self.expression(value)?;
                // Swift 1 prints a line with println and text with print.
                match self.syntax.print_calls {
                    Some(own) => {
                        let callee = if newline { own.line[0] } else { own.text[0] };
                        format!("{callee}({single})")
                    }
                    None if newline => format!("print({single})"),
                    None => format!("print({single}, terminator: \"\")"),
                }
            }
            "nim" | "d" => {
                let pieces = parts
                    .iter()
                    .map(|part| self.expression(part))
                    .collect::<Result<Vec<_>>>()?
                    .join(", ");
                match (self.id(), newline) {
                    ("nim", true) => format!("echo {pieces}"),
                    ("nim", false) => format!("stdout.write({pieces})"),
                    (_, true) => format!("writeln({pieces});"),
                    (_, false) => format!("write({pieces});"),
                }
            }
            _ => {
                return Err(GrammarError::new(format!(
                    "No output procedure for {}",
                    self.syntax.label
                )));
            }
        })
    }

    pub(crate) fn interpolation_or_text(&mut self, parts: &[Node]) -> Result<String> {
        let merged = merge_texts(parts);
        if merged.len() == 1 && merged[0].is("Text") {
            Ok(self.quote(merged[0].str("value").unwrap_or_default()))
        } else {
            self.interpolation(&merged)
        }
    }
}
