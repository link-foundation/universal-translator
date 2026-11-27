//! Declaration annotations stay separate from parameter types.
use super::{Parsed, Parser, source_type};
use crate::formal::lexer::{TokenType, tokenize};
use crate::meta::Node;

pub(super) fn type_depth(value: &str) -> i64 {
    match value {
        "<" | "[" => 1,
        ">" | "]" => -1,
        ">>" => -2,
        _ => 0,
    }
}

impl Parser {
    pub(crate) fn annotations(&mut self) -> Parsed<Vec<Node>> {
        let mut annotations = Vec::new();
        while ["java", "kotlin", "python"].contains(&self.syntax.id) && self.accept("@") {
            annotations.push(Node::new("Annotation").with("expression", self.postfix()?));
            self.skip_newlines();
        }
        Ok(annotations)
    }

    pub(crate) fn prefix_parameter(&mut self) -> Parsed {
        self.skip_newlines();
        let annotations = self.annotations()?;
        let mut words = Vec::new();
        let mut depth = 0i64;
        while depth > 0 || (!self.is(",") && !self.is(")")) {
            depth += type_depth(self.value(0));
            if self.kind(0) == TokenType::Newline {
                self.position += 1;
            } else {
                words.push(self.next_value()?);
            }
        }
        let name = words.pop().unwrap_or_default();
        let spelling = words.join(" ");
        let mut parameter = Node::new("Parameter")
            .with("name", name)
            .with_opt("type", source_type(&spelling));
        if self.syntax.id == "cpp"
            && words.iter().any(|word| word == "const")
            && words
                .iter()
                .any(|word| matches!(word.as_str(), "&" | "&&" | "*"))
        {
            parameter.set("cppType", format!("source:{spelling}"));
        }
        if !annotations.is_empty() {
            parameter.set("annotations", annotations);
        }
        Ok(parameter)
    }

    pub(crate) fn type_head_length(&self) -> usize {
        if self.syntax.id == "csharp" && self.is("from") && self.is_at("in", 2) {
            return 0;
        }
        let mut offset = 0;
        let mut depth = 0;
        let cpp_fixed_array = self.is_cpp_fixed_array();
        loop {
            let value = self.value(offset);
            if self.kind(offset) != TokenType::Name
                && !["*", "::", ".", "[", "]", "<", ">", ">>"].contains(&value)
                && !(depth > 0 && [",", "?"].contains(&value))
                && !(cpp_fixed_array && depth > 0 && self.kind(offset) == TokenType::Number)
            {
                return offset;
            }
            depth += type_depth(value);
            offset += 1;
        }
    }

    pub(super) fn prototype_length(&self) -> usize {
        let offset = self.prefix_head_length();
        if offset < 2
            || !self.is_at("(", offset)
            || self.kind(offset - 1) != TokenType::Name
            || self.cpp_string_initializer(offset)
        {
            return 0;
        }
        // A dotted or namespace-qualified callee is a single declarator.
        let mut name_start = offset - 1;
        while name_start > 0 && matches!(self.value(name_start - 1), "." | "::") {
            name_start -= if name_start > 1 && self.kind(name_start - 2) == TokenType::Name {
                2
            } else {
                1
            };
        }
        let after = self.after_parentheses(offset);
        if name_start > 0 && self.is_at(";", after) {
            after + 1
        } else {
            0
        }
    }

    pub(crate) fn annotated_parameters(&mut self) -> Parsed<Vec<Node>> {
        self.expect("(")?;
        self.skip_newlines();
        let mut parameters = Vec::new();
        while !self.is(")") {
            let annotations = self.annotations()?;
            let name = self.expect_name()?;
            let kind = if self.accept(":") {
                self.type_expression()?
            } else {
                None
            };
            let mut parameter = Node::new("Parameter")
                .with("name", name)
                .with_opt("type", kind);
            if !annotations.is_empty() {
                parameter.set("annotations", annotations);
            }
            parameters.push(parameter);
            self.skip_newlines();
            if !self.accept(",") {
                break;
            }
            self.skip_newlines();
        }
        self.expect(")")?;
        Ok(parameters)
    }

    pub(crate) fn annotated_hint(&self, parameter: Node) -> Parsed {
        let Some(kind) = parameter.str("type") else {
            return Ok(parameter);
        };
        if self.syntax.id != "python" || !kind.starts_with("source:Annotated[") {
            return Ok(parameter);
        }
        let mut parser = Parser::new(
            tokenize(&kind["source:".len()..], &self.syntax)?,
            self.syntax.clone(),
        );
        parser.expect("Annotated")?;
        parser.expect("[")?;
        let kind = parser.type_hint()?;
        let mut annotations = Vec::new();
        while parser.accept(",") {
            annotations.push(Node::new("Annotation").with("expression", parser.expression()?));
        }
        parser.expect("]")?;
        Ok(parameter
            .with_opt("type", kind)
            .with("annotations", annotations))
    }
}
