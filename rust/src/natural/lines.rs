//! Group physical lines while retaining newlines inside quoted values.
use super::catalog::Language;
use regex::Regex;

pub(super) fn note_pattern(language: &Language) -> Regex {
    let (before, after) = language
        .note
        .split_once("{text}")
        .unwrap_or((language.note.as_str(), ""));
    Regex::new(&format!(
        r"^{}\s*(.*?){}$",
        regex::escape(before.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')),
        regex::escape(after)
    ))
    .expect("note pattern")
}

/// Byte ranges of notes, leaving markers, indentation and line ends outside.
pub(crate) fn note_spans(source: &str, language: &Language) -> Vec<(usize, usize)> {
    let starts: Vec<_> = std::iter::once(0)
        .chain(source.match_indices('\n').map(|(at, _)| at + 1))
        .collect();
    let (before, after) = language.note.split_once("{text}").unwrap();
    let space = |c: char| c.is_whitespace() || c == '\u{feff}';
    let pattern = note_pattern(language);
    sentence_lines(source, language)
        .into_iter()
        .filter_map(|(index, raw)| {
            pattern.is_match(raw.trim_matches(space)).then(|| {
                let indent = raw.len() - raw.trim_start_matches(space).len();
                (
                    starts[index] + indent + before.trim_matches(space).len(),
                    starts[index] + raw.trim_end_matches(space).len() - after.len(),
                )
            })
        })
        .collect()
}

pub(super) fn sentence_lines(source: &str, language: &Language) -> Vec<(usize, String)> {
    let (opening, closing) = &language.quotes;
    let note = language
        .note
        .split("{text}")
        .next()
        .unwrap_or_default()
        .trim();
    let mut lines = Vec::new();
    let mut raw = String::new();
    let mut quoted = false;
    let mut comment = false;
    let mut line = 0;
    let mut first = 0;
    let mut at = 0;
    while at < source.len() {
        if raw.is_empty() && !quoted {
            comment = !note.is_empty() && source[at..].trim_start().starts_with(note);
        }
        let mark = if quoted { closing } else { opening };
        if !comment && source[at..].starts_with(mark.as_str()) {
            let doubled = quoted && source[at + mark.len()..].starts_with(mark.as_str());
            let end = at + mark.len() * if doubled { 2 } else { 1 };
            raw.push_str(&source[at..end]);
            at = end;
            if !doubled {
                quoted = !quoted;
            }
        } else {
            let character = source[at..].chars().next().unwrap();
            at += character.len_utf8();
            if character == '\n' {
                line += 1;
                if !quoted {
                    if raw.ends_with('\r') {
                        raw.pop();
                    }
                    lines.push((first, std::mem::take(&mut raw)));
                    first = line;
                    continue;
                }
            }
            raw.push(character);
        }
    }
    lines.push((first, raw));
    lines
}
