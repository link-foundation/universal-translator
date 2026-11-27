//! Updateable grammar imports using the same Meta Language IR as JavaScript.

mod lexer_scopes;

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

pub use meta_language::grammar::Grammar;
pub use meta_language::grammar::feature_runtime::{FeatureParseOptions, ParseOutcome, SyntaxTree};
pub use meta_language::grammar::merge::{GrammarMergeOptions, GrammarMergeResult};
use meta_language::grammar::{feature_runtime, interchange, merge};
use meta_language::{GlobalConceptOptions, GlobalConceptSource, create_global_concept_space};

use crate::meta::{GrammarError, Node, Value};
use crate::source_origins::SourceLocator;
use crate::stages::ParseStage;

/// An upstream grammar, its language edition and reproducible provenance.
#[derive(Clone, Debug)]
pub struct GrammarSource {
    pub id: String,
    pub language: String,
    pub edition: String,
    pub format: String,
    pub source: String,
    pub imported_source: Option<String>,
    pub revision: Option<String>,
    pub url: Option<String>,
    pub precedence: u32,
    pub grammar: Option<Grammar>,
}

impl GrammarSource {
    #[must_use]
    pub fn new(id: &str, language: &str, format: &str, source: &str) -> Self {
        Self {
            id: id.into(),
            language: language.into(),
            format: format.into(),
            source: source.into(),
            imported_source: None,
            edition: String::new(),
            revision: None,
            url: None,
            precedence: 0,
            grammar: None,
        }
    }
}

pub type SourceTransform =
    Arc<dyn Fn(String, &GrammarSource) -> Result<String, GrammarError> + Send + Sync>;
pub type GrammarTransform =
    Arc<dyn Fn(Grammar, &str) -> Result<Grammar, GrammarError> + Send + Sync>;
pub type ParseTransform =
    Arc<dyn Fn(ParseOutcome, &str) -> Result<ParseOutcome, GrammarError> + Send + Sync>;
pub type ExportTransform = Arc<dyn Fn(String, &str) -> Result<String, GrammarError> + Send + Sync>;
pub type GrammarTrace = Arc<dyn Fn(&str, &str) + Send + Sync>;
pub type GrammarReader = Arc<dyn Fn(&SyntaxTree, &str) -> Result<Node, GrammarError> + Send + Sync>;

/// Transforms are reapplied to updates; tracing stays disabled by default.
#[derive(Clone, Default)]
pub struct GrammarHooks {
    pub before_import: Vec<SourceTransform>,
    pub after_import: Vec<GrammarTransform>,
    pub before_compile: Vec<GrammarTransform>,
    pub after_parse: Vec<ParseTransform>,
    pub before_export: Vec<GrammarTransform>,
    pub after_export: Vec<ExportTransform>,
    pub trace: Option<GrammarTrace>,
}

#[derive(Clone, Default)]
pub struct GrammarWorkspace {
    sources: BTreeMap<String, GrammarSource>,
    previous: Arc<Mutex<Option<GrammarMergeResult>>>,
    pub hooks: GrammarHooks,
}

/// A grammar parse retains its executor tree and the common source record.
#[derive(Clone, Debug)]
pub struct GrammarReading {
    pub outcome: ParseOutcome,
    pub syntax: Node,
}

fn error(value: impl std::fmt::Display) -> GrammarError {
    GrammarError::new(value.to_string())
}

impl GrammarWorkspace {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    fn trace(&self, stage: &str, context: &str) {
        if let Some(trace) = &self.hooks.trace {
            trace(stage, context);
        }
    }

    /// Import before replacing an existing value, so failed updates are atomic.
    pub fn import(&mut self, mut source: GrammarSource) -> Result<&GrammarSource, GrammarError> {
        if source.id.is_empty() || source.id.contains(':') || source.language.is_empty() {
            return Err(error(
                "A grammar source needs an id without colon and a language",
            ));
        }
        let importer = interchange::grammar_importer(&source.format)
            .ok_or_else(|| error(format!("Unsupported grammar format {}", source.format)))?;
        self.trace("beforeImport", &source.id);
        let mut text = source.source.clone();
        for transform in &self.hooks.before_import {
            text = transform(text, &source)?;
        }
        let mut grammar = importer(&text).map_err(error)?;
        self.trace("afterImport", &source.id);
        for transform in &self.hooks.after_import {
            grammar = transform(grammar, &source.id)?;
        }
        source.imported_source = Some(text);
        source.grammar = Some(grammar);
        let id = source.id.clone();
        self.sources.insert(id.clone(), source);
        Ok(&self.sources[&id])
    }

    pub fn update(
        &mut self,
        id: &str,
        source: &str,
        revision: Option<String>,
    ) -> Result<&GrammarSource, GrammarError> {
        let mut descriptor = self.get(id)?.clone();
        descriptor.source = source.into();
        descriptor.revision = revision;
        self.import(descriptor)
    }

    pub fn remove(&mut self, id: &str) -> Result<GrammarSource, GrammarError> {
        self.sources
            .remove(id)
            .ok_or_else(|| error(format!("Unknown grammar source {id}")))
    }

    #[must_use]
    pub fn sources(&self) -> Vec<&GrammarSource> {
        self.sources.values().collect()
    }

    fn get(&self, id: &str) -> Result<&GrammarSource, GrammarError> {
        self.sources
            .get(id)
            .ok_or_else(|| error(format!("Unknown grammar source {id}")))
    }

    /// Unrelated languages/editions remain separate groups. Equivalence is structural.
    pub fn merge(
        &self,
        options: &GrammarMergeOptions<'_>,
    ) -> Result<GrammarMergeResult, GrammarError> {
        let mut qualified = BTreeSet::new();
        let sources: Vec<_> = self
            .sources
            .values()
            .map(|source| {
                let original = source.grammar.as_ref().expect("imported grammar");
                let grammar = lexer_scopes::qualify_existing_scopes(&source.id, original)
                    .map_or_else(
                        || original.clone(),
                        |grammar| {
                            qualified.insert(source.id.as_str());
                            grammar
                        },
                    );
                merge::GrammarMergeSource::new(&source.id, &source.language, grammar)
                    .with_edition(&source.edition)
                    .with_precedence(source.precedence)
            })
            .collect();
        let mut previous = self.previous.lock().map_err(error)?;
        let options = GrammarMergeOptions {
            previous: options.previous.or(previous.as_ref()),
            ..options.clone()
        };
        let mut result = merge::merge_grammars(&sources, &options).map_err(error)?;
        if !qualified.is_empty() {
            for production in result
                .groups
                .iter_mut()
                .flat_map(|group| &mut group.source_productions)
            {
                if let Some((source, rule)) = production.alias.split_once(':')
                    && qualified.contains(source)
                {
                    let grammar = self.sources[source]
                        .grammar
                        .as_ref()
                        .expect("imported grammar");
                    production.rule = grammar.rule(rule).expect("original production").clone();
                }
            }
            // Global proof inputs retain the declarations and bindings as imported.
            let originals = self
                .sources
                .values()
                .map(|source| GlobalConceptSource {
                    id: source.id.clone(),
                    language: source.language.clone(),
                    edition: source.edition.clone(),
                    grammar: source.grammar.clone().expect("imported grammar"),
                })
                .collect::<Vec<_>>();
            result.global_concept_space = create_global_concept_space(
                &originals,
                &GlobalConceptOptions {
                    previous: options
                        .previous
                        .map(|result| result.global_concept_space.clone()),
                    equivalences: options.global_equivalences,
                    records: options.concept_records,
                    formal_definitions: options.formal_definitions,
                },
            )
            .map_err(error)?;
        }
        *previous = Some(result.clone());
        Ok(result)
    }

    pub fn grammar(
        &self,
        language: &str,
        edition: &str,
        source_id: Option<&str>,
    ) -> Result<(Grammar, Vec<String>), GrammarError> {
        if let Some(id) = source_id {
            return Ok((
                self.get(id)?.grammar.clone().expect("imported grammar"),
                vec![id.into()],
            ));
        }
        let group = self
            .merge(&GrammarMergeOptions::default())?
            .groups
            .into_iter()
            .find(|group| group.language == language && group.edition == edition)
            .ok_or_else(|| error(format!("No imported grammar for {language}@{edition}")))?;
        Ok((group.grammar, group.sources))
    }

    pub fn parse(
        &self,
        source: &str,
        language: &str,
        edition: &str,
        source_id: Option<&str>,
        options: FeatureParseOptions,
    ) -> Result<GrammarReading, GrammarError> {
        let language = if let Some(id) = source_id {
            &self.get(id)?.language
        } else {
            language
        };
        let (mut grammar, ids) = self.grammar(language, edition, source_id)?;
        self.trace("beforeCompile", language);
        for transform in &self.hooks.before_compile {
            grammar = transform(grammar, language)?;
        }
        let resolve = |id: &str| self.sources.get(id).and_then(|entry| entry.grammar.clone());
        let bounded = FeatureParseOptions {
            max_depth: options.max_depth.or(Some(256)),
            step_limit: options.step_limit.or(Some(1_000_000)),
            memo_limit: options.memo_limit.or(Some(100_000)),
            memory_limit: options.memory_limit.or(Some(200_000)),
            ..options
        };
        let parser = feature_runtime::compile_feature_grammar(&grammar, Some(&resolve), bounded)
            .map_err(error)?;
        let mut outcome = parser
            .parse_tree(source.as_bytes(), &FeatureParseOptions::default())
            .map_err(error)?;
        self.trace("afterParse", language);
        for transform in &self.hooks.after_parse {
            outcome = transform(outcome, source)?;
        }
        let mut syntax = concrete(source, language, &outcome)?;
        let provenance: Vec<_> = ids
            .iter()
            .map(|id| {
                let descriptor = &self.sources[id];
                Node::new("GrammarSource")
                    .with("id", id.as_str())
                    .with(
                        "revision",
                        descriptor.revision.as_deref().unwrap_or_default(),
                    )
                    .with("url", descriptor.url.as_deref().unwrap_or_default())
            })
            .collect();
        syntax.set("grammar", provenance);
        Ok(GrammarReading { outcome, syntax })
    }

    /// Export refuses an emitter's reported semantic losses.
    pub fn export(
        &self,
        format: &str,
        language: &str,
        edition: &str,
        source_id: Option<&str>,
    ) -> Result<String, GrammarError> {
        let emitter = interchange::grammar_emitter(format)
            .ok_or_else(|| error(format!("Unsupported grammar format {format}")))?;
        let (mut grammar, _) = self.grammar(language, edition, source_id)?;
        self.trace("beforeExport", format);
        for transform in &self.hooks.before_export {
            grammar = transform(grammar, format)?;
        }
        let (mut text, report) = emitter(&grammar).map_err(error)?;
        if !report.lossy.is_empty() {
            return Err(error(format!(
                "Grammar conversion would lose: {}",
                report.lossy.join("; ")
            )));
        }
        self.trace("afterExport", format);
        for transform in &self.hooks.after_export {
            text = transform(text, format)?;
        }
        Ok(text)
    }

    pub fn read(
        &self,
        source: &str,
        language: &str,
        edition: &str,
        lower: &GrammarReader,
    ) -> Result<Node, GrammarError> {
        let reading = self.parse(
            source,
            language,
            edition,
            None,
            FeatureParseOptions::default(),
        )?;
        if !reading.outcome.ok {
            return Err(error(reading.outcome.rejection.map_or_else(
                || "The grammar rejected the input".into(),
                |rejection| rejection.to_string(),
            )));
        }
        let concrete_tree = reading
            .outcome
            .tree
            .ok_or_else(|| error("The grammar produced no tree"))?;
        let mut tree = lower(&concrete_tree, source)?;
        if !tree.is("SourceProgram") || !matches!(tree.get("items"), Some(Value::List(_))) {
            return Err(error(
                "A grammar reader must return a SourceProgram with items",
            ));
        }
        tree.set("syntax", reading.syntax);
        tree.set("language", language);
        Ok(tree)
    }

    /// Install imported grammars using the existing replaceable parser stage.
    pub fn decorate_parser(
        self: Arc<Self>,
        next: ParseStage,
        readers: BTreeMap<String, GrammarReader>,
        edition: String,
    ) -> ParseStage {
        Arc::new(move |source, syntax| {
            if let Some(lower) = readers.get(syntax.id) {
                self.read(source, syntax.id, &edition, lower)
            } else {
                next(source, syntax)
            }
        })
    }
}

/// Give a semantic node the ownership of its concrete grammar production.
pub fn source_node(mut node: Node, tree: &SyntaxTree, source: &str) -> Result<Node, GrammarError> {
    let (start, end) = (tree.start(), tree.end());
    if start > end
        || end > source.len()
        || !source.is_char_boundary(start)
        || !source.is_char_boundary(end)
    {
        return Err(error("Grammar tree has an invalid source range"));
    }
    node.origin = Some(SourceLocator::new(source).range(
        source[..start].chars().count(),
        source[..end].chars().count(),
    ));
    Ok(node)
}

fn concrete(source: &str, language: &str, outcome: &ParseOutcome) -> Result<Node, GrammarError> {
    let mut leaves = Vec::new();
    let mut productions = Vec::new();
    let mut errors = Vec::new();
    fn visit(
        tree: &SyntaxTree,
        leaves: &mut Vec<(usize, usize, bool, String)>,
        productions: &mut Vec<Node>,
        errors: &mut Vec<Node>,
    ) {
        match tree {
            SyntaxTree::Node {
                kind,
                start,
                end,
                children,
                ..
            } => {
                productions.push(
                    Node::new("Production")
                        .with("rule", kind.as_str())
                        .with("start", *start as f64)
                        .with("end", *end as f64),
                );
                children
                    .iter()
                    .for_each(|child| visit(child, leaves, productions, errors));
            }
            SyntaxTree::Embed {
                language,
                start,
                end,
                root,
                ..
            } => {
                productions.push(
                    Node::new("Production")
                        .with("rule", language.as_str())
                        .with("start", *start as f64)
                        .with("end", *end as f64),
                );
                visit(root, leaves, productions, errors);
            }
            SyntaxTree::Token {
                start,
                end,
                kind,
                trivia,
                ..
            } => leaves.push((
                *start,
                *end,
                *trivia,
                kind.clone().unwrap_or_else(|| "token".into()),
            )),
            SyntaxTree::Error {
                start, end, reason, ..
            } => {
                errors.push(
                    Node::new("Error")
                        .with("start", *start as f64)
                        .with("end", *end as f64)
                        .with("message", reason.as_deref().unwrap_or("error")),
                );
                leaves.push((*start, *end, false, "error".into()));
            }
            SyntaxTree::Missing { start, end, .. } => errors.push(
                Node::new("Error")
                    .with("start", *start as f64)
                    .with("end", *end as f64)
                    .with("message", "missing"),
            ),
        }
    }
    if let Some(tree) = &outcome.tree {
        validate_ranges(tree, source, 0, source.len())?;
        visit(tree, &mut leaves, &mut productions, &mut errors);
    }
    let mut children = Vec::new();
    let mut position = 0;
    for (start, end, trivia, kind) in leaves {
        if start < position
            || start > end
            || end > source.len()
            || !source.is_char_boundary(start)
            || !source.is_char_boundary(end)
        {
            return Err(error(
                "Grammar tree has an invalid source range or overlapping leaves",
            ));
        }
        append_leaf(&mut children, source, "Trivia", "layout", position, start);
        append_leaf(
            &mut children,
            source,
            if kind == "error" {
                "Error"
            } else if trivia {
                "Trivia"
            } else {
                "Token"
            },
            &kind,
            start,
            end,
        );
        position = end;
    }
    append_leaf(
        &mut children,
        source,
        if outcome.ok { "Trivia" } else { "Error" },
        "unread",
        position,
        source.len(),
    );
    if let Some(rejection) = &outcome.rejection
        && errors.is_empty()
    {
        errors.push(
            Node::new("Error")
                .with("start", rejection.offset.unwrap_or(position) as f64)
                .with("end", source.len() as f64)
                .with("message", rejection.reason),
        );
    }
    let mut record = crate::concrete_syntax::record(source, language, children, productions);
    record.set("errors", errors);
    Ok(record)
}

fn validate_ranges(
    tree: &SyntaxTree,
    source: &str,
    parent_start: usize,
    parent_end: usize,
) -> Result<(), GrammarError> {
    let (start, end) = (tree.start(), tree.end());
    if start < parent_start
        || end < start
        || end > parent_end
        || !source.is_char_boundary(start)
        || !source.is_char_boundary(end)
    {
        return Err(error("Grammar tree has an invalid source range"));
    }
    match tree {
        SyntaxTree::Node { children, .. } => {
            for child in children {
                validate_ranges(child, source, start, end)?;
            }
        }
        SyntaxTree::Embed { root, .. } => validate_ranges(root, source, start, end)?,
        _ => {}
    }
    Ok(())
}

fn append_leaf(
    children: &mut Vec<Node>,
    source: &str,
    kind: &str,
    token: &str,
    start: usize,
    end: usize,
) {
    if start < end {
        children.push(
            Node::new(kind)
                .with("type", token)
                .with("start", start as f64)
                .with("end", end as f64)
                .with("text", &source[start..end]),
        );
    }
}
