//! Application-defined types and explicit annotation expressions.
use super::emitter::{Emitter, Result};
use crate::meta::{GrammarError, Node};

pub(crate) fn named_type(name: &str, target: &str) -> String {
    let mut written = String::new();
    let mut pending_space = false;
    let mut brackets = Vec::new();
    let mut chars = name.chars().peekable();
    while let Some(char) = chars.next() {
        if char.is_whitespace() {
            pending_space = true;
            continue;
        }
        let mark = "<>,[]*.:".contains(char);
        if pending_space
            && !mark
            && !written.ends_with(|last| "<>,[]*.:".contains(last))
            && !written.is_empty()
        {
            written.push(' ');
        }
        pending_space = false;
        written.push(if ["python", "scala", "go"].contains(&target) {
            match char {
                '<' => '[',
                '>' => ']',
                _ => char,
            }
        } else {
            match char {
                '[' => {
                    let generic = chars.clone().find(|value| !value.is_whitespace()) != Some(']');
                    brackets.push(generic);
                    if generic { '<' } else { '[' }
                }
                ']' if brackets.pop().unwrap_or(false) => '>',
                _ => char,
            }
        });
    }
    written
}

impl Emitter {
    fn metadata_type(&mut self, kind: &str) -> String {
        if self.id() != "python" || kind.starts_with("source:") {
            return self.type_name(kind);
        }
        match kind {
            "integer" => "int",
            "text" => "str",
            "boolean" => "bool",
            "nothing" => "None",
            "real" => "float",
            "array" => "list[int]",
            _ => "object",
        }
        .to_owned()
    }

    fn annotation_values(&mut self, item: &Node) -> Result<Vec<String>> {
        item.nodes("annotations")
            .into_iter()
            .map(|annotation| {
                self.expression(
                    annotation
                        .node("expression")
                        .ok_or_else(|| GrammarError::new("An annotation needs an expression"))?,
                )
            })
            .collect()
    }

    pub(crate) fn write_annotations(&mut self, item: &Node) -> Result<()> {
        let annotations = self.annotation_values(item)?;
        if !annotations.is_empty() && !["java", "kotlin", "python"].contains(&self.id()) {
            return Err(GrammarError::new(format!(
                "Annotations need a framework mapping for {}",
                self.id()
            )));
        }
        for annotation in annotations {
            self.line(&format!("@{annotation}"));
        }
        Ok(())
    }

    pub(crate) fn metadata_signature(&mut self, item: &Node) -> Result<Option<String>> {
        let parameters = item.nodes("parameters");
        let named = |item: &Node, key: &str| {
            item.str(key)
                .is_some_and(|kind| kind.starts_with("source:"))
        };
        let annotated = !item.nodes("annotations").is_empty()
            || parameters
                .iter()
                .any(|parameter| !parameter.nodes("annotations").is_empty());
        if !annotated
            && !named(item, "returnType")
            && !parameters.iter().any(|parameter| named(parameter, "type"))
        {
            return Ok(None);
        }
        if !["java", "kotlin", "python"].contains(&self.id()) {
            return if annotated {
                Err(GrammarError::new(format!(
                    "Annotations need a framework mapping for {}",
                    self.id()
                )))
            } else {
                Ok(None)
            };
        }
        let mut written = Vec::new();
        for parameter in parameters {
            let name = parameter.str("name").unwrap_or_default();
            let mut kind = self.metadata_type(parameter.str("type").unwrap_or_default());
            let annotations = self.annotation_values(parameter)?;
            let value = if self.id() == "python" {
                if !annotations.is_empty() {
                    self.uses.insert("typing");
                    kind = format!("Annotated[{kind}, {}]", annotations.join(", "));
                }
                format!("{name}: {}", self.quote(&kind))
            } else {
                let prefix = annotations
                    .iter()
                    .map(|value| format!("@{value} "))
                    .collect::<String>();
                if self.id() == "java" {
                    format!("{prefix}{kind} {name}")
                } else {
                    format!("{prefix}{name}: {kind}")
                }
            };
            written.push(value);
        }
        let name = item.str("name").unwrap_or_default();
        let returns = self.metadata_type(item.str("returnType").unwrap_or_default());
        let parameters = written.join(", ");
        Ok(Some(match self.id() {
            "python" => format!("def {name}({parameters}) -> {}", self.quote(&returns)),
            "java" => format!("static {returns} {name}({parameters})"),
            _ => format!("fun {name}({parameters}): {returns}"),
        }))
    }
}
