use crate::links;
use links_notation::LiNo;

/// A lossless, language-labeled representation of source lines.
#[derive(Debug, PartialEq, Eq)]
pub struct SourceDocument {
    pub language: String,
    pub source: String,
}

impl SourceDocument {
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

fn line_field(name: &str, value: &str) -> links::Link {
    LiNo::new(Some(name.into()), vec![LiNo::reference(value.to_owned())])
}
