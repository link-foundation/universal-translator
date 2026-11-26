use super::{Parsed, Parser};
use crate::meta::Node;

impl Parser {
    pub(super) fn concrete_rule(
        &mut self,
        rule: &str,
        parse: impl FnOnce(&mut Self) -> Parsed,
    ) -> Parsed {
        let start = self.position;
        let result = parse(self)?;
        let consumed = &self.tokens[start..self.position];
        let first = consumed.iter().find_map(|token| token.raw_span);
        let last = consumed.iter().rev().find_map(|token| token.raw_span);
        if let (Some((start, _)), Some((_, end))) = (first, last) {
            self.productions.push(
                Node::new("Production")
                    .with("rule", rule)
                    .with("concept", result.kind.clone())
                    .with("start", start as f64)
                    .with("end", end as f64),
            );
        }
        Ok(result)
    }
}
