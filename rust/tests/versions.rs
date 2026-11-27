//! The versions of a programming language and the ids that name them. The
//! JavaScript twin is js/tests/versions.test.js.

use std::fs;

use universal_translator::meta::tree::same_meaning;
use universal_translator::{Mode, Translator, split_version, versions_of};

#[test]
fn splits_a_version_from_an_id() {
    assert_eq!(split_version("python@2"), ("python", Some("2")));
    assert_eq!(split_version("python"), ("python", None));
}

#[test]
fn lists_the_default_version_first() {
    let listed: Vec<_> = versions_of("python")
        .into_iter()
        .map(|version| (version.version, version.default))
        .collect();
    assert_eq!(
        listed,
        vec![
            ("3", true),
            ("3.13", false),
            ("3.12", false),
            ("3.5", false),
            ("2", false)
        ]
    );
    assert!(versions_of("ruby").is_empty());
    let listed = |id: &str| -> Vec<&str> {
        versions_of(id)
            .into_iter()
            .map(|version| version.version)
            .collect()
    };
    assert_eq!(listed("lua"), ["5.3", "5.1"]);
    assert_eq!(listed("php"), ["7", "5"]);
    assert_eq!(listed("csharp"), ["6", "5"]);
}

const SOURCE: &str = "function half(n) {\n  return Math.trunc(n / 2);\n}\nconsole.log(`${half(4)}${half(2)} items`);\n";

fn translate(source: &str, from: &str, to: &str) -> String {
    Translator::new()
        .translate(source, from, to, Mode::default())
        .expect("a translation")
}

#[test]
fn divides_integers_in_lua_5_1_and_php_5_without_operators_and_intdiv() {
    for target in ["lua", "lua@5.1"] {
        assert!(translate(SOURCE, "javascript", target).contains("return ut_integer_divide(n, 2)"));
    }
    assert!(translate(SOURCE, "javascript", "php@5").contains("return (int) ($n / 2);"));
}

#[test]
fn joins_text_with_plus_in_csharp_5() {
    assert!(
        translate(SOURCE, "javascript", "csharp@5").contains(concat!(
            "System.Console.WriteLine(System.Convert.ToString(Half(4)) + ",
            "System.Convert.ToString(Half(2)) + \" items\");"
        ))
    );
    assert!(
        translate(SOURCE, "javascript", "csharp")
            .contains("System.Console.WriteLine($\"{Half(4)}{Half(2)} items\");")
    );
}

#[test]
fn keeps_the_meaning_of_every_task_written_in_every_older_version() {
    let translator = Translator::new();
    let mut tasks: Vec<String> = fs::read_dir("examples/programs")
        .expect("the examples")
        .filter_map(|entry| {
            let name = entry.ok()?.file_name().into_string().ok()?;
            name.strip_suffix(".js").map(str::to_owned)
        })
        .collect();
    tasks.sort();
    for target in ["python@2", "lua@5.1", "php@5", "csharp@5"] {
        for task in &tasks {
            let source =
                fs::read_to_string(format!("examples/programs/{task}.js")).expect("a task");
            let meta = translator.to_meta(&source, "javascript").expect("meta");
            let written = translator
                .from_meta(&meta, target, None, Mode::default())
                .expect("the older version");
            let back = translator
                .to_meta(&written, split_version(target).0)
                .expect("read back");
            assert!(same_meaning(&meta, &back), "{target} {task}:\n{written}");
        }
    }
}

#[test]
fn reads_lua_concatenation_as_joined_text_looser_than_addition() {
    let lua = "print(half(4) .. half(2) .. \" items\")\nlocal s = \"a\" .. 1 + 2\n";
    assert_eq!(
        translate(lua, "lua", "javascript"),
        "console.log(`${half(4)}${half(2)} items`);\nconst s = `a${1 + 2}`;\n"
    );
}
