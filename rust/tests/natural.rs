//! Controlled natural languages in Rust: every task in every language must
//! match the files under examples/programs/natural byte for byte, read back
//! to the same meaning and keep the rules of its controlled language. The
//! JavaScript twin is js/tests/natural.test.js.

use std::fs;
use std::path::{Path, PathBuf};

use universal_translator::Mode;
use universal_translator::natural::{
    check_description, check_text, natural_language, natural_language_ids, read_natural,
    semantic_primes,
};
use universal_translator::translator::{Translator, meaning_difference, natural_languages};

fn programs() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/programs")
}

/// Every task with a JavaScript program and a natural folder.
fn tasks() -> Vec<String> {
    let mut tasks: Vec<String> = fs::read_dir(programs().join("natural"))
        .expect("natural folder")
        .map(|entry| {
            entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    tasks.sort();
    tasks
}

struct Text {
    task: String,
    language: String,
    path: PathBuf,
}

/// Every file natural/<task>/<task>.<language>.txt.
fn texts() -> Vec<Text> {
    let mut texts = Vec::new();
    for task in tasks() {
        let folder = programs().join("natural").join(&task);
        let mut files: Vec<PathBuf> = fs::read_dir(&folder)
            .expect("task folder")
            .map(|entry| entry.expect("entry").path())
            .collect();
        files.sort();
        for path in files {
            let file = path.file_name().unwrap().to_string_lossy().into_owned();
            let language = file
                .strip_prefix(&format!("{task}."))
                .and_then(|rest| rest.strip_suffix(".txt"))
                .expect("task.language.txt")
                .to_owned();
            texts.push(Text {
                task: task.clone(),
                language,
                path,
            });
        }
    }
    texts
}

#[test]
fn every_language_and_standard_is_described() {
    let ids = natural_language_ids();
    for id in [
        "english",
        "chinese",
        "hindi",
        "spanish",
        "french",
        "arabic",
        "bengali",
        "portuguese",
        "russian",
        "urdu",
        "indonesian",
        "german",
        "japanese",
        "marathi",
        "telugu",
        "turkish",
        "tamil",
        "vietnamese",
        "korean",
        "italian",
        "persian",
        "swahili",
        "tagalog",
        "thai",
        "polish",
        "ukrainian",
        "hausa",
        "gujarati",
        "punjabi",
        "dutch",
    ] {
        assert!(ids.contains(&id), "{id}");
    }
    for (id, label) in [
        (
            "english-asd-ste100",
            "ASD-STE100 Simplified Technical English",
        ),
        ("english-ace", "Attempto Controlled English"),
        ("english-gellish", "Gellish Formal English"),
        ("dutch-gellish", "Gellish Formeel Nederlands"),
        ("english-sbvr", "SBVR Structured English"),
        ("english-plain-language", "Plain language, ISO 24495-1"),
        ("minimal-english", "Minimal English"),
        ("minimal-french", "Minimal French"),
        ("minimal-polish", "Minimal Polish"),
        ("minimal-arabic", "Minimal Arabic"),
        ("minimal-bengali", "Minimal Bengali"),
        ("minimal-chinese", "Minimal Chinese"),
        ("minimal-dutch", "Minimal Dutch"),
        ("minimal-german", "Minimal German"),
        ("minimal-gujarati", "Minimal Gujarati"),
        ("minimal-hausa", "Minimal Hausa"),
        ("minimal-hindi", "Minimal Hindi"),
        ("minimal-indonesian", "Minimal Indonesian"),
        ("minimal-italian", "Minimal Italian"),
        ("minimal-japanese", "Minimal Japanese"),
        ("minimal-korean", "Minimal Korean"),
        ("minimal-marathi", "Minimal Marathi"),
        ("minimal-persian", "Minimal Persian"),
        ("minimal-portuguese", "Minimal Portuguese"),
        ("minimal-punjabi", "Minimal Punjabi"),
        ("minimal-russian", "Minimal Russian"),
        ("minimal-spanish", "Minimal Spanish"),
        ("minimal-swahili", "Minimal Swahili"),
        ("minimal-tagalog", "Minimal Tagalog"),
        ("minimal-tamil", "Minimal Tamil"),
        ("minimal-telugu", "Minimal Telugu"),
        ("minimal-thai", "Minimal Thai"),
        ("minimal-turkish", "Minimal Turkish"),
        ("minimal-ukrainian", "Minimal Ukrainian"),
        ("minimal-urdu", "Minimal Urdu"),
        ("minimal-vietnamese", "Minimal Vietnamese"),
        ("english-e-prime", "E-Prime"),
        ("english-basic-english", "Basic English"),
        ("english-special-english", "VOA Special English"),
        ("english-globish", "Globish"),
        ("english-british", "English (British)"),
    ] {
        let language = natural_language(id).unwrap();
        assert!(language.label.contains(label), "{id}: {}", language.label);
    }
    assert_eq!(
        natural_language("english").unwrap().profile.as_deref(),
        Some("cnl-default")
    );
    assert!(
        natural_language("english-ace")
            .unwrap()
            .label
            .contains("Attempto Controlled English")
    );
    assert_eq!(
        natural_language("english-ace").unwrap().base.as_deref(),
        Some("english")
    );
    assert_eq!(natural_languages().len(), ids.len());
}

#[test]
fn lists_the_65_semantic_primes_with_english_exponents() {
    let primes = semantic_primes().unwrap();
    assert_eq!(primes.len(), 65);
    for prime in primes {
        assert!(
            prime
                .exponents
                .get("english")
                .is_some_and(|words| !words.is_empty()),
            "{}",
            prime.prime
        );
        assert!(!prime.category.is_empty(), "{}", prime.prime);
    }
}

#[test]
fn keeps_the_rules_of_every_language_description() {
    for id in natural_language_ids() {
        assert_eq!(check_description(id).unwrap(), Vec::<String>::new(), "{id}");
    }
}

#[test]
fn every_task_in_every_natural_language() {
    let translator = Translator::new();
    let texts = texts();
    assert_eq!(texts.len(), tasks().len() * natural_language_ids().len());
    let mut failures = Vec::new();
    let mut current: Option<(String, universal_translator::meta::Node)> = None;
    for Text {
        task,
        language,
        path,
    } in &texts
    {
        if current.as_ref().is_none_or(|(name, _)| name != task) {
            let source = fs::read_to_string(programs().join(format!("{task}.js")))
                .expect("JavaScript program");
            current = Some((
                task.clone(),
                translator.to_meta(&source, "javascript").unwrap(),
            ));
        }
        let meta = &current.as_ref().unwrap().1;
        let expected = fs::read_to_string(path).unwrap();
        match translator.from_meta(meta, language, None, Mode::default()) {
            Ok(text) if text == expected => {}
            Ok(text) => failures.push(format!(
                "{task} {language}: written differently\n--- expected\n{expected}--- actual\n{text}"
            )),
            Err(error) => failures.push(format!("{task} {language}: {error}")),
        }
        match read_natural(&expected, language) {
            Ok(back) => {
                if let Some(difference) = meaning_difference(meta, &back) {
                    failures.push(format!("{task} {language}: read back {difference}"));
                }
            }
            Err(error) => failures.push(format!("{task} {language}: {error}")),
        }
        match check_text(&expected, language) {
            Ok(problems) if problems.is_empty() => {}
            Ok(problems) => failures.push(format!("{task} {language}: {problems:?}")),
            Err(error) => failures.push(format!("{task} {language}: {error}")),
        }
    }
    assert!(
        failures.is_empty(),
        "{} failures:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn translates_between_words_and_programming_languages() {
    let translator = Translator::new();
    let words = translator
        .translate(
            "console.log(\"Hi\");",
            "javascript",
            "english",
            Mode::default(),
        )
        .unwrap();
    let python = translator
        .translate(&words, "english", "python", Mode::default())
        .unwrap();
    assert!(python.contains("print(\"Hi\")"), "{python}");
    let source = fs::read_to_string(programs().join("factorial.js")).unwrap();
    let spanish = translator
        .translate(&source, "javascript", "spanish", Mode::default())
        .unwrap();
    assert!(spanish.contains("factorial"), "{spanish}");
    assert_eq!(
        meaning_difference(
            &translator.to_meta(&spanish, "spanish").unwrap(),
            &translator.to_meta(&source, "javascript").unwrap()
        ),
        None
    );
    let error = translator
        .from_meta_with(
            &translator.to_meta(&source, "javascript").unwrap(),
            "english",
            None,
            universal_translator::Options {
                mode: Mode::default(),
                common_library: true,
                ..Default::default()
            },
        )
        .unwrap_err();
    assert!(
        error
            .message
            .contains("Natural languages have no common library")
    );
}

#[test]
fn limits_sentence_length_asd_ste100() {
    let long = format!("Write {}.", vec!["x"; 25].join(" plus "));
    let problems = check_text(&long, "english-asd-ste100").unwrap();
    assert!(problems.join(",").contains("words"), "{problems:?}");
}

#[test]
fn forbids_forms_of_to_be_e_prime() {
    let problems = check_text("If x is 0, do this:", "english-e-prime").unwrap();
    assert!(
        problems.join(",").contains("forbidden \"is\""),
        "{problems:?}"
    );
}

#[test]
fn forbids_shall_plain_language() {
    let problems = check_text("The total shall be 0.", "english-plain-language").unwrap();
    assert!(
        problems.join(",").contains("forbidden \"shall\""),
        "{problems:?}"
    );
}

#[test]
fn requires_an_allowed_first_word_ace() {
    let problems = check_text("Perhaps write x.", "english-ace").unwrap();
    assert!(
        problems.join(",").contains("starts with \"Perhaps\""),
        "{problems:?}"
    );
}

#[test]
fn rejects_sentences_outside_the_grammar() {
    let error = read_natural("Dance with the moon.", "english").unwrap_err();
    assert!(error.contains("No sentence template matches"), "{error}");
    let error = read_natural("Otherwise, do this:\n  Do nothing.\n", "english").unwrap_err();
    assert!(error.contains("Otherwise without a condition"), "{error}");
}
