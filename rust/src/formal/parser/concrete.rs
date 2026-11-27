use super::{Parsed, Parser};
use crate::formal::{languages::Syntax, lexer::tokenize, objpak, objpak_reader};
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

// Parsing and library contracts share one lossless concrete source record.
pub(super) fn parse_program(source: &str, syntax: &Syntax) -> Parsed {
    let library = objpak_reader::prepare(source, syntax);
    let tokens = tokenize(&library.masked, syntax)?;
    let mut parser = Parser::new(tokens.clone(), syntax.clone()).with_source(source);
    let mut tree = parser.program()?;
    if !library.bindings.is_empty() {
        tree.set("objpakBindings", library.bindings.clone());
    }
    if syntax.id == "objc" {
        objpak::validate_entries(&tree)?;
    }
    crate::source_origins::register_origins(&mut tree);
    let concrete =
        objpak_reader::concrete(source, syntax.id, &tokens, parser.productions, &library);
    Ok(tree.with("syntax", concrete))
}
