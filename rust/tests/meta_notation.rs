use serde_json::Value as Json;
use universal_translator::meta::{Node, Value, notation::format_meta};
use universal_translator::{Mode, Translator};

// Read the language-neutral fixtures, including unkinded parameter records.
// Null is absent in the meta model and in these finite fixtures.
fn field(value: &Json) -> Value {
    match value {
        Json::Bool(value) => Value::Bool(*value),
        Json::Number(value) => Value::Number(value.as_f64().unwrap()),
        Json::String(value) => Value::Text(value.clone()),
        Json::Array(values) => Value::List(values.iter().map(field).collect()),
        Json::Object(fields) => {
            let mut node = Node::new(fields.get("kind").and_then(Json::as_str).unwrap_or(""));
            for (key, value) in fields {
                if key != "kind" {
                    node.set(key, field(value));
                }
            }
            Value::Node(node)
        }
        Json::Null => panic!("meta fixtures contain no null fields"),
    }
}

fn roles(text: &str) -> Vec<&str> {
    let mut roles: Vec<_> = text
        .lines()
        .map(str::trim)
        .filter(|line| {
            [
                "condition",
                "body",
                "then",
                "otherwise",
                "expression",
                "arguments",
                "left",
                "right",
            ]
            .contains(line)
        })
        .collect();
    roles.sort();
    roles
}

#[test]
fn all_reader_families_retain_condition_action_and_value_effect_roles() {
    let translator = Translator::new();
    let input = translator.to_meta("n = 1\nwhile n < 3:\n    if n == 1:\n        print(n)\n    else:\n        print(n + 1)\n    n = n * 2\n", "python").unwrap();
    let text = format_meta(&input);
    let expected = roles(&text);
    assert_eq!(
        expected.iter().filter(|role| **role == "condition").count(),
        2
    );
    for language in universal_translator::formal::languages::language_ids()
        .into_iter()
        .chain(universal_translator::natural::natural_language_ids())
        .chain(universal_translator::translator::machine_target_ids())
    {
        let output = translator
            .from_meta(&input, language, None, Mode::default())
            .unwrap();
        let meta = translator.to_meta(&output, language).unwrap();
        assert_eq!(roles(&format_meta(&meta)), expected, "{language}\n{output}");
    }
}

#[test]
fn all_child_roles_match_the_shared_readable_fixtures() {
    for (input, expected) in [
        (
            include_str!("../../examples/translation/meta-roles/control-flow.json"),
            include_str!("../../examples/translation/meta-roles/control-flow.lino"),
        ),
        (
            include_str!("../../examples/translation/meta-roles/queries-library.json"),
            include_str!("../../examples/translation/meta-roles/queries-library.lino"),
        ),
        (
            include_str!("../../examples/translation/meta-roles/nested-prose.json"),
            include_str!("../../examples/translation/meta-roles/nested-prose.lino"),
        ),
        (
            include_str!("../../examples/translation/meta-roles/annotated-block.json"),
            include_str!("../../examples/translation/meta-roles/annotated-block.lino"),
        ),
    ] {
        let node = field(&serde_json::from_str(input).unwrap());
        let node = node.as_node().unwrap();
        let before = node.clone();
        assert_eq!(format_meta(node), expected);
        assert_eq!(node, &before);
    }
}
