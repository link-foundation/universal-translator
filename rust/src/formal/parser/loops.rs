//! Counting loops: C-style `for (init; condition; update)`, Lua's numeric
//! `for`, range loops such as `for i in 0..n` and Ruby's `(a..b).each`.

use super::{ADDITIVE, Parsed, Parser};
use crate::formal::languages::Blocks;
use crate::formal::lexer::{Token, TokenType};
use crate::meta::GrammarError;
use crate::meta::{Node, add, block, number};

/// `++` and `--` written as the compound assignment they stand for.
pub(super) fn step_operator(symbol: &str) -> Option<&'static str> {
    match symbol {
        "++" => Some("+="),
        "--" => Some("-="),
        _ => None,
    }
}

/// The `start` and exclusive `end` of a counting range.
struct Range {
    start: Node,
    end: Node,
}

/// The step of a C-style loop update such as `i++` or `i += 1`.
pub(crate) struct Update {
    pub(crate) name: String,
    pub(crate) operator: String,
    pub(crate) value: Node,
}

impl Parser {
    pub(crate) fn for_statement(&mut self) -> Parsed {
        self.position += 1;
        let parenthesized = self.syntax.id != "go"
            && self.is("(")
            && (self.syntax.id == "kotlin" || self.syntax.blocks == Blocks::Braces);
        if parenthesized {
            self.expect("(")?;
        }
        // C family: for (init; condition; update)
        if self.tokens_until_block().any(|token| token.value == ";") {
            let initial = self.statement()?;
            let condition = self.expression()?;
            self.expect(";")?;
            let update = self.for_update()?;
            if parenthesized {
                self.expect(")")?;
            }
            let body = self.block()?;
            return counting_loop(initial, condition, update, body);
        }
        if self.syntax.id == "go" && !self.is_at("range", 1) && !self.is_at(":=", 1) {
            let condition = self.expression()?;
            let body = self.block()?;
            return Ok(Node::new("While")
                .with("condition", condition)
                .with("body", body));
        }
        // Perl declares the loop variable: for my $i (...)
        if self.syntax.declarations.contains(&self.value(0)) && self.kind(1) == TokenType::Name {
            self.position += 1;
        }
        let variable = self.expect_name()?;
        if self.syntax.id == "lua" {
            self.numeric_for(variable)
        } else {
            self.range_for(variable, parenthesized)
        }
    }

    /// Lua: `for i = first, last do ... end`
    pub(crate) fn numeric_for(&mut self, variable: String) -> Parsed {
        self.expect("=")?;
        let start = self.expression()?;
        self.expect(",")?;
        let last = self.expression()?;
        let body = self.block()?;
        self.close_keyword_block()?;
        let range = Range {
            start,
            end: add(last, number(1.0)),
        };
        Ok(counting_node(variable, range, body))
    }

    /// `for i in range`, `for my $i (range)`, `for (i <- range)`
    pub(crate) fn range_for(&mut self, variable: String, parenthesized: bool) -> Parsed {
        let opener = self.syntax.for_in.unwrap_or("in");
        self.expect(opener)?;
        let range = self.range_expression()?;
        if opener == "(" || parenthesized {
            self.expect(")")?;
        }
        let body = self.block()?;
        self.close_keyword_block()?;
        Ok(counting_node(variable, range, body))
    }

    /// Ruby: `(first..last).each do |variable| ... end`
    pub(crate) fn is_range_each(&self) -> bool {
        if !self.is("(") {
            return false;
        }
        let mut depth = 0;
        for offset in 0.. {
            let token = self.peek(offset);
            if matches!(token.kind, TokenType::End | TokenType::Newline) {
                return false;
            }
            if token.value == "(" {
                depth += 1;
            }
            if token.value == ")" {
                depth -= 1;
                if depth == 0 {
                    return self.is_at(".", offset + 1) && self.is_at("each", offset + 2);
                }
            }
        }
        false
    }

    pub(crate) fn range_each(&mut self) -> Parsed {
        self.expect("(")?;
        let range = self.range_expression()?;
        for word in [")", ".", "each", "do", "|"] {
            self.expect(word)?;
        }
        let variable = self.expect_name()?;
        self.expect("|")?;
        let body = self.block()?;
        self.close_keyword_block()?;
        Ok(counting_node(variable, range, body))
    }

    pub(crate) fn tokens_until_block(&self) -> impl Iterator<Item = &Token> {
        self.tokens[self.position.min(self.tokens.len() - 1)..]
            .iter()
            .take_while(|token| {
                !matches!(token.kind, TokenType::End | TokenType::Newline) && token.value != "{"
            })
    }

    pub(crate) fn for_update(&mut self) -> Parsed<Update> {
        let name = self.expect_name()?;
        let written = self.next_value()?;
        if let Some(operator) = step_operator(&written) {
            return Ok(Update {
                name,
                operator: operator.to_owned(),
                value: number(1.0),
            });
        }
        if !["+=", "-=", "*=", "/=", "="].contains(&written.as_str()) {
            return Err(GrammarError::syntax(
                format!("Unsupported loop update \"{written}\""),
                self.current().line,
            ));
        }
        Ok(Update {
            name,
            operator: written,
            value: self.expression()?,
        })
    }

    fn range_expression(&mut self) -> Parsed<Range> {
        if self.accept("range") {
            self.expect("(")?;
            let first = self.expression()?;
            let second = if self.accept(",") {
                Some(self.expression()?)
            } else {
                None
            };
            self.expect(")")?;
            return Ok(match second {
                Some(end) => Range { start: first, end },
                None => Range {
                    start: number(0.0),
                    end: first,
                },
            });
        }
        let start = self.binary(ADDITIVE)?;
        let operator = self.next_value()?;
        let last = self.binary(ADDITIVE)?;
        let inclusive = |last: Node| add(last, number(1.0));
        let end = match operator.as_str() {
            "until" | "..<" => last,
            "..." if self.syntax.id == "ruby" => last,
            ".." if self.syntax.id == "rust" => last,
            "..." | ".." | "..=" => inclusive(last),
            // Scala's `to`, and Julia's and R's `:`
            "to" | ":" => inclusive(last),
            _ => {
                return Err(GrammarError::syntax(
                    format!("Unsupported range operator \"{operator}\""),
                    self.current().line,
                ));
            }
        };
        Ok(Range { start, end })
    }
}

fn counting_node(variable: String, range: Range, body: Node) -> Node {
    Node::new("CountingLoop")
        .with("variable", variable)
        .with("start", range.start)
        .with("end", range.end)
        .with("body", body)
}

/// `for (i = a; i < b; i++)` is a counting loop. Every other C-style loop
/// becomes its initial assignment followed by a while loop that ends with
/// the update.
fn counting_loop(initial: Node, condition: Node, update: Update, body: Node) -> Parsed {
    let variable = initial.str("name").unwrap_or_default().to_owned();
    let declares = initial.is("Declaration") || initial.is("Assignment");
    let operator = condition.str("operator").unwrap_or_default();
    let counts = declares
        && condition.is("Binary")
        && ["less", "lessOrEqual"].contains(&operator)
        && condition
            .node("left")
            .is_some_and(|left| left.is_name(&variable))
        && update.name == variable
        && update.operator == "+="
        && update.value.is("Number")
        && update.value.number("value") == Some(1.0);
    if !counts {
        let start = if initial.is("Declaration") {
            Node::new("Assignment")
                .with("name", variable)
                .with("operator", "=")
                .with_opt("value", initial.node("value").cloned())
        } else {
            initial
        };
        let step = Node::new("Assignment")
            .with("name", update.name)
            .with("operator", update.operator)
            .with("value", update.value);
        let mut statements = body.node_list("statements");
        statements.push(step);
        let looped = Node::new("While")
            .with("condition", condition)
            .with("body", block(statements));
        return Ok(Node::new("Statements").with("statements", vec![start, looped]));
    }
    let right = condition
        .node("right")
        .cloned()
        .unwrap_or_else(|| number(0.0));
    let end = if operator == "less" {
        right
    } else {
        add(right, number(1.0))
    };
    Ok(Node::new("CountingLoop")
        .with("variable", variable)
        .with_opt("start", initial.node("value").cloned())
        .with("end", end)
        .with("body", body))
}
