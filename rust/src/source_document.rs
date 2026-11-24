use crate::links;
use links_notation::{LiNo, ParserConfig, parse_lino_to_links_with_config};
use meta_language::{LinkId, LinkNetwork, LinkType, ParseConfiguration, grammar_provenance};

/// A lossless, language-labeled representation of source lines.
#[derive(Debug, PartialEq, Eq)]
pub struct SourceDocument {
    pub language: String,
    pub source: String,
}

impl SourceDocument {
    /// Parses the source with Meta Language and retains grammar nodes and tokens.
    /// Returns an error if Meta Language has no grammar or cannot retain the bytes.
    pub fn syntax_network(&self) -> Result<LinkNetwork, String> {
        parse_syntax(&self.source, &self.language)
    }

    /// Restores source and its language from a serialized Meta Language CST.
    pub fn from_syntax_notation(notation: &str) -> Result<Self, String> {
        validate_syntax_notation(notation)?;
        let network = LinkNetwork::from_lino(notation).map_err(|error| error.to_string())?;
        Ok(Self {
            language: syntax_language(&network)?,
            source: network.reconstruct_text(),
        })
    }

    /// Writes each source line, including its ending, as an ordered Links Notation link.
    pub fn to_links_notation(&self) -> Result<String, String> {
        if self.language.is_empty() {
            return Err("Expected a source language".into());
        }
        let mut fields = vec![line_field("language", &self.language)];
        fields.extend(
            self.source
                .split_inclusive('\n')
                .map(|line| line_field("line", line)),
        );
        Ok(links_notation::binary::format_document(&[LiNo::new(
            Some("source-document".into()),
            fields,
        )]))
    }

    /// Reads exactly one document and restores its source.
    pub fn from_links_notation(notation: &str) -> Result<Self, String> {
        let roots =
            links_notation::parse_lino_to_links(notation).map_err(|error| error.to_string())?;
        let [root] = roots.as_slice() else {
            return Err("Expected one Links Notation source document".into());
        };
        let [language, lines @ ..] = links::children(root, "source-document")? else {
            return Err("Expected a source language".into());
        };
        let language = links::reference(links::children(language, "language")?)?;
        if language.is_empty() {
            return Err("Expected a source language".into());
        }
        let mut source = String::new();
        for (index, line) in lines.iter().enumerate() {
            let line = links::children(line, "line")?;
            let [LiNo::Ref(line)] = line else {
                return Err("Expected one source line reference".into());
            };
            let valid = match line.find('\n') {
                Some(position) => position == line.len() - 1,
                None => !line.is_empty() && index == lines.len() - 1,
            };
            if !valid {
                return Err("Invalid source line boundaries".into());
            }
            source.push_str(line);
        }
        Ok(Self { language, source })
    }
}

pub(crate) fn parse_syntax(source: &str, language: &str) -> Result<LinkNetwork, String> {
    if grammar_provenance(language).is_empty() {
        return Err(format!("No Meta Language grammar for {language}"));
    }
    let network = LinkNetwork::parse(source, language, ParseConfiguration::default());
    if syntax_language(&network)? != language {
        return Err(format!("Expected a grammar tree for {language}"));
    }
    if network.reconstruct_text() != source {
        return Err(format!("{language} grammar did not preserve source bytes"));
    }
    Ok(network)
}

pub(crate) fn syntax_root(network: &LinkNetwork, language: &str) -> Option<LinkId> {
    network
        .links()
        .find(|link| {
            let metadata = link.metadata();
            metadata.link_type() == Some(LinkType::Document)
                && metadata.language() == Some(language)
        })
        .map(meta_language::Link::id)
}

fn syntax_language(network: &LinkNetwork) -> Result<String, String> {
    let (language, _) = network
        .parse_grammars()
        .into_iter()
        .next()
        .ok_or("Expected parser provenance in CST")?;
    if !network.links().any(|link| {
        let metadata = link.metadata();
        metadata.link_type() == Some(LinkType::Syntax)
            && metadata.language() == Some(&language)
            && metadata.span().is_some()
    }) {
        return Err(format!("Expected a grammar tree for {language}"));
    }
    Ok(language)
}

fn validate_syntax_notation(notation: &str) -> Result<(), String> {
    // Meta Language 1.0 asserts ordered byte ranges and increments link IDs.
    let roots = parse_lino_to_links_with_config(notation, &ParserConfig::without_comments())
        .map_err(|error| error.to_string())?;
    for root in &roots {
        let (id, values) = links::named(root)?;
        if id.parse::<u64>() == Ok(u64::MAX) {
            return Err("CST link ID is out of range".into());
        }
        for meta in values
            .iter()
            .filter_map(|value| links::children(value, "meta").ok())
        {
            for span in meta
                .iter()
                .filter_map(|field| links::children(field, "span").ok())
            {
                if let [LiNo::Ref(start), LiNo::Ref(end), ..] = span {
                    let start = start
                        .parse::<usize>()
                        .map_err(|_| "Invalid CST span start")?;
                    let end = end.parse::<usize>().map_err(|_| "Invalid CST span end")?;
                    if start > end {
                        return Err("CST byte range start must not exceed end".into());
                    }
                }
            }
        }
    }
    Ok(())
}

fn line_field(name: &str, value: &str) -> links::Link {
    LiNo::new(Some(name.into()), vec![LiNo::reference(value.to_owned())])
}
