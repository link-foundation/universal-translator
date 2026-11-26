//! Typed exception payloads and entry-point return values.
use super::emitter::{Emitter, Result, field};
use super::languages::EntryPoint;
use crate::meta::{GrammarError, Node, walk};
use std::collections::HashSet;

const MARKER: &str = "universal-translator:throw";

#[derive(Default)]
pub(crate) struct ExceptionState {
    names: HashSet<String>,
    active: Option<String>,
}

impl Emitter {
    pub(crate) fn prepare_exceptions(&mut self, program: &Node) {
        walk(program, |item| {
            if let Some(name) = item.str("name") {
                self.exceptions.names.insert(name.to_owned());
            }
        });
    }

    fn fresh_exception_name(&mut self, role: &str) -> String {
        let mut index = 0;
        while self
            .exceptions
            .names
            .contains(&format!("_ut_{role}{index}"))
        {
            index += 1;
        }
        let name = format!("_ut_{role}{index}");
        self.exceptions.names.insert(name.clone());
        name
    }

    pub(crate) fn exception_statement(&mut self, statement: &Node) -> Result<()> {
        if !["cpp", "python", "javascript", "typescript"].contains(&self.id()) {
            return Err(GrammarError::new(format!(
                "Exception translation is unavailable for {}",
                self.id()
            )));
        }
        if statement.is("Try") {
            return self.try_statement(statement);
        }
        let Some(value) = statement.node("value") else {
            let line = if self.id() == "python" {
                "raise".to_owned()
            } else if self.id() == "cpp" {
                "throw;".to_owned()
            } else {
                format!(
                    "throw {};",
                    self.exceptions.active.as_deref().unwrap_or("undefined")
                )
            };
            self.line(&line);
            return Ok(());
        };
        let value_text = self.expression(value)?;
        if self.id() == "python" && statement.str("mode") == Some("exception") {
            self.line(&format!("raise {value_text}"));
            return Ok(());
        }
        let line = if self.id() == "cpp" {
            format!("throw {value_text};")
        } else {
            let payload = format!(
                "{}, {}, {value_text}",
                self.quote(MARKER),
                self.quote(value.str("type").unwrap_or_default())
            );
            if self.id() == "python" {
                format!("raise BaseException({payload})")
            } else {
                format!("throw [{payload}];")
            }
        };
        self.line(&line);
        Ok(())
    }

    fn try_statement(&mut self, statement: &Node) -> Result<()> {
        if self.id() == "cpp" {
            if statement.node("finalizer").is_some() || statement.node("success").is_some() {
                return Err(GrammarError::new(
                    "C++ exception cleanup needs control-flow lowering",
                ));
            }
            self.open_block("try");
            self.body(field(statement, "body")?)?;
            self.close_block();
            for handler in statement.nodes("handlers") {
                let parameter = if let Some(kind) = handler.str("type") {
                    format!(
                        "{} {}",
                        self.type_name(kind),
                        handler.str("name").unwrap_or_default()
                    )
                    .trim()
                    .to_owned()
                } else {
                    "...".to_owned()
                };
                self.open_block(&format!("catch ({parameter})"));
                self.body(field(handler, "body")?)?;
                self.close_block();
            }
            return Ok(());
        }
        self.open_block("try");
        self.body(field(statement, "body")?)?;
        self.close_block();
        if !statement.nodes("handlers").is_empty() {
            self.exception_handlers(&statement.nodes("handlers"))?;
        }
        if let Some(success) = statement.node("success") {
            if self.id() != "python" {
                return Err(GrammarError::new(
                    "Exception success blocks need control-flow lowering",
                ));
            }
            self.open_block("else");
            self.body(success)?;
            self.close_block();
        }
        if let Some(finalizer) = statement.node("finalizer") {
            self.open_block("finally");
            self.body(finalizer)?;
            self.close_block();
        }
        Ok(())
    }

    fn exception_handlers(&mut self, handlers: &[&Node]) -> Result<()> {
        let python = self.id() == "python";
        let error = self.fresh_exception_name("error");
        let payload = self.fresh_exception_name("value");
        let tag = self.fresh_exception_name("type");
        self.open_block(&if python {
            format!("except BaseException as {error}")
        } else {
            format!("catch ({error})")
        });
        let carrier = if python {
            format!(
                "type({error}) == BaseException and len({error}.args) == 3 and {error}.args[0] == {}",
                self.quote(MARKER)
            )
        } else {
            format!(
                "Array.isArray({error}) && {error}.length === 3 && {error}[0] === {}",
                self.quote(MARKER)
            )
        };
        if !python {
            self.line(&format!("let {payload} = {error};"));
            self.line(&format!("let {tag} = \"\";"));
        }
        self.open_block(&if python {
            format!("if {carrier}")
        } else {
            format!("if ({carrier})")
        });
        let args = if python { ".args" } else { "" };
        self.line(&format!(
            "{payload} = {error}{args}[2]{}",
            self.terminator()
        ));
        self.line(&format!("{tag} = {error}{args}[1]{}", self.terminator()));
        self.close_block();
        if python {
            self.open_block("else");
            self.line(&format!("{payload} = {error}"));
            self.line(&format!("{tag} = \"\""));
            self.close_block();
        }
        let mut guarded = false;
        let mut catches_all = false;
        for handler in handlers {
            if catches_all {
                return Err(GrammarError::new("A catch-all handler must be last"));
            }
            let guard = handler.str("type").map(|kind| {
                if kind.starts_with("source:") {
                    let kind = self.type_name(kind);
                    if python {
                        format!("isinstance({payload}, {kind})")
                    } else {
                        format!("{payload} instanceof {kind}")
                    }
                } else {
                    format!(
                        "{tag} {} {}",
                        if python { "==" } else { "===" },
                        self.quote(kind)
                    )
                }
            });
            if let Some(guard) = &guard {
                let word = if guarded {
                    if python { "elif" } else { "else if" }
                } else {
                    "if"
                };
                self.open_block(&if python {
                    format!("{word} {guard}")
                } else {
                    format!("{word} ({guard})")
                });
                guarded = true;
            } else {
                if guarded {
                    self.open_block("else");
                }
                catches_all = true;
            }
            if let Some(name) = handler.str("name") {
                self.line(&format!(
                    "{}{name} = {payload}{}",
                    if python { "" } else { "let " },
                    self.terminator()
                ));
            }
            let outer = self.exceptions.active.replace(error.clone());
            self.body(field(handler, "body")?)?;
            self.exceptions.active = outer;
            if guard.is_some() || guarded {
                self.close_block();
            }
        }
        if !catches_all {
            self.open_block("else");
            self.line(&if python {
                "raise".to_owned()
            } else {
                format!("throw {error};")
            });
            self.close_block();
        }
        self.close_block();
        Ok(())
    }

    pub(crate) fn exception_main(&mut self, program: &Node) -> Result<bool> {
        let main = field(program, "main")?;
        let mut returns = false;
        walk(main, |item| {
            if item.is("Return") {
                returns = true;
            }
        });
        if !returns || self.syntax.entry_point != EntryPoint::TopLevel {
            return Ok(false);
        }
        if !["python", "javascript", "typescript"].contains(&self.id()) {
            return Err(GrammarError::new(format!(
                "Returning from a program entry point is unavailable for {}",
                self.id()
            )));
        }
        let name = self.fresh_exception_name("main");
        self.open_block(&if self.id() == "python" {
            format!("def {name}()")
        } else {
            format!("function {name}()")
        });
        self.body(main)?;
        self.line(if self.id() == "python" {
            "return 0"
        } else {
            "return 0;"
        });
        self.close_block();
        self.line("");
        self.line(&if self.id() == "python" {
            format!("raise SystemExit({name}())")
        } else {
            format!("process.exit({name}());")
        });
        Ok(true)
    }
}
