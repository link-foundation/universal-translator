//! Group physical lines while retaining newlines inside quoted values.
use super::catalog::Language;

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
