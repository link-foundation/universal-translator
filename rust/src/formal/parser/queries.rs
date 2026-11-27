//! Comprehensions, LINQ clauses and expression lambdas retain their scopes.
use super::{Parsed, Parser};
use crate::formal::lexer::TokenType;
use crate::meta::queries::{query, rewrite_free, row_members};
use crate::meta::{Node, name, walk};

fn pure(expression: &Node) -> bool {
    let mut result = true;
    walk(expression, |current| {
        if ![
            "Number", "Text", "Boolean", "Name", "Index", "Binary", "Unary",
        ]
        .contains(&current.kind.as_str())
        {
            result = false;
        }
    });
    result
}

pub(super) fn query_call(expression: Node) -> Node {
    if !expression.is("Call") {
        return expression;
    }
    let Some((receiver, method)) = expression
        .str("callee")
        .and_then(|callee| callee.rsplit_once('.'))
    else {
        return expression;
    };
    let mut arguments = expression.node_list("arguments");
    let source = if receiver.is_empty() {
        if arguments.is_empty() {
            return expression;
        }
        arguments.remove(0)
    } else {
        name(receiver)
    };
    let source = query_call(source);
    if ["ToArray", "AsEnumerable"].contains(&method) && arguments.is_empty() && source.is("Query") {
        return source.with("eager", method == "ToArray");
    }
    if !["filter", "map"].contains(&method) || arguments.len() != 1 || !arguments[0].is("Lambda") {
        return expression;
    }
    let lambda = &arguments[0];
    let parameters = lambda.texts("parameters");
    if parameters.len() != 1 {
        return expression;
    }
    let variable = &parameters[0];
    let Some(body) = lambda.node("body") else {
        return expression;
    };
    let body = row_members(body.clone(), variable, false);
    if method == "filter" {
        return query(source, variable, name(variable), Some(body), true);
    }
    let range = source.str("variable").unwrap_or_default().to_owned();
    let identity = source
        .node("projection")
        .is_some_and(|p| p.is("Name") && p.str("name") == Some(&range));
    if !source.is("Query")
        || !identity
        || !source.node("condition").is_some_and(pure)
        || !pure(&body)
    {
        return query(source, variable, body, None, true);
    }
    let projection = rewrite_free(body, variable, &mut |current| {
        if current.is("Name") && current.str("name") == Some(variable) {
            name(&range)
        } else {
            current
        }
    });
    source.with("projection", projection)
}

impl Parser {
    pub(super) fn query_primary(&mut self) -> Parsed<Option<Node>> {
        if self.syntax.id == "csharp" && self.is("from") && self.is_at("in", 2) {
            self.position += 1;
            let variable = self.expect_name()?;
            self.expect("in")?;
            let source = self.expression()?;
            let condition = if self.accept("where") {
                Some(self.expression()?)
            } else {
                None
            };
            self.expect("select")?;
            let projection = self.expression()?;
            return Ok(Some(query(
                source,
                &variable,
                row_members(projection, &variable, false),
                condition.map(|c| row_members(c, &variable, false)),
                false,
            )));
        }
        if self.syntax.id == "python" && (self.is("(") || self.is("[")) {
            let eager = self.is("[");
            let closing = if eager { "]" } else { ")" };
            if self.contains_for(closing) {
                self.position += 1;
                let projection = self.expression()?;
                self.expect("for")?;
                let variable = self.expect_name()?;
                self.expect("in")?;
                let source = self.expression()?;
                let condition = if self.accept("if") {
                    Some(self.expression()?)
                } else {
                    None
                };
                self.expect(closing)?;
                return Ok(Some(query(
                    source,
                    &variable,
                    row_members(projection, &variable, false),
                    condition.map(|c| row_members(c, &variable, false)),
                    eager,
                )));
            }
        }
        Ok(None)
    }

    fn contains_for(&self, closing: &str) -> bool {
        let mut depth = 0i64;
        for token in self.tokens.iter().skip(self.position + 1) {
            if token.kind == TokenType::End || (depth == 0 && token.value == closing) {
                return false;
            }
            if depth == 0 && token.value == "for" {
                return true;
            }
            if ["(", "[", "{"].contains(&token.value.as_str()) {
                depth += 1;
            } else if [")", "]", "}"].contains(&token.value.as_str()) {
                depth -= 1;
            }
        }
        false
    }

    pub(super) fn query_lambda(&mut self) -> Parsed<Option<Node>> {
        if !["javascript", "typescript"].contains(&self.syntax.id) {
            return Ok(None);
        }
        let plain = self.kind(0) == TokenType::Name && self.is_at("=>", 1);
        let wrapped = self.is("(")
            && self.kind(1) == TokenType::Name
            && self.is_at(")", 2)
            && self.is_at("=>", 3);
        if !plain && !wrapped {
            return Ok(None);
        }
        self.position += usize::from(wrapped);
        let variable = self.expect_name()?;
        self.position += if wrapped { 2 } else { 1 };
        Ok(Some(
            Node::new("Lambda")
                .with("parameters", vec![variable])
                .with("body", self.expression()?),
        ))
    }
}
