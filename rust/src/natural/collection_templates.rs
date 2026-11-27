//! Quoted operation labels compose with every controlled language's expression syntax.
use super::catalog::Language;
use crate::meta::{Node, number};

pub(super) const KEYS: [&str; 5] = [
    "process-arguments",
    "objpak-string-set",
    "set-insert",
    "prefix-update",
    "postfix-update",
];

pub(super) fn derive(language: &mut Language) {
    for (key, slots) in [
        ("process-arguments", vec!["includeProgram"]),
        ("objpak-string-set", vec![]),
        ("set-insert", vec!["collection", "value"]),
        ("prefix-update", vec!["operand", "delta"]),
        ("postfix-update", vec!["operand", "delta"]),
    ] {
        if language.templates.get(key).is_some() {
            continue;
        }
        let arguments = if slots.is_empty() {
            " ()".into()
        } else {
            slots
                .iter()
                .map(|slot| format!(" ({{{slot}}})"))
                .collect::<String>()
        };
        language.templates.insert(
            key,
            vec![format!(
                "{}{key}{}{arguments}",
                language.quotes.0, language.quotes.1
            )],
        );
    }
}

type Phrase = (&'static str, Vec<(&'static str, Node)>);

pub(super) fn phrase(expression: &Node) -> Result<Option<Phrase>, String> {
    let child = |key: &str| {
        expression
            .node(key)
            .cloned()
            .ok_or_else(|| format!("A {} without {key}", expression.kind))
    };
    Ok(Some(match expression.kind.as_str() {
        "ProcessArguments" => (
            "process-arguments",
            vec![(
                "includeProgram",
                Node::new("Boolean")
                    .with("value", expression.flag("includeProgram").unwrap_or(false)),
            )],
        ),
        "SetLiteral" => {
            if expression.str("order") != Some("objpak-string")
                || !expression.nodes("elements").is_empty()
            {
                return Err("Only an empty Objpak string set has this phrase".into());
            }
            ("objpak-string-set", vec![])
        }
        "SetInsert" => (
            "set-insert",
            vec![
                ("collection", child("collection")?),
                ("value", child("value")?),
            ],
        ),
        "Update" => (
            if expression.flag("prefix").unwrap_or(false) {
                "prefix-update"
            } else {
                "postfix-update"
            },
            vec![
                ("operand", child("operand")?),
                (
                    "delta",
                    number(expression.number("delta").unwrap_or_default()),
                ),
            ],
        ),
        _ => return Ok(None),
    }))
}
