use crate::{Effect, Expression, Interpretation, Placement, Profile};
use meta_language::{ByteRange, LinkId, LinkMetadata, LinkNetwork, LinkType, Point, SourceSpan};

pub(crate) fn source_network(
    source: &str,
    language: &str,
    interpretation: Option<&Interpretation>,
) -> LinkNetwork {
    let mut network = LinkNetwork::new();
    let mut offset = 0;
    let mut lines = Vec::new();
    let mut comments = interpretation
        .into_iter()
        .flat_map(|value| &value.comments)
        .peekable();
    for (line, text) in source.split_inclusive('\n').enumerate() {
        let end = if text.ends_with('\n') {
            Point::new(line + 1, 0)
        } else {
            Point::new(line, text.len())
        };
        let span = SourceSpan::new(
            ByteRange::new(offset, offset + text.len()),
            Point::new(line, 0),
            end,
        );
        offset += text.len();
        let token = network.insert_link(
            [],
            metadata(language, LinkType::Token, text).with_span(span),
        );
        let kind = if comments.peek().is_some_and(|comment| comment.line == line) {
            comments.next();
            "comment"
        } else if text.trim().is_empty() {
            "trivia"
        } else {
            "code"
        };
        lines.push(network.insert_link([token], metadata(language, LinkType::Syntax, kind)));
    }
    let label = interpretation.map_or("unclassified", |value| value.form.as_str());
    let children = ordered(&mut network, language, &lines);
    let root = network.insert_link([children], metadata(language, LinkType::Syntax, label));
    bind_source(&mut network, language, interpretation, root);
    network
}

pub(crate) fn bind_source(
    network: &mut LinkNetwork,
    language: &str,
    interpretation: Option<&Interpretation>,
    root: LinkId,
) {
    if let Some(value) = interpretation {
        let meaning = insert_effect(network, &value.effect);
        bind_operation(
            network,
            language,
            &value.output,
            &value.requires,
            root,
            meaning,
        );
    }
}

fn bind_operation(
    network: &mut LinkNetwork,
    language: &str,
    output: &str,
    requires: &[String],
    root: LinkId,
    meaning: LinkId,
) {
    let prerequisites: Vec<_> = requires
        .iter()
        .map(|requirement| network.insert_point(requirement))
        .collect();
    let prerequisites = ordered(network, language, &prerequisites);
    let operation = network.insert_link(
        [root, prerequisites],
        metadata(language, LinkType::Semantic, output),
    );
    network.insert_link(
        [operation, meaning],
        metadata(language, LinkType::Semantic, "realizes"),
    );
}

pub(crate) fn bind_target(expression: &mut Expression, profile: &Profile) {
    let form = profile
        .forms
        .iter()
        .find(|form| form.task == expression.effect.task() && form.name == expression.form);
    let output = form
        .and_then(|form| form.output.as_deref())
        .unwrap_or(&profile.output);
    let requires = form
        .and_then(|form| form.requires.as_deref())
        .or_else(|| {
            profile
                .forms
                .iter()
                .find(|form| form.task == "hello" && form.name == "standard")?
                .requires
                .as_deref()
        })
        .unwrap_or_default();

    let network = &mut expression.network;
    let language = &expression.language;
    let comments: Vec<_> = expression
        .comments
        .iter()
        .map(|comment| {
            let text = network.insert_point(&comment.text);
            let placement = match comment.placement {
                Placement::Leading => "leading",
                Placement::Body => "body",
            };
            network.insert_link([text], metadata(language, LinkType::Syntax, placement))
        })
        .collect();
    let ordered = ordered(network, language, &comments);
    let root = network.insert_link(
        [ordered],
        metadata(language, LinkType::Syntax, &expression.form),
    );
    bind_operation(network, language, output, requires, root, expression.id);
}

fn metadata(language: &str, kind: LinkType, term: &str) -> LinkMetadata {
    LinkMetadata::new()
        .with_link_type(kind)
        .with_term(term)
        .with_language(language)
}

fn ordered(network: &mut LinkNetwork, language: &str, children: &[LinkId]) -> LinkId {
    let end = network.insert_point("end");
    children.iter().rev().fold(end, |rest, child| {
        network.insert_link(
            [*child, rest],
            metadata(language, LinkType::Relation, "next"),
        )
    })
}

pub(crate) fn insert_effect(network: &mut LinkNetwork, effect: &Effect) -> LinkId {
    let mut fields = Vec::new();
    for (key, value) in effect.fields() {
        let value = network.insert_point(&value);
        fields.push(network.insert_link([value], metadata("meta", LinkType::Relation, key)));
    }
    let fields = ordered(network, "meta", &fields);
    network.insert_link(
        [fields],
        metadata("meta", LinkType::Semantic, effect.task()),
    )
}
