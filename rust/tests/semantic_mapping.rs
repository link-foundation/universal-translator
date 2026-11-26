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
