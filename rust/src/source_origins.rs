//! Source locations travel with nodes without changing their meaning.

use std::collections::BTreeMap;
use std::sync::Arc;

use crate::meta::{Node, Value};

#[derive(Clone, Debug)]
pub(crate) struct SourceOrigin {
    pub(crate) source: Arc<str>,
    pub(crate) lines: Vec<usize>,
    range: Option<(usize, usize)>,
    comments: BTreeMap<String, Vec<Option<Arc<SourceOrigin>>>>,
}

pub(crate) fn comment_origins(node: &Node, key: &str) -> Vec<Option<Arc<SourceOrigin>>> {
    node.origin
        .as_ref()
        .and_then(|origin| origin.comments.get(key))
        .cloned()
        .unwrap_or_default()
}

pub(crate) fn attach_comment_origins(
    mut node: Node,
    key: &str,
    origins: Vec<Option<Arc<SourceOrigin>>>,
) -> Node {
    let own = node.origin.as_deref().cloned().or_else(|| {
        origins.iter().flatten().next().map(|origin| SourceOrigin {
            source: origin.source.clone(),
            lines: Vec::new(),
            range: None,
            comments: BTreeMap::new(),
        })
    });
    if let Some(mut own) = own {
        own.comments.insert(key.to_owned(), origins);
        node.origin = Some(Arc::new(own));
    }
    node
}

pub(crate) fn attach_comments(node: Node, key: &str, comments: &[Node]) -> Node {
    let comments: Vec<_> = comments.iter().filter(|node| node.is("Comment")).collect();
    let texts: Vec<_> = comments
        .iter()
        .map(|node| node.str("text").unwrap_or_default().to_owned())
        .collect();
    attach_comment_origins(
        node.with(key, texts),
        key,
        comments.iter().map(|node| node.origin.clone()).collect(),
    )
}

pub(crate) fn attach_comment_texts(node: Node, key: &str, texts: &[String]) -> Node {
    attach_comment_origins(
        node.with(key, texts.to_vec()),
        key,
        texts
            .iter()
            .map(|text| combine_origins(&crate::emission_map::line_origins(text)))
            .collect(),
    )
}

pub(crate) fn combine_origins(origins: &[Arc<SourceOrigin>]) -> Option<Arc<SourceOrigin>> {
    let source = origins.first()?.source.clone();
    let mut lines: Vec<_> = origins
        .iter()
        .filter(|origin| origin.source == source)
        .flat_map(|origin| origin.lines.iter().copied())
        .collect();
    lines.sort_unstable();
    lines.dedup();
    Some(Arc::new(SourceOrigin {
        source,
        lines,
        range: None,
        comments: BTreeMap::new(),
    }))
}

pub(crate) struct SourceLocator {
    source: Arc<str>,
    starts: Vec<usize>,
}

impl SourceLocator {
    pub(crate) fn new(source: &str) -> Self {
        Self {
            source: source.into(),
            starts: std::iter::once(0)
                .chain(
                    source
                        .chars()
                        .enumerate()
                        .filter_map(|(i, c)| (c == '\n').then_some(i + 1)),
                )
                .collect(),
        }
    }

    pub(crate) fn range(&self, start: usize, end: usize) -> Arc<SourceOrigin> {
        let first = self.starts.partition_point(|offset| *offset <= start) - 1;
        let last = self
            .starts
            .partition_point(|offset| *offset <= end.saturating_sub(1).max(start))
            - 1;
        Arc::new(SourceOrigin {
            source: self.source.clone(),
            lines: (first..=last).collect(),
            range: Some((first, last)),
            comments: BTreeMap::new(),
        })
    }

    pub(crate) fn line(&self, line: usize) -> Arc<SourceOrigin> {
        Arc::new(SourceOrigin {
            source: self.source.clone(),
            lines: vec![line],
            range: Some((line, line)),
            comments: BTreeMap::new(),
        })
    }

    pub(crate) fn at_line(&self, mut node: Node, line: usize) -> Node {
        node.origin = Some(self.line(line));
        node
    }
}

fn container(node: &Node) -> bool {
    matches!(
        node.kind.as_str(),
        "Block" | "Function" | "Class" | "Program"
    )
}

fn statement(node: &Node) -> bool {
    matches!(
        node.kind.as_str(),
        "Declaration"
            | "Assignment"
            | "IndexAssignment"
            | "Print"
            | "Evaluate"
            | "Return"
            | "Throw"
            | "Try"
            | "Catch"
            | "If"
            | "While"
            | "CountingLoop"
            | "ForEach"
            | "Comment"
    )
}

fn children(node: &Node, visit: &mut impl FnMut(&Node)) {
    fn value(item: &Value, visit: &mut impl FnMut(&Node)) {
        match item {
            Value::Node(node) => visit(node),
            Value::List(items) => items.iter().for_each(|item| value(item, visit)),
            _ => {}
        }
    }
    node.fields.values().for_each(|item| value(item, visit));
}

pub(crate) fn children_mut(node: &mut Node, visit: &mut impl FnMut(&mut Node)) {
    fn value(item: &mut Value, visit: &mut impl FnMut(&mut Node)) {
        match item {
            Value::Node(node) => visit(node),
            Value::List(items) => items.iter_mut().for_each(|item| value(item, visit)),
            _ => {}
        }
    }
    node.fields.values_mut().for_each(|item| value(item, visit));
}

pub(crate) fn register_origins(node: &mut Node) {
    children_mut(node, &mut register_origins);
    let Some(origin) = &node.origin else { return };
    if !(container(node) || statement(node)) {
        return;
    }
    let mut lines = origin.lines.clone();
    let first = lines.first().copied();
    let last = lines.last().copied();
    fn exclude(node: &Node, lines: &mut Vec<usize>, first: Option<usize>, last: Option<usize>) {
        if statement(node) {
            // Commands lifted into this statement's expressions can precede
            // its own range, and belong to it rather than the parent loop.
            for origin in expression_origins(node) {
                lines.retain(|line| {
                    Some(*line) == first
                        || Some(*line) == last
                        || !origin.range.map_or_else(
                            || origin.lines.contains(line),
                            |(start, end)| (start..=end).contains(line),
                        )
                });
            }
        } else {
            children(node, &mut |child| exclude(child, lines, first, last));
        }
    }
    children(node, &mut |child| exclude(child, &mut lines, first, last));
    node.origin = Some(Arc::new(SourceOrigin {
        lines,
        ..origin.as_ref().clone()
    }));
}

pub(crate) fn expression_origins(node: &Node) -> Vec<Arc<SourceOrigin>> {
    fn visit(node: &Node, result: &mut Vec<Arc<SourceOrigin>>) {
        if let Some(origin) = &node.origin {
            result.push(origin.clone());
        }
        children(node, &mut |child| {
            if !(container(child) || statement(child)) {
                visit(child, result);
            }
        });
    }
    let mut result = Vec::new();
    visit(node, &mut result);
    result
}

pub(crate) fn inherit(mut node: Node, source: &Node) -> Node {
    if node.origin.is_none() {
        node.origin = source.origin.clone();
    }
    node
}

pub(crate) fn remap_origins(node: &mut Node, source: &str, lines: &[Option<usize>]) {
    let source: Arc<str> = source.into();
    fn remap(
        origin: &SourceOrigin,
        source: &Arc<str>,
        lines: &[Option<usize>],
    ) -> Arc<SourceOrigin> {
        let mut mapped: Vec<_> = origin
            .lines
            .iter()
            .filter_map(|line| lines.get(*line).copied().flatten().map(|line| line - 1))
            .collect();
        mapped.sort_unstable();
        mapped.dedup();
        Arc::new(SourceOrigin {
            source: source.clone(),
            lines: mapped,
            range: None,
            comments: origin
                .comments
                .iter()
                .map(|(key, origins)| {
                    (
                        key.clone(),
                        origins
                            .iter()
                            .map(|origin| {
                                origin.as_ref().map(|origin| remap(origin, source, lines))
                            })
                            .collect(),
                    )
                })
                .collect(),
        })
    }
    fn visit(node: &mut Node, source: &Arc<str>, lines: &[Option<usize>]) {
        if let Some(origin) = &node.origin {
            node.origin = Some(remap(origin, source, lines));
        }
        children_mut(node, &mut |child| visit(child, source, lines));
    }
    visit(node, &source, lines);
}
