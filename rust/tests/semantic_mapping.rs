use universal_translator::natural::natural_language_ids;
use universal_translator::translator::machine_target_ids;
use universal_translator::{Options, TextLayout, Translator};

fn options() -> Options {
    Options {
        layout: TextLayout::Target,
        ..Options::default()
    }
}

#[test]
fn independent_statements_map_to_their_full_expansion_in_every_machine_target() {
    let source = "const value = 5;\nconsole.log(value + 2);\n";
    let translator = Translator::new();
    for target in machine_target_ids() {
        let result = translator
            .translate_partial(source, "javascript", target, options(), false)
            .unwrap();
        assert!(result.complete, "{target}");
        let mapped = |source| {
            result
                .line_map
                .iter()
                .copied()
                .filter_map(|(from, to)| (from == source).then_some(to))
                .collect::<Vec<_>>()
        };
        let declaration = mapped(0);
        let print = mapped(1);
        // LLVM folds the literal into its store instruction.
        assert!(
            declaration.len() >= if target == "llvm" { 1 } else { 2 },
            "{target}: {declaration:?}"
        );
        assert!(print.len() >= 3, "{target}: {print:?}");
        assert!(
            !declaration.iter().any(|line| print.contains(line)),
            "{target}"
        );
        let lines = result.text.lines().collect::<Vec<_>>();
        assert!(
            declaration
                .iter()
                .chain(&print)
                .all(|line| !lines[*line].trim().is_empty()),
            "{target}"
        );
        assert_eq!(
            result.text,
            translator
                .translate_with(source, "javascript", target, options())
                .unwrap(),
            "{target}"
        );
        let restored = translator
            .translate_partial(&result.text, target, "python", options(), false)
            .unwrap();
        assert!(restored.complete, "{target}");
        assert_eq!(restored.text, "value = 5\nprint(value + 2)\n", "{target}");
        for (statement, instruction) in &result.line_map {
            assert!(
                restored.line_map.contains(&(*instruction, *statement)),
                "{target}: missing {instruction} → {statement}: {:?}",
                restored.line_map
            );
        }
    }
}

#[test]
fn machine_arrays_conditions_loops_and_interpolated_calls_keep_their_owners() {
    let source = include_str!("../../examples/translation/machine-mapping.js");
    let translator = Translator::new();
    let direct = translator
        .translate_partial(source, "javascript", "python", options(), false)
        .unwrap();
    let direct_lines = direct.text.lines().collect::<Vec<_>>();
    for target in machine_target_ids() {
        let machine = translator
            .translate_partial(source, "javascript", target, options(), false)
            .unwrap();
        let restored = translator
            .translate_partial(&machine.text, target, "python", options(), false)
            .unwrap();
        assert!(machine.complete && restored.complete, "{target}");
        let content = |text: &str| {
            text.lines()
                .filter(|line| !line.trim().is_empty())
                .collect::<Vec<_>>()
                .join("\n")
        };
        assert_eq!(content(&restored.text), content(&direct.text), "{target}");
        let restored_lines = restored.text.lines().collect::<Vec<_>>();
        for (from, instruction) in &machine.line_map {
            let expected = direct
                .line_map
                .iter()
                .filter_map(|(line, mapped)| (line == from).then_some(direct_lines[*mapped].trim()))
                .collect::<Vec<_>>();
            assert!(
                restored
                    .line_map
                    .iter()
                    .any(|(line, mapped)| line == instruction
                        && expected.contains(&restored_lines[*mapped].trim())),
                "{target}: missing {instruction} → {from}: {:?}",
                restored.line_map
            );
        }
    }
}

#[test]
fn the_complete_fibonacci_interpolation_maps_to_call_and_echo() {
    let source = include_str!("../../examples/translation/mapping.java");
    let translator = Translator::new();
    let bash = translator
        .translate_partial(source, "java", "bash", options(), true)
        .unwrap();
    let print = source
        .lines()
        .position(|line| line.contains("System.out.println"))
        .unwrap();
    let call = bash
        .text
        .lines()
        .position(|line| line.trim() == "fibonacci \"$index\"")
        .unwrap();
    let echo = bash
        .text
        .lines()
        .position(|line| line.contains("echo \"fibonacci($index) = $REPLY\""))
        .unwrap();
    assert_eq!(
        bash.line_map
            .iter()
            .copied()
            .filter(|(line, _)| *line == print)
            .collect::<Vec<_>>(),
        vec![(print, call), (print, echo)]
    );
    let restored = translator
        .translate_partial(&bash.text, "bash", "java", options(), true)
        .unwrap();
    let target = restored
        .text
        .lines()
        .position(|line| line.contains("System.out.println"))
        .unwrap();
    assert_eq!(
        restored
            .line_map
            .iter()
            .copied()
            .filter(|(line, _)| *line == call || *line == echo)
            .collect::<Vec<_>>(),
        vec![(call, target), (echo, target)]
    );
}

#[test]
fn java_print_maps_to_both_bash_command_and_echo_and_back() {
    let java = "class Main {\n    static int fib(int n) {\n        return n;\n    }\n    public static void main(String[] args) {\n        System.out.println(fib(5));\n    }\n}\n";
    let translator = Translator::new();
    let bash = translator
        .translate_partial(java, "java", "bash", options(), true)
        .unwrap();
    let call = bash.text.lines().position(|line| line == "fib 5").unwrap();
    let echo = bash
        .text
        .lines()
        .position(|line| line.starts_with("echo "))
        .unwrap();
    assert_eq!(
        bash.line_map
            .iter()
            .copied()
            .filter(|(source, _)| *source == 5)
            .collect::<Vec<_>>(),
        vec![(5, call), (5, echo)]
    );
    let java = translator
        .translate_partial(&bash.text, "bash", "java", options(), true)
        .unwrap();
    let print = java
        .text
        .lines()
        .position(|line| line.contains("System.out.println"))
        .unwrap();
    assert_eq!(
        java.line_map
            .iter()
            .copied()
            .filter(|(source, _)| *source == call || *source == echo)
            .collect::<Vec<_>>(),
        vec![(call, print), (echo, print)]
    );
}

#[test]
fn every_controlled_natural_language_maps_statements_in_both_directions() {
    let source = "const x = 1;\nconsole.log(x + 2);\n";
    let translator = Translator::new();
    for id in natural_language_ids() {
        let natural = translator
            .translate_partial(source, "javascript", id, options(), true)
            .unwrap();
        assert!(natural.complete, "{id}");
        assert_eq!(natural.line_map, vec![(0, 0), (1, 1)], "to {id}");
        let python = translator
            .translate_partial(&natural.text, id, "python", options(), true)
            .unwrap();
        assert_eq!(python.text, "x = 1\nprint(x + 2)\n", "from {id}");
        assert_eq!(python.line_map, vec![(0, 0), (1, 1)], "from {id}");
    }
}

#[test]
fn source_lines_survive_fragment_wrappers_and_split_statements() {
    let translator = Translator::new();
    let python = translator
        .translate_partial(
            "\n\nconst x = 1; console.log(x);\n",
            "javascript",
            "python",
            options(),
            true,
        )
        .unwrap();
    assert_eq!(python.text, "x = 1\nprint(x)\n");
    assert_eq!(python.line_map, vec![(2, 0), (2, 1)]);
    let russian = translator
        .translate_partial("return 1;\n", "c", "russian", options(), true)
        .unwrap();
    assert!(russian.complete);
    assert_eq!(russian.line_map, vec![(0, 0)]);
}
