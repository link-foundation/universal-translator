//! Recursive-descent parser driven by the language descriptions in
//! `languages.rs`. It produces the meta tree described in `meta.rs`, keeping
//! the surface concepts (calls, imports, classes) that later rule layers
//! interpret. The parser never decides what a program means.

use std::any::Any;
use std::sync::OnceLock;

use regex::Regex;

use super::dialects::shared::comment_node;
use super::dialects::{ParserDialect, parser_dialect, rocq_comparison};
use super::interpolation::{Piece, split_interpolation};
use super::languages::{Blocks, CommandCalls, ForwardDeclarations, Syntax, Typed};
use super::lexer::{InterpolationStyle, Token, TokenType, decode_escapes, tokenize};
use super::numbers::slash_operator;
use super::power::power_symbol;
use crate::meta::GrammarError;
use crate::meta::{Node, binary, block, name, number, text};

/// Binary operators by precedence level, loosest first, with their spellings.
const BINARY_LEVELS: [&[(&str, &[&str])]; 6] = [
    &[("or", &["||", "or"])],
    &[("and", &["&&", "and"])],
    &[
        ("equal", &["==", "==="]),
        ("notEqual", &["!=", "!==", "~="]),
    ],
    &[
        ("less", &["<"]),
        ("lessOrEqual", &["<="]),
        ("greater", &[">"]),
        ("greaterOrEqual", &[">="]),
    ],
    &[("add", &["+", ".."]), ("subtract", &["-"])],
    &[
        ("multiply", &["*"]),
        ("divide", &["/", "//"]),
        ("remainder", &["%"]),
    ],
];

/// The level of additive operators, where ranges and streams also live.
const ADDITIVE: usize = 4;

const TYPE_WORDS: [&str; 17] = [
    "int", "long", "short", "char", "void", "bool", "boolean", "double", "float", "string",
    "String", "var", "auto", "const", "unsigned", "signed", "std",
];

const MODIFIERS: [&str; 10] = [
    "public",
    "private",
    "protected",
    "static",
    "internal",
    "final",
    "export",
    "inline",
    "async",
    "local",
];

const CONTROL_WORDS: [&str; 9] = [
    "if", "else", "while", "for", "foreach", "switch", "return", "do", "catch",
];

const ASSIGNMENT_SYMBOLS: [&str; 8] = ["=", "+=", "-=", "*=", "/=", "%=", "++", "--"];

mod annotations;
mod arrays;
mod arrows;
mod concrete;
mod exceptions;
mod forms;
mod loops;

use loops::step_operator;

pub(crate) type Parsed<T = Node> = Result<T, GrammarError>;

/// Parse a whole source text into a `SourceProgram` tree.
pub fn parse_program(source: &str, syntax: &Syntax) -> Parsed {
    let tokens = tokenize(source, syntax)?;
    let mut parser = Parser::new(tokens.clone(), syntax.clone());
    let tree = parser.program()?;
    let concrete =
        crate::concrete_syntax::concrete_syntax(source, syntax.id, &tokens, parser.productions);
    Ok(tree.with("syntax", concrete))
}

/// Binary operators by precedence level with their spellings.
type Levels = Vec<Vec<(&'static str, Vec<&'static str>)>>;

pub(crate) struct Parser {
    pub(crate) tokens: Vec<Token>,
    pub(crate) position: usize,
    pub(crate) syntax: Syntax,
    /// The binary levels with the language's own remainder and integer
    /// division spellings added.
    levels: Levels,
    /// The statements and layout of a language with a grammar of its own.
    dialect: &'static dyn ParserDialect,
    /// What a dialect remembers while it reads (see `state`).
    state: Box<dyn Any>,
    /// How many classes enclose the current item.
    class_depth: usize,
    productions: Vec<Node>,
}

impl Parser {
    pub(crate) fn new(tokens: Vec<Token>, syntax: Syntax) -> Self {
        let operators = syntax.operators;
        let levels = BINARY_LEVELS
            .iter()
            .map(|level| {
                level
                    .iter()
                    .map(|(operator, surfaces)| {
                        // Word operators such as Nim's mod and div, or
                        // Pascal's <>, join the shared symbols of their level.
                        let extra = match *operator {
                            "remainder" => operators.remainder,
                            "divide" => operators.integer_divide,
                            "and" => Some(operators.and),
                            "or" => Some(operators.or),
                            "equal" => operators.equal,
                            "notEqual" => Some(operators.not_equal),
                            _ => None,
                        }
                        .filter(|extra| !surfaces.contains(extra));
                        // Rocq spells comparisons with a question mark: <?.
                        let question = rocq_comparison(operator).filter(|_| syntax.id == "rocq");
                        (
                            *operator,
                            surfaces
                                .iter()
                                .copied()
                                // Fortran joins text with //, which divides
                                // elsewhere.
                                .filter(|surface| operators.concatenate != Some(*surface))
                                .chain(extra)
                                .chain(question)
                                .collect(),
                        )
                    })
                    .collect()
            })
            .collect();
        let dialect = parser_dialect(syntax.id);
        Parser {
            tokens: dialect.tokens(tokens),
            position: 0,
            syntax,
            levels,
            dialect,
            state: Box::new(()),
            class_depth: 0,
            productions: Vec::new(),
        }
    }

    /// The reading state of a dialect, created on first use.
    pub(crate) fn state<T: Default + 'static>(&mut self) -> &mut T {
        if !self.state.is::<T>() {
            self.state = Box::new(T::default());
        }
        self.state.downcast_mut().expect("state of this type")
    }

    // ---- token helpers ----

    /// Import lines: `import`, `using`, `package`, `use`, `require`,
    /// `require_once`, Rust `mod name;` and Python `from module import a`.
    pub(crate) fn is_import_start(&self, token: &Token) -> bool {
        if token.kind != TokenType::Name || self.is_at("(", 1) {
            return false;
        }
        match token.value.as_str() {
            "from" => self.peek(2).value == "import",
            "mod" => self.peek(1).kind == TokenType::Name && self.is_at(";", 2),
            other => [
                "import",
                "using",
                "package",
                "use",
                "require",
                "require_once",
                "require_relative",
            ]
            .contains(&other),
        }
    }

    pub(crate) fn peek(&self, offset: usize) -> &Token {
        let last = self.tokens.len() - 1;
        &self.tokens[(self.position + offset).min(last)]
    }

    pub(crate) fn current(&self) -> &Token {
        self.peek(0)
    }

    pub(crate) fn kind(&self, offset: usize) -> TokenType {
        self.peek(offset).kind
    }

    pub(crate) fn value(&self, offset: usize) -> &str {
        &self.peek(offset).value
    }

    /// The current token; reading past the end is a syntax error.
    pub(crate) fn next(&mut self) -> Parsed<Token> {
        let token = self.current().clone();
        if self.position >= self.tokens.len() {
            return Err(GrammarError::syntax(
                "Unexpected end of program",
                token.line,
            ));
        }
        self.position += 1;
        Ok(token)
    }

    pub(crate) fn next_value(&mut self) -> Parsed<String> {
        Ok(self.next()?.value)
    }

    /// Whether the token at `offset` is the symbol or word `value`.
    pub(crate) fn is_at(&self, value: &str, offset: usize) -> bool {
        let token = self.peek(offset);
        if token.kind == TokenType::Name && self.syntax.case_insensitive {
            return token.value.eq_ignore_ascii_case(value);
        }
        matches!(token.kind, TokenType::Symbol | TokenType::Name) && token.value == value
    }

    pub(crate) fn is(&self, value: &str) -> bool {
        self.is_at(value, 0)
    }

    pub(crate) fn accept(&mut self, value: &str) -> bool {
        if self.is(value) {
            self.position += 1;
            return true;
        }
        false
    }

    pub(crate) fn expect(&mut self, value: &str) -> Parsed<()> {
        if self.accept(value) {
            return Ok(());
        }
        let token = self.current();
        Err(GrammarError::syntax(
            format!("Expected \"{value}\" but found \"{}\"", token.shown()),
            token.line,
        ))
    }

    pub(crate) fn expect_name(&mut self) -> Parsed<String> {
        let token = self.next()?;
        if token.kind != TokenType::Name {
            return Err(GrammarError::syntax(
                format!("Expected a name but found \"{}\"", token.value),
                token.line,
            ));
        }
        Ok(token.value)
    }

    pub(crate) fn skip_separators(&mut self) {
        while self.kind(0) == TokenType::Newline || self.is(";") {
            self.position += 1;
        }
    }

    pub(crate) fn skip_newlines(&mut self) {
        while self.kind(0) == TokenType::Newline {
            self.position += 1;
        }
    }

    pub(crate) fn end_statement(&mut self) -> Parsed<()> {
        if self.accept(";") || self.kind(0) == TokenType::Newline {
            self.skip_separators();
            return Ok(());
        }
        if self.current().trailing.is_some()
            || self.is("}")
            || matches!(self.kind(0), TokenType::End | TokenType::Dedent)
            || self.is("end")
        {
            return Ok(());
        }
        let token = self.current();
        Err(GrammarError::syntax(
            format!("Unexpected \"{}\" after statement", token.value),
            token.line,
        ))
    }

    /// The values of the tokens before the first of `stops`.
    pub(crate) fn words_until(&mut self, stops: &[&str]) -> Parsed<Vec<String>> {
        let mut words = Vec::new();
        while !stops.iter().any(|stop| self.is(stop)) {
            if self.kind(0) == TokenType::End {
                let token = self.current();
                return Err(GrammarError::syntax(
                    format!("Expected \"{}\" but found \"end\"", stops[0]),
                    token.line,
                ));
            }
            words.push(self.next_value()?);
        }
        Ok(words)
    }

    pub(crate) fn is_modifier(&self, offset: usize) -> bool {
        MODIFIERS.contains(&self.value(offset))
    }

    pub(crate) fn modifier_count(&self) -> usize {
        (0..).take_while(|offset| self.is_modifier(*offset)).count()
    }

    pub(crate) fn skip_modifiers(&mut self) {
        while self.is_modifier(0) {
            self.position += 1;
        }
    }

    // ---- program structure ----

    pub(crate) fn program(&mut self) -> Parsed {
        let dialect = self.dialect;
        dialect.program(self)
    }

    pub(crate) fn base_program(&mut self) -> Parsed {
        let items = self.items(&|parser| parser.kind(0) == TokenType::End)?;
        Ok(Node::new("SourceProgram")
            .with("language", self.syntax.id)
            .with("items", items))
    }

    pub(crate) fn items(&mut self, done: &dyn Fn(&Parser) -> bool) -> Parsed<Vec<Node>> {
        let dialect = self.dialect;
        dialect.items(self, done)
    }

    pub(crate) fn base_items(&mut self, done: &dyn Fn(&Self) -> bool) -> Parsed<Vec<Node>> {
        let mut items = Vec::new();
        self.skip_separators();
        while !done(self) {
            // Concrete syntax: empty lines between two items are kept.
            let blank = self.blank_lines_before();
            if blank > 0 && !items.is_empty() {
                items.push(Node::new("Blank").with("lines", blank as f64));
            }
            // A C-style loop that is not a counting loop becomes several statements.
            let item = self.item()?;
            if item.is("Statements") {
                items.extend(item.node_list("statements"));
            } else {
                items.push(item);
            }
            self.skip_separators();
        }
        Ok(items)
    }

    /// Empty lines right before the current token.
    pub(crate) fn blank_lines_before(&self) -> usize {
        for token in self.tokens[..self.position.min(self.tokens.len())]
            .iter()
            .rev()
        {
            if token.kind == TokenType::Newline {
                return token.blank;
            }
            if !["indent", "dedent", ";"].contains(&token.value.as_str())
                && !matches!(token.kind, TokenType::Indent | TokenType::Dedent)
            {
                return 0;
            }
        }
        0
    }

    pub(crate) fn item(&mut self) -> Parsed {
        self.concrete_rule("item", Self::concrete_item)
    }

    fn concrete_item(&mut self) -> Parsed {
        let annotations = self.annotations()?;
        let dialect = self.dialect;
        let item = dialect.item(self)?;
        Ok(if annotations.is_empty() {
            item
        } else {
            item.with("annotations", annotations)
        })
    }

    pub(crate) fn base_item(&mut self) -> Parsed {
        let token = self.current().clone();
        match token.kind {
            TokenType::Comment => {
                self.position += 1;
                return Ok(comment_node(&token));
            }
            TokenType::Directive => {
                self.position += 1;
                return Ok(Node::new("Import").with("text", token.value));
            }
            TokenType::Name if self.is_import_start(&token) => {
                return self.import_statement();
            }
            _ => {}
        }
        if self.is_namespace_or_class() {
            return self.class_definition();
        }
        let announcement = self.announcement_length();
        if announcement > 0 {
            // `int male(int index);` only announces a function defined later.
            self.position += announcement;
            return Ok(Node::new("Statements").with("statements", Vec::<Node>::new()));
        }
        if self.is_function_start() {
            return self.function_definition();
        }
        if self.is_arrow_function_start() {
            return self.arrow_function_definition();
        }
        if self.is_static_method_start() {
            return self.static_method_definition();
        }
        self.statement()
    }

    pub(crate) fn import_statement(&mut self) -> Parsed {
        let mut parts = Vec::new();
        let line = self.current().line;
        while self.kind(0) != TokenType::Newline
            && !self.is(";")
            && self.kind(0) != TokenType::End
            && self.current().line == line
        {
            let token = self.next()?;
            parts.push(if token.kind == TokenType::Text {
                format!("\"{}\"", token.value)
            } else {
                token.value
            });
        }
        self.end_statement()?;
        let joined = parts.join(" ").replace(" . ", ".").replace(" :: ", "::");
        Ok(Node::new("Import").with("text", joined))
    }

    pub(crate) fn is_namespace_or_class(&self) -> bool {
        let offset = self.modifier_count();
        ["class", "namespace", "object"].contains(&self.value(offset))
            && self.kind(offset) == TokenType::Name
    }

    pub(crate) fn class_definition(&mut self) -> Parsed {
        self.skip_modifiers();
        let form = self.next_value()?;
        let title = self.expect_name()?;
        // Scala: the body of `object Hello extends App { ... }` is the
        // program.
        if self.syntax.id == "scala" && self.is("extends") && self.is_at("App", 1) {
            self.position += 2;
        }
        self.skip_newlines();
        self.expect("{")?;
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

    pub(crate) fn is_function_start(&self) -> bool {
        if self.syntax.assigned_functions {
            return self.kind(0) == TokenType::Name
                && self.is_at(self.syntax.assignment.unwrap_or("="), 1)
                && self.is_at("function", 2);
        }
        match self.syntax.function_keyword {
            Some(keyword) => self.is_keyword_function_start(keyword),
            None => self.is_prefix_function_start(),
        }
    }

    /// `[modifiers] function-keyword name`
    pub(crate) fn is_keyword_function_start(&self, keyword: &str) -> bool {
        let offset = self.modifier_count();
        self.is_at(keyword, offset) && self.kind(offset + 1) == TokenType::Name
    }

    /// Prefix-typed languages: `[modifiers] [type] name ( ... ) {`
    pub(crate) fn is_prefix_function_start(&self) -> bool {
        let offset = self.prefix_head_length();
        offset > 0
            && self.is_at("(", offset)
            && self.kind(offset - 1) == TokenType::Name
            && self.is_at("{", self.after_parentheses(offset))
    }

    /// The number of tokens that announce a function defined later, or 0:
    /// `int male(int index);`, `proc male(index: int): int` or `local male`
    /// followed by `function male`.
    fn plain_announcement_length(&self) -> usize {
        match self.syntax.forward_declarations {
            ForwardDeclarations::None => 0,
            ForwardDeclarations::Prototype => {
                let offset = self.prefix_head_length();
                let after = self.after_parentheses(offset);
                let prototype = offset > 1
                    && self.is_at("(", offset)
                    && self.kind(offset - 1) == TokenType::Name
                    && self.is_at(";", after);
                if prototype { after + 1 } else { 0 }
            }
            ForwardDeclarations::Heading => self.heading_length(),
            ForwardDeclarations::Local => {
                let announced = self.value(1);
                let alone = self.is("local")
                    && self.kind(1) == TokenType::Name
                    && matches!(self.kind(2), TokenType::Newline | TokenType::End);
                let keyword = self.syntax.function_keyword.unwrap_or("function");
                let defined = self
                    .tokens
                    .windows(2)
                    .any(|pair| pair[0].value == keyword && pair[1].value == announced);
                if alone && defined { 2 } else { 0 }
            }
        }
    }

    /// A function heading whose line ends before the body marker.
    pub(crate) fn heading_length(&self) -> usize {
        let keyword = self.syntax.function_keyword;
        if !keyword.is_some_and(|keyword| self.is_keyword_function_start(keyword)) {
            return 0;
        }
        let mut index = 0;
        while !matches!(self.kind(index), TokenType::Newline | TokenType::End) {
            if self
                .syntax
                .body_after
                .is_some_and(|symbol| self.is_at(symbol, index))
            {
                return 0;
            }
            index += 1;
        }
        index
    }

    /// How many tokens of a type and a name come before `(`.
    pub(crate) fn prefix_head_length(&self) -> usize {
        if CONTROL_WORDS.contains(&self.value(0)) {
            return 0;
        }
        self.type_head_length()
    }

    /// The index after the parentheses opening at `offset` and any newlines.
    pub(crate) fn after_parentheses(&self, offset: usize) -> usize {
        let mut depth = 0i64;
        let mut index = offset;
        while self.kind(index) != TokenType::End {
            depth += match self.value(index) {
                "(" => 1,
                ")" => -1,
                _ => 0,
            };
            if depth == 0 {
                break;
            }
            index += 1;
        }
        if self.kind(index) == TokenType::End {
            return index;
        }
        let mut after = index + 1;
        while self.kind(after) == TokenType::Newline {
            after += 1;
        }
        after
    }

    pub(crate) fn function_definition(&mut self) -> Parsed {
        let dialect = self.dialect;
        self.concrete_rule("functionDefinition", |parser| {
            dialect.function_definition(parser)
        })
    }

    pub(crate) fn base_function_definition(&mut self) -> Parsed {
        self.skip_modifiers();
        let mut return_type = None;
        let function_name = if self.syntax.assigned_functions {
            let function_name = self.expect_name()?;
            self.expect(self.syntax.assignment.unwrap_or("="))?;
            self.expect("function")?;
            function_name
        } else if let Some(keyword) = self.syntax.function_keyword {
            self.expect(keyword)?;
            self.expect_name()?
        } else {
            let mut words = self.words_until(&["("])?;
            let last = words.pop().unwrap_or_default();
            if !words.is_empty() {
                return_type = source_type(&words.join(" "));
            }
            last
        };
        // Ruby and Perl may leave out the parentheses of a parameter list.
        let mut parameters = if self.is("(") {
            self.parameter_list()?
        } else {
            Vec::new()
        };
        if self.accept("->")
            || (self.syntax.return_arrow == Some(":") && self.accept(":"))
            || (self.syntax.typed == Typed::Suffix && !self.is("{"))
        {
            return_type = self.type_expression()?;
        }
        // Scala: def name(...): Type = { ... }
        if let Some(symbol) = self.syntax.body_after
            && self.syntax.blocks != Blocks::Indentation
        {
            self.accept(symbol);
        }
        let mut body = self.block()?;
        self.close_keyword_block()?;
        // Perl: sub name { my ($first, $second) = @_; ... }
        let mut statements = body.node_list("statements");
        if statements
            .first()
            .is_some_and(|first| first.is("Parameters"))
        {
            parameters = statements
                .remove(0)
                .texts("names")
                .into_iter()
                .map(|parameter| Node::new("Parameter").with("name", parameter))
                .collect();
            body.set("statements", statements);
        }
        Ok(Node::new("Function")
            .with("name", function_name)
            .with("parameters", parameters)
            .with_opt("returnType", return_type)
            .with("body", body))
    }

    pub(crate) fn parameter_list(&mut self) -> Parsed<Vec<Node>> {
        if self.syntax.id == "kotlin" {
            return self.annotated_parameters();
        }
        self.expect("(")?;
        self.skip_newlines();
        let mut parameters = Vec::new();
        let mut pending_names = Vec::new();
        let parameter = |name: String, kind: Option<String>| {
            Node::new("Parameter")
                .with("name", name)
                .with_opt("type", kind)
        };
        while !self.is(")") {
            match self.syntax.typed {
                Typed::Prefix => {
                    parameters.push(self.prefix_parameter()?);
                }
                Typed::Suffix => {
                    pending_names.push(self.expect_name()?);
                    if !self.is(",") && !self.is(")") {
                        let kind = self.type_expression()?;
                        for pending in pending_names.drain(..) {
                            parameters.push(parameter(pending, kind.clone()));
                        }
                    }
                }
                _ => {
                    if self.syntax.id == "swift" && self.kind(1) == TokenType::Name {
                        self.position += 1; // argument label such as "_"
                    }
                    let parameter_name = self.expect_name()?;
                    let kind = if self.accept(":") {
                        self.type_expression()?
                    } else {
                        None
                    };
                    parameters.push(self.annotated_hint(parameter(parameter_name, kind))?);
                }
            }
            if !self.accept(",") {
                break;
            }
            self.skip_newlines();
        }
        self.expect(")")?;
        Ok(parameters)
    }

    pub(crate) fn type_expression(&mut self) -> Parsed<Option<String>> {
        let dialect = self.dialect;
        dialect.type_expression(self)
    }

    pub(crate) fn base_type_expression(&mut self) -> Parsed<Option<String>> {
        if self.syntax.id == "python" {
            return self.type_hint();
        }
        let mut words = Vec::new();
        let mut depth = 0i64;
        loop {
            let token = self.current();
            depth += annotations::type_depth(&token.value);
            let stops = token.kind == TokenType::Newline
                || ["{", "=", "=>", ",", ")", ";"].contains(&token.value.as_str());
            if (depth == 0 && stops) || token.kind == TokenType::End {
                break;
            }
            words.push(self.next_value()?);
        }
        Ok(source_type(&words.join(" ")))
    }

    // ---- blocks ----

    pub(crate) fn block(&mut self) -> Parsed {
        match self.syntax.blocks {
            Blocks::Braces => {
                self.skip_newlines();
                self.expect("{")?;
                let statements = self.items(&|parser| parser.is("}"))?;
                self.expect("}")?;
                Ok(block(statements))
            }
            Blocks::Indentation => {
                // Nim: proc name(...): Type = <indented body>
                if !self
                    .syntax
                    .body_after
                    .is_some_and(|symbol| self.accept(symbol))
                {
                    self.expect(":")?;
                }
                while self.kind(0) == TokenType::Comment {
                    self.position += 1;
                }
                if self.kind(0) != TokenType::Newline {
                    return Err(GrammarError::syntax(
                        "Expected a new line after \":\"",
                        self.current().line,
                    ));
                }
                self.skip_separators();
                if self.next()?.kind != TokenType::Indent {
                    return Err(GrammarError::syntax(
                        "Expected an indented block",
                        self.current().line,
                    ));
                }
                let statements = self.items(&|parser| {
                    matches!(parser.kind(0), TokenType::Dedent | TokenType::End)
                })?;
                self.position += 1;
                Ok(block(statements))
            }
            Blocks::End => {
                // Keyword-delimited blocks (Ruby, Lua) stop at end / else / elsif.
                self.accept("then");
                self.accept("do");
                let statements = self.items(&|parser| {
                    ["end", "else", "elsif", "elseif"]
                        .iter()
                        .any(|word| parser.is(word))
                })?;
                Ok(block(statements))
            }
            Blocks::Keywords => Err(GrammarError::syntax(
                "Keyword blocks are read by the language's dialect",
                self.current().line,
            )),
        }
    }

    pub(crate) fn close_keyword_block(&mut self) -> Parsed<()> {
        if self.syntax.blocks == Blocks::End {
            self.expect("end")?;
        }
        Ok(())
    }

    // ---- statements ----

    pub(crate) fn statement(&mut self) -> Parsed {
        let dialect = self.dialect;
        self.concrete_rule("statement", |parser| dialect.statement(parser))
    }

    pub(crate) fn base_statement(&mut self) -> Parsed {
        if self.is_exception_start() {
            return self.exception_statement();
        }
        let word = if self.kind(0) == TokenType::Name {
            self.value(0).to_owned()
        } else {
            String::new()
        };
        match word.as_str() {
            "if" => return self.if_statement(),
            "while" => return self.while_statement(),
            "for" => return self.for_statement(),
            "foreach"
                if self
                    .syntax
                    .for_each
                    .is_some_and(|each| each.starts_with("foreach")) =>
            {
                return self.foreach_statement();
            }
            "return" => return self.return_statement(),
            "echo" => return self.echo_statement(),
            _ => {}
        }
        if self.syntax.id == "ruby" && self.is_range_each() {
            return self.range_each();
        }
        if !word.is_empty() && self.syntax.declarations.contains(&word.as_str()) {
            return self.declaration();
        }
        if self.syntax.typed == Typed::Prefix && self.is_typed_declaration() {
            return self.typed_declaration();
        }
        self.simple_statement()
    }

    pub(crate) fn return_statement(&mut self) -> Parsed {
        self.position += 1;
        // R leaves a function without a value by calling `return(invisible())`
        // (or `return()`, which prints NULL at the top level).
        let bare = [&["(", "invisible", "(", ")", ")"][..], &["(", ")"][..]]
            .into_iter()
            .find(|tokens| {
                tokens
                    .iter()
                    .enumerate()
                    .all(|(at, value)| self.value(at) == *value)
            });
        if let Some(tokens) = bare {
            self.position += tokens.len();
            self.end_statement()?;
            return Ok(Node::new("Return"));
        }
        let value = if self.is_statement_end() {
            None
        } else {
            Some(self.expression()?)
        };
        self.end_statement()?;
        Ok(Node::new("Return").with_opt("value", value))
    }

    pub(crate) fn is_statement_end(&self) -> bool {
        matches!(
            self.kind(0),
            TokenType::Newline | TokenType::End | TokenType::Dedent
        ) || self.is(";")
            || self.is("}")
    }

    fn plain_is_typed_declaration(&self) -> bool {
        let offset = self.type_head_length();
        offset >= 2
            && self.kind(offset - 1) == TokenType::Name
            && (self.is_at("=", offset) || self.is_at(";", offset))
            && (TYPE_WORDS.contains(&self.value(0))
                || self.kind(1) == TokenType::Name
                || self.is_at("<", 1))
    }

    fn plain_typed_declaration(&mut self) -> Parsed {
        let mut words = self.words_until(&["=", ";"])?;
        let variable = words.pop().unwrap_or_default();
        let kind = source_type(&words.join(" "));
        let value = if self.accept("=") {
            Some(self.expression()?)
        } else {
            None
        };
        self.end_statement()?;
        Ok(Node::new("Declaration")
            .with("name", variable)
            .with_opt("type", kind)
            .with_opt("value", value)
            .with("mutable", !words.iter().any(|word| word == "const")))
    }

    fn plain_declaration(&mut self) -> Parsed {
        if self.syntax.unpacked_parameters && self.is_at("(", 1) {
            return self.unpacked_parameters();
        }
        let keyword = self.next_value()?;
        let mutable = if self.accept("mut") {
            true
        } else {
            !["const", "val", "let"].contains(&keyword.as_str())
                || self.syntax.id == "javascript"
                || self.syntax.id == "typescript"
        };
        let variable = self.expect_name()?;
        let mut kind = None;
        if self.accept(":") || (self.syntax.typed == Typed::Suffix && !self.is("=")) {
            kind = self.type_expression()?;
        }
        let value = if self.accept("=") {
            Some(self.expression()?)
        } else {
            None
        };
        self.end_statement()?;
        Ok(Node::new("Declaration")
            .with("name", variable)
            .with_opt("type", kind)
            .with_opt("value", value)
            .with("mutable", keyword != "const" && mutable))
    }

    /// Perl passes arguments in `@_`; a function names them by unpacking it.
    pub(crate) fn unpacked_parameters(&mut self) -> Parsed {
        self.position += 1;
        self.expect("(")?;
        let mut names = vec![self.expect_name()?];
        while self.accept(",") {
            names.push(self.expect_name()?);
        }
        self.expect(")")?;
        self.expect("=")?;
        self.expect("@")?;
        self.expect("_")?;
        self.end_statement()?;
        Ok(Node::new("Parameters").with("names", names))
    }

    fn plain_simple_statement(&mut self) -> Parsed {
        let starts_with_name = self.kind(0) == TokenType::Name;
        if starts_with_name && self.is_at(":=", 1) {
            return self.short_declaration();
        }
        if (self.is("++") || self.is("--")) && self.kind(1) == TokenType::Name {
            return self.prefix_step();
        }
        if starts_with_name
            && ASSIGNMENT_SYMBOLS
                .iter()
                .copied()
                .chain(self.syntax.assignment)
                .any(|symbol| self.is_at(symbol, 1))
        {
            return self.assignment();
        }
        if self.is_command_call() {
            return self.command_call(None);
        }
        let expression = self.expression()?;
        let terminated = self.is(";");
        self.end_statement()?;
        if self.syntax.id == "rust" && !terminated && self.is("}") {
            return Ok(Node::new("Return")
                .with("value", expression)
                .with("implicit", true));
        }
        Ok(Node::new("Evaluate").with("expression", expression))
    }

    /// Go: `name := value`
    pub(crate) fn short_declaration(&mut self) -> Parsed {
        let variable = self.next_value()?;
        self.position += 1;
        let value = self.expression()?;
        self.end_statement()?;
        Ok(Node::new("Declaration")
            .with("name", variable)
            .with("value", value)
            .with("mutable", true))
    }

    /// `++name` and `--name`
    pub(crate) fn prefix_step(&mut self) -> Parsed {
        let operator = step_operator(&self.next_value()?).unwrap_or("+=");
        let variable = self.next_value()?;
        self.end_statement()?;
        Ok(assignment(variable, operator, number(1.0)))
    }

    /// `name = value`, `name += value`, `name++` ...
    pub(crate) fn assignment(&mut self) -> Parsed {
        let variable = self.next_value()?;
        let written = self.next_value()?;
        let (operator, value) = match step_operator(&written) {
            Some(operator) => (operator.to_owned(), number(1.0)),
            None if Some(written.as_str()) == self.syntax.assignment => {
                ("=".to_owned(), self.expression()?)
            }
            None => (written, self.expression()?),
        };
        self.end_statement()?;
        Ok(assignment(variable, &operator, value))
    }

    /// Calls written without parentheses: `puts value`, `echo value`. The
    /// callee is the current word unless given.
    pub(crate) fn command_call(&mut self, callee: Option<&str>) -> Parsed {
        let written = self.next_value()?;
        let callee = callee.map_or(written, str::to_owned);
        // A bare `print` (Python 2) has no values.
        let ends = matches!(self.kind(0), TokenType::Newline | TokenType::End);
        let mut values = Vec::new();
        if !ends {
            values.push(self.expression()?);
            while self.accept(",") {
                values.push(self.expression()?);
            }
        }
        self.end_statement()?;
        Ok(Node::new("Evaluate").with(
            "expression",
            Node::new("Call")
                .with("callee", callee)
                .with("arguments", values),
        ))
    }

    /// Ruby allows calls without parentheses, such as `puts "Hello"`.
    pub(crate) fn is_command_call(&self) -> bool {
        if self.kind(0) != TokenType::Name {
            return false;
        }
        match self.syntax.command_calls {
            CommandCalls::No => return false,
            CommandCalls::Only(names) if !names.contains(&self.current().value.as_str()) => {
                return false;
            }
            // A bare `print` prints an empty line.
            CommandCalls::Only(_)
                if matches!(self.kind(1), TokenType::Newline | TokenType::End) =>
            {
                return true;
            }
            _ => {}
        }
        let following = self.peek(1);
        matches!(
            following.kind,
            TokenType::Text | TokenType::Number | TokenType::Name
        ) && following.line == self.current().line
            && !["do", "then", "if"].contains(&following.value.as_str())
    }

    pub(crate) fn echo_statement(&mut self) -> Parsed {
        self.command_call(Some("echo"))
    }

    pub(crate) fn condition(&mut self) -> Parsed {
        let value = self.expression()?;
        if self.syntax.blocks == Blocks::End {
            self.accept("then");
            self.accept("do");
        }
        Ok(value)
    }

    pub(crate) fn if_statement(&mut self) -> Parsed {
        self.position += 1;
        let condition = self.condition()?;
        let then = self.block()?;
        let result = |otherwise: Option<Node>| {
            Node::new("If")
                .with("condition", condition.clone())
                .with("then", then.clone())
                .with_opt("otherwise", otherwise)
        };
        self.skip_blank_lines_before_else();
        let else_if = if self.syntax.id == "python" {
            Some("elif")
        } else {
            self.syntax.else_if
        };
        if else_if.is_some_and(|word| self.is(word)) {
            return Ok(result(Some(self.if_statement()?)));
        }
        let mut otherwise = None;
        if self.accept("else") {
            if self.is("if") {
                return Ok(result(Some(self.if_statement()?)));
            }
            otherwise = Some(self.block()?);
        }
        self.close_keyword_block()?;
        Ok(result(otherwise))
    }

    pub(crate) fn skip_blank_lines_before_else(&mut self) {
        let mut offset = 0;
        while self.kind(offset) == TokenType::Newline {
            offset += 1;
        }
        if ["else", "elif", "elsif", "elseif"]
            .iter()
            .any(|word| self.is_at(word, offset))
        {
            self.position += offset;
        }
    }

    pub(crate) fn while_statement(&mut self) -> Parsed {
        let dialect = self.dialect;
        dialect.while_statement(self)
    }

    pub(crate) fn base_while_statement(&mut self) -> Parsed {
        self.position += 1;
        let condition = self.condition()?;
        let body = self.block()?;
        self.close_keyword_block()?;
        Ok(Node::new("While")
            .with("condition", condition)
            .with("body", body))
    }

    // ---- expressions ----

    pub(crate) fn expression(&mut self) -> Parsed {
        self.concrete_rule("expression", |parser| parser.binary(0))
    }

    /// The meta operator spelled by the current token at a precedence level.
    pub(crate) fn binary_operator(&self, level: usize) -> Option<&'static str> {
        let token = self.current();
        if !matches!(token.kind, TokenType::Symbol | TokenType::Name) {
            return None;
        }
        self.levels[level]
            .iter()
            .find(|(_, surfaces)| surfaces.contains(&token.value.as_str()))
            .map(|(operator, _)| *operator)
    }

    pub(crate) fn binary(&mut self, level: usize) -> Parsed {
        if level == self.levels.len() {
            return self.unary();
        }
        let mut left = self.binary(level + 1)?;
        loop {
            let Some(operator) = self.binary_operator(level) else {
                let token = self.current();
                // PHP joins text with "."; C++ streams output with "<<".
                let surface = if level != ADDITIVE {
                    None
                } else if token.kind == TokenType::Symbol
                    && Some(token.value.as_str()) == self.syntax.operators.concatenate
                {
                    Some("concatenate")
                } else if token.value == "<<" {
                    Some("stream")
                } else {
                    None
                };
                let Some(operator) = surface else {
                    return Ok(left);
                };
                self.position += 1;
                let right = self.binary(level + 1)?;
                left = binary(operator, left, right);
                continue;
            };
            if self.value(0) == ".." && self.syntax.id != "lua" {
                return Ok(left);
            }
            if self.value(0) == ".." {
                // Lua's `..` joins text, numbers included. It binds looser
                // than `+` and `-`, to the right: `"a" .. 1 + 2` is "a3".
                self.position += 1;
                let right = self.binary(level)?;
                return Ok(binary("concatenate", left, right));
            }
            // `/` is true division or integer division, depending on the language.
            let operator = if operator == "divide" && self.value(0) == "/" {
                slash_operator(&self.syntax)
            } else {
                operator
            };
            self.position += 1;
            let right = self.binary(level + 1)?;
            left = binary(operator, left, right);
        }
    }

    fn plain_unary(&mut self) -> Parsed {
        if self.accept("-") {
            let operand = self.unary()?;
            if operand.is("Number") {
                let value = -operand.number("value").unwrap_or(0.0);
                return Ok(operand.with("value", value));
            }
            return Ok(Node::new("Unary")
                .with("operator", "negate")
                .with("operand", operand));
        }
        let not = self.syntax.operators.not;
        if self.accept("!") || self.accept("not") || self.accept(not) {
            let operand = self.unary()?;
            return Ok(Node::new("Unary")
                .with("operator", "not")
                .with("operand", operand));
        }
        // ECMAScript 5 truncates with ~~(a / b), which reads as a call of "~~".
        if self.is("~") && self.is_at("~", 1) {
            self.position += 2;
            let operand = self.unary()?;
            return Ok(Node::new("Call")
                .with("callee", "~~")
                .with("arguments", vec![operand]));
        }
        let left = self.postfix()?;
        if let Some(power) = power_symbol(self.syntax.id)
            && self.accept(power)
        {
            let right = self.unary()?;
            Ok(binary("power", left, right))
        } else {
            Ok(left)
        }
    }

    pub(crate) fn postfix(&mut self) -> Parsed {
        let mut expression = self.primary()?;
        loop {
            let mut offset = 0;
            while self.kind(offset) == TokenType::Newline {
                offset += 1;
            }
            if self.syntax.blocks == Blocks::Braces && self.is_at(".", offset) {
                self.position += offset;
            }
            let member =
                (self.is(".") && self.syntax.operators.concatenate != Some(".")) || self.is("::");
            if member && self.kind(1) == TokenType::Name {
                let separator = self.next_value()?;
                let member = self.next_value()?;
                if !expression.is("Name") {
                    expression = Node::new("Method")
                        .with("receiver", expression)
                        .with("name", member);
                    continue;
                }
                expression = name(format!("{}{separator}{member}", callee_name(&expression)?));
                continue;
            }
            if self.accept("(") {
                let mut values = Vec::new();
                while !self.is(")") {
                    // Where "=" compares (Pascal, Ada, Visual Basic),
                    // `f(a = b)` passes a truth value, not a named argument.
                    // Swift labels an argument with ":", print(x,
                    // terminator: "").
                    if self.kind(0) == TokenType::Name
                        && ((self.syntax.operators.equal != Some("=") && self.is_at("=", 1))
                            || (self.syntax.id == "swift" && self.is_at(":", 1)))
                    {
                        let label = self.next_value()?;
                        self.position += 1;
                        let value = self.expression()?;
                        values.push(
                            Node::new("NamedArgument")
                                .with("name", label)
                                .with("value", value),
                        );
                    } else {
                        values.push(self.expression()?);
                    }
                    if !self.accept(",") {
                        break;
                    }
                }
                self.expect(")")?;
                expression = if expression.is("Method") {
                    let method = expression.str("name").unwrap_or_default();
                    let receiver = expression.node("receiver").cloned();
                    Node::new("Call").with("callee", format!(".{method}")).with(
                        "arguments",
                        receiver.into_iter().chain(values).collect::<Vec<_>>(),
                    )
                } else {
                    Node::new("Call")
                        .with("callee", callee_name(&expression)?)
                        .with("arguments", values)
                };
                continue;
            }
            // Lua: a call with one text argument needs no parentheses, f "x".
            if self.syntax.id == "lua"
                && expression.is("Name")
                && self.kind(0) == TokenType::Text
                && self.position > 0
                && self.current().line == self.tokens[self.position - 1].line
            {
                let token = self.next()?;
                let argument = self.text_literal(&token)?;
                expression = Node::new("Call")
                    .with("callee", callee_name(&expression)?)
                    .with("arguments", vec![argument]);
                continue;
            }
            return Ok(expression);
        }
    }

    pub(crate) fn primary(&mut self) -> Parsed {
        let dialect = self.dialect;
        dialect.primary(self)
    }

    fn plain_primary(&mut self) -> Parsed {
        let token = self.next()?;
        match token.kind {
            TokenType::Number => return Ok(number_literal(&token.value)),
            TokenType::Text => return self.text_literal(&token),
            TokenType::Name => {
                return Ok(match token.value.as_str() {
                    "true" => Node::new("Boolean").with("value", true),
                    "false" => Node::new("Boolean").with("value", false),
                    word => match self.syntax.words {
                        Some((yes, _)) if yes == word => Node::new("Boolean").with("value", true),
                        Some((_, no)) if no == word => Node::new("Boolean").with("value", false),
                        _ => name(token.value),
                    },
                });
            }
            TokenType::Symbol if token.value == "(" => {
                let inner = self.expression()?;
                self.expect(")")?;
                return Ok(inner);
            }
            _ => {}
        }
        Err(GrammarError::syntax(
            format!("Unexpected \"{}\" in expression", token.shown()),
            token.line,
        ))
    }

    pub(crate) fn text_literal(&self, token: &Token) -> Parsed {
        let single = token.quote == Some('\'');
        let style = if single && ["php", "ruby"].contains(&self.syntax.id) {
            InterpolationStyle::Plain
        } else {
            token.style
        };
        // Text read with doubled quotes has no escapes.
        let decode = |raw: &str| {
            if token.decoded {
                raw.to_owned()
            } else {
                decode_escapes(raw)
            }
        };
        if style == InterpolationStyle::Plain {
            return Ok(text(if single && self.syntax.id == "php" {
                token.value.clone()
            } else {
                decode(&token.value)
            }));
        }
        let mut parts = Vec::new();
        for piece in split_interpolation(&token.value, style)? {
            match piece {
                Piece::Literal(literal) => parts.push(text(decode(&literal))),
                Piece::Code(code) => {
                    let inner = Syntax {
                        variable_sigil: Some('$'),
                        ..self.syntax.clone()
                    };
                    let tokens = tokenize(&code, &inner)?;
                    let mut parser = Parser::new(tokens, inner);
                    let expression = parser.expression()?;
                    parser.skip_newlines();
                    if parser.current().kind != TokenType::End {
                        return Err(GrammarError::syntax(
                            format!("Unexpected \"{}\" in interpolation", parser.value(0)),
                            token.line,
                        ));
                    }
                    parts.push(expression);
                }
            }
        }
        if parts.len() == 1 && parts[0].is("Text") {
            return Ok(parts.remove(0));
        }
        Ok(Node::new("Interpolation").with("parts", parts))
    }
}

fn assignment(variable: String, operator: &str, value: Node) -> Node {
    Node::new("Assignment")
        .with("name", variable)
        .with("operator", operator)
        .with("value", value)
}

fn callee_name(expression: &Node) -> Parsed<String> {
    match expression.str("name") {
        Some(identifier) if expression.is("Name") => Ok(identifier.to_owned()),
        _ => Err(GrammarError::syntax(
            "Only named functions can be called",
            0,
        )),
    }
}

/// A number as written: 1.5, 2.0 and 1e3 are reals, 7 is an integer.
pub fn number_literal(written: &str) -> Node {
    let literal = number(written.parse().unwrap_or(0.0));
    if written.contains(['.', 'e', 'E']) {
        literal.with("type", "real")
    } else {
        literal
    }
}

/// Map a source type spelling to a meta type: integer, text, boolean,
/// nothing, `source:<spelling>` for other types, or `None` when the source
/// leaves the type to inference.
pub fn source_type(spelling: &str) -> Option<String> {
    static QUALIFIERS: OnceLock<Regex> = OnceLock::new();
    let qualifiers = QUALIFIERS.get_or_init(|| {
        Regex::new(r"\b(const|static|unsigned|signed|mut)\b").expect("valid pattern")
    });
    let stripped = qualifiers.replace_all(spelling, "");
    let words = stripped.split_whitespace().collect::<Vec<_>>().join(" ");
    let meta = match words.as_str() {
        "int" | "long" | "short" | "i8" | "i16" | "i32" | "i64" | "isize" | "u8" | "u16"
        | "u32" | "u64" | "usize" | "Int" | "Long" | "number" | "integer" => "integer",
        "string" | "String" | "&'static str" => "text",
        _ if is_spaced_variant(&words) => "text",
        _ if array_pattern().is_match(&words) => "array",
        "double" | "float" | "f32" | "f64" | "float32" | "float64" | "Double" | "Float"
        | "Float64" | "Long_Float" | "real" | "Real" => "real",
        "bool" | "boolean" | "Bool" | "Boolean" => "boolean",
        "void" | "()" | "Unit" | "Void" => "nothing",
        "" | "var" | "auto" => return None,
        _ => return Some(format!("source:{words}")),
    };
    Some(meta.to_owned())
}

/// The spellings of an array of integers: `int[]`, `std::vector<int>`,
/// `Vec<i64>`, `IntArray`, `[]int`, `[Int]`, `List<Long>`, `Array[Long]`,
/// `seq[int]` and `[n]i64`.
fn array_pattern() -> &'static Regex {
    static ARRAY: OnceLock<Regex> = OnceLock::new();
    ARRAY.get_or_init(|| {
        Regex::new(
            r"^((int|long|Long|number|i64) ?\[ ?\]|std ?:: ?vector ?< ?int ?>|Vec ?< ?i64 ?>|IntArray|\[ ?\] ?int|\[ ?Int ?\]|List ?< ?(int|Long) ?>|Array ?\[ ?Long ?\]|seq ?\[ ?int ?\]|\[ ?(\d+ ?)?\] ?i64)$",
        )
        .expect("valid pattern")
    })
}

/// Whether `words` spells `char *`, `std::string` or `&str` with at most one
/// space at each place the type pattern allows one.
fn is_spaced_variant(words: &str) -> bool {
    [
        "char*",
        "char *",
        "std::string",
        "std ::string",
        "std:: string",
        "std :: string",
        "&str",
        "& str",
    ]
    .contains(&words)
}
