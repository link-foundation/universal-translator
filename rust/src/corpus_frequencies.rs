use std::collections::HashMap;
use std::sync::LazyLock;

use serde::Deserialize;

#[derive(Deserialize)]
struct Frequencies {
    code: Code,
    prose: Prose,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Code {
    language_tasks: HashMap<String, u32>,
}

#[derive(Deserialize)]
struct Prose {
    readings: HashMap<String, Vec<Reading>>,
}

#[derive(Deserialize)]
struct Reading {
    forms: Vec<String>,
    counts: HashMap<String, u32>,
}

static FREQUENCIES: LazyLock<Frequencies> = LazyLock::new(|| {
    serde_json::from_str(include_str!(
        "../../data/translation/corpus-frequencies.json"
    ))
    .expect("checked-in corpus frequencies")
});

pub(crate) fn code_task_frequency(id: &str) -> u32 {
    FREQUENCIES
        .code
        .language_tasks
        .get(id)
        .copied()
        .unwrap_or(0)
}

pub(crate) fn reading_counts<'a>(
    id: &str,
    phrase: &str,
    meanings: impl IntoIterator<Item = &'a str>,
) -> Option<Vec<u32>> {
    let entry = FREQUENCIES
        .prose
        .readings
        .get(id)?
        .iter()
        .find(|reading| reading.forms.iter().any(|form| form == phrase))?;
    meanings
        .into_iter()
        .map(|meaning| {
            entry
                .counts
                .get(meaning)
                .copied()
                .filter(|count| *count > 0)
        })
        .collect()
}
