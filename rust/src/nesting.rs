//! Nested grammars: a text of one language inside a text of another.
//!
//! A program holds natural language in its comments and strings, a string
//! may hold code of another language, and prose may quote code between
//! backticks. [`nest_grammars`] reads each of them with the grammar it is
//! written in and keeps the reading next to the text:
//!
//! ```text
//!   comment 'Prints `x + 1`'
//!     prose english
//!       sentence
//!         word Prints (concept print) (part verb)
//!         code javascript
//!           ...the statements of x + 1
//! ```
//!
//! A string reads as code when the grammar of the program, or else the
//! likeliest programming language, reads all of it; otherwise as prose.
//!
//! The comments a program, a function or an import keeps as a list of
//! strings become comment nodes, read the same way.
//!
//! A long text (more than [`LONGEST_INLINE_TEXT`] words) is written once, in
//! the `texts` of the program, under an id; the comment, and every string
//! equal to it, refers to it by that id. The ids follow the texts in the
//! order of the field names of the tree. [`unnest`] puts the texts back and
//! drops the readings, so a nested program translates like the plain one.
//! The JavaScript twin is js/src/translation/nesting.js.

use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;

use crate::meta::tree::{Node, Value, rewrite};
use crate::natural::prose_reading::read_prose;
use crate::natural::words_of;
use crate::translator::Translator;

/// The most words a comment or a string keeps in its place.
pub const LONGEST_INLINE_TEXT: usize = 12;

static CODE_LIKE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[(){}\[\];=]").expect("code-like characters"));

/// The field holding the text of a node: a comment's text, a string's value.
fn text_field(kind: &str) -> Option<&'static str> {
    match kind {
        "Comment" => Some("text"),
        "Text" => Some("value"),
        _ => None,
    }
}

/// The fields that hold the comments of a program, a function or an import
/// as plain strings; the nested program holds them as comment nodes.
const COMMENT_LISTS: [&str; 2] = ["comments", "mainComments"];

fn filled(value: &Value) -> Option<&str> {
    value.as_str().filter(|text| !text.trim().is_empty())
}

fn text_of(node: &Node) -> Option<String> {
    filled(node.get(text_field(&node.kind)?)?).map(str::to_owned)
}

/// The texts of a tree, its fields taken in the order of their names.
fn texts_of(value: &Value, found: &mut Vec<String>) {
    match value {
        Value::List(items) => items.iter().for_each(|item| texts_of(item, found)),
        Value::Node(node) => {
            found.extend(text_of(node));
            for (field, value) in &node.fields {
                if COMMENT_LISTS.contains(&field.as_str())
                    && let Value::List(items) = value
                {
                    found.extend(items.iter().filter_map(filled).map(str::to_owned));
                }
                texts_of(value, found);
            }
        }
        _ => {}
    }
}

/// A node with its comment lists changed item by item.
fn with_comment_lists(mut node: Node, change: impl Fn(Value) -> Value) -> Node {
    for field in COMMENT_LISTS {
        if let Some(Value::List(items)) = node.fields.get_mut(field) {
            *items = std::mem::take(items).into_iter().map(&change).collect();
        }
    }
    node
}

/// Quoted code is code; a string is code only when it looks like it.
fn read_code(text: &str, quoted: bool, language: &str, translator: &Translator) -> Option<Node> {
    if !quoted && !CODE_LIKE.is_match(text) {
        return None;
    }
    let mut candidates = vec![language.to_owned()];
    for detection in translator.detect_language(text, 3) {
        if !detection.natural && detection.reads && !candidates.contains(&detection.id) {
            candidates.push(detection.id);
        }
    }
    candidates.into_iter().find_map(|id| {
        let fragment = translator.parse_fragment(text, &id).ok()?;
        Some(
            Node::new("Code")
                .with("language", id.as_str())
                .with("program", fragment.program),
        )
    })
}

/// Read the comments and strings of a meta program with the grammars they
/// are written in.
pub fn nest_grammars(program: &Node, language: &str, translator: &Translator) -> Node {
    let quoted = |text: &str| read_code(text, true, language, translator);
    let reading = |text: &str, string: bool| {
        let code = if string {
            read_code(text, false, language, translator)
        } else {
            None
        };
        code.or_else(|| read_prose(text, None, &quoted))
    };
    let long = |text: &str| words_of(text).len() > LONGEST_INLINE_TEXT;

    let mut texts: Vec<Node> = Vec::new();
    let mut ids: HashMap<String, String> = HashMap::new();
    let mut found = Vec::new();
    texts_of(&Value::Node(program.clone()), &mut found);
    for text in found.into_iter().filter(|text| long(text)) {
        if ids.contains_key(&text) {
            continue;
        }
        let id = format!("text-{}", texts.len() + 1);
        let paragraph = Node::new("Paragraph")
            .with("id", id.as_str())
            .with("text", text.as_str())
            .with_opt("reading", reading(&text, false));
        texts.push(paragraph);
        ids.insert(text, id);
    }

    let nest_text = |mut node: Node| {
        let Some(text) = text_of(&node) else {
            return node;
        };
        if let Some(id) = ids.get(&text) {
            if let Some(field) = text_field(&node.kind) {
                node.remove(field);
            }
            return node.with("reference", id.as_str());
        }
        let found = reading(&text, node.is("Text"));
        node.with_opt("reading", found)
    };
    let nested = rewrite(program.clone(), |node| {
        let node = with_comment_lists(node, |item| match filled(&item) {
            Some(text) => Value::Node(nest_text(Node::new("Comment").with("text", text))),
            None => item,
        });
        nest_text(node)
    });
    if texts.is_empty() || !nested.is("Program") {
        return nested;
    }
    nested.with(
        "texts",
        Value::List(texts.into_iter().map(Value::Node).collect()),
    )
}

/// The plain program of a nested one: every text in its place, no readings.
pub fn unnest(program: &Node) -> Node {
    let texts: HashMap<String, String> = program
        .nodes("texts")
        .into_iter()
        .filter_map(|entry| Some((entry.str("id")?.to_owned(), entry.str("text")?.to_owned())))
        .collect();
    let mut plain = rewrite(program.clone(), |mut node| {
        node.remove("reading");
        if let Some(Value::Text(id)) = node.remove("reference")
            && let Some(field) = text_field(&node.kind)
            && let Some(text) = texts.get(&id)
        {
            node.set(field, text.as_str());
        }
        with_comment_lists(node, |item| match item {
            Value::Node(comment) if comment.is("Comment") => comment
                .get("text")
                .cloned()
                .unwrap_or(Value::Text(String::new())),
            item => item,
        })
    });
    if plain.is("Program") {
        plain.remove("texts");
    }
    plain
}
