//! Resolve reusable lexical rules and productions before compiling the
//! language. Typed slots still parse nested expressions at runtime.

use crate::meta::links::Link;
use std::collections::{HashMap, HashSet};

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

fn binding_aliases<'a>(key: &str, bindings: &'a str) -> Result<HashMap<&'a str, &'a str>, String> {
    let mut aliases = HashMap::new();
    for binding in bindings.split(',') {
        let invalid = || format!("Invalid slot binding for natural grammar rule \"{key}\"");
        let (from, to) = binding.split_once('=').ok_or_else(invalid)?;
        if !term_name(from) || !term_name(to) || aliases.insert(from, to).is_some() {
            return Err(invalid());
        }
    }
    Ok(aliases)
}

fn rename_slots<'a>(
    phrase: &'a str,
    aliases: &HashMap<&str, &str>,
    used: &mut HashSet<&'a str>,
) -> Result<String, String> {
    let mut result = String::new();
    let mut offset = 0;
    let mut length = phrase.encode_utf16().count();
    for (start, _) in phrase.match_indices('{') {
        if start < offset {
            continue;
        }
        let Some((name, _)) = phrase[start + 1..].split_once('}') else {
            break;
        };
        let Some(alias) = aliases.get(name) else {
            continue;
        };
        used.insert(name);
        length = length - name.len() + alias.len();
        if length > MAX_LENGTH {
            return Err("Natural grammar phrase is too long".into());
        }
        result.push_str(&phrase[offset..start + 1]);
        result.push_str(alias);
        offset = start + 1 + name.len();
    }
    result.push_str(&phrase[offset..]);
    Ok(result)
}

fn bind_slots(variants: Vec<String>, key: &str, bindings: &str) -> Result<Vec<String>, String> {
    let aliases = binding_aliases(key, bindings)?;
    let mut used = HashSet::new();
    let phrases = variants
        .iter()
        .map(|phrase| rename_slots(phrase, &aliases, &mut used))
        .collect::<Result<_, _>>()?;
    if let Some(slot) = aliases.keys().filter(|slot| !used.contains(**slot)).min() {
        return Err(format!(
            "Unknown slot \"{slot}\" in natural grammar rule \"{key}\""
        ));
    }
    Ok(phrases)
}

fn reference_bindings<'a>(key: &str, rest: &'a str) -> Result<Option<&'a str>, String> {
    let Some(value) = rest.strip_prefix('[') else {
        return Ok(None);
    };
    if !value
        .split_once('=')
        .is_some_and(|(slot, _)| term_name(slot))
    {
        return Ok(None);
    }
    value
        .split_once(']')
        .map(|(bindings, _)| Some(bindings))
        .ok_or_else(|| format!("Unclosed slot bindings for natural grammar rule \"{key}\""))
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
        let key = &rest[..length];
        let bindings = reference_bindings(key, &rest[length..])?;
        let alternatives = resolve(key)?;
        let alternatives = match bindings {
            Some(bindings) => bind_slots(alternatives, key, bindings)?,
            None => alternatives,
        };
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
        offset = index + 1 + length + bindings.map_or(0, |value| value.len() + 2);
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

#[derive(Clone, Debug)]
pub(super) struct Expansion {
    variants: Vec<String>,
    depth: usize,
}

pub(super) type Bindings = HashMap<String, Expansion>;

fn resolve_rule(
    rules: &HashMap<&str, &[String]>,
    bindings: &mut Bindings,
    path: &mut Vec<String>,
    key: &str,
) -> Result<Expansion, String> {
    if path.len() >= MAX_DEPTH || path.iter().any(|step| step == key) {
        return Err(format!("Natural grammar recursion at \"{key}\""));
    }
    if let Some(known) = bindings.get(key) {
        if path.len() + known.depth > MAX_DEPTH {
            return Err(format!("Natural grammar recursion at \"{key}\""));
        }
        return Ok(known.clone());
    }
    let patterns = rules
        .get(key)
        .ok_or_else(|| format!("Unknown natural grammar rule \"{key}\""))?;
    path.push(key.to_owned());
    let mut depth = 1;
    let variants = expand_rule(patterns, |rule| {
        let next = resolve_rule(rules, bindings, path, rule)?;
        depth = depth.max(next.depth + 1);
        Ok(next.variants)
    })?;
    path.pop();
    let expansion = Expansion { variants, depth };
    bindings.insert(key.to_owned(), expansion.clone());
    Ok(expansion)
}

pub(super) fn productions(
    fields: &[Link],
    bindings: &mut Bindings,
) -> Result<Ordered<Vec<String>>, String> {
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
    // References within an inherited expansion keep their original meanings.
    // Local declarations shadow the inherited expansion for new references.
    for key in rules.keys() {
        bindings.remove(*key);
    }
    if bindings.len() + rules.len() > MAX_RULES * 2 {
        return Err("Too many natural grammar rules".into());
    }
    let mut path = Vec::new();
    for (key, _) in &terms.entries {
        resolve_rule(&rules, bindings, &mut path, key)?;
    }
    let mut compiled = Ordered::default();
    for (key, _) in &productions.entries {
        let expansion = resolve_rule(&rules, bindings, &mut path, key)?;
        compiled.insert(key, expansion.variants);
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
        let compiled = productions(values_of(&root), &mut Bindings::new()).unwrap();
        assert_eq!(
            compiled.get("print-line").unwrap(),
            &["Send message {value} now", "Send notice {value} now"]
        );
    }

    #[test]
    fn binds_nested_phrase_slots_without_changing_the_referenced_rule() {
        let root = parse_root(
            "grammar:\n  terms:\n    part: 'part {position} of {collection}' 'slot {position} of {collection}'\n  productions:\n    element: '@part[position=index,collection=array]'\n    set-element: 'Replace @element[array=name] with {value}'\n",
        )
        .unwrap();
        let compiled = productions(values_of(&root), &mut Bindings::new()).unwrap();
        assert_eq!(
            compiled.get("element").unwrap(),
            &["part {index} of {array}", "slot {index} of {array}"]
        );
        assert_eq!(
            compiled.get("set-element").unwrap(),
            &[
                "Replace part {index} of {name} with {value}",
                "Replace slot {index} of {name} with {value}"
            ]
        );
    }

    #[test]
    fn bounds_depth_with_either_declaration_order() {
        let mut terms = vec!["    term-0: 'Speak {value}'".to_owned()];
        terms
            .extend((1..MAX_DEPTH).map(|index| format!("    term-{index}: '@term-{}'", index - 1)));
        let compile = |terms: &[String], index| {
            let root = parse_root(&format!(
                "grammar:\n  terms:\n{}\n  productions:\n    print-line: '@term-{index}'\n",
                terms.join("\n")
            ))
            .unwrap();
            productions(values_of(&root), &mut Bindings::new())
        };
        let compiled = compile(&terms, MAX_DEPTH - 2).unwrap();
        assert_eq!(compiled.get("print-line").unwrap(), &["Speak {value}"]);
        let mut reversed = terms.clone();
        reversed.reverse();
        for rules in [&terms, &reversed] {
            let error = compile(rules, MAX_DEPTH - 1).unwrap_err();
            assert!(error.starts_with("Natural grammar recursion at"), "{error}");
        }
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
            (
                "  terms:\n    write: 'Write {value}'\n  productions:\n    print-line: '@write[missing=value]'",
                "Unknown slot \"missing\" in natural grammar rule \"write\"",
            ),
            (
                "  terms:\n    write: 'Write {value}'\n  productions:\n    print-line: '@write[value=operand,value=value]'",
                "Invalid slot binding for natural grammar rule \"write\"",
            ),
            (
                "  terms:\n    write: 'Write {value}'\n  productions:\n    print-line: '@write[value=value'",
                "Unclosed slot bindings for natural grammar rule \"write\"",
            ),
        ];
        for (body, expected) in cases {
            let root = parse_root(&format!("grammar:\n{body}\n")).unwrap();
            assert_eq!(
                productions(values_of(&root), &mut Bindings::new()).unwrap_err(),
                expected
            );
        }
    }
}
