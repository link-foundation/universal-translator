//! Shared integer rounding algorithms lower only operations a target lacks.
use super::{GrammarError, Node, Settings, Value, binary, number, rewrite, same_meaning, walk};
use serde_json::Value as Json;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

static DATA: LazyLock<Json> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../data/integer-arithmetic.json"))
        .expect("integer arithmetic data")
});

static HELPER_BODIES: LazyLock<Vec<(String, Node, Node)>> = LazyLock::new(|| {
    DATA["helpers"]
        .as_object()
        .expect("helpers")
        .iter()
        .map(|(operator, template)| {
            let body = json_node(&template["body"]);
            // Earlier releases used "result", an implicit variable reserved by Nim.
            let legacy = rewrite(body.clone(), |mut item| {
                if item.str("name") == Some("quotient") {
                    item.set("name", "result");
                }
                item
            });
            (operator.clone(), body, legacy)
        })
        .collect()
});

fn profile(key: &str, id: &str) -> bool {
    DATA[key]
        .as_array()
        .expect("profile list")
        .iter()
        .any(|v| v.as_str() == Some(id))
}

pub(crate) fn floor_division(id: &str) -> bool {
    profile("floorDivision", id)
}
pub(crate) fn floor_modulo(id: &str) -> bool {
    profile("floorModulo", id)
}

fn may_produce_negative_zero(item: &Node) -> bool {
    let operand = |key| {
        item.node(key)
            .filter(|value| value.is("Number"))
            .and_then(|value| value.number("value"))
    };
    let (Some(left), Some(right)) = (operand("left"), operand("right")) else {
        return true;
    };
    let dividend = left + 0.0;
    let divisor = right + 0.0;
    let value = if item.str("operator") == Some("divide") {
        (dividend / divisor).trunc()
    } else {
        dividend % divisor
    };
    value == 0.0 && value.is_sign_negative()
}

fn normalize_integer_zero(item: Node) -> Node {
    // In JavaScript, -0 + 0 is +0 and evaluates the integer operation once.
    if item.str("type") == Some("integer") && may_produce_negative_zero(&item) {
        binary("add", item, number(0.0).with("type", "integer")).with("type", "integer")
    } else {
        item
    }
}

fn native(operator: &str, id: &str) -> bool {
    match operator {
        "divide" => !floor_division(id),
        "floorDivide" => floor_division(id),
        "remainder" => !floor_modulo(id),
        "modulo" => floor_modulo(id),
        _ => true,
    }
}

fn json_node(json: &Json) -> Node {
    let mut node = Node::new(json["kind"].as_str().unwrap_or("Parameter"));
    fn value(json: &Json) -> Value {
        match json {
            Json::Bool(b) => Value::Bool(*b),
            Json::Number(n) => Value::Number(n.as_f64().expect("number")),
            Json::String(s) => Value::Text(s.clone()),
            Json::Array(items) => Value::List(items.iter().map(value).collect()),
            Json::Object(_) => Value::Node(json_node(json)),
            Json::Null => unreachable!("templates have no nulls"),
        }
    }
    for (key, json) in json
        .as_object()
        .expect("node")
        .iter()
        .filter(|(k, _)| k.as_str() != "kind")
    {
        node.set(key, value(json));
    }
    node
}

struct Lower<'a> {
    target: &'a str,
    language: &'a str,
    normalize_zero: bool,
    used: HashSet<String>,
    names: HashMap<String, String>,
    functions: Vec<Node>,
    error: Option<GrammarError>,
}

impl Lower<'_> {
    fn helper(&mut self, operator: &str) -> String {
        if let Some(name) = self.names.get(operator) {
            return name.clone();
        }
        let mut definition = json_node(&DATA["helpers"][operator]);
        let base = definition.str("name").expect("helper name").to_owned();
        let mut callee = base.clone();
        let mut suffix = 2;
        while self.used.contains(&callee) {
            callee = format!("{base}-{suffix}");
            suffix += 1;
        }
        self.used.insert(callee.clone());
        self.names.insert(operator.into(), callee.clone());
        definition.set("name", callee.clone());
        let definition = self.lower(definition);
        self.functions.push(definition);
        callee
    }

    fn lower(&mut self, program: Node) -> Node {
        rewrite(program, |current| {
            let operator = current.str("operator").unwrap_or_default();
            if self.normalize_zero
                && current.is("Binary")
                && matches!(operator, "divide" | "remainder")
            {
                return normalize_integer_zero(current);
            }
            if !current.is("Binary") || native(operator, self.language) {
                return current;
            }
            if current.str("type") == Some("real") {
                self.error = Some(GrammarError::new(format!(
                    "Real {operator} has no verified lowering for {}",
                    self.target
                )));
                return current;
            }
            let callee = self.helper(operator);
            Node::new("Call")
                .with("callee", callee)
                .with(
                    "arguments",
                    vec![
                        current.node("left").expect("left").clone(),
                        current.node("right").expect("right").clone(),
                    ],
                )
                .with("type", "integer")
        })
    }
}

pub(crate) fn lower(program: Node, settings: &Settings) -> Result<Node, GrammarError> {
    let mut used = HashSet::new();
    walk(&program, |current| {
        for key in ["name", "variable", "callee"] {
            if let Some(name) = current.str(key) {
                used.insert(name.to_owned());
            }
        }
        for parameter in current.node_list("parameters") {
            if let Some(name) = parameter.str("name") {
                used.insert(name.to_owned());
            }
        }
        if current.is("Lambda") {
            used.extend(current.texts("parameters"));
        }
    });
    let mut lower = Lower {
        target: &settings.target,
        language: &settings.to,
        normalize_zero: matches!(settings.from.as_str(), "c" | "cpp" | "objc")
            && matches!(settings.to.as_str(), "javascript" | "typescript"),
        used,
        names: HashMap::new(),
        functions: vec![],
        error: None,
    };
    let mut result = lower.lower(program);
    if let Some(error) = lower.error {
        return Err(error);
    }
    if !lower.functions.is_empty() {
        lower.functions.extend(result.node_list("functions"));
        result.set("functions", lower.functions);
    }
    Ok(result)
}

/// Full algorithm matching; rebinding and escaping prevent recognition.
pub(crate) fn raise(mut program: Node, _: &Settings) -> Node {
    loop {
        let mut candidates = HashMap::new();
        let mut definitions = HashMap::new();
        for item in program.node_list("functions") {
            let name = item.str("name").unwrap_or_default();
            *definitions.entry(name.to_owned()).or_insert(0) += 1;
            let params = item.node_list("parameters");
            if !name.starts_with("ut-integer-")
                || item.node("documentation").is_some()
                || params.len() != 2
                || params
                    .iter()
                    .zip(["first", "second"])
                    .any(|(p, n)| p.str("name") != Some(n))
                || item.str("returnType") != Some("integer")
            {
                continue;
            }
            if let Some(candidate) = item.node("body") {
                for (operator, body, legacy) in HELPER_BODIES.iter() {
                    if same_meaning(candidate, body) || same_meaning(candidate, legacy) {
                        candidates.insert(name.to_owned(), operator.clone());
                    }
                }
            }
        }
        candidates.retain(|name, _| definitions.get(name) == Some(&1));
        walk(&program, |current| {
            if matches!(
                current.kind.as_str(),
                "Name" | "Declaration" | "Assignment" | "Catch"
            ) {
                candidates.remove(current.str("name").unwrap_or_default());
            }
            if let Some(variable) = current.str("variable") {
                candidates.remove(variable);
            }
            for parameter in current.node_list("parameters") {
                candidates.remove(parameter.str("name").unwrap_or_default());
            }
            if current.is("Lambda") {
                for parameter in current.texts("parameters") {
                    candidates.remove(&parameter);
                }
            }
            if current.is("Call") && current.node_list("arguments").len() != 2 {
                candidates.remove(current.str("callee").unwrap_or_default());
            }
        });
        if candidates.is_empty() {
            return program;
        }
        let functions = program
            .node_list("functions")
            .into_iter()
            .filter(|f| !candidates.contains_key(f.str("name").unwrap_or_default()))
            .collect::<Vec<_>>();
        program.set("functions", functions);
        program = rewrite(program, |current| {
            let Some(operator) = candidates
                .get(current.str("callee").unwrap_or_default())
                .filter(|_| current.is("Call"))
            else {
                return current;
            };
            let args = current.node_list("arguments");
            binary(operator, args[0].clone(), args[1].clone()).with("type", "integer")
        });
    }
}
