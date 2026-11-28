//! Function-local lowering for C++ integer exceptions.
use super::emitter::{Emitter, Result, field};
use crate::meta::{GrammarError, Node, walk};

#[derive(Clone)]
pub(super) struct CExceptionTarget {
    payload: String,
    raised: String,
    dispatch: String,
}

fn int_handler(statement: &Node) -> Result<Option<&Node>> {
    let mut selected = None;
    for handler in statement.nodes("handlers") {
        match handler.str("cppType") {
            Some("int" | "...") => {
                selected.get_or_insert(handler);
            }
            Some("bool" | "char" | "double" | "float" | "long" | "short") => {}
            _ => {
                return Err(GrammarError::new(
                    "C exception lowering requires a known C++ catch type",
                ));
            }
        }
    }
    Ok(selected)
}

// A branch to the dispatch label leaves only scopes that hold scalar locals.
// C++ calls and objects would need separate exception and cleanup handling.
fn validate_protected_block(block: &Node) -> Result<()> {
    let mut forbidden = None;
    walk(block, |item| {
        let allowed = match item.kind.as_str() {
            "Declaration" => matches!(item.str("type"), Some("integer" | "boolean" | "real")),
            "Assignment" | "Binary" | "Blank" | "Block" | "Boolean" | "Catch" | "Comment"
            | "CountingLoop" | "Evaluate" | "If" | "Name" | "Number" | "Return" | "Throw"
            | "Try" | "Unary" | "While" => true,
            _ => false,
        };
        if !allowed && forbidden.is_none() {
            forbidden = Some(format!("C exception lowering cannot unwind {}", item.kind));
        }
    });
    forbidden.map_or(Ok(()), |message| Err(GrammarError::new(message)))
}

impl Emitter {
    pub(super) fn c_exception_statement(&mut self, statement: &Node) -> Result<()> {
        if statement.is("Try") {
            return self.c_try_statement(statement);
        }
        let target = self.exceptions.c_target.clone().ok_or_else(|| {
            GrammarError::new("C exception lowering requires a local matching handler")
        })?;
        let value = if let Some(value) = statement.node("value") {
            if statement.str("cppType") != Some("int") {
                return Err(GrammarError::new(
                    "C exception lowering requires a portable C++ int literal",
                ));
            }
            self.expression(value)?
        } else {
            self.exceptions
                .c_active
                .clone()
                .ok_or_else(|| GrammarError::new("C rethrow requires an active local exception"))?
        };
        self.line(&format!("{} = {value};", target.payload));
        self.line(&format!("{} = 1;", target.raised));
        self.line(&format!("goto {};", target.dispatch));
        Ok(())
    }

    fn c_try_statement(&mut self, statement: &Node) -> Result<()> {
        if statement.node("success").is_some() || statement.node("finalizer").is_some() {
            return Err(GrammarError::new(
                "C exception lowering requires explicit cleanup control flow",
            ));
        }
        let handler = int_handler(statement)?;
        let body = field(statement, "body")?;
        if self.exceptions.c_target.is_none() {
            validate_protected_block(body)?;
        }
        self.open_block("");
        if let Some(handler) = handler {
            let payload = self.fresh_exception_name("payload");
            let raised = self.fresh_exception_name("raised");
            let dispatch = self.fresh_exception_name("dispatch");
            self.line(&format!("int {payload} = 0;"));
            self.line(&format!("int {raised} = 0;"));
            self.open_block("");
            let outer_target = self.exceptions.c_target.replace(CExceptionTarget {
                payload: payload.clone(),
                raised: raised.clone(),
                dispatch: dispatch.clone(),
            });
            let result = self.body(body);
            self.exceptions.c_target = outer_target;
            result?;
            self.close_block();
            self.line(&format!("goto {dispatch};"));
            self.line(&format!("{dispatch}:"));
            self.open_block(&format!("if ({raised})"));
            if let Some(name) = handler.str("name") {
                self.line(&format!("int {name} = {payload};"));
            }
            let handler_body = field(handler, "body")?;
            let outer_active = self.exceptions.c_active.replace(payload);
            let result = self.body(handler_body);
            self.exceptions.c_active = outer_active;
            result?;
            self.close_block();
        } else {
            self.body(body)?;
        }
        self.close_block();
        Ok(())
    }
}
