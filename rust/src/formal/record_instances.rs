use std::collections::{HashMap, HashSet};

use super::languages::{Syntax, language_syntax};
use super::lexer::{Token, TokenType, tokenize};
use super::names::neutral_name;
use crate::meta::{Node, Settings};
use crate::source_origins::inherit;

pub(super) fn literal_type(value: &Node) -> Option<&'static str> {
    match value.kind.as_str() {
        "Text" if value.str("value").is_some() => Some("text"),
        "Boolean" if value.flag("value").is_some() => Some("boolean"),
        "Number" if value.str("type") != Some("real") => value
            .number("value")
            .filter(|value| {
                value.fract() == 0.0
                    && (f64::from(i32::MIN)..=f64::from(i32::MAX)).contains(value)
                    && !(*value == 0.0 && value.is_sign_negative())
            })
            .map(|_| "integer"),
        _ => None,
    }
}

fn supported_text(token: &Token) -> bool {
    if token.kind != TokenType::Text {
        return true;
    }
    let mut characters = token.value.chars();
    while let Some(character) = characters.next() {
        if character == '\\' {
            match characters.next() {
                Some('x') => return false,
                Some('u') if characters.next() != Some('{') => return false,
                _ => {}
            }
        }
    }
    true
}

fn preserves_source(statement: &Node, syntax: &Syntax, may_format: bool) -> bool {
    if matches!(statement.kind.as_str(), "Comment" | "Blank") {
        return true;
    }
    let Some(source) = statement.origin.as_ref().and_then(|origin| {
        let start = origin.spans.first()?.0;
        let end = origin.spans.last()?.1;
        origin.source.get(start..end)
    }) else {
        return false;
    };
    let Ok(tokens) = tokenize(source, syntax) else {
        return false;
    };
    if !tokens.iter().all(supported_text) {
        return false;
    }
    let rust = syntax.id == "rust";
    if rust
        && !tokens.iter().enumerate().all(|(index, token)| {
            token.kind != TokenType::Name
                || token.value != "as"
                || (index
                    .checked_sub(1)
                    .and_then(|index| tokens.get(index))
                    .is_some_and(|previous| previous.kind == TokenType::Number)
                    && tokens
                        .get(index + 1)
                        .is_some_and(|next| next.value == "i64"))
        })
    {
        return false;
    }
    if !statement.is("Print") {
        return true;
    }
    let [name, second, third, fourth, ..] = tokens.as_slice() else {
        return false;
    };
    if !rust {
        return name.value == "console"
            && second.value == "."
            && third.value == "log"
            && fourth.value == "("
            && (!may_format || !has_multiple_arguments(&tokens[4..]));
    }
    matches!(name.value.as_str(), "print!" | "println!")
        && second.value == "("
        && third.kind == TokenType::Text
        && standard_format(&third.value)
}

fn has_multiple_arguments(tokens: &[Token]) -> bool {
    let mut depth = 0;
    for token in tokens
        .iter()
        .filter(|token| token.kind == TokenType::Symbol)
    {
        match token.value.as_str() {
            "," if depth == 0 => return true,
            "(" | "[" | "{" => depth += 1,
            ")" | "]" | "}" => depth -= 1,
            _ => {}
        }
    }
    false
}

fn standard_format(written: &str) -> bool {
    let mut characters = written.chars();
    while let Some(current) = characters.next() {
        match current {
            '{' if !matches!(characters.next(), Some('{' | '}')) => return false,
            '}' if characters.next() != Some('}') => return false,
            _ => {}
        }
    }
    true
}

// Bind and consume only scalar literals and reads in the same linear scope.
struct RecordScope<'a> {
    constructors: HashMap<String, &'a Node>,
    names: HashSet<String>,
    records: HashMap<String, HashMap<String, &'static str>>,
    scalars: HashSet<String>,
    rust: bool,
}

impl<'a> RecordScope<'a> {
    fn new(definitions: Vec<&'a Node>, rust: bool) -> Self {
        let mut names = HashSet::from(["console".to_owned()]);
        let mut constructors = HashMap::new();
        for definition in definitions {
            let name = definition.str("name").unwrap_or_default();
            let constructor = if rust {
                format!("{name}::new")
            } else {
                format!("new {name}")
            };
            constructors.insert(constructor, definition);
            names.insert(neutral_name(name));
        }
        Self {
            constructors,
            names,
            records: HashMap::new(),
            scalars: HashSet::new(),
            rust,
        }
    }

    fn scalar(&self, value: &Node) -> Option<Node> {
        if literal_type(value).is_some() {
            return Some(value.clone());
        }
        if value.is("Interpolation") {
            let parts = value
                .nodes("parts")
                .into_iter()
                .map(|part| self.scalar(part))
                .collect::<Option<Vec<_>>>()?;
            return Some(value.clone().with("parts", parts));
        }
        let name = value.str("name").filter(|_| value.is("Name"))?;
        if self.scalars.contains(name) {
            return Some(value.clone());
        }
        let (receiver, property) = name.split_once('.')?;
        let kind = *self.records.get(receiver)?.get(property)?;
        let object = inherit(Node::new("Name").with("name", receiver), value);
        Some(inherit(
            Node::new("RecordFieldRead")
                .with("object", object)
                .with("property", property)
                .with("type", kind),
            value,
        ))
    }

    fn construct(&mut self, name: &str, value: &Node) -> Option<Node> {
        let definition = *self.constructors.get(value.str("callee")?)?;
        if !self.rust {
            let definition_end = definition.origin.as_ref()?.spans.last()?.1;
            let call_start = value.origin.as_ref()?.spans.first()?.0;
            if definition_end > call_start {
                return None;
            }
        }
        let parameters = definition.texts("parameters");
        let arguments = value.node_list("arguments");
        if parameters.len() != arguments.len() {
            return None;
        }
        let types: HashMap<_, _> = parameters
            .iter()
            .map(String::as_str)
            .zip(arguments.iter().map(literal_type))
            .collect();
        if types.values().any(Option::is_none) {
            return None;
        }
        let fields = definition
            .nodes("fields")
            .into_iter()
            .map(|field| {
                let property = field.str("name")?.to_owned();
                let kind = (*types.get(field.str("parameter")?)?)?;
                Some((property, kind))
            })
            .collect::<Option<HashMap<_, _>>>()?;
        self.records.insert(name.to_owned(), fields);
        Some(inherit(
            Node::new("RecordConstruction")
                .with("record", definition.str("name")?)
                .with("arguments", arguments),
            value,
        ))
    }

    fn statement(&mut self, statement: &Node) -> Option<Node> {
        if matches!(statement.kind.as_str(), "Comment" | "Blank") {
            return Some(statement.clone());
        }
        let value = statement.node("value")?;
        if statement.is("Print") {
            return Some(statement.clone().with("value", self.scalar(value)?));
        }
        let name = statement
            .str("name")
            .filter(|_| statement.is("Declaration"))?;
        if statement.flag("mutable") == Some(true) || !self.names.insert(neutral_name(name)) {
            return None;
        }
        let next = if value.is("Call") {
            self.construct(name, value)?
        } else {
            let scalar = self.scalar(value)?;
            self.scalars.insert(name.to_owned());
            scalar
        };
        Some(statement.clone().with("value", next))
    }
}

pub(super) fn recognize(program: Node, settings: &Settings) -> Node {
    let definitions = program.nodes("definitions");
    if definitions.is_empty()
        || !program.nodes("functions").is_empty()
        || !program.texts("imports").is_empty()
    {
        return program;
    }
    let Ok(syntax) = language_syntax(&settings.from) else {
        return program;
    };
    let rust = syntax.id == "rust";
    if !rust
        && (program.get("mainComments").is_some()
            || definitions
                .iter()
                .any(|definition| definition.str("name") == Some("console")))
    {
        return program;
    }
    let Some(main) = program.node("main") else {
        return program;
    };
    let original = main.nodes("statements");
    let mut scope = RecordScope::new(definitions, rust);
    if !original.iter().any(|statement| {
        statement.node("value").is_some_and(|value| {
            value.is("Call")
                && value
                    .str("callee")
                    .is_some_and(|name| scope.constructors.contains_key(name))
        })
    }) {
        return program;
    }
    let may_format = !rust
        && original
            .iter()
            .find_map(|item| item.origin.as_ref())
            .is_some_and(|origin| {
                origin.source.contains('%')
                    || origin.source.contains("\\x")
                    || origin.source.contains("\\u")
            });
    let mut statements = Vec::with_capacity(original.len());
    for statement in original {
        if !preserves_source(statement, &syntax, may_format) {
            return program;
        }
        let Some(next) = scope.statement(statement) else {
            return program;
        };
        statements.push(next);
    }
    let main = main.clone().with("statements", statements);
    program.with("main", main)
}
