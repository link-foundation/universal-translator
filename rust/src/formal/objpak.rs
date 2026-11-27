//! Interpret Portable Object Compiler string/set operations compositionally.
use crate::meta::for_each::used_names;
use crate::meta::{
    GrammarError, Node, Settings, Value, binary, block, name, number, rewrite, walk,
};
use std::collections::HashMap;

type Scope = HashMap<String, String>;

fn source_type(value: &Node, scope: &Scope) -> Option<String> {
    match value.kind.as_str() {
        "ProcessArguments" => Some("array<text>".into()),
        "SetLiteral" => Some("set<text>".into()),
        "Text" => Some("text".into()),
        "Index"
            if value
                .node("array")
                .and_then(|a| source_type(a, scope))
                .as_deref()
                == Some("array<text>") =>
        {
            Some("text".into())
        }
        "Name" => scope.get(value.str("name")?).cloned(),
        "SetInsert" => value.node("collection").and_then(|c| source_type(c, scope)),
        _ => None,
    }
}

fn message(value: &Node, receiver: &str, selector: &str) -> bool {
    value.is("Message")
        && value.node("receiver").is_some_and(|r| r.is_name(receiver))
        && value.str("selector") == Some(selector)
}

fn library_value(value: Value, scope: &Scope) -> Value {
    match value {
        Value::Node(value) => library_node(value, scope).into(),
        Value::List(values) => Value::List(
            values
                .into_iter()
                .map(|v| library_value(v, scope))
                .collect(),
        ),
        other => other,
    }
}

fn library_node(mut current: Node, scope: &Scope) -> Node {
    if current.is("Block") || current.is("SourceProgram") {
        let key = if current.is("Block") {
            "statements"
        } else {
            "items"
        };
        let mut local = scope.clone();
        let statements = current
            .node_list(key)
            .into_iter()
            .map(|s| {
                let result = library_node(s, &local);
                if matches!(result.kind.as_str(), "Declaration" | "Assignment") {
                    let variable = result.str("name").unwrap_or_default().to_owned();
                    if let Some(known) = result.node("value").and_then(|v| source_type(v, &local)) {
                        local.insert(variable, known);
                    } else {
                        local.insert(variable, "unknown".into());
                    }
                }
                result
            })
            .collect::<Vec<_>>();
        current.set(key, statements);
        return current;
    }
    if current.is("Function") {
        let mut local = scope.clone();
        for p in current.nodes("parameters") {
            if let (Some(name), Some(kind)) = (p.str("name"), p.str("type")) {
                local.insert(name.into(), kind.into());
            }
        }
        if let Some(body) = current.node("body").cloned() {
            current.set("body", library_node(body, &local));
        }
        return current;
    }
    if current.is("ForEach")
        && let (Some(array), Some(body)) = (current.node("array"), current.node("body"))
    {
        let array = library_node(array.clone(), scope);
        let mut local = scope.clone();
        local.insert(
            current.str("variable").unwrap_or_default().into(),
            if source_type(&array, scope).as_deref() == Some("set<text>") {
                "text"
            } else {
                "unknown"
            }
            .into(),
        );
        let body = library_node(body.clone(), &local);
        current.set("array", array);
        current.set("body", body);
        return current;
    }
    if current.is("Evaluate")
        && let Some(expression) = current.node("expression")
        && expression.is("Message")
        && expression.str("selector") == Some("do:")
        && expression
            .node("receiver")
            .and_then(|r| source_type(&library_node(r.clone(), scope), scope))
            .as_deref()
            == Some("set<text>")
        && let Some(lambda) = expression.nodes("arguments").first()
        && lambda.is("BlockLambda")
        && lambda.texts("parameters").len() == 1
    {
        let variable = lambda.texts("parameters")[0].clone();
        let mut local = scope.clone();
        local.insert(variable.clone(), "text".into());
        let mut result = Node::new("ForEach")
            .with("variable", variable)
            .with(
                "array",
                library_node(expression.node("receiver").unwrap().clone(), scope),
            )
            .with(
                "body",
                library_node(lambda.node("body").unwrap().clone(), &local),
            );
        result.origin = current.origin;
        return result;
    }
    current.fields = std::mem::take(&mut current.fields)
        .into_iter()
        .map(|(k, v)| (k, library_value(v, scope)))
        .collect();
    let arguments = current.node_list("arguments");
    if current.is("Message")
        && current
            .node("receiver")
            .and_then(|r| source_type(r, scope))
            .as_deref()
            == Some("array<text>")
    {
        let receiver = current.node("receiver").unwrap().clone();
        let mut result = match current.str("selector") {
            Some("size") if arguments.is_empty() => {
                Some(Node::new("Length").with("array", receiver))
            }
            Some("at:") if arguments.len() == 1 => Some(
                Node::new("Index")
                    .with("array", receiver)
                    .with("index", arguments[0].clone()),
            ),
            _ => None,
        };
        if let Some(ref mut result) = result {
            result.origin = current.origin;
            return result.clone();
        }
    }
    let portable = if current.is_name("sys.argv") && !scope.contains_key("sys") {
        Some(Node::new("ProcessArguments").with("includeProgram", true))
    } else if current.is("Call") {
        let callee = current.str("callee").unwrap_or_default();
        let constructor = callee.strip_prefix("new ").unwrap_or(callee);
        let constructor = constructor.strip_suffix("::new").unwrap_or(constructor);
        if arguments.is_empty()
            && scope
                .get(constructor)
                .is_some_and(|kind| kind == "objpak-constructor")
        {
            Some(
                Node::new("SetLiteral")
                    .with("elements", Vec::<Node>::new())
                    .with("order", "objpak-string"),
            )
        } else if callee == "process.argv.slice"
            && !scope.contains_key("process")
            && arguments.len() == 1
            && matches!(arguments[0].number("value"), Some(1.0 | 2.0))
        {
            Some(
                Node::new("ProcessArguments")
                    .with("includeProgram", arguments[0].number("value") == Some(1.0)),
            )
        } else if let Some(dot) = callee.rfind('.') {
            let method = &callee[dot + 1..];
            let receiver = if dot == 0 {
                arguments.first().cloned()
            } else {
                Some(name(&callee[..dot]))
            };
            let args = if dot == 0 {
                &arguments[1..]
            } else {
                &arguments[..]
            };
            receiver.and_then(|receiver| {
                let kind = source_type(&receiver, scope);
                if kind.as_deref() == Some("set<text>") {
                    if method == "add" && args.len() == 1 {
                        Some(
                            Node::new("SetInsert")
                                .with("collection", receiver)
                                .with("value", args[0].clone()),
                        )
                    } else if matches!(method, "clone" | "iter") && args.is_empty() {
                        Some(receiver)
                    } else {
                        None
                    }
                } else if kind.as_deref() == Some("text") && method == "to_owned" && args.is_empty()
                {
                    Some(receiver)
                } else {
                    None
                }
            })
        } else {
            None
        }
    } else if current.is("Binary")
        && let Some(left) = current.node("left")
        && left.is("Update")
        && left.flag("prefix") == Some(true)
        && current.node("right").and_then(|n| n.number("value")) == Some(1.0)
        && current.str("operator")
            == Some(if left.number("delta") == Some(1.0) {
                "subtract"
            } else {
                "add"
            })
    {
        Some(left.clone().with("prefix", false))
    } else {
        None
    };
    let mut result = if let Some(portable) = portable {
        portable
    } else if message(&current, "Set", "new") && !scope.contains_key("Set") && arguments.is_empty()
    {
        Node::new("SetLiteral")
            .with("elements", Vec::<Node>::new())
            .with("order", "objpak-string")
    } else if message(&current, "String", "str:")
        && !scope.contains_key("String")
        && arguments.len() == 1
        && arguments[0].is("Text")
    {
        let value = arguments[0]
            .str("value")
            .unwrap_or_default()
            .split('\0')
            .next()
            .unwrap_or_default();
        arguments[0].clone().with("value", value)
    } else if message(&current, "String", "str:")
        && !scope.contains_key("String")
        && arguments.len() == 1
        && arguments[0].is("Index")
        && arguments[0].node("array").is_some_and(|a| {
            a.is("Name") && source_type(a, scope).as_deref() == Some("array<text>")
        })
    {
        arguments[0].clone()
    } else if current.is("Message")
        && current.str("selector") == Some("str")
        && arguments.is_empty()
        && current
            .node("receiver")
            .and_then(|r| source_type(r, scope))
            .as_deref()
            == Some("text")
    {
        current.node("receiver").unwrap().clone()
    } else if current.is("Message")
        && current.str("selector") == Some("add:")
        && arguments.len() == 1
        && current
            .node("receiver")
            .and_then(|r| source_type(r, scope))
            .as_deref()
            == Some("set<text>")
    {
        Node::new("SetInsert")
            .with("collection", current.node("receiver").unwrap().clone())
            .with("value", arguments[0].clone())
    } else {
        current.clone()
    };
    if result.is("Declaration") && result.str("type") == Some("source:id") {
        if let Some(kind) = result.node("value").and_then(|v| source_type(v, scope)) {
            result.set("type", kind);
        } else {
            result.remove("type");
        }
    }
    result.origin = current.origin;
    result
}

fn entry_parameters(item: &Node) -> Option<(String, String)> {
    if !item.is("Function") || item.str("name") != Some("main") {
        return None;
    }
    let parameters = item.nodes("parameters");
    if parameters.len() != 2
        || parameters[0].str("type") != Some("integer")
        || parameters[1].str("type")?.replace(' ', "") != "source:char**"
    {
        return None;
    }
    Some((
        parameters[0].str("name")?.into(),
        parameters[1].str("name")?.into(),
    ))
}

fn valid_pointer(operand: &Node, variable: &str) -> bool {
    operand.is_name(variable)
        || operand.is("Update") && operand.node("operand").is_some_and(|v| v.is_name(variable))
}

fn validate_pointer(
    current: &Node,
    parent: Option<&Node>,
    variable: &str,
) -> Result<(), GrammarError> {
    if current.is_name(variable)
        && !parent.is_some_and(|p| matches!(p.kind.as_str(), "Dereference" | "Update"))
    {
        return Err(GrammarError::new(
            "Command-line pointers support dereferencing and integer cursor updates",
        ));
    }
    for value in current.fields.values() {
        match value {
            Value::Node(child) => validate_pointer(child, Some(current), variable)?,
            Value::List(values) => {
                for value in values {
                    if let Value::Node(child) = value {
                        validate_pointer(child, Some(current), variable)?;
                    }
                }
            }
            _ => (),
        }
    }
    Ok(())
}

fn normalized_body(item: &Node, bindings: &[String]) -> Option<Node> {
    let (count, pointer) = entry_parameters(item)?;
    let mut normalized = false;
    let body = rewrite(item.node("body")?.clone(), |current| {
        let arguments = current.nodes("arguments");
        if current.is("Call")
            && bindings
                .iter()
                .any(|binding| current.str("callee") == Some(binding))
            && arguments.len() == 3
            && arguments[0].is_name(&count)
            && arguments[1].is_name(&pointer)
            && matches!(arguments[2].number("value"), Some(0.0 | 1.0))
        {
            normalized = true;
            Node::new("ProcessArguments")
                .with("includeProgram", arguments[2].number("value") == Some(1.0))
        } else {
            current
        }
    });
    normalized.then_some(body)
}

pub(crate) fn validate_entries(program: &Node) -> Result<(), GrammarError> {
    let bindings = program.texts("objpakBindings");
    for item in program.nodes("items") {
        if let Some((count, pointer)) = entry_parameters(item)
            && let Some(body) = item.node("body")
        {
            if let Some(normalized) = normalized_body(item, &bindings) {
                let mut references = false;
                walk(&normalized, |current| {
                    if current.is_name(&count) || current.is_name(&pointer) {
                        references = true;
                    }
                });
                if references {
                    return Err(GrammarError::new(
                        "A normalized argument entry cannot reuse its native parameters",
                    ));
                }
            } else {
                validate_pointer(body, None, &pointer)?;
            }
        }
    }
    Ok(())
}

fn process_entry(mut item: Node, bindings: &[String]) -> Node {
    if let Some(body) = normalized_body(&item, bindings) {
        item.set("body", body);
        return item;
    }
    let Some((count, pointer)) = entry_parameters(&item) else {
        return item;
    };
    let Some(body) = item.node("body").cloned() else {
        return item;
    };
    let used = used_names(&body, &item.nodes("parameters"));
    let mut args = "processArguments".to_owned();
    while used.contains(&args) {
        args.push('_');
    }
    let body = rewrite(body, |current| {
        if current.is("Dereference")
            && current
                .node("operand")
                .is_some_and(|o| valid_pointer(o, &pointer))
        {
            Node::new("Index")
                .with("array", name(&args))
                .with("index", current.node("operand").unwrap().clone())
        } else {
            current
        }
    });
    let declaration = |variable: &str, kind: &str, value: Node| {
        Node::new("Declaration")
            .with("name", variable)
            .with("type", kind)
            .with("value", value)
    };
    let mut statements = vec![
        declaration(
            &args,
            "array<text>",
            Node::new("ProcessArguments").with("includeProgram", true),
        ),
        declaration(
            &count,
            "integer",
            Node::new("Length").with("array", name(&args)),
        ),
        declaration(&pointer, "integer", number(0.0)),
    ];
    statements.extend(body.node_list("statements"));
    item.set("body", block(statements));
    item
}

pub(crate) fn recognize_objpak(mut program: Node, settings: &Settings) -> Node {
    let language = settings.from.split('@').next().unwrap_or_default();
    if !matches!(language, "objc" | "python" | "javascript" | "rust") {
        return program;
    }
    let bindings = program.texts("objpakBindings");
    let scope = bindings
        .iter()
        .cloned()
        .map(|binding| (binding, "objpak-constructor".into()))
        .collect::<Scope>();
    program.remove("objpakBindings");
    if language == "objc" {
        program.set(
            "items",
            program
                .node_list("items")
                .into_iter()
                .map(|item| process_entry(item, &bindings))
                .collect::<Vec<_>>(),
        );
    }
    library_node(program, &scope)
}

pub(crate) fn normalize_objc_conditions(program: Node, settings: &Settings) -> Node {
    if settings.from.split('@').next() != Some("objc") {
        return program;
    }
    rewrite(program, |mut current| {
        if matches!(current.kind.as_str(), "While" | "If")
            && let Some(condition) = current.node("condition")
            && matches!(condition.str("type"), Some("integer" | "real"))
        {
            current.set(
                "condition",
                binary(
                    "notEqual",
                    condition.clone(),
                    number(0.0).with("type", "integer"),
                )
                .with("type", "boolean"),
            );
        }
        current
    })
}
