use universal_translator::{
    Adapter, Effect, Expression, Interpretation, Mode, Options, Translator, language_profiles,
    rank_interpretations, read_referent_input,
};

const C: &str = include_str!("../../examples/translation/hello.c");
const CSHARP: &str = include_str!("../../examples/translation/hello.cs");

#[test]
fn links_notation_intermediate_preserves_effect_and_whole_line_comments() {
    let translator = Translator::default();
    let literal = Options {
        mode: Mode::Literal,
        ..Options::default()
    };
    let intermediate = translator.translate(C, "c", "meta", &literal).unwrap();
    let effect = Effect::Hello {
        message: "Hello, World!".into(),
    };
    assert!(intermediate.contains(&effect.to_links_notation()));
    assert_eq!(
        Effect::read_links_notation(&intermediate).unwrap(),
        [effect.clone()]
    );
    let output = translator
        .translate(&intermediate, "meta", "csharp", &literal)
        .unwrap();
    assert!(output.contains("// Print a line by function call."));
    let empty = Effect::Hello {
        message: String::new(),
    };
    assert_eq!(
        Effect::read_links_notation(&empty.to_links_notation()).unwrap(),
        [empty]
    );
    assert!(Effect::read_links_notation("(hello: (message: Hi) (extra: 1))").is_err());
    assert!(Effect::read_links_notation("(fizz-buzz: (limit: 010))").is_err());
    assert!(
        translator
            .parse(
                &format!("{intermediate}{}", effect.to_links_notation()),
                "meta"
            )
            .unwrap()
            .interpretation
            .is_none()
    );
}

#[test]
fn source_links_comments_and_default_mode() {
    let translator = Translator::default();
    let result = translator
        .translate_detailed(C, "c", "csharp", &Options::default())
        .unwrap();
    assert_eq!(result.code, CSHARP);
    assert_eq!(result.document.restore(), C);
    assert_eq!(
        result.document.interpretation.unwrap().requires,
        ["stdio.h"]
    );
    assert_eq!(
        result
            .expression
            .network
            .link(result.expression.id)
            .unwrap()
            .metadata()
            .term(),
        Some("hello")
    );
    assert!(
        result
            .expression
            .network
            .links()
            .any(|link| link.metadata().term() == Some("System.Console.WriteLine"))
    );
    let literal = Options {
        mode: Mode::Literal,
        ..Options::default()
    };
    let effect = Options {
        mode: Mode::SameEffect,
        ..Options::default()
    };
    assert!(
        translator
            .translate(C, "c", "csharp", &literal)
            .unwrap()
            .contains("// Print a line by function call.")
    );
    assert!(
        !translator
            .translate(C, "c", "csharp", &effect)
            .unwrap()
            .contains("//")
    );
    let alternate = "// note\r\nconsole.log('Hello, World!');";
    assert_eq!(
        translator
            .translate(alternate, "javascript", "javascript", &Options::default())
            .unwrap(),
        alternate
    );
}

#[test]
fn all_authored_forms_and_directed_pairs() {
    let translator = Translator::default();
    let effects: Vec<Effect> =
        Effect::read_links_notation(include_str!("../../examples/translation/effects.lino"))
            .unwrap();
    assert_eq!(translator.profiles().count(), 76);
    for (kind, count) in [
        ("programming", 50),
        ("natural-language", 20),
        ("instruction", 5),
        ("meta-language", 1),
    ] {
        assert_eq!(
            translator
                .profiles()
                .filter(|profile| profile.kind == kind)
                .count(),
            count
        );
    }
    let options = Options {
        mode: Mode::SameEffect,
        ..Options::default()
    };
    for effect in effects {
        let admitted: Vec<_> = translator
            .profiles()
            .filter(|profile| profile.forms.iter().any(|form| form.task == effect.task()))
            .collect();
        assert_eq!(
            admitted.len(),
            if effect.task() == "hello" { 76 } else { 72 }
        );
        for source_profile in &admitted {
            for form in source_profile
                .forms
                .iter()
                .filter(|form| form.task == effect.task())
            {
                let mut expression = Expression::new(&source_profile.id, effect.clone()).unwrap();
                expression.form = form.name.clone();
                let source = translator.materialize(&expression).unwrap();
                let document = translator.parse(&source, &source_profile.id).unwrap();
                assert_eq!(document.restore(), source);
                assert_eq!(document.interpretation.as_ref().unwrap().effect, effect);
                for target_profile in &admitted {
                    let expression = translator
                        .transform(&document, &target_profile.id, &options)
                        .unwrap();
                    let source = translator.materialize(&expression).unwrap();
                    let target = translator.parse(&source, &target_profile.id).unwrap();
                    assert_eq!(target.interpretation.unwrap().effect, effect);
                }
            }
        }
    }
}

#[test]
fn refusal_keeps_lossless_source() {
    let translator = Translator::default();
    let unicode = translator.parse("code\r\n🐍é", "c").unwrap();
    let span = unicode
        .network
        .links()
        .find(|link| link.metadata().term() == Some("🐍é"))
        .and_then(|link| link.metadata().span())
        .unwrap();
    assert_eq!(
        (span.byte_range().start(), span.byte_range().end()),
        (6, 12)
    );
    assert_eq!(
        (span.start_point().row(), span.start_point().column()),
        (1, 0)
    );
    assert_eq!((span.end_point().row(), span.end_point().column()), (1, 6));
    for (language, source) in [
        ("c", "/* 🐍 */\r\nunsupported(  \n tail  "),
        (
            "c",
            "// line continuation \\\n#include <stdio.h>\nint main(void)\n{\n    printf(\"Hi\\n\");\n    return 0;\n}\n",
        ),
        ("php", "\n<?php\necho \"Hi\\n\";\n"),
        ("php", "<?php\n// ?>\necho \"Hi\\n\";\n"),
        ("javascript", "console.log(\"Unexpected\"); sendData();\n"),
        ("javascript", "console.log(\"Hello%\");\n"),
        ("javascript", "console.log(\"Hello\n\");\n"),
        ("lua", "--[=[\nprint(\"Hello, World!\")\n"),
    ] {
        let document = translator.parse(source, language).unwrap();
        assert_eq!(document.restore(), source);
        assert!(
            translator
                .transform(&document, "python", &Options::default())
                .is_err()
        );
    }
    assert!(Expression::new("c", Effect::FizzBuzz { limit: 1001 }).is_err());
    let other = C.replace("Hello, World!", "Other message");
    assert!(
        translator
            .translate(&other, "c", "cil", &Options::default())
            .is_err()
    );
}

struct BrokenOutput(Box<dyn Adapter>);

impl Adapter for BrokenOutput {
    fn parse(&self, source: &str) -> Option<Interpretation> {
        self.0.parse(source)
    }
    fn emit(&self, expression: &Expression) -> Result<String, String> {
        Ok(self
            .0
            .emit(expression)?
            .replace("Hello, World!", "Other message"))
    }
}

#[test]
fn layers_and_decorators() {
    let mut translator = Translator::with_profiles(language_profiles());
    translator.add_layer(vec![Box::new(|expression, _, _| {
        expression.comments[0].text = "Hello".into();
        Ok(())
    })]);
    translator.add_layer(vec![Box::new(|expression, _, _| {
        expression.form = "single-quotes".into();
        Ok(())
    })]);
    let source = "// Привет\nconsole.log(\"Hello (World\");\n";
    assert_eq!(
        translator
            .translate(source, "javascript", "javascript", &Options::default())
            .unwrap(),
        "// Hello\nconsole.log('Hello (World');\n"
    );
    let mut translator = Translator::default();
    translator
        .decorate_adapter("python", |adapter| Box::new(BrokenOutput(adapter)))
        .unwrap();
    let error = translator
        .translate(C, "c", "python", &Options::default())
        .unwrap_err();
    assert!(error.contains("failed the effect round trip"));

    let mut translator = Translator::default();
    translator.add_layer(vec![Box::new(|expression, _, _| {
        expression.effect = Effect::Hello {
            message: "Different greeting".into(),
        };
        Ok(())
    })]);
    let exact = Options {
        mode: Mode::SameEffect,
        ..Options::default()
    };
    assert!(
        translator
            .translate(C, "c", "csharp", &exact)
            .unwrap_err()
            .contains("changed the source effect")
    );
}

#[test]
fn dependent_referents_keep_uncertainty() {
    let (source, candidates) = read_referent_input(include_str!(
        "../../examples/translation/referent-input.lino"
    ))
    .unwrap();
    let ranking = rank_interpretations(&source, &candidates, &[]).unwrap();
    assert_eq!(ranking.preferred[0].candidate.id, "white-skin");
    let scores: Vec<_> = ranking
        .candidates
        .iter()
        .map(|ranked| ranked.confidence)
        .collect();
    assert_eq!(scores, [[0.65, 0.65], [0.91, 0.91], [0.0, 0.29]]);
    let prefix = ["person", "white", "painted white"].map(str::to_owned);
    assert_eq!(
        rank_interpretations(&source, &candidates, &prefix)
            .unwrap()
            .preferred[0]
            .candidate
            .id,
        "painted-white"
    );
    assert!(
        rank_interpretations(&source, &candidates, &["plant".into()])
            .unwrap()
            .candidates
            .is_empty()
    );
}
