use std::process::Command;
use universal_translator::{Mode, Translator};

const SOURCE: &str = include_str!("../../examples/translation/exceptions.cpp");

fn execute(source: &str, target: &str) -> i32 {
    let (command, flag) = if target == "python" {
        ("python3", "-c")
    } else {
        ("node", "-e")
    };
    let result = Command::new(command)
        .args([flag, source])
        .output()
        .expect("runtime available");
    assert!(
        result.stderr.is_empty(),
        "{}\n{source}",
        String::from_utf8_lossy(&result.stderr)
    );
    result.status.code().expect("normal exit")
}

#[test]
fn cpp_try_typed_catch_and_throw_keep_explicit_boundaries() {
    let translator = Translator::new();
    let meta = translator.to_meta(SOURCE, "cpp").unwrap();
    let attempt = meta.node("main").unwrap().nodes("statements")[0];
    assert!(attempt.is("Try"));
    let thrown = attempt.node("body").unwrap().nodes("statements")[1];
    assert!(thrown.is("Throw"));
    assert_eq!(thrown.node("value").unwrap().number("value"), Some(8.0));
    assert_eq!(attempt.nodes("handlers")[0].str("type"), Some("integer"));
    assert_eq!(translator.detect_language(SOURCE, 5)[0].id, "cpp");
}

#[test]
fn translated_cpp_exceptions_keep_the_exit_status() {
    let translator = Translator::new();
    for source in [
        SOURCE,
        "int main() { try { throw 8; } catch (double realError) { return 3; } catch (int caughtError) { return caughtError; } }",
        "int main() { try { try { throw 8; } catch (...) { throw; } } catch (int e) { return e; } }",
    ] {
        for target in ["python", "javascript"] {
            let translation = translator
                .translate(source, "cpp", target, Mode::default())
                .unwrap();
            assert_eq!(execute(&translation, target), 8, "{target}\n{translation}");
        }
    }
}

#[test]
fn c_lowers_a_local_cpp_integer_throw_and_catch_to_control_flow() {
    let result = Translator::new()
        .translate(SOURCE, "cpp", "c", Mode::default())
        .unwrap();
    assert!(result.contains("goto _ut_dispatch"), "{result}");
    assert!(result.contains("int e = _ut_payload"), "{result}");
}

#[test]
fn c_rejects_exception_paths_that_need_a_different_type_or_unwinding() {
    let translator = Translator::new();
    for (source, message) in [
        (
            SOURCE.replace("throw 8;", "throw 010;"),
            "portable C++ int literal",
        ),
        (
            SOURCE.replace("throw 8;", "throw 40000;"),
            "portable C++ int literal",
        ),
        (
            SOURCE.replace("catch (int e)", "catch (int &e)"),
            "known C++ catch type",
        ),
        (
            SOURCE.replace("throw 8;", "unknown(); throw 8;"),
            "cannot unwind Call",
        ),
        (
            SOURCE.replace("catch (int e)", "catch (double e)"),
            "local matching handler",
        ),
    ] {
        let error = translator
            .translate(&source, "cpp", "c", Mode::default())
            .unwrap_err();
        assert!(error.to_string().contains(message), "{source}\n{error}");
    }
}

#[test]
fn exception_names_preserve_user_bindings() {
    let source = "int main() { int _ut_error0 = 5; try { throw 8; } catch(int e) { return _ut_error0 + e; } }";
    let translation = Translator::new()
        .translate(source, "cpp", "python", Mode::default())
        .unwrap();
    assert_eq!(execute(&translation, "python"), 13);
}

#[test]
fn finally_runs_before_a_function_returns() {
    let source = "function result() { try { return 8; } finally { console.log(1); } } console.log(result());";
    for target in ["python", "javascript"] {
        let translation = Translator::new()
            .translate(source, "javascript", target, Mode::default())
            .unwrap();
        let (command, flag) = if target == "python" {
            ("python3", "-c")
        } else {
            ("node", "-e")
        };
        let result = Command::new(command)
            .args([flag, &translation])
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{translation}\n{}",
            String::from_utf8_lossy(&result.stderr)
        );
        assert_eq!(String::from_utf8_lossy(&result.stdout), "1\n8\n");
    }
}
