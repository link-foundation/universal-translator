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

use super::agreement::{normalize, slot_case};
use super::catalog::{Language, natural_language};
use super::levels::{Associativity, LEVELS, level_index, operator_of_template};
use super::lines::{note_pattern, sentence_lines};
use super::tokens::{Kind, Token};
use crate::meta::for_each::raise_for_each;
use crate::meta::questions::ASPECTS;
use crate::meta::{Node, Value, add, binary, block, name, number};

const NAME_SLOTS: [&str; 3] = ["name", "variable", "callee"];
/// Slots the writer fills with a primary expression (parenthesized unless it
/// is one already).
const PRIMARY_SLOTS: [&str; 4] = ["index", "array", "length", "fill"];
const ARRAY_KEYS: [&str; 4] = ["array", "new-array", "element", "length"];

const STATEMENT_KEYS: [&str; 18] = [
    "question-query",
    "question-deferred-query",
    "question-type",
    "question-documentation",
    "question-source",
    "question-details",
    "documentation",
    "print-line",
    "print",
    "set-element",
    "declare",
    "assign",
    "increase",
    "decrease",
    "return-value",
    "return",
    "nothing",
    "evaluate",
];
const BLOCK_KEYS: [&str; 6] = ["else-if", "else", "if", "while", "for", "for-each"];
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
            self.slot_expression(tokens, from, to, slot_level(slot), key, slot)
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
        // A contextual reflection phrase takes priority over a bare callee spelling.
        for aspect in ASPECTS {
            for template in self.language.variants(&format!("answer-{aspect}")) {
                let mut reader = |_slot: &str, from: usize, to: usize| {
                    self.expression(tokens, from, to, 0).map(Slot::Expression)
                };
                if let Some(mut slots) =
                    Self::match_template(template, tokens, start, end, &mut reader)
                {
                    return Some(
                        Node::new("Question")
                            .with("aspect", aspect)
                            .with("subject", expression_slot(&mut slots, "subject")?),
                    );
                }
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
        for key in super::collection_templates::KEYS {
            for template in self.language.variants(key) {
                let mut reader =
                    |slot: &str, from: usize, to: usize| self.slot(tokens, slot, from, to);
                if let Some(slots) = Self::match_template(template, tokens, start, end, &mut reader)
                {
                    return collection_node(key, slots);
                }
            }
        }
        for key in ARRAY_KEYS {
            for template in self.language.variants(key) {
                let mut reader =
                    |slot: &str, from: usize, to: usize| self.slot(tokens, slot, from, to);
                if let Some(slots) = Self::match_template(template, tokens, start, end, &mut reader)
                {
                    return array_node(key, slots);
                }
            }
        }
        for key in ["answer-query", "answer-deferred-query"] {
            for template in self.language.variants(key) {
                let mut reader =
                    |slot: &str, from: usize, to: usize| self.slot(tokens, slot, from, to);
                if let Some(slots) = Self::match_template(template, tokens, start, end, &mut reader)
                {
                    return query_node(key, slots);
                }
            }
        }
        None
    }

    fn atom(&self, token: &Token) -> Option<Node> {
        match token.kind {
            Kind::Number if token.real => Some(number(token.number).with("type", "real")),
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

    fn slot_expression(
        &self,
        tokens: &[Token],
        from: usize,
        to: usize,
        level: usize,
        key: &str,
        slot: &str,
    ) -> Option<Node> {
        let expression = self.expression(tokens, from, to, level);
        let Some(case) = slot_case(self.language, key, slot) else {
            return expression;
        };
        if expression
            .as_ref()
            .is_some_and(|value| !value.is("Name") && !value.is("Boolean"))
        {
            return expression;
        }
        let normalized = normalize(&tokens[from..to], self.language, &case);
        Self::new(self.language).expression(&normalized, 0, normalized.len(), level)
    }

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
        self.slot_for(tokens, slot, from, to, "")
    }

    fn slot_for(
        &self,
        tokens: &[Token],
        slot: &str,
        from: usize,
        to: usize,
        key: &str,
    ) -> Option<Slot> {
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
        if slot == "elements" {
            return self.arguments(tokens, from, to).map(Slot::Arguments);
        }
        if PRIMARY_SLOTS.contains(&slot) {
            return self
                .expression(tokens, from, to, level_index("primary"))
                .map(Slot::Expression);
        }
        self.slot_expression(tokens, from, to, 0, key, slot)
            .map(Slot::Expression)
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
                let mut reader = |slot: &str, from: usize, to: usize| {
                    self.slot_for(&tokens, slot, from, to, key)
                };
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

fn collection_node(key: &str, mut slots: Captured) -> Option<Node> {
    Some(match key {
        "sql-null" => Node::new("Null"),
        "sql-truth" => {
            Node::new("SqlTruth").with("operand", expression_slot(&mut slots, "operand")?)
        }
        "sql-between" => Node::new("SqlBetween")
            .with("value", expression_slot(&mut slots, "value")?)
            .with("lower", expression_slot(&mut slots, "lower")?)
            .with("upper", expression_slot(&mut slots, "upper")?),
        "sql-in" => {
            let choices = expression_slot(&mut slots, "choices")?;
            if !choices.is("ArrayLiteral") {
                return None;
            }
            Node::new("SqlIn")
                .with("value", expression_slot(&mut slots, "value")?)
                .with("choices", choices)
        }
        "sql-unary" => {
            let operator = expression_slot(&mut slots, "operator")?;
            if !operator.is("Text") || !crate::meta::sql_values::unary(operator.str("value")?) {
                return None;
            }
            Node::new("SqlUnary")
                .with("operator", operator.str("value")?)
                .with("operand", expression_slot(&mut slots, "operand")?)
        }
        "sql-binary" => {
            let operator = expression_slot(&mut slots, "operator")?;
            if !operator.is("Text") || !crate::meta::sql_values::binary(operator.str("value")?) {
                return None;
            }
            Node::new("SqlBinary")
                .with("operator", operator.str("value")?)
                .with("left", expression_slot(&mut slots, "left")?)
                .with("right", expression_slot(&mut slots, "right")?)
        }
        "process-arguments" => {
            let include = expression_slot(&mut slots, "includeProgram")?;
            Node::new("ProcessArguments").with("includeProgram", include.flag("value")?)
        }
        "objpak-string-set" => Node::new("SetLiteral")
            .with("elements", Vec::<Node>::new())
            .with("order", "objpak-string"),
        "set-insert" => Node::new("SetInsert")
            .with("collection", expression_slot(&mut slots, "collection")?)
            .with("value", expression_slot(&mut slots, "value")?),
        "prefix-update" | "postfix-update" => {
            let operand = expression_slot(&mut slots, "operand")?;
            let delta = expression_slot(&mut slots, "delta")?.number("value")?;
            if !operand.is("Name") || !matches!(delta, -1.0 | 1.0) {
                return None;
            }
            Node::new("Update")
                .with("operand", operand)
                .with("delta", delta)
                .with("prefix", key == "prefix-update")
        }
        _ => return None,
    })
}

fn name_slot(slots: &mut Captured, name: &str) -> String {
    slots.remove(name).and_then(Slot::name).unwrap_or_default()
}

/// The node of a matched array template. A new array of no elements is the
/// empty array literal.
fn array_node(key: &str, mut slots: Captured) -> Option<Node> {
    let mut value = |name: &str| expression_slot(&mut slots, name);
    Some(match key {
        "array" => {
            let elements = match slots.remove("elements") {
                Some(Slot::Arguments(elements)) => elements,
                _ => return None,
            };
            Node::new("ArrayLiteral").with("elements", elements)
        }
        "new-array" => {
            let length = value("length")?;
            if length.is("Number") && length.number("value") == Some(0.0) {
                Node::new("ArrayLiteral").with("elements", Vec::<Node>::new())
            } else {
                Node::new("NewArray")
                    .with("length", length)
                    .with("fill", value("fill")?)
            }
        }
        "element" => {
            let index = value("index")?;
            Node::new("Index")
                .with("array", value("array")?)
                .with("index", index)
        }
        _ => Node::new("Length").with("array", value("array")?),
    })
}

fn query_node(key: &str, mut slots: Captured) -> Option<Node> {
    let source = expression_slot(&mut slots, "source")?;
    let variable = name_slot(&mut slots, "variable");
    let condition = expression_slot(&mut slots, "condition")?;
    let projection = expression_slot(&mut slots, "projection")?;
    Some(crate::meta::queries::query(
        source,
        &variable,
        projection,
        Some(condition),
        !key.contains("deferred"),
    ))
}

fn statement_from_sentence(key: &str, mut slots: Captured) -> Option<Node> {
    if crate::meta::queries::KEYS.contains(&key) {
        return Some(Node::new("Evaluate").with("expression", query_node(key, slots)?));
    }
    if let Some(aspect) = key
        .strip_prefix("question-")
        .filter(|aspect| ASPECTS.contains(aspect))
    {
        return Some(
            Node::new("Evaluate").with(
                "expression",
                Node::new("Question")
                    .with("aspect", aspect)
                    .with("subject", expression_slot(&mut slots, "subject")?),
            ),
        );
    }
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
        "increase" | "decrease" => {
            let variable = name_slot(&mut slots, "name");
            let operator = if key == "increase" { "add" } else { "subtract" };
            Node::new("Assignment")
                .with("name", variable.clone())
                .with("operator", "=")
                .with_opt(
                    "value",
                    expression_slot(&mut slots, "value")
                        .map(|amount| binary(operator, name(variable), amount)),
                )
        }
        "set-element" => Node::new("IndexAssignment")
            .with("name", name_slot(&mut slots, "name"))
            .with_opt("index", expression_slot(&mut slots, "index"))
            .with_opt("value", expression_slot(&mut slots, "value")),
        "return-value" => Node::new("Return").with_opt("value", value("value")),
        "return" => Node::new("Return"),
        "evaluate" => Node::new("Evaluate").with_opt("expression", value("expression")),
        "documentation" => {
            let documentation = value("value");
            if !documentation.as_ref().is_some_and(|value| value.is("Text")) {
                return None;
            }
            Node::new("Documentation").with_opt("value", documentation)
        }
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
    /// Text without the sentence or block end mark.
    unmarked: bool,
    blank: bool,
}

/// JavaScript's `trim` also removes the byte order mark.
fn is_space(character: char) -> bool {
    character.is_whitespace() || character == '\u{feff}'
}

/// A heading written without its end mark ("While n is less than 3, do
/// this") still opens a block when the lines after it are indented deeper.
fn mark_headings(mut lines: Vec<Line>) -> Vec<Line> {
    for position in 0..lines.len() {
        if lines[position].unmarked {
            let depth = lines[position].depth;
            lines[position].opens_block = lines[position + 1..]
                .iter()
                .find(|other| !other.blank)
                .is_some_and(|next| next.depth > depth);
        }
    }
    lines
}

fn read_lines(source: &str, language: &Language) -> Vec<Line> {
    let pattern = note_pattern(language);
    let lines = sentence_lines(source, language)
        .into_iter()
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
                    unmarked: false,
                    blank: false,
                };
            }
            let opens_block = text.ends_with(language.block_end.as_str());
            let end_mark = if opens_block {
                language.block_end.as_str()
            } else if text.ends_with('?') {
                "?"
            } else {
                language.sentence_end.as_str()
            };
            let sentence = text
                .strip_suffix(end_mark)
                .map_or(text, |sentence| sentence.trim_matches(is_space));
            Line {
                index,
                depth,
                note: None,
                text: sentence.to_owned(),
                opens_block,
                unmarked: !text.is_empty() && !text.ends_with(end_mark),
                blank: text.is_empty(),
            }
        })
        .collect();
    mark_headings(lines)
}

struct Paragraph {
    notes_only: bool,
    notes: Vec<Node>,
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
    source: crate::source_origins::SourceLocator,
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
                statements.push(self.source.at_line(comment(note), line.index));
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
        let line = self.lines[index].index;
        let result = self.statement_inner(index, depth, statements)?;
        Ok(result.map(|node| self.source.at_line(node, line)))
    }

    fn statement_inner(
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
                Some((key, slots)) => match statement_from_sentence(key, slots) {
                    Some(statement) => Ok(Some(statement)),
                    None => self.fail(line, "Invalid sentence value"),
                },
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
            "for-each" => {
                return Ok(Some(
                    Node::new("ForEach")
                        .with("variable", name_slot(&mut slots, "variable"))
                        .with_opt("array", expression_slot(&mut slots, "array"))
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
        open.set("otherwise", self.source.at_line(otherwise, line.index));
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
        Ok(crate::source_origins::attach_comments(
            Node::new("Program")
                .with("imports", Value::List(Vec::new()))
                .with("functions", functions)
                .with("main", block(main)),
            "comments",
            &comments,
        ))
    }

    fn paragraph(&mut self) -> Result<Paragraph, String> {
        let mut notes = Vec::new();
        while let Some(note) = self
            .lines
            .get(self.position)
            .and_then(|line| line.note.clone())
        {
            notes.push(
                self.source
                    .at_line(comment(&note), self.lines[self.position].index),
            );
            self.position += 1;
        }

        let Some(line) = self.lines.get(self.position).filter(|line| !line.blank) else {
            return Ok(Paragraph {
                notes_only: true,
                statements: notes.clone(),
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
            let heading_line = line.index;
            self.position += 1;
            let mut body = self.block(1.0)?;
            let mut statements = body.node_list("statements");
            let documentation = if statements
                .first()
                .is_some_and(|item| item.is("Documentation"))
            {
                statements.remove(0).node("value").cloned()
            } else {
                None
            };
            body.set("statements", statements);
            let parameters: Vec<Node> = match slots.remove("parameters") {
                Some(Slot::Names(names)) => names
                    .into_iter()
                    .map(|parameter| Node::new("Parameter").with("name", parameter))
                    .collect(),
                _ => Vec::new(),
            };
            let function = crate::source_origins::attach_comments(
                self.source.at_line(
                    Node::new("Function")
                        .with("name", name_slot(&mut slots, "name"))
                        .with("parameters", parameters)
                        .with_opt("documentation", documentation)
                        .with("body", body),
                    heading_line,
                ),
                "comments",
                &notes,
            );
            return Ok(Paragraph {
                notes_only: false,
                notes: Vec::new(),
                function: Some(function),
                statements: Vec::new(),
            });
        }
        let mut statements: Vec<Node> = notes.clone();
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
    read_natural_with(source, natural_language(id)?)
}

/// [`read_natural`] with a compiled language, such as one with more
/// template variants (see [`super::catalog::with_templates`]).
pub fn read_natural_with(source: &str, language: &Language) -> Result<Node, String> {
    if !source.trim().contains('\n') {
        let tokens = super::tokens::tokenize(source.trim(), &language.spelling(), false)?;
        if tokens.len() == 1
            && let Some(expression) =
                SentenceReader::new(language).expression(&tokens, 0, tokens.len(), 0)
            && (!expression.is("Name")
                || source
                    .trim()
                    .chars()
                    .next()
                    .is_some_and(char::is_alphabetic))
        {
            return Ok(Node::new("Program")
                .with("comments", Value::List(Vec::new()))
                .with("imports", Value::List(Vec::new()))
                .with("functions", Value::List(Vec::new()))
                .with(
                    "main",
                    block(vec![
                        crate::source_origins::SourceLocator::new(source).at_line(
                            Node::new("Evaluate").with("expression", expression),
                            source
                                .chars()
                                .take_while(|c| c.is_whitespace())
                                .filter(|c| *c == '\n')
                                .count(),
                        ),
                    ]),
                ));
        }
    }
    // A language without a for-each sentence writes the counting loop over an
    // index; it is read back as the loop over the elements it stands for.
    ProgramReader {
        language,
        sentences: SentenceReader::new(language),
        lines: read_lines(source, language),
        position: 0,
        source: crate::source_origins::SourceLocator::new(source),
    }
    .read()
    .and_then(|program| {
        let mut orphan = false;
        crate::meta::walk(&program, |current| {
            orphan |= current.is("Documentation");
        });
        if orphan {
            Err("Documentation must begin a function definition".into())
        } else {
            Ok(raise_for_each(program))
        }
    })
}
