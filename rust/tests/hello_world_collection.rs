//! The Hello World Collection (issue 1, item 1.3): every program the
//! coverage file lists as read is read into the meta language, and the
//! others are not. The JavaScript twin is
//! js/tests/hello-world-collection.test.js, and
//! scripts/hello-world-collection.mjs writes the coverage file.

use std::collections::HashMap;

use universal_translator::Translator;

const PROGRAMS: &str =
    include_str!("../../docs/case-studies/issue-14/data/hello-world-collection/programs.json");
const COVERAGE: &str = include_str!("../../docs/case-studies/issue-14/hello-world-coverage.lino");

/// The status of each program of the coverage file, by language and section.
fn statuses() -> HashMap<(String, String), String> {
    let mut found = HashMap::new();
    let (mut language, mut section) = (String::new(), String::new());
    for line in COVERAGE.lines() {
        let line = line.trim();
        if let Some(value) = line.strip_prefix("language: ") {
            language = value.to_owned();
        } else if let Some(value) = line.strip_prefix("section: ") {
            section = value.trim_matches('\'').to_owned();
        } else if let Some(value) = line.strip_prefix("status: ")
            && value != "absent"
        {
            found.insert((language.clone(), section.clone()), value.to_owned());
        }
    }
    found
}

#[test]
fn reads_the_programs_the_coverage_file_lists_as_read() {
    let programs: serde_json::Value = serde_json::from_str(PROGRAMS).unwrap();
    let statuses = statuses();
    let translator = Translator::new();
    let mut checked = 0;
    for (id, entries) in programs.as_object().unwrap() {
        for entry in entries.as_array().unwrap() {
            let section = entry["section"].as_str().unwrap().to_owned();
            let program = entry["program"].as_str().unwrap();
            let status = &statuses[&(id.clone(), section.clone())];
            let meta = translator.to_meta(program, id);
            assert_eq!(
                (id.as_str(), section.as_str(), meta.is_ok()),
                (id.as_str(), section.as_str(), status == "read"),
                "{meta:?}"
            );
            checked += 1;
        }
    }
    assert_eq!(checked, statuses.len());
}

#[test]
fn reads_every_program_but_the_blocked_ones() {
    let unread: Vec<String> = statuses()
        .into_values()
        .filter(|status| status != "read")
        .collect();
    assert_eq!(unread, ["blocked"]);
}
