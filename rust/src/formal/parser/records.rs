use std::collections::{HashMap, HashSet};

use super::{Parsed, Parser, TokenType};
use crate::formal::records::{supports_records, valid_record};
use crate::meta::{GrammarError, Node};
use crate::source_origins;

impl Parser {
    pub(super) fn is_namespace_or_class(&self) -> bool {
        let offset = self.modifier_count();
        ["class", "namespace", "object"].contains(&self.value(offset))
            && self.kind(offset) == TokenType::Name
    }

    pub(super) fn class_definition(&mut self) -> Parsed {
        let modified = self.modifier_count() > 0;
        self.skip_modifiers();
        let form = self.next_value()?;
        let title = self.expect_name()?;
        // A Scala App object supplies the program's body.
        if self.syntax.id == "scala" && self.is("extends") && self.is_at("App", 1) {
            self.position += 2;
        }
        self.skip_newlines();
        self.expect("{")?;
        if self.syntax.id == "javascript" && form == "class" && self.js_record_starts() {
            if !supports_records(&self.syntax) {
                return Err(self.record_error("Class declarations require ECMAScript 2015"));
            }
            if modified || self.class_depth != 0 {
                return Err(
                    self.record_error("A record class must be an unmodified top-level declaration")
                );
            }
            return self.js_record(title);
        }
        self.class_depth += 1;
        let items = self.items(&|parser| parser.is("}"));
        self.class_depth -= 1;
        let items = items?;
        self.expect("}")?;
        Ok(Node::new("Class")
            .with("form", form)
            .with("name", title)
            .with("items", items))
    }

    fn record_error(&self, message: &str) -> GrammarError {
        GrammarError::syntax(message, self.current().line)
    }

    fn js_record_starts(&self) -> bool {
        let mut offset = 0;
        while matches!(self.kind(offset), TokenType::Newline | TokenType::Comment) {
            offset += 1;
        }
        self.is_at("constructor", offset) && self.is_at("(", offset + 1)
    }

    fn record_comments(&mut self) -> Parsed<Vec<Node>> {
        self.skip_separators();
        let mut comments = Vec::new();
        while self.kind(0) == TokenType::Comment {
            comments.push(self.item()?);
            self.skip_separators();
        }
        Ok(comments)
    }

    fn record(
        &self,
        name: String,
        parameters: Vec<String>,
        fields: Vec<Node>,
        comments: Vec<Node>,
    ) -> Parsed {
        let definition = Node::new("RecordDefinition")
            .with("name", name)
            .with("parameters", parameters)
            .with("fields", fields);
        if !valid_record(&definition) {
            return Err(
                self.record_error("A record requires one field per distinct constructor parameter")
            );
        }
        if comments.is_empty() {
            return Ok(definition);
        }
        Ok(source_origins::attach_comments(
            definition,
            "constructorComments",
            &comments,
        ))
    }

    fn js_record(&mut self, name: String) -> Parsed {
        let comments = self.record_comments()?;
        self.expect("constructor")?;
        let parameters = self.record_list("(", ")", Self::expect_name)?;
        let body = self.block()?;
        let fields = body
            .nodes("statements")
            .into_iter()
            .filter(|statement| !statement.is("Blank"))
            .map(|statement| {
                let field = statement
                    .str("property")
                    .zip(statement.node("value").filter(|value| value.is("Name")))
                    .and_then(|(property, value)| Some((property, value.str("name")?)));
                let Some((property, parameter)) = field.filter(|_| {
                    statement.is("PropertyAssignment")
                        && statement
                            .node("object")
                            .is_some_and(|object| object.is_name("this"))
                }) else {
                    return Err(self.record_error(
                        "Expected an assignment from a parameter to an instance field",
                    ));
                };
                Ok(source_origins::inherit(
                    Node::new("RecordField")
                        .with("name", property)
                        .with("parameter", parameter),
                    statement,
                ))
            })
            .collect::<Parsed<Vec<_>>>()?;
        self.skip_separators();
        self.expect("}")?;
        self.record(name, parameters, fields, comments)
    }

    fn record_list<T>(
        &mut self,
        open: &str,
        close: &str,
        mut read: impl FnMut(&mut Self) -> Parsed<T>,
    ) -> Parsed<Vec<T>> {
        self.skip_newlines();
        self.expect(open)?;
        self.skip_newlines();
        let mut items = Vec::new();
        while !self.is(close) {
            items.push(read(self)?);
            self.skip_newlines();
            if !self.accept(",") {
                break;
            }
            self.skip_newlines();
        }
        self.expect(close)?;
        Ok(items)
    }

    fn record_types(&mut self) -> Parsed<Vec<String>> {
        if self.is("<") {
            self.record_list("<", ">", Self::expect_name)
        } else {
            Ok(Vec::new())
        }
    }

    fn record_entries(
        &mut self,
        open: &str,
        close: &str,
        public: bool,
        shorthand: bool,
    ) -> Parsed<Vec<(String, String)>> {
        self.record_list(open, close, |parser| {
            if public {
                parser.expect("pub")?;
            }
            let key = parser.expect_name()?;
            if parser.accept(":") {
                Ok((key, parser.expect_name()?))
            } else if shorthand {
                Ok((key.clone(), key))
            } else {
                Err(parser.record_error("Expected a record field type"))
            }
        })
    }

    pub(super) fn rust_record(&mut self) -> Parsed {
        self.expect("pub")?;
        self.expect("struct")?;
        let name = self.expect_name()?;
        let types = self.record_types()?;
        let declarations = self.record_entries("{", "}", true, false)?;
        self.skip_separators();
        self.expect("impl")?;
        let implementation_types = self.record_types()?;
        self.expect(&name)?;
        let type_arguments = self.record_types()?;
        self.skip_newlines();
        self.expect("{")?;
        let comments = self.record_comments()?;
        self.expect("pub")?;
        self.expect("fn")?;
        self.expect("new")?;
        let parameters = self.record_entries("(", ")", false, false)?;
        self.expect("->")?;
        self.expect("Self")?;
        self.skip_newlines();
        self.expect("{")?;
        self.skip_separators();
        self.expect("Self")?;
        let initializers = self.record_entries("{", "}", false, true)?;
        self.skip_newlines();
        self.expect("}")?;
        self.skip_separators();
        self.expect("}")?;

        let declared_types: HashMap<_, _> = types.iter().zip(&type_arguments).collect();
        let field_types: HashMap<_, _> = declarations.iter().cloned().collect();
        let parameter_types: HashMap<_, _> = parameters.iter().cloned().collect();
        let distinct = |names: &[String]| names.iter().collect::<HashSet<_>>().len();
        if types.len() != type_arguments.len()
            || distinct(&types) != types.len()
            || distinct(&type_arguments) != type_arguments.len()
            || distinct(&implementation_types) != types.len()
            || implementation_types.len() != types.len()
            || !type_arguments
                .iter()
                .all(|kind| implementation_types.contains(kind))
            || parameter_types.values().collect::<HashSet<_>>().len() != types.len()
            || parameters.len() != types.len()
            || declarations.len() != field_types.len()
            || declarations.len() != initializers.len()
            || initializers.iter().any(|(key, parameter)| {
                let actual = field_types
                    .get(key)
                    .and_then(|kind| declared_types.get(kind).copied());
                actual.is_none() || actual != parameter_types.get(parameter)
            })
        {
            return Err(
                self.record_error("A record constructor requires one generic type per field")
            );
        }
        let fields = initializers
            .into_iter()
            .map(|(name, parameter)| {
                Node::new("RecordField")
                    .with("name", name)
                    .with("parameter", parameter)
            })
            .collect();
        let parameters = parameters.into_iter().map(|(name, _)| name).collect();
        self.record(name, parameters, fields, comments)
    }
}
