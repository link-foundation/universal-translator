use super::{Parsed, Parser};
use crate::meta::{GrammarError, Node, name};

impl Parser {
    pub(super) fn question_suffix(&mut self, expression: Node) -> Parsed {
        if self.syntax.id == "python" && self.accept("?") {
            self.expect("?")?;
            if !expression.is("Name") {
                return Err(GrammarError::syntax(
                    "Detailed inspection requires an entity name",
                    self.current().line,
                ));
            }
            return Ok(Node::new("Question")
                .with("aspect", "details")
                .with("subject", expression));
        }
        Ok(expression)
    }

    pub(super) fn property_assignment(&mut self, expression: Node) -> Parsed {
        let (object, property) = if expression.is("Name") {
            let Some((object, property)) = expression
                .str("name")
                .and_then(|value| value.rsplit_once('.'))
            else {
                return Err(GrammarError::syntax(
                    "Expected an assignable property",
                    self.current().line,
                ));
            };
            (name(object), property.to_owned())
        } else if expression.is("Method") {
            (
                expression
                    .node("receiver")
                    .cloned()
                    .ok_or_else(|| GrammarError::new("A property needs an object"))?,
                expression.str("name").unwrap_or_default().to_owned(),
            )
        } else {
            return Err(GrammarError::syntax(
                "Expected an assignable property",
                self.current().line,
            ));
        };
        let value = self.expression()?;
        self.end_statement()?;
        Ok(Node::new("PropertyAssignment")
            .with("object", object)
            .with("property", property)
            .with("value", value))
    }
}
