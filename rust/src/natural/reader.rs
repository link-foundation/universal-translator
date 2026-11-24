//! Controlled natural language text -> meta program.
//!
//! The reader accepts every template a language lists (the first one is the
//! one the writer uses; later ones are accepted alternatives). A sentence is
//! matched against templates token by token; a slot takes any span of tokens
//! that parses as what the slot holds (an expression, a name or a list of
//! names), and literal words only match outside parentheses. The JavaScript
//! twin is js/src/natural/reader.js.

use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;

use super::catalog::{Language, natural_language};
use super::levels::{Associativity, LEVELS, operator_of_template};
use super::tokens::{Kind, Token};
use crate::grammar::meta::{Node, Value, add, block, name, number};

const NAME_SLOTS: [&str; 3] = ["name", "variable", "callee"];

const STATEMENT_KEYS: [&str; 8] = [
    "print-line",
    "print",
    "declare",
    "assign",
    "return-value",
    "return",
    "nothing",
    "evaluate",
];
const BLOCK_KEYS: [&str; 5] = ["else-if", "else", "if", "while", "for"];
const FUNCTION_KEYS: [&str; 2] = ["function", "function-without-parameters"];

static NAME_START: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[\p{L}_]").expect("name start pattern"));

/// What a slot of a matched template holds.
#[derive(Clone, Debug)]
pub enum Slot {
    Expression(Node),
    Name(String),
    Names(Vec<String>),
    Arguments(Vec<Node>),
}

impl Slot {
    fn expression(self) -> Option<Node> {
        match self {
            Slot::Expression(node) => Some(node),
            _ => None,
        }
    }

    fn name(self) -> Option<String> {
        match self {
            Slot::Name(name) => Some(name),
            _ => None,
        }
    }
}

type Captured = HashMap<String, Slot>;

/// Depth of parentheses before each token, so literals only match at depth 0.
fn depths(tokens: &[Token]) -> Vec<i64> {
    let mut depth = 0;
    tokens
        .iter()
        .map(|token| {
            if token.kind == Kind::Close {
                depth -= 1;
            }
            let current = depth;
            if token.kind == Kind::Open {
                depth += 1;
            }
            current
        })
        .collect()
}

fn same_literal(template: &Token, token: &Token) -> bool {
    template.kind == token.kind
        && match template.kind {
            Kind::Word => template.folded == token.folded,
            Kind::Text => template.value == token.value,
            _ => true,
        }
}

/// Reads one sentence against the templates of a language.
pub struct SentenceReader<'a> {
    language: &'a Language,
    memo: RefCell<HashMap<(usize, usize, usize), Option<Node>>>,
}

type SlotReader<'s> = dyn FnMut(&str, usize, usize) -> Option<Slot> + 's;

impl<'a> SentenceReader<'a> {
    pub fn new(language: &'a Language) -> Self {
        SentenceReader {
            language,
            memo: RefCell::new(HashMap::new()),
        }
    }

    /// Neutral name of a written name token, or `None`.
    pub fn read_name(&self, token: Option<&Token>) -> Option<String> {
        let token = token.filter(|token| token.kind == Kind::Word)?;
        if self.language.reserved.contains(&token.folded) || !NAME_START.is_match(&token.value) {
            return None;
        }
        let written = token.value.strip_suffix('_').unwrap_or(&token.value);
        Some(
            written
                .split(self.language.name_joiner.as_str())
                .map(|part| {
                    let folded = part.to_lowercase();
                    self.language
                        .reverse_lexicon
                        .get(&folded)
                        .cloned()
                        .unwrap_or(folded)
                })
                .collect::<Vec<_>>()
                .join("-"),
        )
    }

    /// Match `template` against tokens[start, end). Returns the slot values.
    /// `slot(name_of_slot, from, to)` parses a slot span.
    fn match_template(
        template: &[Token],
        tokens: &[Token],
        start: usize,
        end: usize,
        slot: &mut SlotReader,
    ) -> Option<Captured> {
        let levels = depths(tokens);
        let mut captured = Captured::new();
        Self::step(
            template,
            tokens,
            &levels,
            start,
            end,
            0,
            start,
            slot,
            &mut captured,
        )
        .then_some(captured)
    }

    #[allow(clippy::too_many_arguments)]
    fn step(
        template: &[Token],
        tokens: &[Token],
        levels: &[i64],
        start: usize,
        end: usize,
        template_index: usize,
        position: usize,
        slot: &mut SlotReader,
        captured: &mut Captured,
    ) -> bool {
        if template_index == template.len() {
            return position == end;
        }
        let current = &template[template_index];
        let next = |captured: &mut Captured, slot: &mut SlotReader, position: usize| {
            Self::step(
                template,
                tokens,
                levels,
                start,
                end,
                template_index + 1,
                position,
                slot,
                captured,
            )
        };
        if current.kind != Kind::Slot {
            return position < end
                && levels[position] == levels[start]
                && same_literal(current, &tokens[position])
                && next(captured, slot, position + 1);
        }
        // A slot spans at least one token; try the longest span first so
        // left-associative operators split at their rightmost occurrence.
        let last = template_index == template.len() - 1;
        let mut stop = if last { end } else { end.saturating_sub(1) };
        while stop > position {
            if (stop == end || levels[stop] == levels[start])
                && let Some(value) = slot(&current.value, position, stop)
            {
                captured.insert(current.value.clone(), value);
                if next(captured, slot, stop) {
                    return true;
                }
            }
            stop -= 1;
        }
        false
    }

    // ---- expressions ----

    fn expression(&self, tokens: &[Token], start: usize, end: usize, level: usize) -> Option<Node> {
        let key = (start, end, level);
        if let Some(known) = self.memo.borrow().get(&key) {
            return known.clone();
        }
        self.memo.borrow_mut().insert(key, None);
        let result = self.parse_expression(tokens, start, end, level);
        self.memo.borrow_mut().insert(key, result.clone());
        result
    }

    fn parse_expression(
        &self,
        tokens: &[Token],
        start: usize,
        end: usize,
        level: usize,
    ) -> Option<Node> {
        if start >= end {
            return None;
        }
        let current = &LEVELS[level];
        if current.name == "primary" {
            return self.primary(tokens, start, end);
        }
        for key in current.templates {
            for template in self.language.variants(key) {
                if let Some(result) = self.operator(key, template, tokens, start, end, level) {
                    return Some(result);
                }
            }
        }
        self.expression(tokens, start, end, level + 1)
    }

    fn operator(
        &self,
        key: &str,
        template: &[Token],
        tokens: &[Token],
        start: usize,
        end: usize,
        level: usize,
    ) -> Option<Node> {
        let associativity = LEVELS[level].associativity;
        let slot_level = |slot: &str| match associativity {
            Associativity::Prefix => level,
            Associativity::Left if slot == "left" => level,
            _ => level + 1,
        };
        let mut reader = |slot: &str, from: usize, to: usize| {
            self.expression(tokens, from, to, slot_level(slot))
                .map(Slot::Expression)
        };
        let mut slots = Self::match_template(template, tokens, start, end, &mut reader)?;
        let mut take = |name: &str| slots.remove(name).and_then(Slot::expression);
        if key == "join" {
            let left = take("left")?;
            let right = take("right")?;
            let mut parts = if left.is("Interpolation") {
                left.node_list("parts")
            } else {
                vec![left]
            };
            parts.push(right);
            return Some(Node::new("Interpolation").with("parts", parts));
        }
        let operator = operator_of_template(key)?;
        if associativity == Associativity::Prefix {
            return Some(
                Node::new("Unary")
                    .with("operator", operator)
                    .with("operand", take("operand")?),
            );
        }
        Some(
            Node::new("Binary")
                .with("operator", operator)
                .with("left", take("left")?)
                .with("right", take("right")?),
        )
    }

    fn arguments(&self, tokens: &[Token], start: usize, end: usize) -> Option<Vec<Node>> {
        let levels = depths(tokens);
        let mut values = Vec::new();
        let mut from = start;
        for index in start..=end {
            let boundary = index == end
                || (tokens[index].kind == Kind::Separator && levels[index] == levels[start]);
            if boundary {
                values.push(self.expression(tokens, from, index, 0)?);
                from = index + 1;
            }
        }
        Some(values)
    }

    fn primary(&self, tokens: &[Token], start: usize, end: usize) -> Option<Node> {
        let first = &tokens[start];
        if end - start == 1 {
            return self.atom(first);
        }
        if first.kind == Kind::Open && tokens[end - 1].kind == Kind::Close {
            let inner = depths(tokens);
            let closes_first = (start + 1..end - 1).any(|index| inner[index] == inner[start]);
            if !closes_first {
                return self.expression(tokens, start + 1, end - 1, 0);
            }
        }
        for key in ["call", "call-without-arguments"] {
            for template in self.language.variants(key) {
                let mut reader = |slot: &str, from: usize, to: usize| {
                    if slot == "callee" {
                        return if to - from == 1 {
                            self.read_name(tokens.get(from)).map(Slot::Name)
                        } else {
                            None
                        };
                    }
                    self.arguments(tokens, from, to).map(Slot::Arguments)
                };
                if let Some(mut slots) =
                    Self::match_template(template, tokens, start, end, &mut reader)
                {
                    let callee = slots.remove("callee").and_then(Slot::name)?;
                    let arguments = match slots.remove("arguments") {
                        Some(Slot::Arguments(arguments)) => arguments,
                        _ => Vec::new(),
                    };
                    return Some(
                        Node::new("Call")
                            .with("callee", callee)
                            .with("arguments", arguments),
                    );
                }
            }
        }
        None
    }

    fn atom(&self, token: &Token) -> Option<Node> {
        match token.kind {
            Kind::Number => Some(number(token.number)),
            Kind::Text => Some(Node::new("Text").with("value", token.value.clone())),
            Kind::Word => {
                if token.folded == self.language.true_word.to_lowercase() {
                    return Some(Node::new("Boolean").with("value", true));
                }
                if token.folded == self.language.false_word.to_lowercase() {
                    return Some(Node::new("Boolean").with("value", false));
                }
                self.read_name(Some(token)).map(name)
            }
            _ => None,
        }
    }

    // ---- sentences ----

    fn names(&self, tokens: &[Token], start: usize, end: usize) -> Option<Vec<String>> {
        let mut result = Vec::new();
        let and_words: Vec<&str> = self
            .language
            .list_and
            .as_deref()
            .unwrap_or_default()
            .split(' ')
            .filter(|word| !word.is_empty())
            .collect();
        let mut index = start;
        while index < end {
            result.push(self.read_name(tokens.get(index))?);
            index += 1;
            if index == end {
                break;
            }
            if tokens[index].kind == Kind::Separator {
                index += 1;
            } else if !and_words.is_empty()
                && and_words.iter().enumerate().all(|(offset, word)| {
                    tokens
                        .get(index + offset)
                        .is_some_and(|token| token.folded == *word)
                })
            {
                index += and_words.len();
            } else {
                return None;
            }
            if index == end {
                return None;
            }
        }
        Some(result)
    }

    fn slot(&self, tokens: &[Token], slot: &str, from: usize, to: usize) -> Option<Slot> {
        if NAME_SLOTS.contains(&slot) {
            return if to - from == 1 {
                self.read_name(tokens.get(from)).map(Slot::Name)
            } else {
                None
            };
        }
        if slot == "parameters" {
            return self.names(tokens, from, to).map(Slot::Names);
        }
        self.expression(tokens, from, to, 0).map(Slot::Expression)
    }

    /// The first template among `keys` that matches the whole sentence.
    pub fn sentence(
        &self,
        text: &str,
        keys: &[&'static str],
    ) -> Result<Option<(&'static str, Captured)>, String> {
        let tokens = self.language.tokenize(text)?;
        self.memo.borrow_mut().clear();
        for key in keys {
            for template in self.language.variants(key) {
                let mut reader =
                    |slot: &str, from: usize, to: usize| self.slot(&tokens, slot, from, to);
                if let Some(slots) =
                    Self::match_template(template, &tokens, 0, tokens.len(), &mut reader)
                {
                    return Ok(Some((key, slots)));
                }
            }
        }
        Ok(None)
    }
}

fn expression_slot(slots: &mut Captured, name: &str) -> Option<Node> {
    slots.remove(name).and_then(Slot::expression)
}

fn name_slot(slots: &mut Captured, name: &str) -> String {
    slots.remove(name).and_then(Slot::name).unwrap_or_default()
}

fn statement_from_sentence(key: &str, mut slots: Captured) -> Option<Node> {
    let mut value = |name: &str| expression_slot(&mut slots, name);
    Some(match key {
        "print-line" | "print" => Node::new("Print")
            .with_opt("value", value("value"))
            .with("newline", key == "print-line"),
        "declare" => Node::new("Declaration")
            .with("name", name_slot(&mut slots, "name"))
            .with_opt("value", expression_slot(&mut slots, "value"))
            .with("mutable", true),
        "assign" => Node::new("Assignment")
            .with("name", name_slot(&mut slots, "name"))
            .with("operator", "=")
            .with_opt("value", expression_slot(&mut slots, "value")),
        "return-value" => Node::new("Return").with_opt("value", value("value")),
        "return" => Node::new("Return"),
        "evaluate" => Node::new("Evaluate").with_opt("expression", value("expression")),
        _ => return None,
    })
}

/// One line of text: depth, the sentence without its end mark, and whether
/// it opens a block.
struct Line {
    index: usize,
    depth: f64,
    note: Option<String>,
    text: String,
    opens_block: bool,
    blank: bool,
}

/// JavaScript's `trim` also removes the byte order mark.
fn is_space(character: char) -> bool {
    character.is_whitespace() || character == '\u{feff}'
}

fn note_pattern(language: &Language) -> Regex {
    let (before, after) = language
        .note
        .split_once("{text}")
        .unwrap_or((language.note.as_str(), ""));
    Regex::new(&format!(
        r"^{}\s*(.*?){}$",
        regex::escape(before.trim_matches(is_space)),
        regex::escape(after)
    ))
    .expect("note pattern")
}

fn read_lines(source: &str, language: &Language) -> Vec<Line> {
    let pattern = note_pattern(language);
    source
        .split('\n')
        .map(|raw| raw.strip_suffix('\r').unwrap_or(raw))
        .enumerate()
        .map(|(index, raw)| {
            let content = raw.trim_end_matches(is_space);
            let text = content.trim_start_matches(is_space);
            let indentation = content.chars().count() - text.chars().count();
            let depth = indentation as f64 / 2.0;
            if let Some(note) = pattern.captures(text) {
                return Line {
                    index,
                    depth,
                    note: Some(note[1].to_owned()),
                    text: text.to_owned(),
                    opens_block: false,
                    blank: false,
                };
            }
            let opens_block = text.ends_with(language.block_end.as_str());
            let end_mark = if opens_block {
                &language.block_end
            } else {
                &language.sentence_end
            };
            let sentence = text
                .strip_suffix(end_mark.as_str())
                .map_or(text, |sentence| sentence.trim_matches(is_space));
            Line {
                index,
                depth,
                note: None,
                text: sentence.to_owned(),
                opens_block,
                blank: text.is_empty(),
            }
        })
        .collect()
}

struct Paragraph {
    notes_only: bool,
    notes: Vec<String>,
    function: Option<Node>,
    statements: Vec<Node>,
}

fn comment(text: &str) -> Node {
    Node::new("Comment").with("text", text)
}

struct ProgramReader<'a> {
    language: &'a Language,
    sentences: SentenceReader<'a>,
    lines: Vec<Line>,
    position: usize,
}

impl ProgramReader<'_> {
    fn fail<T>(&self, line: &Line, message: &str) -> Result<T, String> {
        Err(format!(
            "{}, line {}: {message}: \"{}\"",
            self.language.label,
            line.index + 1,
            line.text
        ))
    }

    /// Statements at `depth` starting at `self.position`.
    fn block(&mut self, depth: f64) -> Result<Node, String> {
        let mut statements = Vec::new();
        while self.position < self.lines.len() {
            let line = &self.lines[self.position];
            if line.blank {
                if depth > 0.0 {
                    self.position += 1;
                    continue;
                }
                break;
            }
            if line.depth < depth {
                break;
            }
            if line.depth > depth {
                return self.fail(line, "Unexpected indentation");
            }
            self.position += 1;
            if let Some(note) = &line.note {
                statements.push(comment(note));
                continue;
            }
            if let Some(statement) = self.statement(self.position - 1, depth, &mut statements)? {
                statements.push(statement);
            }
        }
        Ok(block(statements))
    }

    fn statement(
        &mut self,
        index: usize,
        depth: f64,
        statements: &mut [Node],
    ) -> Result<Option<Node>, String> {
        let line = &self.lines[index];
        if !line.opens_block {
            return match self.sentences.sentence(&line.text, &STATEMENT_KEYS)? {
                None => self.fail(line, "No sentence template matches"),
                Some(("nothing", _)) => Ok(None),
                Some((key, slots)) => Ok(statement_from_sentence(key, slots)),
            };
        }
        let Some((key, mut slots)) = self.sentences.sentence(&line.text, &BLOCK_KEYS)? else {
            return self.fail(line, "No block template matches");
        };
        let body = self.block(depth + 1.0)?;
        let mut condition = || expression_slot(&mut slots, "condition");
        let conditional = |condition: Option<Node>, body: Node| {
            Node::new("If")
                .with_opt("condition", condition)
                .with("then", body)
        };
        match key {
            "if" => return Ok(Some(conditional(condition(), body))),
            "while" => {
                return Ok(Some(
                    Node::new("While")
                        .with_opt("condition", condition())
                        .with("body", body),
                ));
            }
            "for" => {
                let last = expression_slot(&mut slots, "last").unwrap_or_else(|| number(0.0));
                return Ok(Some(
                    Node::new("CountingLoop")
                        .with("variable", name_slot(&mut slots, "variable"))
                        .with_opt("start", expression_slot(&mut slots, "start"))
                        .with("end", add(last, number(1.0)))
                        .with("body", body),
                ));
            }
            _ => {}
        }
        // "Otherwise" continues the innermost open conditional before it.
        let line = &self.lines[index];
        let Some(mut open) = statements.last_mut().filter(|statement| statement.is("If")) else {
            return self.fail(line, "Otherwise without a condition before it");
        };
        while open
            .node("otherwise")
            .is_some_and(|otherwise| otherwise.is("If"))
        {
            open = match open.fields.get_mut("otherwise") {
                Some(Value::Node(otherwise)) => otherwise,
                _ => unreachable!("checked above"),
            };
        }
        if open.get("otherwise").is_some() {
            return self.fail(line, "A condition has two otherwise branches");
        }
        let otherwise = if key == "else-if" {
            conditional(condition(), body)
        } else {
            body
        };
        open.set("otherwise", otherwise);
        Ok(None)
    }

    fn read(mut self) -> Result<Node, String> {
        let mut comments = Vec::new();
        let mut functions = Vec::new();
        let mut main = Vec::new();
        let mut first = true;
        while self.position < self.lines.len() {
            if self.lines[self.position].blank {
                self.position += 1;
                continue;
            }
            let paragraph = self.paragraph()?;
            if first && paragraph.notes_only {
                comments = paragraph.notes;
            } else if let Some(function) = paragraph.function {
                functions.push(function);
            } else {
                main.extend(paragraph.statements);
            }
            first = false;
        }
        Ok(Node::new("Program")
            .with("comments", comments)
            .with("imports", Value::List(Vec::new()))
            .with("functions", functions)
            .with("main", block(main)))
    }

    fn paragraph(&mut self) -> Result<Paragraph, String> {
        let mut notes = Vec::new();
        while let Some(note) = self
            .lines
            .get(self.position)
            .and_then(|line| line.note.clone())
        {
            notes.push(note);
            self.position += 1;
        }
        let comments = |notes: &[String]| notes.iter().map(|text| comment(text)).collect();
        let Some(line) = self.lines.get(self.position).filter(|line| !line.blank) else {
            return Ok(Paragraph {
                notes_only: true,
                statements: comments(&notes),
                notes,
                function: None,
            });
        };
        let heading = if line.opens_block {
            self.sentences.sentence(&line.text, &FUNCTION_KEYS)?
        } else {
            None
        };
        if let Some((_, mut slots)) = heading.filter(|_| line.depth == 0.0) {
            self.position += 1;
            let body = self.block(1.0)?;
            let parameters: Vec<Node> = match slots.remove("parameters") {
                Some(Slot::Names(names)) => names
                    .into_iter()
                    .map(|parameter| Node::new("Parameter").with("name", parameter))
                    .collect(),
                _ => Vec::new(),
            };
            let function = Node::new("Function")
                .with("name", name_slot(&mut slots, "name"))
                .with("parameters", parameters)
                .with("body", body)
                .with("comments", notes);
            return Ok(Paragraph {
                notes_only: false,
                notes: Vec::new(),
                function: Some(function),
                statements: Vec::new(),
            });
        }
        let mut statements: Vec<Node> = comments(&notes);
        statements.extend(self.block(0.0)?.node_list("statements"));
        Ok(Paragraph {
            notes_only: false,
            notes,
            function: None,
            statements,
        })
    }
}

/// A program written in a controlled natural language, as a meta program.
pub fn read_natural(source: &str, id: &str) -> Result<Node, String> {
    let language = natural_language(id)?;
    ProgramReader {
        language,
        sentences: SentenceReader::new(language),
        lines: read_lines(source, language),
        position: 0,
    }
    .read()
}
