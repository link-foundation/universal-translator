use super::{Parsed, Parser};
use crate::meta::Node;

impl Parser {
    pub(crate) fn token_node(&mut self, mut node: Node, token: &super::Token) -> Node {
        if let Some((start, end)) = token.raw_span {
            node.origin = self.source.as_ref().map(|source| source.range(start, end));
            self.productions.push(
                Node::new("Production")
                    .with("rule", "comment")
                    .with("concept", node.kind.clone())
                    .with("start", start as f64)
                    .with("end", end as f64),
            );
        }
        node
    }

    pub(super) fn with_source(mut self, source: &str) -> Self {
        self.source = Some(crate::source_origins::SourceLocator::new(source));
        self
    }

    pub(super) fn concrete_rule(
        &mut self,
        rule: &str,
        parse: impl FnOnce(&mut Self) -> Parsed,
    ) -> Parsed {
        let start = self.position;
        let mut result = parse(self)?;
        let consumed = &self.tokens[start..self.position];
        let first = consumed.iter().find_map(|token| token.raw_span);
        let last = consumed.iter().rev().find_map(|token| token.raw_span);
        if result.origin.is_none()
            && let (Some((start, _)), Some((_, end))) = (first, last)
        {
            result.origin = self.source.as_ref().map(|source| source.range(start, end));
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
