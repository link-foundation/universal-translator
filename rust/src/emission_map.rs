//! Scoped source provenance for internal emitter lines.

use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::ops::{Deref, DerefMut};
use std::sync::Arc;

use crate::meta::Node;
use crate::source_origins::{SourceLocator, SourceOrigin, expression_origins};

pub(crate) type Origins = Vec<Arc<SourceOrigin>>;

#[derive(Default)]
struct Context {
    emissions: Vec<Emission>,
    active: Origins,
    instructions: HashMap<usize, Origins>,
    source_lines: HashMap<usize, Origins>,
}

thread_local! { static CONTEXTS: RefCell<Vec<Context>> = const { RefCell::new(Vec::new()) }; }

pub(crate) struct Emission {
    language: String,
    text: String,
    mapped: Vec<(usize, Arc<SourceOrigin>)>,
}

struct Capture(bool);

impl Drop for Capture {
    fn drop(&mut self) {
        if self.0 {
            CONTEXTS.with_borrow_mut(|contexts| {
                contexts.pop();
            });
        }
    }
}

pub(crate) fn capture<T>(translate: impl FnOnce() -> T) -> (T, Vec<Emission>) {
    CONTEXTS.with_borrow_mut(|contexts| contexts.push(Context::default()));
    let mut guard = Capture(true);
    let result = translate();
    let emissions =
        CONTEXTS.with_borrow_mut(|contexts| contexts.pop().expect("capture context").emissions);
    guard.0 = false;
    (result, emissions)
}

// Readers need instruction provenance for concrete production views even
// when the caller has not requested an emitted line map.
pub(crate) fn source_records<T>(read: impl FnOnce() -> T) -> T {
    if CONTEXTS.with_borrow(|contexts| contexts.is_empty()) {
        capture(read).0
    } else {
        read()
    }
}

pub(crate) fn record_mapping(source: &str, text: &str, language: &str, lines: &[(usize, usize)]) {
    CONTEXTS.with_borrow_mut(|contexts| {
        if let Some(context) = contexts.last_mut() {
            let locator = SourceLocator::new(source);
            context.emissions.push(Emission {
                language: language.to_owned(),
                text: text.to_owned(),
                mapped: lines
                    .iter()
                    .map(|(from, to)| (*to, locator.line(*from)))
                    .collect(),
            });
        }
    });
}

pub(crate) struct Active(Option<Origins>);

impl Drop for Active {
    fn drop(&mut self) {
        if let Some(previous) = self.0.take() {
            CONTEXTS.with_borrow_mut(|contexts| {
                if let Some(context) = contexts.last_mut() {
                    context.active = previous;
                }
            });
        }
    }
}

pub(crate) fn active(node: &Node) -> Active {
    Active(CONTEXTS.with_borrow_mut(|contexts| {
        let context = contexts.last_mut()?;
        let origins = expression_origins(node);
        (!origins.is_empty()).then(|| std::mem::replace(&mut context.active, origins))
    }))
}

pub(crate) fn current() -> Origins {
    CONTEXTS.with_borrow(|contexts| {
        contexts
            .last()
            .map(|context| context.active.clone())
            .unwrap_or_default()
    })
}

pub(crate) fn active_origins(origins: Origins) -> Active {
    Active(CONTEXTS.with_borrow_mut(|contexts| {
        let context = contexts.last_mut()?;
        Some(std::mem::replace(&mut context.active, origins))
    }))
}

pub(crate) fn register_source_lines(source: &str, lines: &[String]) {
    CONTEXTS.with_borrow_mut(|contexts| {
        if let Some(context) = contexts.last_mut() {
            let locator = SourceLocator::new(source);
            for (index, line) in lines
                .iter()
                .enumerate()
                .filter(|(_, line)| !line.is_empty())
            {
                context
                    .source_lines
                    .insert(line.as_ptr() as usize, vec![locator.line(index)]);
            }
        }
    });
}

pub(crate) fn line_origins(line: &str) -> Origins {
    if line.is_empty() {
        return Vec::new();
    }
    CONTEXTS.with_borrow(|contexts| {
        contexts
            .last()
            .and_then(|context| context.source_lines.get(&(line.as_ptr() as usize)))
            .cloned()
            .unwrap_or_default()
    })
}

pub(crate) fn clone_source_line(line: &str) -> String {
    let cloned = line.to_owned();
    if !cloned.is_empty() {
        let origins = line_origins(line);
        CONTEXTS.with_borrow_mut(|contexts| {
            if let Some(context) = contexts.last_mut() {
                let address = cloned.as_ptr() as usize;
                context.source_lines.remove(&address);
                if !origins.is_empty() {
                    context.source_lines.insert(address, origins);
                }
            }
        });
    }
    cloned
}

pub(crate) fn cloned_source_lines(lines: &[String]) -> Vec<String> {
    lines.iter().map(|line| clone_source_line(line)).collect()
}

pub(crate) fn include_source_line(line: &str, omitted: &str) {
    if line.is_empty() {
        return;
    }
    let origins = line_origins(omitted);
    CONTEXTS.with_borrow_mut(|contexts| {
        if let Some(context) = contexts.last_mut() {
            context
                .source_lines
                .entry(line.as_ptr() as usize)
                .or_default()
                .extend(origins);
        }
    });
}

pub(crate) fn instruction_origins<T>(instruction: &T) -> Origins {
    CONTEXTS.with_borrow(|contexts| {
        contexts
            .last()
            .and_then(|context| {
                context
                    .instructions
                    .get(&(instruction as *const T as usize))
            })
            .cloned()
            .unwrap_or_default()
    })
}

// Instruction addresses remain stable while the completed code buffer is
// borrowed by a writer. Records live only within this capture, without
// changing the public stack-machine representation.
pub(crate) fn register_instructions<T>(code: &[T], origins: Vec<(usize, Origins)>) {
    CONTEXTS.with_borrow_mut(|contexts| {
        if let Some(context) = contexts.last_mut() {
            // A prior failed attempt can have released a buffer at these
            // addresses. Clear every slot before registering its new owners.
            for instruction in code {
                context
                    .instructions
                    .remove(&(instruction as *const T as usize));
            }
            for (index, origins) in origins {
                if let Some(instruction) = code.get(index) {
                    context
                        .instructions
                        .insert(instruction as *const T as usize, origins);
                }
            }
        }
    });
}

pub(crate) fn active_instruction<T>(instruction: &T) -> Active {
    active_origins(instruction_origins(instruction))
}

pub(crate) struct SourceLine(String, Origins);

impl From<String> for SourceLine {
    fn from(text: String) -> Self {
        let origins = if text.is_empty() {
            Vec::new()
        } else {
            current()
        };
        Self(text, origins)
    }
}

#[derive(Default)]
pub(crate) struct SourceLines {
    text: Vec<String>,
    origins: Vec<Origins>,
}

impl From<Vec<String>> for SourceLines {
    fn from(text: Vec<String>) -> Self {
        let mut lines = Self::default();
        lines.extend(text);
        lines
    }
}

impl FromIterator<String> for SourceLines {
    fn from_iter<T: IntoIterator<Item = String>>(iter: T) -> Self {
        let mut lines = Self::default();
        lines.extend(iter);
        lines
    }
}

impl Deref for SourceLines {
    type Target = [String];
    fn deref(&self) -> &Self::Target {
        &self.text
    }
}

impl DerefMut for SourceLines {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.text
    }
}

impl IntoIterator for SourceLines {
    type Item = SourceLine;
    type IntoIter = std::vec::IntoIter<SourceLine>;
    fn into_iter(self) -> Self::IntoIter {
        self.text
            .into_iter()
            .zip(self.origins)
            .map(|(text, origins)| SourceLine(text, origins))
            .collect::<Vec<_>>()
            .into_iter()
    }
}

impl SourceLines {
    pub(crate) fn map_text(mut self, change: impl Fn(String) -> String) -> Self {
        self.text = self.text.into_iter().map(change).collect();
        self
    }
    pub(crate) fn push(&mut self, text: String) {
        self.origins.push(if text.is_empty() {
            Vec::new()
        } else {
            current()
        });
        self.text.push(text);
    }

    pub(crate) fn insert(&mut self, index: usize, text: String) {
        self.origins.insert(
            index,
            if text.is_empty() {
                Vec::new()
            } else {
                current()
            },
        );
        self.text.insert(index, text);
    }

    pub(crate) fn pop(&mut self) -> Option<String> {
        self.origins.pop();
        self.text.pop()
    }

    pub(crate) fn extend<I, T>(&mut self, lines: I)
    where
        I: IntoIterator<Item = T>,
        T: Into<SourceLine>,
    {
        for line in lines {
            let SourceLine(text, origins) = line.into();
            self.text.push(text);
            self.origins.push(origins);
        }
    }

    pub(crate) fn append_origin(&mut self) {
        if let Some(origins) = self.origins.last_mut() {
            origins.extend(current());
        }
    }

    pub(crate) fn render(&self, language: &str) -> String {
        self.render_ending(language, "\n")
    }

    pub(crate) fn render_ending(&self, language: &str, ending: &str) -> String {
        let text = format!("{}{ending}", self.text.join("\n"));
        CONTEXTS.with_borrow_mut(|contexts| {
            if let Some(context) = contexts.last_mut() {
                let mapped: Vec<_> = self
                    .origins
                    .iter()
                    .enumerate()
                    .flat_map(|(line, origins)| {
                        origins.iter().map(move |origin| (line, origin.clone()))
                    })
                    .collect();
                if !mapped.is_empty() {
                    context.emissions.push(Emission {
                        language: language.into(),
                        text: text.clone(),
                        mapped,
                    });
                }
            }
        });
        text
    }
}

pub(crate) fn emitted_map(
    emissions: &[Emission],
    source: &str,
    target: &str,
    language: &str,
) -> Vec<(usize, usize)> {
    let Some(emission) = emissions
        .iter()
        .rev()
        .find(|item| item.language == language)
    else {
        return Vec::new();
    };
    let lines = if emission.text == target {
        emission
            .text
            .split('\n')
            .enumerate()
            .map(|(line, _)| (line, line))
            .collect()
    } else {
        let marks = if crate::natural::is_natural_language(language) {
            crate::layout::Marks::default()
        } else if let Ok(syntax) = crate::formal::languages::language_syntax(language) {
            crate::layout::Marks::of(&syntax)
        } else {
            return Vec::new();
        };
        crate::layout::transfer_layout(&emission.text, target, &marks, &marks, false, language)
            .lines
    };
    let mut positions: BTreeMap<usize, BTreeSet<usize>> = BTreeMap::new();
    for (before, after) in lines {
        positions.entry(before).or_default().insert(after);
    }
    let mut result = BTreeSet::new();
    for (line, origin) in &emission.mapped {
        if origin.source.as_ref() != source {
            continue;
        }
        for from in &origin.lines {
            for to in positions.get(line).into_iter().flatten() {
                result.insert((*from, *to));
            }
        }
    }
    result.into_iter().collect()
}

pub(crate) fn merge(
    semantic: Vec<(usize, usize)>,
    lexical: Vec<(usize, usize)>,
) -> Vec<(usize, usize)> {
    let targets: BTreeSet<_> = semantic.iter().map(|(_, target)| *target).collect();
    let mut result = semantic;
    result.extend(
        lexical
            .into_iter()
            .filter(|(_, target)| !targets.contains(target)),
    );
    result.sort_unstable();
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capture_context_is_restored_after_panics_and_nested_translations() {
        assert!(std::panic::catch_unwind(|| capture(|| panic!("capture probe"))).is_err());
        let translator = crate::Translator::new();
        let (result, emissions) = capture(|| {
            translator
                .translate_partial(
                    "console.log(9);\n",
                    "javascript",
                    "python",
                    crate::Options::default(),
                    false,
                )
                .unwrap();
            translator
                .translate_partial(
                    "console.log(8);\n",
                    "javascript",
                    "russian",
                    crate::Options::default(),
                    false,
                )
                .unwrap()
        });
        assert!(emissions.is_empty());
        assert_eq!(result.line_map, vec![(0, 0)]);
    }
}
