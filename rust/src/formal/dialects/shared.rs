//! Helpers shared by the dialects: languages whose programs are laid out
//! with keywords (begin ... end, if ... end if) and a declaration section,
//! which the braces and indentation of the shared grammar do not cover.

use crate::formal::lexer::TokenType;
use crate::formal::parser::{Parsed, Parser};
use crate::meta::{Node, number, text};

/// Parser helpers for keyword-delimited statements.
impl Parser {
    /// Skip line ends and statement separators.
    pub(crate) fn skip_lines(&mut self) {
        while self.kind(0) == TokenType::Newline || self.is(";") {
            self.position += 1;
        }
    }

    /// Statements and comments up to the word that ends the block.
    pub(crate) fn statements_until(&mut self, done: &dyn Fn(&Parser) -> bool) -> Parsed<Vec<Node>> {
        let mut statements = Vec::new();
        self.skip_lines();
        while !done(self) && self.kind(0) != TokenType::End {
            if self.kind(0) == TokenType::Comment {
                let comment = self.next()?.value;
                statements.push(Node::new("Comment").with("text", comment));
            } else {
                statements.push(self.statement()?);
            }
            self.skip_lines();
        }
        Ok(statements)
    }

    /// Comments and line ends between top-level items.
    pub(crate) fn gather_comments(&mut self, items: &mut Vec<Node>) {
        while matches!(self.kind(0), TokenType::Newline | TokenType::Comment) {
            let token = self.current().clone();
            self.position += 1;
            if token.kind == TokenType::Comment {
                items.push(Node::new("Comment").with("text", token.value));
            }
        }
    }

    /// The meta type a language spells this way (Int64, Long, ...).
    pub(crate) fn type_of(&self, spelling: &str) -> Option<&'static str> {
        let types = self.syntax.types?;
        [
            ("integer", types.integer),
            ("text", types.text),
            ("boolean", types.boolean),
            ("nothing", types.nothing),
        ]
        .into_iter()
        .find(|(_, written)| !written.is_empty() && written.eq_ignore_ascii_case(spelling))
        .map(|(meta, _)| meta)
    }

    /// Words up to the end of the line, for headers the program ignores.
    pub(crate) fn skip_line(&mut self) {
        while !matches!(self.kind(0), TokenType::Newline | TokenType::End) {
            self.position += 1;
        }
    }

    /// A statement that only names a procedure calls it without arguments.
    pub(crate) fn called(expression: Node) -> Node {
        if expression.is("Name") {
            let callee = expression.str("name").unwrap_or_default().to_owned();
            Node::new("Call")
                .with("callee", callee)
                .with("arguments", Vec::<Node>::new())
        } else {
            expression
        }
    }
}

/// Visit every statement of a block, inner blocks included, in source order.
pub(crate) fn each_statement(body: &Node, visit: &mut dyn FnMut(&Node)) {
    for statement in body.nodes("statements") {
        visit(statement);
        for key in ["then", "otherwise", "body"] {
            match statement.node(key) {
                Some(inner) if inner.is("Block") => each_statement(inner, visit),
                Some(inner) if inner.is("If") => {
                    each_statement(
                        &Node::new("Block").with("statements", vec![inner.clone()]),
                        visit,
                    );
                }
                _ => {}
            }
        }
    }
}

/// The variables a body declares, with their meta types, for languages that
/// declare every variable before the first statement. Counting loop
/// variables are included unless the loop declares its own (Ada).
pub(crate) fn declared_variables(body: &Node, loops: bool) -> Vec<(String, String)> {
    let mut found: Vec<(String, String)> = Vec::new();
    each_statement(body, &mut |statement| {
        let entry = if statement.is("Declaration") {
            statement.str("name").map(|name| {
                (
                    name.to_owned(),
                    statement.str("type").unwrap_or("integer").to_owned(),
                )
            })
        } else if statement.is("CountingLoop") && loops {
            statement
                .str("variable")
                .map(|name| (name.to_owned(), "integer".to_owned()))
        } else {
            None
        };
        if let Some((name, kind)) = entry
            && !found.iter().any(|(known, _)| *known == name)
        {
            found.push((name, kind));
        }
    });
    found
}

/// The value a declaration without one starts from.
pub(crate) fn default_value(kind: &str) -> Node {
    match kind {
        "text" => text(""),
        "boolean" => Node::new("Boolean").with("value", false),
        _ => number(0.0),
    }
}
