//! Expression precedence shared by the writer and the reader, lowest first.
//!
//! A level lists the templates that build an expression at that level and
//! how their operands bind:
//!
//! ```text
//!   left      left-associative binary: {left} at this level, {right} above
//!   none      non-associative binary: both operands one level above
//!   prefix    unary: {operand} at this same level
//! ```

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Associativity {
    Left,
    None,
    Prefix,
}

pub struct Level {
    pub name: &'static str,
    pub templates: &'static [&'static str],
    pub associativity: Associativity,
}

pub const LEVELS: [Level; 9] = [
    Level {
        name: "join",
        templates: &["join"],
        associativity: Associativity::Left,
    },
    Level {
        name: "or",
        templates: &["or"],
        associativity: Associativity::Left,
    },
    Level {
        name: "and",
        templates: &["and"],
        associativity: Associativity::Left,
    },
    Level {
        name: "not",
        templates: &["not"],
        associativity: Associativity::Prefix,
    },
    Level {
        name: "comparison",
        templates: &[
            "equal",
            "not-equal",
            "less",
            "less-or-equal",
            "greater",
            "greater-or-equal",
        ],
        associativity: Associativity::None,
    },
    Level {
        name: "additive",
        templates: &["add", "subtract"],
        associativity: Associativity::Left,
    },
    Level {
        name: "multiplicative",
        templates: &["multiply", "divide", "remainder"],
        associativity: Associativity::Left,
    },
    Level {
        name: "negate",
        templates: &["negate"],
        associativity: Associativity::Prefix,
    },
    Level {
        name: "primary",
        templates: &[],
        associativity: Associativity::None,
    },
];

/// The index of the level named `name`.
pub fn level_index(name: &str) -> usize {
    LEVELS
        .iter()
        .position(|level| level.name == name)
        .unwrap_or(LEVELS.len() - 1)
}

/// The index of the level whose templates include `key`.
pub fn level_of_template(key: &str) -> Option<usize> {
    LEVELS
        .iter()
        .position(|level| level.templates.contains(&key))
}

const BINARY: [(&str, &str); 13] = [
    ("or", "or"),
    ("and", "and"),
    ("equal", "equal"),
    ("notEqual", "not-equal"),
    ("less", "less"),
    ("lessOrEqual", "less-or-equal"),
    ("greater", "greater"),
    ("greaterOrEqual", "greater-or-equal"),
    ("add", "add"),
    ("subtract", "subtract"),
    ("multiply", "multiply"),
    ("divide", "divide"),
    ("remainder", "remainder"),
];

const UNARY: [(&str, &str); 2] = [("not", "not"), ("negate", "negate")];

/// Meta binary operator -> template key.
pub fn binary_template(operator: &str) -> Option<&'static str> {
    BINARY
        .iter()
        .find(|(name, _)| *name == operator)
        .map(|(_, key)| *key)
}

/// Meta unary operator -> template key.
pub fn unary_template(operator: &str) -> Option<&'static str> {
    UNARY
        .iter()
        .find(|(name, _)| *name == operator)
        .map(|(_, key)| *key)
}

/// Template key -> meta operator.
pub fn operator_of_template(key: &str) -> Option<&'static str> {
    BINARY
        .iter()
        .chain(UNARY.iter())
        .find(|(_, template)| *template == key)
        .map(|(operator, _)| *operator)
}
