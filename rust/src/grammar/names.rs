//! Identifier naming. The meta language stores each name the program
//! declares as neutral lower-case words joined by "-" (for example
//! "greatest-common-divisor"); every language description states how it
//! spells such words. Names the program does not declare (library
//! procedures) are left exactly as written.

use std::collections::HashSet;
use std::sync::OnceLock;

use regex::Regex;

use super::languages::{Convention, Role};
use super::meta::{Node, rewrite, walk};

/// The words of an identifier: "greatestCommonDivisor",
/// "greatest_common_divisor" and "GreatestCommonDivisor" all become
/// `["greatest", "common", "divisor"]`.
pub fn name_words(identifier: &str) -> Vec<String> {
    static BOUNDARIES: OnceLock<[Regex; 2]> = OnceLock::new();
    let [lower_then_capital, acronym_end] = BOUNDARIES.get_or_init(|| {
        [
            Regex::new("([a-z0-9])([A-Z])").expect("valid pattern"),
            Regex::new("([A-Z])([A-Z][a-z])").expect("valid pattern"),
        ]
    });
    let spaced = lower_then_capital.replace_all(identifier, "${1} ${2}");
    let spaced = acronym_end.replace_all(&spaced, "${1} ${2}");
    spaced
        .split(|c: char| c.is_whitespace() || c == '_')
        .filter(|word| !word.is_empty())
        .map(str::to_lowercase)
        .collect()
}

fn capitalize(word: &str) -> String {
    let mut characters = word.chars();
    match characters.next() {
        Some(first) => first.to_uppercase().chain(characters).collect(),
        None => String::new(),
    }
}

/// Join words in a naming convention.
pub fn spell_words(words: &[&str], convention: Convention) -> String {
    match convention {
        Convention::Camel => words
            .iter()
            .enumerate()
            .map(|(index, word)| {
                if index == 0 {
                    (*word).to_owned()
                } else {
                    capitalize(word)
                }
            })
            .collect(),
        Convention::Pascal => words.iter().map(|word| capitalize(word)).collect(),
        Convention::Snake => words.join("_"),
    }
}

/// The neutral spelling of an identifier.
pub fn neutral_name(identifier: &str) -> String {
    name_words(identifier).join("-")
}

/// A neutral name spelled in a naming convention.
pub fn spell_name(neutral: &str, convention: Convention) -> String {
    spell_words(&neutral.split('-').collect::<Vec<_>>(), convention)
}

/// Every name the program itself introduces.
pub fn declared_names(program: &Node) -> HashSet<String> {
    let mut names = HashSet::new();
    for item in program.nodes("functions") {
        names.extend(item.str("name").map(str::to_owned));
        for parameter in item.nodes("parameters") {
            names.extend(parameter.str("name").map(str::to_owned));
        }
    }
    walk(program, |current| {
        let field = match current.kind.as_str() {
            "Declaration" => "name",
            "CountingLoop" => "variable",
            _ => return,
        };
        names.extend(current.str(field).map(str::to_owned));
    });
    names
}

/// Apply `rename(name, role)` to every declared name; the role tells
/// functions from variables so languages such as C# can spell methods
/// differently.
pub fn rename_declared(program: Node, rename: impl Fn(&str, Role) -> String) -> Node {
    let declared = declared_names(&program);
    let function_names: HashSet<String> = program
        .nodes("functions")
        .iter()
        .filter_map(|item| item.str("name").map(str::to_owned))
        .collect();
    let change = |identifier: &str| {
        if !declared.contains(identifier) {
            return identifier.to_owned();
        }
        let role = if function_names.contains(identifier) {
            Role::Function
        } else {
            Role::Variable
        };
        rename(identifier, role)
    };
    let rename_field = |mut node: Node, field: &str| {
        if let Some(identifier) = node.str(field).map(str::to_owned) {
            node.set(field, change(&identifier));
        }
        node
    };
    let mut renamed = rewrite(program, |current| match current.kind.as_str() {
        "Name" | "Declaration" | "Assignment" => rename_field(current, "name"),
        "Call" => rename_field(current, "callee"),
        "CountingLoop" => rename_field(current, "variable"),
        _ => current,
    });
    let functions: Vec<Node> = renamed
        .node_list("functions")
        .into_iter()
        .map(|item| {
            let parameters: Vec<Node> = item
                .node_list("parameters")
                .into_iter()
                .map(|parameter| rename_field(parameter, "name"))
                .collect();
            rename_field(item, "name").with("parameters", parameters)
        })
        .collect();
    renamed.set("functions", functions);
    renamed
}
