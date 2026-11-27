//! Resolve reusable lexical rules and productions before compiling the
//! language. Typed slots still parse nested expressions at runtime.

use crate::meta::links::Link;
use std::collections::HashMap;

use super::catalog::{OPTIONAL_TEMPLATE_KEYS, Ordered, TEMPLATE_KEYS, label_of, plain, values_of};

const MAX_DEPTH: usize = 24;
const MAX_VARIANTS: usize = 64;
const MAX_LENGTH: usize = 4096;
const MAX_RULES: usize = 256;

fn term_character(byte: u8) -> bool {
    byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'
}

fn term_name(name: &str) -> bool {
    name.as_bytes().first().is_some_and(u8::is_ascii_lowercase) && name.bytes().all(term_character)
}

fn check_length(phrase: &str) -> Result<(), String> {
    if phrase.encode_utf16().count() > MAX_LENGTH {
        return Err("Natural grammar phrase is too long".into());
    }
    Ok(())
}

fn expand(
    pattern: &str,
    mut resolve: impl FnMut(&str) -> Result<Vec<String>, String>,
) -> Result<Vec<String>, String> {
    check_length(pattern)?;
    let mut variants = vec![String::new()];
    let mut offset = 0;
    for (index, _) in pattern.match_indices('@') {
        let rest = &pattern[index + 1..];
        if !rest.as_bytes().first().is_some_and(u8::is_ascii_lowercase) {
            continue;
        }
        let length = rest
            .bytes()
            .take_while(|&byte| term_character(byte))
            .count();
        let alternatives = resolve(&rest[..length])?;
        if variants.len() * alternatives.len() > MAX_VARIANTS {
            return Err("Too many natural grammar alternatives".into());
        }
        let literal = &pattern[offset..index];
        let mut next = Vec::new();
        for prefix in &variants {
            for word in &alternatives {
                let variant = format!("{prefix}{literal}{word}");
                check_length(&variant)?;
                next.push(variant);
            }
        }
        variants = next;
        offset = index + 1 + length;
    }
    for variant in &mut variants {
        variant.push_str(&pattern[offset..]);
        check_length(variant)?;
    }
    Ok(variants)
}

fn expand_rule(
    patterns: &[String],
    mut resolve: impl FnMut(&str) -> Result<Vec<String>, String>,
) -> Result<Vec<String>, String> {
    if patterns.is_empty() || patterns.len() > MAX_VARIANTS {
        return Err("Invalid number of natural grammar alternatives".into());
    }
    let mut variants = Vec::new();
    for pattern in patterns {
        for phrase in expand(pattern, &mut resolve)? {
            if !variants.contains(&phrase) {
                variants.push(phrase);
            }
        }
        if variants.len() > MAX_VARIANTS {
            return Err("Too many natural grammar alternatives".into());
        }
    }
    Ok(variants)
}

fn resolve_rule(
    rules: &HashMap<&str, &[String]>,
    resolved: &mut HashMap<String, Vec<String>>,
    path: &mut Vec<String>,
    key: &str,
) -> Result<Vec<String>, String> {
    if path.len() >= MAX_DEPTH || path.iter().any(|step| step == key) {
        return Err(format!("Natural grammar recursion at \"{key}\""));
    }
    if let Some(known) = resolved.get(key) {
        return Ok(known.clone());
    }
    let patterns = rules
        .get(key)
        .ok_or_else(|| format!("Unknown natural grammar rule \"{key}\""))?;
    path.push(key.to_owned());
    let variants = expand_rule(patterns, |rule| resolve_rule(rules, resolved, path, rule))?;
    path.pop();
    resolved.insert(key.to_owned(), variants.clone());
    Ok(variants)
}

pub(super) fn productions(fields: &[Link]) -> Result<Ordered<Vec<String>>, String> {
    let mut terms = Ordered::default();
    let mut productions = Ordered::default();
    for field in fields {
        let id = label_of(field);
        let entries = match id {
            "terms" => &mut terms,
            "productions" => &mut productions,
            _ => return Err(format!("Unknown natural grammar field \"{id}\"")),
        };
        for entry in values_of(field) {
            let key = label_of(entry);
            let valid = if id == "terms" {
                term_name(key)
            } else {
                TEMPLATE_KEYS.contains(&key) || OPTIONAL_TEMPLATE_KEYS.contains(&key)
            };
            if !valid || entries.get(key).is_some() || entries.entries.len() >= MAX_RULES {
                return Err(format!(
                    "Invalid or repeated natural grammar rule \"{key}\""
                ));
            }
            let phrases = values_of(entry);
            if phrases
                .iter()
                .any(|phrase| label_of(phrase).trim().is_empty() || !values_of(phrase).is_empty())
            {
                return Err(format!("Invalid phrase in natural grammar rule \"{key}\""));
            }
            entries.insert(key, plain(phrases));
        }
    }
    let mut rules = HashMap::new();
    for (key, patterns) in terms.entries.iter().chain(&productions.entries) {
        if rules.insert(key.as_str(), patterns.as_slice()).is_some() {
            return Err(format!("Repeated natural grammar rule \"{key}\""));
        }
    }
    let mut resolved = HashMap::new();
    let mut path = Vec::new();
    for (key, _) in &terms.entries {
        resolve_rule(&rules, &mut resolved, &mut path, key)?;
    }
    let mut compiled = Ordered::default();
    for (key, _) in &productions.entries {
        compiled.insert(key, resolve_rule(&rules, &mut resolved, &mut path, key)?);
    }
    Ok(compiled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::natural::catalog::parse_root;

    #[test]
    fn productions_reuse_terms_and_other_productions() {
        let root = parse_root(
            "grammar:\n  terms:\n    message: 'message' 'notice'\n    send: 'Send @message'\n  productions:\n    print-line: '@print now'\n    print: '@send {value}'\n",
        )
        .unwrap();
        let compiled = productions(values_of(&root)).unwrap();
        assert_eq!(
            compiled.get("print-line").unwrap(),
            &["Send message {value} now", "Send notice {value} now"]
        );
    }

    #[test]
    fn rejects_unknown_cyclic_and_combinatorial_expansions() {
        let cases = [
            (
                "  productions:\n    print-line: '@missing {value}'",
                "Unknown natural grammar rule \"missing\"",
            ),
            (
                "  terms:\n    one: '@two'\n    two: '@one'",
                "Natural grammar recursion at \"one\"",
            ),
            (
                "  terms:\n    print-line: 'Say'\n  productions:\n    print-line: 'Print {value}'",
                "Repeated natural grammar rule \"print-line\"",
            ),
            (
                "  terms:\n    action: '@print-line'\n  productions:\n    print-line: '@action {value}'",
                "Natural grammar recursion at \"action\"",
            ),
            (
                "  terms:\n    word: a b c d e\n  productions:\n    print-line: '@word @word @word {value}'",
                "Too many natural grammar alternatives",
            ),
        ];
        for (body, expected) in cases {
            let root = parse_root(&format!("grammar:\n{body}\n")).unwrap();
            assert_eq!(productions(values_of(&root)).unwrap_err(), expected);
        }
    }
}
