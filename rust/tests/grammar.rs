use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use universal_translator::Mode;
use universal_translator::formal::languages::Convention;
use universal_translator::formal::lowering::{Instruction, lower_program};
use universal_translator::formal::names::{name_words, spell_name};
use universal_translator::formal::rules::{context_rules, understanding_rules};
use universal_translator::meta::Rule;
use universal_translator::meta::{Node, rewrite};
use universal_translator::translator::{
    Translator, language_ids, machine_target_ids, meaning_difference,
};

#[test]
fn member_calls_keep_computed_receivers_and_java_continuations() {
    let translator = Translator::new();
    for (source, language, expected) in [
        (
            "factory().first(1).second(2);\n",
            "javascript",
            "factory().first(1).second(2)\n",
        ),
        (
            "ResponseEntity\n    .status(HttpStatus.CREATED)\n    .body(user);\n",
            "java",
            "ResponseEntity.status(HttpStatus.CREATED).body(user)\n",
        ),
    ] {
        assert_eq!(
            translator
                .translate(source, language, "python", Mode::default())
                .unwrap(),
            expected
        );
    }
}

#[test]
fn rust_print_resolves_display_fields_and_literal_braces() {
    let translator = Translator::new();
    let source = r#"
        fn main() {
            let forestOwner: &str = "Fox";
            println!("{{{1}}} is {} with {name}/{forestOwner}", "first", "second", name = "third");
        }
    "#;
    let target = translator
        .translate(source, "rust", "python", Mode::default())
        .unwrap();
    assert!(target.contains("with third/{forest_owner}"), "{target}");
    assert!(target.contains("{{second}} is first"), "{target}");
    assert!(target.contains("forest_owner = \"Fox\""), "{target}");
}

#[test]
fn rust_println_keeps_its_own_newline() {
    let translator = Translator::new();
    let source = r#"fn main() { println!("line\n"); println!(); }"#;
    let target = translator
        .translate(source, "rust", "rust", Mode::default())
        .unwrap();
    assert!(target.contains(r#"println!("line\n");"#), "{target}");
    assert!(target.contains(r#"println!("");"#), "{target}");
}

#[test]
fn rust_print_reordering_calls_retains_native_argument_order() {
    let translator = Translator::new();
    let single_call = r#"println!("{item}/{0}/{item}", take(1), item = take(2));"#;
    let source = format!("fn main() {{ {single_call} }}");
    let target = translator
        .translate(&source, "rust", "rust", Mode::default())
        .unwrap();
    assert!(target.contains(single_call), "{target}");
    let error = translator
        .translate(&source, "rust", "python", Mode::default())
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("Rust format requires a native macro in python")
    );
}

#[test]
fn rust_print_retains_native_formatting_and_renames_captures() {
    let translator = Translator::new();
    let source = r#"fn main() { let itemName: &str = "wide"; println!("{itemName:>6}"); }"#;
    let target = translator
        .translate(source, "rust", "rust", Mode::default())
        .unwrap();
    assert!(
        target.contains(r#"println!("{itemName:>6}", itemName = item_name);"#),
        "{target}"
    );
}

#[test]
fn standalone_cpp_member_and_namespace_calls_survive_beside_prototypes() {
    let translator = Translator::new();
    let source = r#"
        int helper(int value);
        int main() {
            values.push(1);
            values.pop();
            std::puts("kept");
            return 0;
        }
    "#;
    let program = translator.to_meta(source, "cpp").unwrap();
    assert!(program.nodes("functions").is_empty());
    let main = program.node("main").unwrap();
    let calls: Vec<_> = main
        .nodes("statements")
        .iter()
        .map(|item| item.node("expression").unwrap().str("callee").unwrap())
        .collect();
    assert_eq!(calls, ["values.push", "values.pop", "std::puts"]);
    let emitted = translator
        .from_meta(&program, "cpp", None, Mode::default())
        .unwrap();
    for call in ["values.push(1);", "values.pop();", "std::puts(\"kept\");"] {
        assert!(emitted.contains(call), "missing {call} in\n{emitted}");
    }
}

#[test]
fn cpp_template_arguments_and_headers_survive_beside_comparisons() {
    let translator = Translator::new();
    let source = r#"#include <algorithm>
#include <iostream>
using namespace std;
int main() {
    max<unsigned>(1, 2);
    lookup<std::vector<unsigned>>(1);
    a < b > (c);
    a < 1 > (c);
    std::get<
        1
    >(values);
    std::cout << 1 << std::endl;
    return 0;
}
"#;
    let program = translator.to_meta(source, "cpp").unwrap();
    let statements = program.node("main").unwrap().nodes("statements");
    let first = statements[0].node("expression").unwrap();
    assert!(first.is("CppTemplateCall"));
    assert_eq!(first.str("callee"), Some("max"));
    assert_eq!(first.str("typeArguments"), Some("unsigned"));
    assert!(
        statements[1]
            .node("expression")
            .unwrap()
            .is("CppTemplateCall")
    );
    assert!(statements[2].node("expression").unwrap().is("Binary"));
    assert!(statements[3].node("expression").unwrap().is("Binary"));
    let indexed = statements[4].node("expression").unwrap();
    assert!(indexed.is("CppTemplateCall"));
    assert_eq!(indexed.str("callee"), Some("std::get"));
    assert_eq!(indexed.str("typeArguments"), Some("1"));
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains("#include <algorithm>\n#include <iostream>\nusing namespace std;"));
    assert_eq!(emitted.matches("#include <iostream>").count(), 1);
    assert!(emitted.contains("lookup<std::vector<unsigned>>(1);"));
    assert!(emitted.contains("std::get<1>(values);"));
    let error = translator
        .translate(source, "cpp", "python", Mode::default())
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("C++ template call requires a library mapping for python")
    );
}

#[test]
fn cpp_template_objects_keep_the_source_type_and_default_construction() {
    let translator = Translator::new();
    let source = r#"#include <optional>
int main() {
    std::optional<std::optional<unsigned>> empty;
    std::optional<unsigned> count = 7;
    return 0;
}
"#;
    let program = translator.to_meta(source, "cpp").unwrap();
    let statements = program.node("main").unwrap().nodes("statements");
    assert!(statements[0].node("value").is_none());
    assert!(statements[0].str("type").unwrap().contains("unsigned"));
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains("std::optional<std::optional<unsigned>> empty;"));
    assert!(emitted.contains("std::optional<unsigned> count = 7;"));
    let error = translator
        .translate(source, "cpp", "python", Mode::default())
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("C++ template type requires a library mapping for python")
    );
}

#[test]
fn cpp_fixed_arrays_retain_extent_and_brace_initialization() {
    let source = r#"int main() {
        const std::array<std::string, 3> fallFruit {"pear", "apple",};
        std::array<std::array<int, 2>, 2> numbers = {{{1, 2}, {3, 4}}};
        fallFruit.size();
        a < 3 > b;
        return 0;
    }"#;
    let translator = Translator::new();
    let meta = translator.to_meta(source, "cpp").unwrap();
    let statements = meta.node("main").unwrap().nodes("statements");
    let fruit = statements[0].node("value").unwrap();
    assert!(fruit.is("CppInitializerList"));
    assert_eq!(fruit.flag("direct"), Some(true));
    assert_eq!(
        statements[1].node("value").unwrap().flag("direct"),
        Some(false)
    );
    assert_eq!(
        statements[2].node("expression").unwrap().str("callee"),
        Some(".size")
    );
    assert!(statements[3].node("expression").unwrap().is("Binary"));
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains(r#"const std::array<std::string,3> fall_fruit{"pear", "apple"};"#));
    assert!(emitted.contains("std::array<std::array<int,2>,2> numbers = {{{1, 2}, {3, 4}}};"));
    assert!(emitted.contains("fall_fruit.size();"));
    assert!(!emitted.contains("(int) fall_fruit.size()"));
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    assert_eq!(reread.node("main").unwrap().nodes("statements"), statements);
    let error = translator
        .translate(source, "cpp", "python", Mode::default())
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("C++ template type requires a library mapping for python")
    );
}

#[test]
fn cpp_parameters_keep_signedness_and_width() {
    let source = r#"bool positive(unsigned int wide, signed char byte, long long large, short small) {
    return wide > 0 && byte > 0 && large > 0 && small > 0;
}"#;
    let translator = Translator::new();
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(
        emitted.contains(
            "bool positive(unsigned int wide, signed char byte, long long large, short small)"
        ),
        "{emitted}"
    );
    let original = translator.to_meta(source, "cpp").unwrap();
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    assert_eq!(
        original.nodes("functions")[0].nodes("parameters"),
        reread.nodes("functions")[0].nodes("parameters")
    );
}

#[test]
fn cpp_shifts_bind_below_addition() {
    let source = r#"#include <iostream>
int main() {
    std::cout << 2 + 3 << " " << (32 >> 1 + 1) << std::endl;
    return 0;
}"#;
    let translator = Translator::new();
    let meta = translator.to_meta(source, "cpp").unwrap();
    let statements = meta.node("main").unwrap().nodes("statements");
    let output = statements[0];
    assert!(output.is("Print"));
    let values = output.node("value").unwrap().nodes("parts");
    assert_eq!(values[0].str("operator"), Some("add"));
    assert_eq!(values[2].str("operator"), Some("rightShift"));
    assert_eq!(
        values[2].node("right").unwrap().str("operator"),
        Some("add")
    );
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains(r#"std::cout << (2 + 3) << " ""#));
    assert!(emitted.contains("32 >> (1 + 1)"));
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    assert_eq!(reread.node("main").unwrap().nodes("statements"), statements);
    let error = translator
        .translate(source, "cpp", "python", Mode::default())
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("C++ shift or stream operator requires a mapping")
    );
}

#[test]
fn cpp_string_addition_keeps_characters() {
    let source = r#"#include <string>
std::string decorate(const std::string& prefix, std::string word) {
    return prefix[0] + word + '!';
}"#;
    let translator = Translator::new();
    let meta = translator.to_meta(source, "cpp").unwrap();
    let functions = meta.nodes("functions");
    let body = functions[0].node("body").unwrap();
    let value = body.nodes("statements")[0].node("value").unwrap();
    assert!(value.is("CppCharacterConcat"));
    assert!(
        value
            .node("left")
            .unwrap()
            .node("left")
            .unwrap()
            .is("Index")
    );
    assert!(value.node("right").unwrap().is("CppCharacter"));
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains("return prefix[0] + word + '!';"));
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    let reread_functions = reread.nodes("functions");
    let reread_body = reread_functions[0].node("body").unwrap();
    assert_eq!(reread_body, body);
    let error = translator
        .translate(source, "cpp", "python", Mode::default())
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("Cannot emit CppCharacterConcat as an expression")
    );
}

#[test]
fn cpp_characters_keep_escapes_and_integral_casts() {
    let source = r"int main() {
        emit((int)'\n', (char)97, (int)(char)(64 + 1), sizeof(char), sizeof('a'));
    }";
    let translator = Translator::new();
    let meta = translator.to_meta(source, "cpp").unwrap();
    let statements = meta.node("main").unwrap().nodes("statements");
    let arguments = statements[0].node("expression").unwrap().nodes("arguments");
    assert!(arguments[0].is("CppIntegralCast"));
    assert_eq!(arguments[0].str("castType"), Some("int"));
    assert_eq!(
        arguments[0].node("operand").unwrap().str("raw"),
        Some(r"\n")
    );
    assert_eq!(arguments[1].str("castType"), Some("char"));
    assert_eq!(
        arguments[2].node("operand").unwrap().str("castType"),
        Some("char")
    );
    assert_eq!(
        arguments[3].node("operand").unwrap().str("name"),
        Some("char")
    );
    assert!(arguments[4].node("operand").unwrap().is("CppCharacter"));
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains(r"(int)('\n')"));
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    assert_eq!(reread.node("main").unwrap().nodes("statements"), statements);
}

#[test]
fn cpp_sizeof_keeps_unevaluated_operands_and_qualified_string_types() {
    let source = r#"#include <string>
using std::string;
int main() {
    string s = "水a";
    string::size_type bytes = s.size() * sizeof(string::value_type);
    std::size_t integerWidth = sizeof(int);
    std::size_t callWidth = sizeof(next());
}"#;
    let translator = Translator::new();
    let meta = translator.to_meta(source, "cpp").unwrap();
    let statements = meta.node("main").unwrap().nodes("statements");
    assert_eq!(
        statements[1].str("type"),
        Some("source:string :: size_type")
    );
    assert!(
        statements[1]
            .node("value")
            .unwrap()
            .node("right")
            .unwrap()
            .is("SizeOf")
    );
    assert_eq!(
        statements[2]
            .node("value")
            .unwrap()
            .node("operand")
            .unwrap()
            .str("name"),
        Some("int")
    );
    assert_eq!(
        statements[3]
            .node("value")
            .unwrap()
            .node("operand")
            .unwrap()
            .str("callee"),
        Some("next")
    );
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains("string::size_type bytes = s.size() * sizeof(string::value_type);"));
    assert!(emitted.contains("std::size_t integer_width = sizeof(int);"));
    assert!(emitted.contains("std::size_t call_width = sizeof(next());"));
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    assert_eq!(reread.node("main").unwrap().nodes("statements"), statements);
}

#[test]
fn reads_direct_string_initialization_alongside_cpp_prototypes() {
    let source = r#"#include <string>
std::string empty();
std::string suggest(const char* text);
std::string repeat(int, char);
int main() {
    std::string greeting(
        "Hello\0ignored"
    );
    std::string suffix;
    int copies = 3;
    std::string repeated(copies,
        '\0'
    );
    greeting.append(" , world!");
    return 0;
}
"#;
    let translator = Translator::new();
    let program = translator.to_meta(source, "cpp").unwrap();
    assert!(program.nodes("functions").is_empty());
    let statements = program.node("main").unwrap().nodes("statements");
    let greeting = &statements[0];
    assert!(greeting.is("Declaration"));
    assert_eq!(greeting.str("name"), Some("greeting"));
    assert_eq!(greeting.str("type"), Some("text"));
    assert_eq!(greeting.node("value").unwrap().str("value"), Some("Hello"));
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains("std::string greeting = \"Hello\";"));
    assert!(emitted.contains("std::string suffix = \"\";"));
    assert_eq!(statements[1].node("value").unwrap().str("value"), Some(""));
    let repeated = statements[3];
    assert_eq!(repeated.str("name"), Some("repeated"));
    let initialization = repeated.node("value").unwrap();
    assert_eq!(initialization.str("callee"), Some("std::string"));
    let arguments = initialization.nodes("arguments");
    assert_eq!(arguments[0].str("name"), Some("copies"));
    assert!(arguments[1].is("CppCharacter"));
    assert_eq!(arguments[1].str("raw"), Some(r"\0"));
    assert!(emitted.contains(r"std::string repeated = std::string(copies, '\0');"));
    assert!(emitted.contains("greeting.append(\" , world!\");"));
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    assert_eq!(reread.node("main").unwrap().nodes("statements"), statements);
    let error = translator
        .to_meta(r#"std::string greeting("\07");"#, "cpp")
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("Unsupported C++ string initializer escape")
    );
}

#[test]
fn cpp_initializer_resolves_bound_values_without_reinterpreting_comparisons() {
    let source = r#"#include <optional>
#include <string>
void example(int width) {
    std::optional<int> result(width);
}
int main() {
    std::string original = "layout";
    std::string copy(original);
    std::string prototype(std::string);
    int count = 1;
    int limit = 2;
    count < limit > probe(count);
    return 0;
}
"#;
    let translator = Translator::new();
    let program = translator.to_meta(source, "cpp").unwrap();
    let initial = program.nodes("functions")[0]
        .node("body")
        .unwrap()
        .nodes("statements")[0]
        .node("value")
        .unwrap();
    assert!(initial.is("CppDirectInitializer"));
    assert_eq!(initial.nodes("arguments")[0].str("name"), Some("width"));
    let statements = program.node("main").unwrap().nodes("statements");
    let copy = statements[1].node("value").unwrap();
    assert!(copy.is("CppDirectInitializer"));
    assert_eq!(copy.nodes("arguments")[0].str("name"), Some("original"));
    assert_eq!(
        statements[4].node("expression").unwrap().str("operator"),
        Some("greater")
    );
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains("std::optional<int> result(width);"));
    assert!(emitted.contains("std::string copy(original);"));
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    assert_eq!(reread.node("main").unwrap().nodes("statements"), statements);
}

#[test]
fn cpp_direct_initialization_keeps_object_constructors_beside_prototypes() {
    let source = r#"#include <iostream>
#include <string_view>
std::string_view factory(int size = 3);
const std::string_view message(
    "ready)"
);
int main() {
    std::string_view deferred();
    std::string_view suffix(message.substr(1));
    std::string_view escaped("\x61");
    int count(2);
    count * estimate(1);
    std::cout << suffix << escaped << '\n';
    return 0;
}
"#;
    let translator = Translator::new();
    let program = translator.to_meta(source, "cpp").unwrap();
    assert!(program.nodes("functions").is_empty());
    let statements = program.node("main").unwrap().nodes("statements");
    assert_eq!(statements[0].str("name"), Some("message"));
    assert_eq!(statements[1].str("name"), Some("suffix"));
    assert!(
        statements[1]
            .node("value")
            .unwrap()
            .is("CppDirectInitializer")
    );
    assert_eq!(statements[2].str("name"), Some("escaped"));
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains(r#"const std::string_view message("ready)");"#));
    assert!(emitted.contains("std::string_view suffix(message.substr(1));"));
    assert!(emitted.contains(r#"std::string_view escaped("\x61");"#));
    assert!(emitted.contains("int count(2);"));
    assert_eq!(
        statements[4].node("expression").unwrap().str("operator"),
        Some("multiply")
    );
    let reread = translator.to_meta(&emitted, "cpp").unwrap();
    assert_eq!(reread.node("main").unwrap().nodes("statements"), statements);
    let error = translator
        .translate(source, "cpp", "python", Mode::default())
        .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("C++ direct initialization requires a library mapping for python")
    );
}

#[test]
fn cpp_stream_extraction_and_throw_are_statements() {
    let source = r#"#include <iostream>
#include <stdexcept>
#include <string>
using std::string;
int main() {
    string label;
    int count = 0;
    std::cin >> label >> count;
    if (count == 0) {
        throw std::invalid_argument(label);
    }
    std::cout << label << count;
    return 0;
}
"#;
    let translator = Translator::new();
    let program = translator.to_meta(source, "cpp").unwrap();
    let statements = program.node("main").unwrap().nodes("statements");
    assert_eq!(
        statements[0]
            .node("value")
            .and_then(|value| value.str("value")),
        Some("")
    );
    assert_eq!(
        statements[2]
            .node("expression")
            .and_then(|expression| expression.str("operator")),
        Some("rightShift")
    );
    let guard = statements[3].node("then").unwrap();
    assert!(guard.nodes("statements")[0].is("Throw"));
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains("std::string label = \"\";"));
    assert!(emitted.contains("std::cin >> label >> count;"));
    assert!(emitted.contains("throw std::invalid_argument(label);"));
}

#[test]
fn cpp_file_scope_initializers_preserve_source_order_and_dependencies() {
    let source = r"int later();
int earlier() { return 7; }
// Shared by the two calls from main.
int shared_value = earlier() + later();
int later() { return 2; }
int advance() { shared_value += 1; return shared_value; }
int main() { return advance() + advance(); }
";
    let translator = Translator::new();
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    let mut remainder = emitted.as_str();
    for section in [
        "int later();",
        "int earlier() {",
        "// Shared by the two calls from main.\nint shared_value = earlier() + later();",
        "int later() {",
        "int advance() {",
        "int main() {",
    ] {
        remainder = remainder
            .split_once(section)
            .unwrap_or_else(|| panic!("Missing ordered section {section:?}:\n{emitted}"))
            .1;
    }
    assert_eq!(
        meaning_difference(
            &translator.to_meta(source, "cpp").unwrap(),
            &translator.to_meta(&emitted, "cpp").unwrap()
        ),
        None
    );
}

#[test]
fn cpp_vectors_keep_empty_and_list_initialization_and_element_types() {
    let translator = Translator::new();
    let source = r"#include <vector>
int main() {
  std::vector<int> empty;
  std::vector<int> list{3, 4};
  std::vector<unsigned> wide;
  return 0;
}
";
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert_eq!(emitted.matches("#include <vector>").count(), 1);
    for declaration in [
        "std::vector<int> empty = {};",
        "std::vector<int> list = {3, 4};",
        "std::vector<unsigned> wide;",
    ] {
        assert!(
            emitted.contains(declaration),
            "Missing {declaration:?}:\n{emitted}"
        );
    }
    assert_eq!(
        meaning_difference(
            &translator.to_meta(source, "cpp").unwrap(),
            &translator.to_meta(&emitted, "cpp").unwrap()
        ),
        None
    );
}

#[test]
fn cpp_using_declarations_stay_in_their_blocks() {
    let translator = Translator::new();
    let source = "#include <iostream>\nint main() {\n  using namespace std;\n  if (true) {\n    using std::flush;\n    cout << 3 << flush;\n  }\n  return 0;\n}\n";
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    let lines: Vec<_> = emitted.lines().collect();
    let main = lines
        .iter()
        .position(|line| *line == "int main() {")
        .unwrap();
    let directly_in_main = lines[main + 1];
    let within_condition = lines[main + 3];
    assert_eq!(directly_in_main.trim_start(), "using namespace std;");
    assert_eq!(lines[main + 2].trim_start(), "if (true) {");
    assert_eq!(within_condition.trim_start(), "using std::flush;");
    assert!(
        within_condition.len() - within_condition.trim_start().len()
            > directly_in_main.len() - directly_in_main.trim_start().len()
    );
    assert!(
        translator
            .translate(source, "cpp", "python", Mode::default())
            .unwrap_err()
            .to_string()
            .contains("Cannot emit Import as a statement")
    );
}

#[test]
fn cpp_const_reference_and_pointer_parameters_keep_their_qualifiers() {
    let translator = Translator::new();
    let source = r#"#include <string>
int example(const std::string& phrase, const char* suffix) {
  return phrase.find(suffix);
}
int main() { return example("abc", "bc"); }
"#;
    let emitted = translator
        .translate(source, "cpp", "cpp", Mode::default())
        .unwrap();
    assert!(emitted.contains("const std::string & phrase"));
    assert!(emitted.contains("const char* suffix"));
    assert_eq!(
        meaning_difference(
            &translator.to_meta(source, "cpp").unwrap(),
            &translator.to_meta(&emitted, "cpp").unwrap()
        ),
        None
    );
}

/// Every task with goldens under `examples/programs/translated`.
fn tasks() -> Vec<String> {
    let folder = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs/translated");
    let mut names: Vec<String> = fs::read_dir(folder)
        .expect("the goldens folder")
        .map(|entry| {
            entry
                .expect("a golden entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    names.sort();
    names
}

fn programs() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs")
}

fn read(path: PathBuf) -> String {
    fs::read_to_string(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

fn source(task: &str) -> String {
    read(programs().join(format!("{task}.js")))
}

fn extension(target: &str) -> &'static str {
    match target {
        "javascript" => "js",
        "typescript" => "ts",
        "python" => "py",
        "ruby" => "rb",
        "lua" => "lua",
        "php" => "php",
        "c" => "c",
        "cpp" => "cpp",
        "csharp" => "cs",
        "java" => "java",
        "go" => "go",
        "rust" => "rs",
        "kotlin" => "kt",
        "swift" => "swift",
        "perl" => "pl",
        "dart" => "dart",
        "scala" => "scala",
        "julia" => "jl",
        "r" => "R",
        "groovy" => "groovy",
        "objc" => "m",
        "nim" => "nim",
        "d" => "d",
        "pascal" => "pas",
        "fortran" => "f90",
        "ada" => "adb",
        "vb" => "vb",
        "bash" => "sh",
        "matlab" => "matlab",
        "zig" => "zig",
        "lean" => "lean",
        "rocq" => "v",
        "gml" => "gml",
        "nasm" => "asm",
        "gas" => "s",
        "arm64" => "arm64",
        "cil" => "il",
        "jvm" => "j",
        "llvm" => "ll",
        "wat" => "wat",
        other => panic!("no extension for {other}"),
    }
}

fn language_of(extension_text: &str) -> Option<&'static str> {
    language_ids()
        .into_iter()
        .find(|language| extension(language) == extension_text)
}

fn golden(task: &str, target: &str) -> PathBuf {
    programs()
        .join("translated")
        .join(task)
        .join(format!("{task}.{}", extension(target)))
}

const ISSUE_C: &str = "// Hello World in C

#include <stdio.h>

int main() {
    // print \"Hello World!\" into console followed by new line symbol by function call
    printf(\"Hello World!\\n\");
    return 0;
}
";

fn translate(source: &str, from: &str, to: &str) -> String {
    Translator::new()
        .translate(source, from, to, Mode::ContextDependent)
        .unwrap_or_else(|error| panic!("{from} -> {to}: {error}"))
}

// ---- shared golden translations ----

#[test]
fn matches_every_golden_file_for_all_targets() {
    let translator = Translator::new();
    let targets: Vec<&str> = language_ids()
        .into_iter()
        .chain(machine_target_ids())
        .collect();
    assert_eq!(targets.len(), 40);
    let mut mismatches = Vec::new();
    for task in tasks() {
        let task = task.as_str();
        let meta = translator.to_meta(&source(task), "javascript").unwrap();
        for target in &targets {
            let written = translator
                .from_meta(&meta, target, Some("javascript"), Mode::ContextDependent)
                .unwrap_or_else(|error| panic!("{task} -> {target}: {error}"));
            if written != read(golden(task, target)) {
                mismatches.push(format!("{task} -> {target}"));
            }
        }
    }
    assert!(mismatches.is_empty(), "golden mismatches: {mismatches:?}");
}

// ---- meaning is preserved ----

#[test]
fn every_translation_returns_to_the_same_meta_program() {
    let translator = Translator::new();
    for task in tasks() {
        let task = task.as_str();
        let meta = translator.to_meta(&source(task), "javascript").unwrap();
        for language in language_ids() {
            let target = translator
                .from_meta(&meta, language, Some("javascript"), Mode::ContextDependent)
                .unwrap();
            let back = translator
                .to_meta(&target, language)
                .unwrap_or_else(|error| panic!("{task} in {language}: {error}"));
            assert_eq!(
                (task, language, meaning_difference(&meta, &back)),
                (task, language, None)
            );
            let from_golden = translator
                .to_meta(&read(golden(task, language)), language)
                .unwrap();
            assert_eq!(
                (task, language, meaning_difference(&meta, &from_golden)),
                (task, language, None)
            );
        }
    }
}

#[test]
fn hand_written_programs_preserve_structure_and_native_arithmetic_contracts() {
    let translator = Translator::new();
    let mut count = 0;
    for entry in fs::read_dir(programs().join("hand-written")).unwrap() {
        let path = entry.unwrap().path();
        let task = path.file_stem().unwrap().to_str().unwrap().to_owned();
        let Some(language) = path
            .extension()
            .and_then(|e| e.to_str())
            .and_then(language_of)
        else {
            continue;
        };
        let mut expected = translator.to_meta(&source(&task), "javascript").unwrap();
        // Positive fixture inputs concealed the native signed-% difference.
        if matches!(language, "python" | "ruby" | "perl") {
            expected = rewrite(expected, |item| {
                if item.is("Binary") && item.str("operator") == Some("remainder") {
                    item.with("operator", "modulo")
                } else {
                    item
                }
            });
        }
        let actual = translator.to_meta(&read(path.clone()), language).unwrap();
        assert_eq!(
            (
                path.display().to_string(),
                meaning_difference(&expected, &actual)
            ),
            (path.display().to_string(), None)
        );
        count += 1;
    }
    assert!(count >= 6);
}

// ---- the issue example ----

#[test]
fn adapts_comments_to_the_target_language_by_default() {
    let csharp = translate(ISSUE_C, "c", "csharp");
    assert!(csharp.contains("Hello World in C#"));
    assert!(csharp.contains("by method call"));
    assert!(csharp.contains("System.Console.WriteLine(\"Hello World!\");"));
    assert!(csharp.contains("static void Main()"));
}

#[test]
fn keeps_comments_word_for_word_in_literal_mode() {
    let csharp = Translator::new()
        .translate(ISSUE_C, "c", "csharp", Mode::Literal)
        .unwrap();
    assert!(csharp.contains("Hello World in C "));
    assert!(csharp.contains("by function call"));
}

#[test]
fn keeps_only_the_behaviour_in_same_effect_mode() {
    let csharp = Translator::new()
        .translate(ISSUE_C, "c", "csharp", Mode::SameEffect)
        .unwrap();
    assert!(!csharp.contains("Hello World in"));
    assert!(csharp.contains("System.Console.WriteLine(\"Hello World!\");"));
}

#[test]
fn rejects_unknown_modes_and_languages() {
    let error = "loose".parse::<Mode>().unwrap_err();
    assert!(error.contains("Unsupported mode"));
    let error = Translator::new()
        .translate(ISSUE_C, "c", "cobol", Mode::ContextDependent)
        .unwrap_err();
    assert!(error.to_string().contains("does not describe"));
}

// ---- target conventions ----

#[test]
fn spells_declared_names_in_each_language_convention() {
    let gcd = source("greatest-common-divisor");
    assert!(
        translate(&gcd, "javascript", "python")
            .contains("def greatest_common_divisor(first, second):")
    );
    assert!(
        translate(&gcd, "javascript", "csharp")
            .contains("static int GreatestCommonDivisor(int first, int second)")
    );
    assert!(
        translate(&gcd, "javascript", "go")
            .contains("func greatestCommonDivisor(first int, second int) int {")
    );
    assert_eq!(
        name_words("greatestCommonDivisor"),
        ["greatest", "common", "divisor"]
    );
    assert_eq!(name_words("HTTPServer_port"), ["http", "server", "port"]);
    assert_eq!(
        spell_name("greatest-common-divisor", Convention::Pascal),
        "GreatestCommonDivisor"
    );
}

#[test]
fn copies_reassigned_parameters_where_parameters_are_immutable() {
    let gcd = source("greatest-common-divisor");
    assert!(translate(&gcd, "javascript", "rust").contains("let mut first: i64 = first;"));
    assert!(translate(&gcd, "javascript", "kotlin").contains("var first = first"));
    assert!(!translate(&gcd, "javascript", "python").contains("first = first"));
}

#[test]
fn writes_compound_assignment_only_where_the_language_has_it() {
    let squares = source("sum-of-squares");
    assert!(translate(&squares, "javascript", "lua").contains("total = total + number * number"));
    assert!(translate(&squares, "javascript", "python").contains("total += number * number"));
}

#[test]
fn turns_text_concatenation_into_each_language_interpolation() {
    let factorial = source("factorial");
    assert!(
        translate(&factorial, "javascript", "python")
            .contains("print(f\"{number}! = {factorial(number)}\")")
    );
    assert!(
        translate(&factorial, "javascript", "swift")
            .contains("print(\"\\(number)! = \\(factorial(number))\")")
    );
    assert!(
        translate(&factorial, "javascript", "c")
            .contains("printf(\"%d! = %d\\n\", number, factorial(number));")
    );
}

// ---- replaceable rule layers ----

#[test]
fn applies_custom_meta_layers_before_the_context_rules() {
    let shout = Rule {
        name: "shout".into(),
        apply: Arc::new(|program, _| {
            rewrite(program, |current: Node| {
                if current.is("Text") {
                    let value = current.str("value").unwrap_or_default().to_uppercase();
                    current.with("value", value)
                } else {
                    current
                }
            })
        }),
    };
    let custom = Translator::new().with_layer(vec![shout]);
    let python = custom
        .translate(
            &source("hello-world"),
            "javascript",
            "python",
            Mode::ContextDependent,
        )
        .unwrap();
    assert!(python.contains("print(\"HELLO WORLD!\")"));
}

#[test]
fn lets_callers_remove_or_decorate_a_rule() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let context: Vec<Rule> = context_rules()
        .into_iter()
        .filter(|rule| rule.name != "adaptComments")
        .map(|rule| {
            let calls = Arc::clone(&calls);
            let inner = Arc::clone(&rule.apply);
            Rule {
                name: rule.name.clone(),
                apply: Arc::new(move |program, settings| {
                    calls.lock().unwrap().push(rule.name.clone());
                    inner(program, settings)
                }),
            }
        })
        .collect();
    let without_comments = Translator {
        context,
        ..Translator::new()
    };
    let ruby = without_comments
        .translate(
            &source("hello-world"),
            "javascript",
            "ruby",
            Mode::ContextDependent,
        )
        .unwrap();
    assert!(ruby.contains("# Hello World in JavaScript"));
    assert_eq!(
        *calls.lock().unwrap(),
        [
            "copyReassignedParameters",
            "expandArrayFills",
            "expandForEach",
            "spellNames",
            "spellCommonLibrary"
        ]
    );
    assert!(
        understanding_rules()
            .iter()
            .any(|rule| rule.name == "recognizePrint")
    );
}

#[test]
fn reports_every_stage_through_the_trace_hook() {
    let stages = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&stages);
    Translator::new()
        .with_trace(move |stage, _| seen.lock().unwrap().push(stage.to_owned()))
        .translate(
            &source("hello-world"),
            "javascript",
            "go",
            Mode::ContextDependent,
        )
        .unwrap();
    assert_eq!(
        *stages.lock().unwrap(),
        ["parsed", "understood", "typed", "transformed", "adapted"]
    );
}

#[test]
fn explains_syntax_errors_with_the_line_number() {
    let error = Translator::new()
        .to_meta("let = ;", "javascript")
        .unwrap_err();
    assert!(error.to_string().contains("line 1"), "{error}");
}

// ---- machine targets ----

fn lower(code: &str) -> Vec<Instruction> {
    let meta = Translator::new().to_meta(code, "javascript").unwrap();
    lower_program(&meta).unwrap().main.code
}

#[test]
fn adapts_comments_and_spells_names_for_assembly_cil_and_jvm() {
    let gcd = source("greatest-common-divisor");
    let nasm = translate(&gcd, "javascript", "nasm");
    assert!(nasm.contains("; Greatest common divisor in x86-64 assembly (NASM)"));
    assert!(nasm.contains("call greatest_common_divisor"));
    let cil = translate(&gcd, "javascript", "cil");
    assert!(cil.contains("call int64 Program::GreatestCommonDivisor"));
    let jvm = Translator::new()
        .translate(&gcd, "javascript", "jvm", Mode::SameEffect)
        .unwrap();
    assert!(jvm.contains("invokestatic Program/greatestCommonDivisor(JJ)J"));
    assert!(!jvm.contains("; Greatest"));
}

#[test]
fn short_circuits_conditions_with_jumps() {
    use Instruction::*;
    let label = |name: &str| name.to_owned();
    assert_eq!(
        lower("let a = 1;\nif (a > 0 && !(a === 2)) {\n  console.log(a);\n}\n"),
        [
            Push(1.0),
            Store(0),
            Load(0),
            Push(0.0),
            CompareJump("lessOrEqual", label("L1")),
            Load(0),
            Push(2.0),
            CompareJump("equal", label("L1")),
            Load(0),
            PrintInteger,
            PrintNewline,
            Jump(label("L2")),
            Label(label("L1")),
            Label(label("L2")),
            ReturnNothing,
        ]
    );
    let either = lower("let a = 1;\nwhile (a < 0 || a === 1) {\n  a += 1;\n}\n");
    assert_eq!(
        either[2..10],
        [
            Label(label("L1")),
            Load(0),
            Push(0.0),
            CompareJump("less", label("L3")),
            Load(0),
            Push(1.0),
            CompareJump("notEqual", label("L2")),
            Label(label("L3")),
        ]
    );
}

#[test]
fn refuses_programs_it_cannot_lower() {
    let translator = Translator::new();
    let error = translator
        .translate(
            "let name = \"Ada\";\n",
            "javascript",
            "nasm",
            Mode::ContextDependent,
        )
        .unwrap_err();
    assert!(error.to_string().contains("cannot lower"), "{error}");
}

// ---- comments inside indented blocks ----

#[test]
fn keeps_a_comment_that_opens_an_indented_block() {
    let python = "def sq(n):\n    # square it\n    return n * n\n\nprint(sq(2))\n";
    let javascript = translate(python, "python", "javascript");
    assert_eq!(
        javascript,
        "function sq(n) {\n    // square it\n    return n * n;\n}\n\nconsole.log(sq(2));\n"
    );
    assert_eq!(translate(&javascript, "javascript", "python"), python);
}

#[test]
fn keeps_comments_that_close_an_indented_block() {
    let python = "def sq(n):\n    return n * n\n    # inside\n# outside\nprint(sq(2))\n";
    let javascript = translate(python, "python", "javascript");
    assert_eq!(
        javascript,
        "function sq(n) {\n    return n * n;\n    // inside\n}\n// outside\nconsole.log(sq(2));\n"
    );
    assert_eq!(translate(&javascript, "javascript", "python"), python);
    assert_eq!(translate("// only\n", "javascript", "python"), "# only\n");
}

// ---- empty lines around functions ----

#[test]
fn keeps_a_comment_right_above_a_function_with_that_function() {
    let python = "# square it\ndef sq(n):\n    return n * n\n\nprint(sq(2))\n";
    assert_eq!(
        translate(python, "python", "javascript"),
        "// square it\nfunction sq(n) {\n    return n * n;\n}\n\nconsole.log(sq(2));\n"
    );
}

#[test]
fn keeps_a_comment_right_above_an_import_as_a_file_comment() {
    let c = "/* Hello World in C */\n#include <stdio.h>\n\nint main(void)\n{\n    printf(\"Hi\\n\");\n    return 0;\n}\n";
    assert_eq!(
        translate(c, "c", "python"),
        "# Hello World in Python\n\nprint(\"Hi\")\n"
    );
}

#[test]
fn c_retains_literal_headers_for_native_calls() {
    let source = r#"# include <stdio.h>  // byte input
#include "local.h"
int main(void) {
    int byte = getchar();
    printf("%d\n", byte != EOF);
    return 0;
}
"#;
    let emitted = translate(source, "c", "c");
    assert!(emitted.contains("#include <stdio.h>  // byte input\n"));
    assert!(emitted.contains("#include \"local.h\"\n"));
    assert_eq!(emitted.matches("#include <stdio.h>").count(), 1);
    assert!(emitted.contains("getchar()"));
    assert!(emitted.contains("EOF"));
}

#[test]
fn keeps_functions_without_an_empty_line_between_them_in_every_language() {
    let tight = "function one(n) {\n    return n + 1;\n}\nfunction two(n) {\n    return n + 2;\n}\n\nconsole.log(one(two(1)));\n";
    for language in universal_translator::formal::languages::language_ids() {
        let text = translate(tight, "javascript", language);
        assert_eq!(
            translate(&text, language, "javascript"),
            tight,
            "{language}"
        );
    }
}

#[test]
fn reads_a_lone_return_1_back_as_a_number() {
    let perl = "sub one {\n    return 1;\n}\n\nprint 2 . \"\\n\";\n";
    assert_eq!(
        translate(perl, "perl", "javascript"),
        "function one() {\n    return 1;\n}\n\nconsole.log(2);\n"
    );
}

// ---- the meta view ----

#[test]
fn shows_the_meta_program_as_links_notation() {
    let meta = Translator::new()
        .to_meta("# hi\n\nx = 'a b'\nprint(x * 3)\n", "python")
        .expect("python");
    assert_eq!(
        universal_translator::meta::notation::format_meta(&meta),
        "program (comments hi)
  main
    declaration x (mutable false) (type text)
      value
        text 'a b' (type text)
    evaluate
      expression
        call print-line (library standard)
          arguments
            binary multiply (type integer)
              left
                name x (type text)
              right
                number 3 (type integer)
"
    );
}

#[test]
fn nests_meta_parameters_and_names_a_field_after_a_block() {
    let source = "def twice(n):\n    if n > 1:\n        return n * 2\n    else:\n        return 0\n\nprint(twice(3))\n";
    let meta = Translator::new().to_meta(source, "python").expect("python");
    assert_eq!(
        universal_translator::meta::notation::format_meta(&meta),
        "program
  functions
    function twice (blank-after true) (return-type integer)
      parameters
        parameter n (type integer)
      body
        if
          condition
            binary greater (type boolean)
              left
                name n (type integer)
              right
                number 1 (type integer)
          then
            return
              value
                binary multiply (type integer)
                  left
                    name n (type integer)
                  right
                    number 2 (type integer)
          otherwise
            return
              value
                number 0 (type integer)
  main
    evaluate
      expression
        call print-line (library standard)
          arguments
            call twice (type integer)
              arguments
                number 3 (type integer)
"
    );
}
