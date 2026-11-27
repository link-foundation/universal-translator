//! Native C-family assignment and comma expressions.
use super::{Parsed, Parser};
use crate::meta::Node;
impl Parser {
    fn sequences(&self) -> bool {
        matches!(self.syntax.id, "c" | "cpp" | "objc")
    }
    pub(super) fn assignment_expression(&mut self, value: Node) -> Parsed {
        if self.sequences() && value.is("Name") && self.accept("=") {
            Ok(Node::new("AssignmentExpression")
                .with("name", value.str("name").unwrap_or_default())
                .with("value", self.expression()?))
        } else {
            Ok(value)
        }
    }
    pub(super) fn evaluation_parenthesized(&mut self) -> Parsed {
        let mut values = vec![self.expression()?];
        while self.sequences() && self.accept(",") {
            values.push(self.expression()?);
        }
        self.expect(")")?;
        let value = values.pop().expect("one expression");
        Ok(if values.is_empty() {
            value
        } else {
            Node::new("ExpressionSequence")
                .with("steps", values)
                .with("value", value)
        })
    }
}
