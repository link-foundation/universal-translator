use crate::{Adapter, Comment, Effect, Expression, Interpretation, Placement};

pub(crate) struct MetaAdapter;

impl Adapter for MetaAdapter {
    fn parse(&self, source: &str) -> Option<Interpretation> {
        let [effect]: [Effect; 1] = Effect::read_links_notation(source).ok()?.try_into().ok()?;
        let mut comments = Vec::new();
        let mut placement = Placement::Leading;
        for (line, source_line) in source.lines().enumerate() {
            let text = source_line.trim();
            if let Some(comment) = text.strip_prefix('#') {
                comments.push(Comment {
                    text: comment.trim().into(),
                    placement,
                    line,
                });
            } else if !text.is_empty() {
                placement = Placement::Body;
            }
        }
        Some(Interpretation {
            effect,
            form: "standard".into(),
            comments,
            output: "effect".into(),
            requires: Vec::new(),
        })
    }

    fn emit(&self, expression: &Expression) -> Result<String, String> {
        if expression.form != "standard" {
            return Err(format!("Unsupported form \"{}\" for meta", expression.form));
        }
        let mut leading = String::new();
        let mut body = String::new();
        for comment in &expression.comments {
            if comment.text.trim() != comment.text || comment.text.contains(['\r', '\n']) {
                return Err("Comment cannot be represented safely in Links Notation".into());
            }
            let lines = match comment.placement {
                Placement::Leading => &mut leading,
                Placement::Body => &mut body,
            };
            lines.push('#');
            if !comment.text.is_empty() {
                lines.push(' ');
                lines.push_str(&comment.text);
            }
            lines.push('\n');
        }
        Ok(format!(
            "{leading}{}\n{body}",
            expression.effect.to_links_notation()
        ))
    }
}
