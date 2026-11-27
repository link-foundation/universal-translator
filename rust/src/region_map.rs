//! Semantic regions in original input and final output, independent of spelling.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Arc;

use crate::Translator;
use crate::meta::{GrammarError, Node, Value};
use crate::source_origins::{SourceOrigin, comment_origins, expression_origins};
use crate::source_spans::{self, Line, Span};

/// A half-open UTF-8 byte range in a source text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ByteRange {
    pub start: usize,
    pub end: usize,
}

/// Two source regions sharing meaning. Either endpoint can occur in several
/// pairs when translation splits or joins a semantic construct.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct TranslationRegion {
    pub source: ByteRange,
    pub target: ByteRange,
}

type Entries = BTreeMap<usize, Vec<Vec<Span>>>;

fn metadata(key: &str) -> bool {
    matches!(
        key,
        "type"
            | "returnType"
            | "mutable"
            | "bindingMutable"
            | "contentMutable"
            | "syntax"
            | "comments"
            | "mainComments"
            | "annotations"
            | "parameterAnnotations"
            | "trailing"
            | "block"
            | "blankAfter"
    )
}

fn owned(origins: &[Arc<SourceOrigin>], source: &str) -> Vec<Span> {
    source_spans::merge(
        origins
            .iter()
            .filter(|origin| origin.source.as_ref() == source)
            .flat_map(|origin| origin.spans.iter().copied())
            .collect(),
    )
    .into_iter()
    .filter_map(|(start, end)| {
        let text = source.get(start..end)?;
        let left = text.len() - text.trim_start().len();
        let right = text.trim_end().len();
        (left < right).then_some((start + left, start + right))
    })
    .collect()
}

fn add_entry(entries: &mut Entries, key: usize, spans: Vec<Span>) {
    if !spans.is_empty() {
        entries.entry(key).or_default().push(spans);
    }
}

#[derive(Default)]
struct Collector {
    identities: HashMap<String, usize>,
}

impl Collector {
    fn identify(&mut self, key: String) -> usize {
        let next = self.identities.len();
        *self.identities.entry(key).or_insert(next)
    }

    fn value(&mut self, value: &Value, source: &str, entries: &mut Entries) -> usize {
        let key = match value {
            Value::Node(node) => return self.visit(node, source, entries),
            Value::List(items) => format!(
                "list:{:?}",
                items
                    .iter()
                    .map(|item| self.value(item, source, entries))
                    .collect::<Vec<_>>()
            ),
            Value::Text(text) => format!("text:{text}"),
            Value::Bool(value) => format!("bool:{value}"),
            Value::Number(value) => format!("number:{value}"),
        };
        self.identify(key)
    }

    fn visit(&mut self, node: &Node, source: &str, entries: &mut Entries) -> usize {
        let fields: Vec<_> = node
            .fields
            .iter()
            .filter(|(key, _)| !metadata(key))
            .map(|(key, value)| (key, self.value(value, source, entries)))
            .collect();
        let key = self.identify(format!("{}:{fields:?}", node.kind));
        if !matches!(node.kind.as_str(), "Program" | "Block" | "Blank") {
            add_entry(entries, key, owned(&expression_origins(node), source));
        }
        for field in ["comments", "mainComments"] {
            for (index, origin) in comment_origins(node, field).iter().enumerate() {
                if let Some(origin) = origin {
                    let comment = self.identify(format!("comment:{key}:{field}:{index}"));
                    add_entry(entries, comment, owned(&[origin.clone()], source));
                }
            }
        }
        key
    }

    fn collect(&mut self, node: &Node, source: &str) -> Entries {
        let mut entries = Entries::new();
        self.visit(node, source, &mut entries);
        entries
    }

    fn read(
        &mut self,
        translator: &Translator,
        source: &str,
        language: &str,
    ) -> Result<Entries, GrammarError> {
        if let Ok(fragment) = translator.parse_fragment(source, language) {
            return Ok(self.collect(&fragment.program, source));
        }
        let mut result = Entries::new();
        let after = source_spans::lines(source);
        for part in translator.parse_partial(source, language)?.parts {
            if part.status != crate::PartStatus::Read {
                continue;
            }
            let before = source_spans::lines(&part.source);
            let positions: Vec<_> = (0..before.len())
                .map(|row| Some(part.start + row + 1))
                .collect();
            let fragment = translator.parse_fragment(&part.source, language)?;
            for (key, groups) in self.collect(&fragment.program, &part.source) {
                result.entry(key).or_default().extend(
                    groups
                        .iter()
                        .map(|spans| source_spans::remap(spans, &before, &after, &positions)),
                );
            }
        }
        Ok(result)
    }
}

fn row_at(lines: &[Line], byte: usize) -> usize {
    lines
        .partition_point(|line| line.start <= byte)
        .saturating_sub(1)
}

struct Regions {
    source: Vec<Line>,
    target: Vec<Line>,
    pairs: BTreeSet<TranslationRegion>,
    covered: BTreeSet<(usize, usize)>,
}

impl Regions {
    fn add(&mut self, left: Span, right: Span) {
        if left.0 < left.1 && right.0 < right.1 {
            self.pairs.insert(TranslationRegion {
                source: ByteRange {
                    start: left.0,
                    end: left.1,
                },
                target: ByteRange {
                    start: right.0,
                    end: right.1,
                },
            });
            self.covered
                .insert((row_at(&self.source, left.0), row_at(&self.target, right.0)));
        }
    }

    fn semantic(&mut self, before: Entries, after: Entries, related: &BTreeSet<(usize, usize)>) {
        for (key, sources) in before {
            let Some(targets) = after.get(&key) else {
                continue;
            };
            for (index, spans) in sources.iter().enumerate() {
                let candidates = if sources.len() == targets.len() {
                    &targets[index..=index]
                } else {
                    targets.as_slice()
                };
                for other in candidates {
                    for &left in spans {
                        for &right in other {
                            if related.contains(&(
                                row_at(&self.source, left.0),
                                row_at(&self.target, right.0),
                            )) {
                                self.add(left, right);
                            }
                        }
                    }
                }
            }
        }
    }
}

pub(crate) fn region_map(
    translator: &Translator,
    source: &str,
    target: &str,
    from: &str,
    to: &str,
    line_map: &[(usize, usize)],
) -> Vec<TranslationRegion> {
    let mut regions = Regions {
        source: source_spans::lines(source),
        target: source_spans::lines(target),
        pairs: BTreeSet::new(),
        covered: BTreeSet::new(),
    };
    let mut collector = Collector::default();
    if let (Ok(before), Ok(after)) = (
        collector.read(translator, source, from),
        collector.read(translator, target, to),
    ) {
        regions.semantic(before, after, &line_map.iter().copied().collect());
    }
    for &(a, b) in line_map {
        if let (Some(left), Some(right)) = (regions.source.get(a), regions.target.get(b))
            && !regions.covered.contains(&(a, b))
        {
            regions.add(
                (left.start + left.indent, left.end),
                (right.start + right.indent, right.end),
            );
        }
    }
    regions.pairs.into_iter().collect()
}
