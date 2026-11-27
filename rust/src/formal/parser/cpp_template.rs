//! Explicit type template-ids with a fundamental type that disambiguates
//! them from ordinary comparisons, as in `left < middle > (right)`.

use super::Parser;
use crate::formal::lexer::TokenType;
use crate::meta::Node;

const FUNDAMENTAL: &[&str] = &[
    "bool", "char", "char8_t", "char16_t", "char32_t", "double", "float", "int", "long", "short",
    "signed", "unsigned", "void", "wchar_t",
];

impl Parser {
    pub(super) fn cpp_template_arguments(&mut self, callee: &Node) -> Option<String> {
        if self.syntax.id != "cpp"
            || !matches!(callee.kind.as_str(), "Name" | "Method")
            || !self.is("<")
        {
            return None;
        }
        let mut tokens = Vec::new();
        let mut depth = 1isize;
        let mut needs_type = true;
        let mut definite = false;
        for offset in 1.. {
            let token = self.peek(offset);
            let value = token.value.as_str();
            match token.kind {
                TokenType::Newline => continue,
                TokenType::Name => {
                    needs_type = false;
                    definite |= FUNDAMENTAL.contains(&value);
                }
                _ if value == "::" => needs_type = true,
                _ if needs_type => return None,
                _ if matches!(value, "," | "<") => {
                    depth += isize::from(value == "<");
                    needs_type = true;
                }
                _ if matches!(value, ">" | ">>") => {
                    depth -= value.len() as isize;
                    if depth <= 0 {
                        if depth != 0 || !definite || !self.is_at("(", offset + 1) {
                            return None;
                        }
                        if value == ">>" {
                            tokens.push(">");
                        }
                        let arguments = tokens.join(" ");
                        self.position += offset + 1;
                        return Some(arguments);
                    }
                }
                _ if matches!(value, "*" | "&" | "&&") => {}
                _ => return None,
            }
            tokens.push(value);
        }
        None
    }
}
