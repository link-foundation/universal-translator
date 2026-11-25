//! Meta program -> controlled natural language text.
//!
//! Every sentence is the first template the language lists for the
//! statement, with its slots filled. Expressions are written at a precedence
//! level and get parentheses only where the reader would otherwise group
//! them differently. The JavaScript twin is js/src/natural/writer.js.

use std::collections::HashMap;

use super::catalog::{Language, natural_language};
use super::levels::{
    Associativity, LEVELS, binary_template, level_index, level_of_template, unary_template,
};
use super::tokens::{Kind, Token};
use crate::meta::{Node, layout, number, subtract};

const INDENT_UNIT: &str = "  ";

type Slots<'a> = HashMap<&'a str, Vec<Token>>;

/// Neutral name ("move-disks") -> the language's spelling of it.
pub fn write_name(neutral: &str, language: &Language) -> String {
    let words: Vec<&str> = neutral
        .split('-')
        .map(|word| language.lexicon.get(word).map_or(word, String::as_str))
        .collect();
    let spelled = words.join(&language.name_joiner);
    if language.reserved.contains(&spelled.to_lowercase()) {
        format!("{spelled}_")
    } else {
        spelled
    }
}

fn word(value: impl Into<String>) -> Token {
    Token::word(value)
}

fn separator(language: &Language) -> Token {
    Token::new(Kind::Separator, language.list_separator.clone())
}

/// Fill the first template of `key` with token lists.
fn fill(language: &Language, key: &str, slots: &Slots) -> Result<Vec<Token>, String> {
    let template = language
        .variants(key)
        .first()
        .ok_or_else(|| format!("{} has no \"{key}\" template", language.id))?;
    let mut tokens = Vec::new();
    for token in template {
        if token.kind != Kind::Slot {
            tokens.push(token.clone());
            continue;
        }
        let value = slots.get(token.value.as_str()).ok_or_else(|| {
            format!(
                "Template \"{key}\" of {} uses {{{}}}",
                language.id, token.value
            )
        })?;
        tokens.extend(value.iter().cloned());
    }
    Ok(tokens)
}

fn list(language: &Language, items: Vec<Vec<Token>>) -> Vec<Token> {
    let joined = |items: &[Vec<Token>]| {
        let mut tokens = Vec::new();
        for (index, item) in items.iter().enumerate() {
            if index > 0 {
                tokens.push(separator(language));
            }
            tokens.extend(item.iter().cloned());
        }
        tokens
    };
    match (&language.list_and, items.split_last()) {
        (Some(and), Some((last, head))) if items.len() >= 2 => {
            let mut tokens = joined(head);
            tokens.extend(and.split(' ').map(word));
            tokens.extend(last.iter().cloned());
            tokens
        }
        _ => joined(&items),
    }
}

fn parenthesize(tokens: Vec<Token>) -> Vec<Token> {
    let mut result = vec![Token::new(Kind::Open, "(")];
    result.extend(tokens);
    result.push(Token::new(Kind::Close, ")"));
    result
}

fn operator(expression: &Node) -> &str {
    expression.str("operator").unwrap_or_default()
}

fn level_of(expression: &Node) -> usize {
    let template = match expression.kind.as_str() {
        "Interpolation" => return level_index("join"),
        "Binary" => binary_template(operator(expression)),
        "Unary" => unary_template(operator(expression)),
        _ => None,
    };
    template
        .and_then(level_of_template)
        .unwrap_or_else(|| level_index("primary"))
}

fn child<'a>(node: &'a Node, key: &str) -> Result<&'a Node, String> {
    node.node(key)
        .ok_or_else(|| format!("A {} without {key}", node.kind))
}

fn binary_slots<'a>(
    expression: &Node,
    language: &Language,
    level: usize,
) -> Result<Slots<'a>, String> {
    let left_level = if LEVELS[level].associativity == Associativity::Left {
        level
    } else {
        level + 1
    };
    Ok(Slots::from([
        (
            "left",
            write_expression(child(expression, "left")?, language, left_level)?,
        ),
        (
            "right",
            write_expression(child(expression, "right")?, language, level + 1)?,
        ),
    ]))
}

/// Tokens of an expression written where only a primary fits (an index, an
/// array or the length and fill of a new array).
fn operand(expression: &Node, key: &str, language: &Language) -> Result<Vec<Token>, String> {
    write_expression(child(expression, key)?, language, level_index("primary"))
}

/// Expressions separated by the list separator, as call arguments are.
fn separated(expressions: Vec<&Node>, language: &Language) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    for (index, expression) in expressions.into_iter().enumerate() {
        if index > 0 {
            tokens.push(separator(language));
        }
        tokens.extend(write_expression(expression, language, 0)?);
    }
    Ok(tokens)
}

fn primary(expression: &Node, language: &Language) -> Result<Vec<Token>, String> {
    match expression.kind.as_str() {
        "Number" => Ok(vec![Token::number(
            expression.number("value").unwrap_or_default(),
        )]),
        "Text" => Ok(vec![Token::new(
            Kind::Text,
            expression.str("value").unwrap_or_default(),
        )]),
        "Boolean" => Ok(vec![word(if expression.flag("value").unwrap_or(false) {
            language.true_word.clone()
        } else {
            language.false_word.clone()
        })]),
        "Name" => Ok(vec![word(write_name(
            expression.str("name").unwrap_or_default(),
            language,
        ))]),
        "Call" => {
            let callee = vec![word(write_name(
                expression.str("callee").unwrap_or_default(),
                language,
            ))];
            let arguments = expression.nodes("arguments");
            if arguments.is_empty() {
                return fill(
                    language,
                    "call-without-arguments",
                    &Slots::from([("callee", callee)]),
                );
            }
            let tokens = separated(arguments, language)?;
            fill(
                language,
                "call",
                &Slots::from([("callee", callee), ("arguments", tokens)]),
            )
        }
        // An empty array is a new array of no zeros: no template lists nothing.
        "ArrayLiteral" => {
            let elements = expression.nodes("elements");
            if elements.is_empty() {
                let zero = || vec![Token::number(0.0)];
                return fill(
                    language,
                    "new-array",
                    &Slots::from([("length", zero()), ("fill", zero())]),
                );
            }
            let elements = separated(elements, language)?;
            fill(language, "array", &Slots::from([("elements", elements)]))
        }
        "NewArray" => fill(
            language,
            "new-array",
            &Slots::from([
                ("length", operand(expression, "length", language)?),
                ("fill", operand(expression, "fill", language)?),
            ]),
        ),
        "Index" => fill(
            language,
            "element",
            &Slots::from([
                ("index", operand(expression, "index", language)?),
                ("array", operand(expression, "array", language)?),
            ]),
        ),
        "Length" => fill(
            language,
            "length",
            &Slots::from([("array", operand(expression, "array", language)?)]),
        ),
        kind => Err(format!("Cannot write a {kind} expression in words")),
    }
}

/// Tokens of an expression that must bind at least as tightly as `minimum`.
pub fn write_expression(
    expression: &Node,
    language: &Language,
    minimum: usize,
) -> Result<Vec<Token>, String> {
    let level = level_of(expression);
    let tokens = match expression.kind.as_str() {
        "Interpolation" => {
            let mut parts = expression
                .nodes("parts")
                .into_iter()
                .map(|part| write_expression(part, language, level + 1));
            let mut tokens = parts
                .next()
                .ok_or_else(|| "An empty interpolation".to_owned())??;
            for right in parts {
                tokens = fill(
                    language,
                    "join",
                    &Slots::from([("left", tokens), ("right", right?)]),
                )?;
            }
            tokens
        }
        "Binary" => {
            let key = binary_template(operator(expression))
                .ok_or_else(|| format!("No words for the operator {}", operator(expression)))?;
            fill(language, key, &binary_slots(expression, language, level)?)?
        }
        "Unary" => {
            let key = unary_template(operator(expression))
                .ok_or_else(|| format!("No words for the operator {}", operator(expression)))?;
            let operand = write_expression(child(expression, "operand")?, language, level)?;
            fill(language, key, &Slots::from([("operand", operand)]))?
        }
        _ => primary(expression, language)?,
    };
    Ok(if level < minimum {
        parenthesize(tokens)
    } else {
        tokens
    })
}

/// Tokens -> text. Spaces go between tokens, except next to parentheses and
/// before separators.
pub fn render_tokens(tokens: &[Token], language: &Language) -> String {
    let (opening, closing) = (&language.quotes.0, &language.quotes.1);
    let mut output = String::new();
    let mut previous: Option<&Token> = None;
    for token in tokens {
        let text = if token.kind == Kind::Text {
            let doubled = format!("{closing}{closing}");
            let escaped = if closing.is_empty() {
                token.value.clone()
            } else {
                token.value.replace(closing.as_str(), &doubled)
            };
            format!("{opening}{escaped}{closing}")
        } else {
            token.value.clone()
        };
        let glued = previous.is_none_or(|previous| previous.kind == Kind::Open)
            || matches!(token.kind, Kind::Close | Kind::Separator);
        if !glued {
            output.push(' ');
        }
        output.push_str(&text);
        previous = Some(token);
    }
    output
}

fn capitalize(sentence: &str) -> String {
    let mut characters = sentence.chars();
    match characters.next() {
        Some(first) => first.to_uppercase().chain(characters).collect(),
        None => String::new(),
    }
}

struct Writer<'a> {
    language: &'a Language,
    lines: Vec<String>,
}

impl Writer<'_> {
    fn sentence(
        &mut self,
        depth: usize,
        key: &str,
        slots: &Slots,
        opens_block: bool,
    ) -> Result<(), String> {
        let language = self.language;
        let text = render_tokens(&fill(language, key, slots)?, language);
        let end = if opens_block {
            &language.block_end
        } else {
            &language.sentence_end
        };
        self.lines.push(format!(
            "{}{}{end}",
            INDENT_UNIT.repeat(depth),
            capitalize(&text)
        ));
        Ok(())
    }

    /// A comment of several lines becomes one note per line.
    fn note(&mut self, depth: usize, text: &str) {
        for part in text.split('\n') {
            let line = self.language.note.replacen("{text}", part.trim(), 1);
            self.lines
                .push(format!("{}{line}", INDENT_UNIT.repeat(depth)));
        }
    }

    fn expression(&self, value: Option<&Node>) -> Result<Vec<Token>, String> {
        let value = value.ok_or_else(|| "A statement without its expression".to_owned())?;
        write_expression(value, self.language, 0)
    }

    fn name(&self, value: Option<&str>) -> Vec<Token> {
        vec![word(write_name(value.unwrap_or_default(), self.language))]
    }

    fn block(&mut self, block: Option<&Node>, depth: usize) -> Result<(), String> {
        let statements = block
            .map(|block| block.nodes("statements"))
            .unwrap_or_default();
        if statements.is_empty() {
            self.sentence(depth, "nothing", &Slots::new(), false)?;
        }
        for statement in &layout(statements.into_iter().cloned().collect()) {
            self.statement(statement, depth)?;
        }
        Ok(())
    }

    fn conditional(&mut self, statement: &Node, depth: usize, key: &str) -> Result<(), String> {
        let condition = self.expression(statement.node("condition"))?;
        self.sentence(depth, key, &Slots::from([("condition", condition)]), true)?;
        self.block(statement.node("then"), depth + 1)?;
        match statement.node("otherwise") {
            Some(otherwise) if otherwise.is("If") => self.conditional(otherwise, depth, "else-if"),
            Some(otherwise) => {
                self.sentence(depth, "else", &Slots::new(), true)?;
                self.block(Some(otherwise), depth + 1)
            }
            None => Ok(()),
        }
    }

    fn statement(&mut self, statement: &Node, depth: usize) -> Result<(), String> {
        match statement.kind.as_str() {
            "Comment" => {
                self.note(depth, statement.str("text").unwrap_or_default());
                Ok(())
            }
            // Concrete syntax: empty lines between sentences stay.
            "Blank" => {
                if self.lines.last().is_none_or(|line| !line.is_empty()) {
                    let lines = statement.number("lines").unwrap_or(1.0) as usize;
                    self.lines.extend(std::iter::repeat_n(String::new(), lines));
                }
                Ok(())
            }
            "Declaration" | "Assignment" => {
                let key = if statement.is("Declaration") {
                    "declare"
                } else {
                    match statement.str("operator") {
                        Some(operator) if !operator.is_empty() && operator != "=" => {
                            return Err(format!("Unexpanded compound assignment {operator}"));
                        }
                        _ => "assign",
                    }
                };
                let slots = Slots::from([
                    ("name", self.name(statement.str("name"))),
                    ("value", self.expression(statement.node("value"))?),
                ]);
                self.sentence(depth, key, &slots, false)
            }
            "IndexAssignment" => {
                let index = child(statement, "index")?;
                let slots = Slots::from([
                    ("name", self.name(statement.str("name"))),
                    (
                        "index",
                        write_expression(index, self.language, level_index("primary"))?,
                    ),
                    ("value", self.expression(statement.node("value"))?),
                ]);
                self.sentence(depth, "set-element", &slots, false)
            }
            "Print" => {
                let key = if statement.flag("newline").unwrap_or(false) {
                    "print-line"
                } else {
                    "print"
                };
                let value = self.expression(statement.node("value"))?;
                self.sentence(depth, key, &Slots::from([("value", value)]), false)
            }
            "Return" => match statement.node("value") {
                Some(value) => {
                    let value = self.expression(Some(value))?;
                    self.sentence(
                        depth,
                        "return-value",
                        &Slots::from([("value", value)]),
                        false,
                    )
                }
                None => self.sentence(depth, "return", &Slots::new(), false),
            },
            "Evaluate" => {
                let expression = self.expression(statement.node("expression"))?;
                self.sentence(
                    depth,
                    "evaluate",
                    &Slots::from([("expression", expression)]),
                    false,
                )
            }
            "If" => self.conditional(statement, depth, "if"),
            "While" => {
                let condition = self.expression(statement.node("condition"))?;
                self.sentence(
                    depth,
                    "while",
                    &Slots::from([("condition", condition)]),
                    true,
                )?;
                self.block(statement.node("body"), depth + 1)
            }
            "CountingLoop" => {
                // Natural languages count up to the last value, not past it.
                let end = child(statement, "end")?.clone();
                let last = subtract(end, number(1.0));
                let slots = Slots::from([
                    ("variable", self.name(statement.str("variable"))),
                    ("start", self.expression(statement.node("start"))?),
                    ("last", self.expression(Some(&last))?),
                ]);
                self.sentence(depth, "for", &slots, true)?;
                self.block(statement.node("body"), depth + 1)
            }
            "Block" => self.block(Some(statement), depth),
            kind => Err(format!("Cannot write a {kind} statement in words")),
        }
    }

    fn function(&mut self, item: &Node) -> Result<(), String> {
        for text in item.texts("comments") {
            self.note(0, &text);
        }
        let name = self.name(item.str("name"));
        let parameters = item.nodes("parameters");
        if parameters.is_empty() {
            self.sentence(
                0,
                "function-without-parameters",
                &Slots::from([("name", name)]),
                true,
            )?;
        } else {
            let items = parameters
                .into_iter()
                .map(|parameter| self.name(parameter.str("name")))
                .collect();
            let parameters = list(self.language, items);
            self.sentence(
                0,
                "function",
                &Slots::from([("name", name), ("parameters", parameters)]),
                true,
            )?;
        }
        self.block(item.node("body"), 1)
    }

    fn program(mut self, program: &Node) -> Result<String, String> {
        for text in program.texts("comments") {
            self.note(0, &text);
        }
        for item in program.nodes("functions") {
            if !self.lines.is_empty() {
                self.lines.push(String::new());
            }
            self.function(item)?;
        }
        let main = program
            .node("main")
            .map(|main| main.nodes("statements"))
            .unwrap_or_default();
        let main_comments = program.texts("mainComments");
        if !main.is_empty() || !main_comments.is_empty() {
            if !self.lines.is_empty() {
                self.lines.push(String::new());
            }
            for text in &main_comments {
                self.note(0, text);
            }
            for statement in &layout(main.into_iter().cloned().collect()) {
                self.statement(statement, 0)?;
            }
        }
        Ok(format!("{}\n", self.lines.join("\n")))
    }
}

/// A meta program written in a controlled natural language.
pub fn write_natural(program: &Node, id: &str) -> Result<String, String> {
    let language = natural_language(id)?;
    Writer {
        language,
        lines: Vec::new(),
    }
    .program(program)
}
