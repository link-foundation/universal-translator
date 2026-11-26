//! The decorator API: every replaceable stage of the pipeline can be
//! wrapped. The JavaScript twin is js/tests/decorators.test.js.

use std::sync::{Arc, Mutex};

use universal_translator::stages::EmitStage;
use universal_translator::{CustomRules, Mode, Translator};

const SOURCE: &str = "console.log(\"Hi\");\n";

fn translate(translator: &Translator, to: &str) -> String {
    translator
        .translate(SOURCE, "javascript", to, Mode::default())
        .unwrap()
}

/// A decorator that rewrites the text the emitter writes.
fn rewrite(change: fn(&str) -> String) -> impl FnOnce(EmitStage) -> EmitStage {
    move |next| Arc::new(move |meta, to| next(meta, to).map(|text| change(&text)))
}

#[test]
fn runs_a_decorator_that_traces_the_calls_of_a_stage() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let (parse_calls, emit_calls) = (calls.clone(), calls.clone());
    let translator = Translator::new()
        .decorate_parse(move |next| {
            Arc::new(move |text, syntax| {
                parse_calls
                    .lock()
                    .unwrap()
                    .push(format!("parse {}", syntax.id));
                next(text, syntax)
            })
        })
        .decorate_emit(move |next| {
            Arc::new(move |meta, to| {
                emit_calls.lock().unwrap().push(format!("emit {to}"));
                next(meta, to)
            })
        });
    assert_eq!(
        translate(&translator, "python"),
        translate(&Translator::new(), "python")
    );
    assert_eq!(
        *calls.lock().unwrap(),
        vec!["parse javascript", "emit python"]
    );
}

#[test]
fn rewrites_the_output_of_the_emitter() {
    let translator = Translator::new().decorate_emit(rewrite(|text| text.to_uppercase()));
    assert_eq!(translate(&translator, "python"), "PRINT(\"HI\")\n");
}

#[test]
fn rewrites_the_input_of_the_parser() {
    let translator = Translator::new().decorate_parse(|next| {
        Arc::new(move |text, syntax| next(&text.replace("Hi", "Bye"), syntax))
    });
    assert_eq!(translate(&translator, "python"), "print(\"Bye\")\n");
}

#[test]
fn composes_the_decorators_of_one_stage_in_order_the_last_outermost() {
    let order = Arc::new(Mutex::new(Vec::new()));
    let named = |name: &'static str| {
        let order = order.clone();
        move |next: EmitStage| -> EmitStage {
            Arc::new(move |meta, to| {
                order.lock().unwrap().push(format!("{name} in"));
                let text = next(meta, to)?;
                order.lock().unwrap().push(format!("{name} out"));
                Ok(format!("{name}({})", text.trim()))
            })
        }
    };
    let translator = Translator::new()
        .decorate_emit(named("first"))
        .decorate_emit(named("second"));
    assert_eq!(
        translate(&translator, "python"),
        "second(first(print(\"Hi\")))"
    );
    assert_eq!(
        *order.lock().unwrap(),
        vec!["second in", "first in", "first out", "second out"]
    );
}

#[test]
fn keeps_the_decorators_when_the_rules_change() {
    let translator = Translator::new()
        .decorate_emit(rewrite(|text| format!("{text}# done\n")))
        .with_rules(CustomRules::from_json(r#"{"names":[{"find":"x","replace":"y"}]}"#).unwrap());
    let text = translator
        .translate("const x = 1;\n", "javascript", "python", Mode::default())
        .unwrap();
    assert_eq!(text, "y = 1\n# done\n");
}

#[test]
fn wraps_the_readers_and_the_writer_of_words() {
    let seen = Arc::new(Mutex::new(Vec::new()));
    let (read_seen, write_seen) = (seen.clone(), seen.clone());
    let translator = Translator::new()
        .decorate_read_natural(move |next| {
            Arc::new(move |words, id, language| {
                read_seen.lock().unwrap().push(format!("read {id}"));
                next(words, id, language)
            })
        })
        .decorate_write_natural(move |next| {
            Arc::new(move |meta, to| {
                write_seen.lock().unwrap().push(format!("write {to}"));
                next(meta, to)
            })
        });
    let words = translate(&translator, "english");
    translator
        .translate(&words, "english", "python", Mode::default())
        .unwrap();
    assert_eq!(*seen.lock().unwrap(), vec!["write english", "read english"]);
}

#[test]
fn wraps_the_machine_code_reader_lifting_and_emitter() {
    let seen = Arc::new(Mutex::new(Vec::new()));
    let (infer_seen, emit_seen, read_seen, lift_seen) =
        (seen.clone(), seen.clone(), seen.clone(), seen.clone());
    let translator = Translator::new()
        .decorate_infer(move |next| {
            Arc::new(move |meta| {
                infer_seen.lock().unwrap().push("infer");
                next(meta)
            })
        })
        .decorate_emit_machine(move |next| {
            Arc::new(move |meta, to| {
                emit_seen.lock().unwrap().push("emitMachineCode");
                next(meta, to)
            })
        })
        .decorate_read_machine(move |next| {
            Arc::new(move |text, target| {
                read_seen.lock().unwrap().push("readMachine");
                next(text, target)
            })
        })
        .decorate_lift(move |next| {
            Arc::new(move |machine| {
                lift_seen.lock().unwrap().push("lift");
                next(machine)
            })
        });
    let assembly = translate(&translator, "nasm");
    translator
        .translate(&assembly, "nasm", "python", Mode::default())
        .unwrap();
    assert_eq!(
        *seen.lock().unwrap(),
        vec!["infer", "emitMachineCode", "readMachine", "lift", "infer"]
    );
}

#[test]
fn wraps_a_replacement_of_a_stage() {
    let mut translator = Translator::new();
    translator.stages.emit = Arc::new(|_, _| Ok("replaced".to_owned()));
    let translator = translator.decorate_emit(rewrite(|text| format!("[{text}]")));
    assert_eq!(translate(&translator, "python"), "[replaced]");
}
