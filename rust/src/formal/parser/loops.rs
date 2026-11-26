//! Counting loops: C-style `for (init; condition; update)`, Lua's numeric
//! `for`, range loops such as `for i in 0..n` and Ruby's `(a..b).each`, and
//! the for-each loops over the elements of an array.

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

/// What a loop runs over: a counting range or the elements of an array.
enum Over {
    Range(Range),
    Array(Node),
}

/// The word or symbol that stands between the loop variable and the array in
/// the for-each template of a language, such as `of`, `in`, `:` and `<-`.
fn for_each_opener(template: Option<&str>) -> Option<String> {
    let template = template?;
    let rest = template[template.find("{variable}")? + "{variable}".len()..].trim_start();
    let end = rest.find(|character: char| character.is_whitespace() || character == '{')?;
    let after = rest[end..].trim_start();
    (end > 0 && after.starts_with("{array")).then(|| rest[..end].to_owned())
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
        if self.syntax.id == "go" {
            return self.go_for();
        }
        // The loop variable may follow a declaration or a type: for my $i
        // (...), for (const x of ...), for (int x : ...)
        self.skip_declarators();
        if self.syntax.id == "rust" {
            self.accept("&");
        }
        if self.syntax.id == "lua" && self.is_at(",", 1) {
            return self.lua_for_each();
        }
        let variable = self.expect_name()?;
        if self.syntax.id == "lua" {
            self.numeric_for(variable)
        } else {
            self.range_for(variable, parenthesized)
        }
    }

    /// Go: `for condition { ... }`, `for i := range n`, `for _, x := range a`
    fn go_for(&mut self) -> Parsed {
        if self.is_at(",", 1) {
            self.position += 2;
            let variable = self.expect_name()?;
            self.expect(":=")?;
            self.expect("range")?;
            let array = self.expression()?;
            let body = self.block()?;
            return Ok(for_each_node(variable, array, body));
        }
        if !self.is_at("range", 1) && !self.is_at(":=", 1) {
            let condition = self.expression()?;
            let body = self.block()?;
            return Ok(Node::new("While")
                .with("condition", condition)
                .with("body", body));
        }
        let variable = self.expect_name()?;
        self.range_for(variable, false)
    }

    /// PHP: `foreach ($a as $x)`, D: `foreach (x; a)`, C#: `foreach (T x in a)`
    pub(crate) fn foreach_statement(&mut self) -> Parsed {
        self.position += 1;
        self.expect("(")?;
        let id = self.syntax.id;
        self.skip_declarators();
        let first = self.expression()?;
        self.expect(match id {
            "php" => "as",
            "d" => ";",
            _ => "in",
        })?;
        let second = self.expression()?;
        self.expect(")")?;
        let body = self.block()?;
        let (element, array) = if id == "php" {
            (second, first)
        } else {
            (first, second)
        };
        let variable = element.str("name").unwrap_or_default().to_owned();
        Ok(for_each_node(variable, array, body))
    }

    /// The words that declare a loop variable, or give its type, before it.
    fn skip_declarators(&mut self) {
        while self.kind(0) == TokenType::Name
            && self.kind(1) == TokenType::Name
            && !["in", "of", "as"].contains(&self.value(1))
        {
            self.position += 1;
        }
    }

    /// Lua: `for _, x in ipairs(a) do ... end`
    fn lua_for_each(&mut self) -> Parsed {
        self.position += 2;
        let variable = self.expect_name()?;
        for word in ["in", "ipairs", "("] {
            self.expect(word)?;
        }
        let array = self.expression()?;
        self.expect(")")?;
        let body = self.block()?;
        self.close_keyword_block()?;
        Ok(for_each_node(variable, array, body))
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
        let each = for_each_opener(self.syntax.for_each);
        let over = each
            .filter(|each| each != opener && self.is(each))
            .unwrap_or_else(|| opener.to_owned());
        self.expect(&over)?;
        if self.syntax.id == "rust" {
            self.accept("&");
        }
        let range = self.range_expression(over != opener)?;
        if opener == "(" || parenthesized {
            self.expect(")")?;
        }
        let body = self.block()?;
        self.close_keyword_block()?;
        Ok(match range {
            Over::Array(array) => for_each_node(variable, array, body),
            Over::Range(range) => counting_node(variable, range, body),
        })
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
        let Over::Range(range) = self.range_expression(false)? else {
            return Err(GrammarError::syntax(
                "Expected a range",
                self.current().line,
            ));
        };
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

    fn is_range_operator(&self) -> bool {
        let value = self.value(0);
        ["until", "..<", "...", "..", "..=", "to"].contains(&value)
            || (value == ":" && ["julia", "r"].contains(&self.syntax.id))
    }

    /// The range a loop counts over, or the array when the loop visits its
    /// elements: `for x in a`, `for (const x of a)`.
    fn range_expression(&mut self, is_array: bool) -> Parsed<Over> {
        if is_array {
            return Ok(Over::Array(self.expression()?));
        }
        if self.accept("range") {
            self.expect("(")?;
            let first = self.expression()?;
            let second = if self.accept(",") {
                Some(self.expression()?)
            } else {
                None
            };
            self.expect(")")?;
            return Ok(Over::Range(match second {
                Some(end) => Range { start: first, end },
                None => Range {
                    start: number(0.0),
                    end: first,
                },
            }));
        }
        let start = self.binary(ADDITIVE)?;
        if !self.is_range_operator() {
            return Ok(Over::Array(start));
        }
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
        Ok(Over::Range(Range { start, end }))
    }
}

fn for_each_node(variable: String, array: Node, body: Node) -> Node {
    Node::new("ForEach")
        .with("variable", variable)
        .with("array", array)
        .with("body", body)
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
