//! How the shared parser reads arrays: literals, the constructors written as
//! syntax (`new int[n]`, `vec![v; n]`, `[Int](repeating: v, count: n)`),
//! indexing with brackets and element assignment. Library calls that create
//! or measure an array are read by the rules in arrays.rs.

use super::{Parsed, Parser};
use crate::formal::arrays::offset;
use crate::formal::dialects::rocq_not_equal;
use crate::formal::lexer::TokenType;
use crate::meta::GrammarError;
use crate::meta::{Node, name, number};

/// Languages whose array literals are written between braces.
const BRACE_LITERALS: [&str; 7] = ["c", "objc", "cpp", "csharp", "java", "lua", "vb"];
/// Languages that index with parentheses, like a call: a(i).
const PARENTHESES_INDEX: [&str; 5] = ["scala", "matlab", "fortran", "vb", "ada"];
/// Type words a C cast may name: (int) value.
const CAST_TYPES: [&str; 3] = ["int", "long", "size_t"];

const ASSIGNMENT_SYMBOLS: [&str; 6] = ["=", "+=", "-=", "*=", "/=", "%="];

fn compound_meaning(symbol: &str) -> Option<&'static str> {
    match symbol {
        "+=" => Some("add"),
        "-=" => Some("subtract"),
        "*=" => Some("multiply"),
        "/=" => Some("divide"),
        "%=" => Some("remainder"),
        _ => None,
    }
}

fn new_array(length: Node, fill: Node) -> Node {
    Node::new("NewArray")
        .with("length", length)
        .with("fill", fill)
}

/// The tokens that start a C array declaration or a C++ vector.
#[derive(Clone, Copy, PartialEq, Eq)]
enum ArrayStart {
    /// int a[] = ..., int a[n];
    C,
    /// std::vector<int> a = ..., std::vector<int> a(n, v);
    Vector,
}

impl Parser {
    fn family(&self) -> &'static str {
        self.syntax.family.unwrap_or(self.syntax.id)
    }

    /// a, b, c up to the closing symbol.
    pub(crate) fn element_list(&mut self, close: &str) -> Parsed<Vec<Node>> {
        self.element_list_with(close, Self::expression)
    }

    pub(super) fn element_list_with(
        &mut self,
        close: &str,
        read_element: fn(&mut Self) -> Parsed,
    ) -> Parsed<Vec<Node>> {
        let mut elements = Vec::new();
        self.skip_newlines();
        while !self.is(close) {
            elements.push(read_element(self)?);
            self.skip_newlines();
            if !self.accept(",") {
                break;
            }
            self.skip_newlines();
        }
        self.expect(close)?;
        Ok(elements)
    }

    pub(crate) fn array_literal(&mut self, close: &str) -> Parsed {
        Ok(Node::new("ArrayLiteral").with("elements", self.element_list(close)?))
    }

    pub(crate) fn base_primary(&mut self) -> Parsed {
        if let Some(expression) = self.objpak_primary()? {
            return Ok(expression);
        }
        let mut expression = match self.array_primary()? {
            Some(read) => read,
            None => self.plain_primary()?,
        };
        // a[i], counted from 1 in Lua, Julia and R.
        while expression.is("Name") && self.is("[") && !PARENTHESES_INDEX.contains(&self.syntax.id)
        {
            self.position += 1;
            let index = self.expression()?;
            self.expect("]")?;
            expression = Node::new("Index")
                .with("array", expression)
                .with("index", offset(index, -self.syntax.array_base));
        }
        Ok(expression)
    }

    fn array_primary(&mut self) -> Parsed<Option<Node>> {
        let family = self.family();
        if self.is("[") {
            return self.bracket_primary().map(Some);
        }
        if self.is("{") && BRACE_LITERALS.contains(&family) {
            self.position += 1;
            return self.array_literal("}").map(Some);
        }
        // Nim: @[a, b]. Perl: @name.
        if self.is("@") && self.is_at("[", 1) {
            self.position += 2;
            return self.array_literal("]").map(Some);
        }
        if self.is("@") && self.kind(1) == TokenType::Name && family == "perl" {
            self.position += 1;
            return Ok(Some(name(self.next_value()?)));
        }
        if self.kind(0) != TokenType::Name {
            if family == "perl" && self.is("(") {
                return self.perl_list().map(Some);
            }
            return self.cast();
        }
        let word = self.value(0).to_owned();
        self.named_constructor(&word)
    }

    /// [a, b], Go's []int{a, b} and []int, Swift's [Int](repeating:count:).
    fn bracket_primary(&mut self) -> Parsed {
        self.position += 1;
        if self.is("]") && self.kind(1) == TokenType::Name {
            self.position += 2;
            if self.accept("{") {
                return self.array_literal("}");
            }
            return Ok(Node::new("ArrayType"));
        }
        if self.kind(0) == TokenType::Name
            && self.is_at("]", 1)
            && self.is_at("(", 2)
            && self.is_at("repeating", 3)
        {
            self.position += 3;
            let mut values = Vec::new();
            for label in ["repeating", "count"] {
                self.expect(label)?;
                self.expect(":")?;
                values.push(self.expression()?);
                self.accept(",");
            }
            self.expect(")")?;
            let length = values.pop().expect("a count");
            let fill = values.pop().expect("a value");
            return Ok(new_array(length, fill));
        }
        self.array_literal("]")
    }

    fn named_constructor(&mut self, word: &str) -> Parsed<Option<Node>> {
        let named = self.kind(1) == TokenType::Name;
        if word == "new" && self.syntax.id == "csharp" && self.is_at("[", 1) && self.is_at("]", 2) {
            self.position += 3;
            self.expect("{")?;
            return self.array_literal("}").map(Some);
        }
        // Java, Groovy and D: new int[n], filled with zeros.
        if word == "new" && named && self.is_at("[", 2) {
            self.position += 3;
            let length = self.expression()?;
            self.expect("]")?;
            return Ok(Some(new_array(length, number(0.0))));
        }
        // JavaScript: new Array(n), filled later.
        if word == "new" && named && self.is_at("(", 2) {
            self.position += 1;
            return Ok(Some(name(format!("new {}", self.next_value()?))));
        }
        // Rust: vec![a, b] and vec![v; n].
        if word == "vec!" && self.is_at("[", 1) {
            self.position += 2;
            let first = self.expression()?;
            if self.accept(";") {
                let length = self.expression()?;
                self.expect("]")?;
                return Ok(Some(new_array(length, first)));
            }
            let rest = if self.accept(",") {
                self.element_list("]")?
            } else {
                Vec::new()
            };
            if rest.is_empty() {
                self.expect("]")?;
            }
            let elements: Vec<Node> = std::iter::once(first).chain(rest).collect();
            return Ok(Some(Node::new("ArrayLiteral").with("elements", elements)));
        }
        // Kotlin: IntArray(n) { v }.
        if word == "IntArray" && self.is_at("(", 1) {
            self.position += 2;
            let length = self.expression()?;
            self.expect(")")?;
            self.expect("{")?;
            let fill = self.expression()?;
            self.expect("}")?;
            return Ok(Some(new_array(length, fill)));
        }
        // Scala: Array.fill(n)(v).
        if word == "Array" && self.is_at(".", 1) && self.is_at("fill", 2) {
            self.position += 3;
            self.expect("(")?;
            let length = self.expression()?;
            self.expect(")")?;
            self.expect("(")?;
            let fill = self.expression()?;
            self.expect(")")?;
            return Ok(Some(new_array(length, fill)));
        }
        // C: sizeof a. D: cast(long) value.
        if word == "sizeof" {
            self.position += 1;
            let operand = self.unary()?;
            return Ok(Some(Node::new("SizeOf").with("operand", operand)));
        }
        if word == "cast" && self.is_at("(", 1) && self.is_at(")", 3) {
            self.position += 4;
            return self.unary().map(Some);
        }
        Ok(None)
    }

    /// C and C++: (int) value.
    fn cast(&mut self) -> Parsed<Option<Node>> {
        if self.is("(")
            && CAST_TYPES.contains(&self.value(1))
            && self.is_at(")", 2)
            && ["c", "objc", "cpp"].contains(&self.family())
        {
            self.position += 3;
            return self.unary().map(Some);
        }
        Ok(None)
    }

    /// Perl: (a, b, c), and (v) x n for n copies of v.
    fn perl_list(&mut self) -> Parsed {
        self.position += 1;
        let mut elements = self.element_list(")")?;
        if self.accept("x") {
            let length = self.unary()?;
            return Ok(new_array(length, elements.swap_remove(0)));
        }
        if elements.len() == 1 {
            return Ok(elements.remove(0));
        }
        Ok(Node::new("ArrayLiteral").with("elements", elements))
    }

    pub(crate) fn unary(&mut self) -> Parsed {
        self.concrete_rule("unary", Self::concrete_unary)
    }

    fn concrete_unary(&mut self) -> Parsed {
        if let Some(value) = self.objc_prefix()? {
            return Ok(value);
        }
        // Lua: #a is the length of a.
        if self.syntax.id == "lua" && self.accept("#") {
            let array = self.unary()?;
            return Ok(Node::new("Length").with("array", array));
        }
        let value = self.plain_unary()?;
        // Rocq: negb (a =? b) is a != b.
        if self.syntax.id == "rocq" {
            return Ok(rocq_not_equal(value));
        }
        // Rust: value as i64. The conversion only changes the integer width.
        if self.syntax.id == "rust" && self.accept("as") {
            self.expect_name()?;
        }
        Ok(value)
    }

    /// Perl: my @name = (...).
    pub(crate) fn declaration(&mut self) -> Parsed {
        if self.syntax.id == "perl" && self.is_at("@", 1) && self.kind(2) == TokenType::Name {
            self.position += 2;
            let variable = self.expect_name()?;
            self.expect("=")?;
            let value = self.expression()?;
            self.end_statement()?;
            return Ok(Node::new("Declaration")
                .with("name", variable)
                .with("type", "array")
                .with("value", value));
        }
        self.plain_declaration()
    }

    fn array_declaration_start(&self) -> Option<ArrayStart> {
        if self.syntax.id == "cpp"
            && ["std", "::", "vector", "<", "int", ">"]
                .iter()
                .enumerate()
                .all(|(offset, word)| self.is_at(word, offset))
        {
            return Some(ArrayStart::Vector);
        }
        let c = ["c", "objc"].contains(&self.family());
        (c && CAST_TYPES.contains(&self.value(0))
            && self.kind(1) == TokenType::Name
            && self.is_at("[", 2))
        .then_some(ArrayStart::C)
    }

    /// `std::vector<int> a(n, v);` is a declaration, not a prototype.
    pub(crate) fn announcement_length(&self) -> usize {
        if self.array_declaration_start().is_some() {
            return 0;
        }
        self.plain_announcement_length()
    }

    pub(crate) fn is_typed_declaration(&self) -> bool {
        self.array_declaration_start().is_some() || self.plain_is_typed_declaration()
    }

    pub(crate) fn typed_declaration(&mut self) -> Parsed {
        let Some(start) = self.array_declaration_start() else {
            return self.plain_typed_declaration();
        };
        let mut value;
        let variable;
        if start == ArrayStart::Vector {
            self.position += 6; // std :: vector < int >
            variable = self.expect_name()?;
            if self.accept("(") {
                let length = self.expression()?;
                self.expect(",")?;
                let fill = self.expression()?;
                self.expect(")")?;
                value = Some(new_array(length, fill));
            } else if self.accept("{") {
                value = Some(self.array_literal("}")?);
            } else {
                value = Some(Node::new("ArrayLiteral").with("elements", Vec::<Node>::new()));
            }
        } else {
            self.position += 1;
            variable = self.expect_name()?;
            self.expect("[")?;
            let length = if self.is("]") {
                None
            } else {
                Some(self.expression()?)
            };
            self.expect("]")?;
            // int a[n]; holds no values until a loop fills it.
            value = length.map(|length| new_array(length, number(0.0)));
        }
        if self.accept("=") {
            value = Some(self.expression()?);
        }
        self.end_statement()?;
        Ok(Node::new("Declaration")
            .with("name", variable)
            .with("type", "array")
            .with_opt("value", value))
    }

    pub(crate) fn simple_statement(&mut self) -> Parsed {
        if self.is_annotated_assignment() {
            return self.annotated_assignment();
        }
        match self.is_element_assignment() {
            Some(close) => self.element_assignment(close),
            None => self.plain_simple_statement(),
        }
    }

    /// name[index] = value, or name(index) = value where parentheses index.
    /// Returns the closing symbol of the index.
    pub(crate) fn is_element_assignment(&self) -> Option<&'static str> {
        if self.kind(0) != TokenType::Name {
            return None;
        }
        let (open, close) = if PARENTHESES_INDEX.contains(&self.syntax.id) {
            ("(", ")")
        } else {
            ("[", "]")
        };
        if !self.is_at(open, 1) {
            return None;
        }
        let mut depth = 0i64;
        let mut index = 1;
        while self.kind(index) != TokenType::End {
            let value = self.value(index);
            if value == open {
                depth += 1;
            } else if value == close {
                depth -= 1;
            }
            if depth == 0 {
                let assigned = ASSIGNMENT_SYMBOLS
                    .iter()
                    .copied()
                    .chain(self.syntax.assignment)
                    .any(|symbol| self.is_at(symbol, index + 1));
                return assigned.then_some(close);
            }
            index += 1;
        }
        None
    }

    pub(crate) fn element_assignment(&mut self, close: &str) -> Parsed {
        let variable = self.next_value()?;
        self.position += 1;
        let written = self.expression()?;
        self.expect(close)?;
        let index = offset(written, -self.syntax.array_base);
        let symbol = self.next_value()?;
        let mut value = self.expression()?;
        if let Some(operator) = compound_meaning(&symbol) {
            value = Node::new("Binary")
                .with("operator", operator)
                .with(
                    "left",
                    Node::new("Index")
                        .with("array", name(variable.clone()))
                        .with("index", index.clone()),
                )
                .with("right", value);
        } else if symbol != "=" && Some(symbol.as_str()) != self.syntax.assignment {
            return Err(GrammarError::syntax(
                format!("Unsupported element assignment \"{symbol}\""),
                self.current().line,
            ));
        }
        self.end_statement()?;
        Ok(Node::new("IndexAssignment")
            .with("name", variable)
            .with("index", index)
            .with("value", value))
    }
}
