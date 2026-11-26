//! Bash: functions read their arguments into local variables and leave
//! their value in REPLY; integers are computed inside (( )) and $(( )).
//! A call inside a value runs first as a command of its own, so `f(g(x))`
//! becomes `g "$x"` and then `f "$REPLY"`. A value is a word: a number,
//! quoted text, "$name" or $((arithmetic)).

use std::collections::HashMap;

use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Result, field};
use crate::formal::lexer::{Token, TokenType, tokenize};
use crate::formal::parser::{Parsed, Parser};
use crate::meta::GrammarError;
use crate::meta::{Node, add, block, format_number, name, number, text, walk};

pub(crate) struct Bash;

/// Inside double quotes a backslash only escapes these characters.
const QUOTED_ESCAPES: &str = "$\"\\`";
/// The variable a function leaves its value in.
const REPLY: &str = "REPLY";
/// The statements whose values may use REPLY, and the fields that hold them.
const STATEMENT_KINDS: [&str; 8] = [
    "Print",
    "Return",
    "Declaration",
    "Assignment",
    "Evaluate",
    "If",
    "While",
    "CountingLoop",
];
const VALUE_FIELDS: [&str; 5] = ["value", "expression", "condition", "start", "end"];

fn ansi_escape(code: char) -> char {
    match code {
        'n' => '\n',
        't' => '\t',
        'r' => '\r',
        other => other,
    }
}

/// The variables that keep a value while the next call runs: REPLY_1, ...
fn is_kept(identifier: &str) -> bool {
    identifier
        .strip_prefix("REPLY_")
        .is_some_and(|digits| !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()))
}

/// REPLY_1=$REPLY keeps the value of the call before it.
fn keeps(statement: &Node) -> bool {
    is_kept(statement.str("name").unwrap_or_default())
        && statement
            .node("value")
            .is_some_and(|value| value.is_name(REPLY))
}

fn is_word_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || character == '_'
}

/// Where the bracket that closes the one opened just before start is.
fn closing(value: &str, start: usize) -> Parsed<usize> {
    let mut depth = 1;
    let mut index = start;
    let bytes = value.as_bytes();
    while index < bytes.len() && depth > 0 {
        match bytes[index] {
            b'(' => depth += 1,
            b')' => depth -= 1,
            _ => {}
        }
        index += 1;
    }
    if depth != 0 {
        return Err(GrammarError::syntax("Unclosed \"(\" in Bash text", 0));
    }
    Ok(index)
}

// ---- joining calls back into values ----

/// The call whose value REPLY holds, the calls whose values were kept, and
/// whether the statement read REPLY.
#[derive(Default)]
struct Replies {
    current: Option<Node>,
    kept: HashMap<String, Node>,
    used: bool,
}

/// Put the calls back into the values that read REPLY or a kept value.
fn restore(expression: &Node, values: &mut Replies) -> Node {
    let mut restored = expression.clone();
    match expression.kind.as_str() {
        "Name" => {
            let identifier = expression.str("name").unwrap_or_default();
            if identifier == REPLY
                && let Some(current) = &values.current
            {
                values.used = true;
                return current.clone();
            }
            return values.kept.get(identifier).cloned().unwrap_or(restored);
        }
        "Binary" => {
            for key in ["left", "right"] {
                if let Some(part) = expression.node(key) {
                    restored.set(key, restore(part, values));
                }
            }
        }
        "Unary" => {
            if let Some(operand) = expression.node("operand") {
                restored.set("operand", restore(operand, values));
            }
        }
        "Call" | "Interpolation" => {
            let key = if expression.is("Call") {
                "arguments"
            } else {
                "parts"
            };
            let parts: Vec<Node> = expression
                .nodes(key)
                .into_iter()
                .map(|part| restore(part, values))
                .collect();
            restored.set(key, parts);
        }
        _ => {}
    }
    restored
}

/// A call followed by a statement that reads REPLY is a call inside that
/// statement; a call whose value nobody reads is a statement of its own.
fn join_replies(statements: Vec<Node>) -> Vec<Node> {
    let mut joined = Vec::new();
    let mut values = Replies::default();
    let flush = |values: &mut Replies, joined: &mut Vec<Node>| {
        if let Some(current) = values.current.take() {
            joined.push(Node::new("Evaluate").with("expression", current));
        }
    };
    for statement in statements {
        if statement.is("Skip") {
            continue;
        }
        if !STATEMENT_KINDS.contains(&statement.kind.as_str()) {
            flush(&mut values, &mut joined);
            joined.push(statement);
            continue;
        }
        if keeps(&statement)
            && let Some(current) = values.current.take()
        {
            let kept = statement.str("name").unwrap_or_default().to_owned();
            values.kept.insert(kept, current);
            continue;
        }
        values.used = false;
        let mut restored = statement.clone();
        for key in VALUE_FIELDS {
            if let Some(value) = statement.node(key) {
                restored.set(key, restore(value, &mut values));
            }
        }
        if !values.used {
            flush(&mut values, &mut joined);
        }
        values.current = None;
        match restored.node("expression") {
            Some(call) if restored.is("Evaluate") && call.is("Call") => {
                values.current = Some(crate::source_origins::inherit(call.clone(), &restored));
            }
            _ => joined.push(restored),
        }
    }
    flush(&mut values, &mut joined);
    joined
}

// ---- reading words ----

/// $((arithmetic)), $(command; echo $REPLY), ${name} and $'text'.
fn substitution(p: &mut Parser) -> Parsed {
    p.expect("$")?;
    if p.is("(") && p.is_at("(", 1) {
        p.position += 2;
        let value = p.expression()?;
        p.expect(")")?;
        p.expect(")")?;
        return Ok(value);
    }
    if p.accept("(") {
        let call = command(p)?;
        if p.accept(";") {
            p.expect("echo")?;
            word(p)?;
        }
        p.expect(")")?;
        return Ok(call);
    }
    if p.accept("{") {
        // ${#a[@]}: the length of the array a.
        if p.accept("#") {
            let array = name(p.expect_name()?);
            for symbol in ["[", "@", "]", "}"] {
                p.expect(symbol)?;
            }
            return Ok(Node::new("Length").with("array", array));
        }
        let found = name(p.expect_name()?);
        p.expect("}")?;
        return Ok(found);
    }
    let token = p.next()?;
    if token.kind == TokenType::Text && token.quote == Some('\'') {
        let mut decoded = String::new();
        let mut characters = token.value.chars();
        while let Some(character) = characters.next() {
            match character {
                '\\' => decoded.extend(characters.next().map(ansi_escape)),
                other => decoded.push(other),
            }
        }
        return Ok(text(decoded));
    }
    Err(GrammarError::syntax(
        format!("Unexpected \"${}\"", token.value),
        token.line,
    ))
}

/// One argument; a minus sign before a number belongs to it.
fn word(p: &mut Parser) -> Parsed {
    // (a b c): an array of the words.
    if p.accept("(") {
        let mut elements = Vec::new();
        while !p.accept(")") {
            elements.push(word(p)?);
        }
        return Ok(Node::new("ArrayLiteral").with("elements", elements));
    }
    if p.is("-") && p.kind(1) == TokenType::Number {
        p.position += 1;
        let value: f64 = p.next()?.value.parse().unwrap_or(0.0);
        return Ok(number(-value));
    }
    p.primary()
}

/// A command and its arguments, up to the end of the command.
fn command(p: &mut Parser) -> Parsed {
    let callee = p.expect_name()?;
    let mut values = Vec::new();
    while !p.is(")")
        && !p.is(";")
        && !matches!(
            p.kind(0),
            TokenType::Newline | TokenType::End | TokenType::Comment
        )
    {
        values.push(word(p)?);
    }
    Ok(Node::new("Call")
        .with("callee", callee)
        .with("arguments", values))
}

/// "Text with $name, ${name} and $((arithmetic))".
fn quoted(p: &Parser, token: &Token) -> Parsed {
    let value = token.value.as_str();
    let mut parts = Vec::new();
    let mut literal = String::new();
    let flush = |literal: &mut String, parts: &mut Vec<Node>| {
        if !literal.is_empty() {
            parts.push(text(std::mem::take(literal)));
        }
    };
    let mut index = 0;
    while index < value.len() {
        let rest = &value[index..];
        let mut characters = rest.chars();
        let first = characters.next().unwrap_or_default();
        let second = characters.next();
        if first == '\\' {
            match second {
                Some(escaped) if QUOTED_ESCAPES.contains(escaped) => literal.push(escaped),
                _ => literal.push_str(&rest[..1 + second.map_or(0, char::len_utf8)]),
            }
            index += 1 + second.map_or(0, char::len_utf8);
        } else if rest.starts_with("$(") {
            let end = closing(value, index + 2)?;
            flush(&mut literal, &mut parts);
            let syntax = p.syntax.clone();
            let mut inner = Parser::new(tokenize(&value[index..end], &syntax)?, syntax);
            parts.push(substitution(&mut inner)?);
            index = end;
        } else if let Some((identifier, length)) = variable_reference(rest) {
            flush(&mut literal, &mut parts);
            parts.push(name(identifier));
            index += length;
        } else {
            literal.push(first);
            index += first.len_utf8();
        }
    }
    flush(&mut literal, &mut parts);
    if parts.len() <= 1 {
        return Ok(parts.pop().unwrap_or_else(|| text("")));
    }
    Ok(Node::new("Interpolation").with("parts", parts))
}

/// $name or ${name} at the start of the text, with its length.
fn variable_reference(rest: &str) -> Option<(&str, usize)> {
    let after = rest.strip_prefix('$')?;
    let (inside, braced) = match after.strip_prefix('{') {
        Some(inside) => (inside, true),
        None => (after, false),
    };
    if !inside
        .chars()
        .next()
        .is_some_and(|first| first.is_ascii_alphabetic() || first == '_')
    {
        return None;
    }
    let length = inside
        .find(|character: char| !is_word_character(character))
        .unwrap_or(inside.len());
    let identifier = &inside[..length];
    if !braced {
        return Some((identifier, 1 + length));
    }
    inside[length..]
        .starts_with('}')
        .then_some((identifier, 3 + length))
}

// ---- reading statements ----

/// `; return` on the line of the command that leaves the value.
fn returns(p: &mut Parser) -> bool {
    if p.is(";") && p.is_at("return", 1) {
        p.position += 2;
        return true;
    }
    false
}

/// echo word, and printf '%s' word, which ends no line.
fn output(p: &mut Parser) -> Parsed {
    let newline = p.next()?.value == "echo" || format_ends_line(p)?;
    let ends = p.is(";") || matches!(p.kind(0), TokenType::Newline | TokenType::End);
    let value = if ends { text("") } else { word(p)? };
    Ok(Node::new("Print")
        .with("value", value)
        .with("newline", newline))
}

/// The format of printf: '%s' writes its argument, '%s\n' a line.
fn format_ends_line(p: &mut Parser) -> Parsed<bool> {
    let format = p.next()?;
    if format.kind != TokenType::Text || !["%s", "%s\\n"].contains(&format.value.as_str()) {
        return Err(GrammarError::syntax(
            format!("Unsupported printf format \"{}\"", format.value),
            format.line,
        ));
    }
    Ok(format.value.ends_with("\\n"))
}

/// (( expression ))
fn arithmetic(p: &mut Parser) -> Parsed {
    p.expect("(")?;
    p.expect("(")?;
    let value = p.expression()?;
    p.expect(")")?;
    p.expect(")")?;
    Ok(value)
}

/// The statements of a block up to the word that ends it.
fn up_to(p: &mut Parser, ends: &[&str]) -> Parsed {
    let found = p.statements_until(&|parser: &Parser| ends.iter().any(|end| parser.is(end)))?;
    Ok(block(join_replies(found)))
}

/// ; do ... done
fn do_block(p: &mut Parser) -> Parsed {
    p.skip_lines();
    p.expect("do")?;
    let body = up_to(p, &["done"])?;
    p.expect("done")?;
    Ok(body)
}

/// if (( c )); then ... elif (( c )); then ... else ... fi
fn bash_if(p: &mut Parser) -> Parsed {
    let condition = arithmetic(p)?;
    p.skip_lines();
    p.expect("then")?;
    let then = up_to(p, &["elif", "else", "fi"])?;
    let statement = Node::new("If")
        .with("condition", condition)
        .with("then", then);
    if p.accept("elif") {
        return Ok(statement.with("otherwise", bash_if(p)?));
    }
    let otherwise = if p.accept("else") {
        Some(up_to(p, &["fi"])?)
    } else {
        None
    };
    p.expect("fi")?;
    Ok(statement.with_opt("otherwise", otherwise))
}

/// for (( i = a; i < b; i++ )); do ... done
fn bash_for(p: &mut Parser) -> Parsed {
    p.expect("(")?;
    p.expect("(")?;
    let variable = p.expect_name()?;
    p.expect("=")?;
    let start = p.expression()?;
    p.expect(";")?;
    p.expect(&variable)?;
    let inclusive = p.next()?.value == "<=";
    let bound = p.expression()?;
    p.expect(";")?;
    p.expect(&variable)?;
    p.expect("++")?;
    p.expect(")")?;
    p.expect(")")?;
    let end = if inclusive {
        add(bound, number(1.0))
    } else {
        bound
    };
    Ok(Node::new("CountingLoop")
        .with("variable", variable)
        .with("start", start)
        .with("end", end)
        .with("body", do_block(p)?))
}

impl ParserDialect for Bash {
    /// The script runs from top to bottom; `name() { ... }` defines a
    /// function, and `source` loads the common library.
    fn program(&self, p: &mut Parser) -> Parsed {
        let mut items = Vec::new();
        while p.kind(0) != TokenType::End {
            p.gather_comments(&mut items);
            if p.kind(0) == TokenType::End {
                break;
            }
            if (p.is("source") || p.is(".")) && !p.is_at("=", 1) {
                let start = p.position;
                p.skip_line();
                let used: Vec<&str> = p.tokens[start..p.position]
                    .iter()
                    .map(|token| token.value.as_str())
                    .collect();
                items.push(Node::new("Import").with("text", used.join(" ")));
            } else if p.is_at("(", 1) && p.is_at(")", 2) {
                items.push(p.function_definition()?);
            } else {
                items.push(p.statement()?);
            }
            p.skip_lines_keeping(&mut items);
        }
        // The #! line names the interpreter; it is not a comment.
        let items: Vec<Node> = join_replies(items)
            .into_iter()
            .filter(|item| {
                !item.is("Comment") || !item.str("text").unwrap_or_default().starts_with('!')
            })
            .collect();
        Ok(Node::new("SourceProgram")
            .with("language", p.syntax.id)
            .with("items", items))
    }

    /// name() { local first=$1 second=$2; ... }
    fn function_definition(&self, p: &mut Parser) -> Parsed {
        let function = p.expect_name()?;
        p.expect("(")?;
        p.expect(")")?;
        p.expect("{")?;
        p.skip_lines();
        let mut parameters = Vec::new();
        if p.is("local") && p.is_at("$", 3) {
            p.position += 1;
            while p.kind(0) == TokenType::Name && p.is_at("=", 1) {
                let parameter = p.next()?.value;
                parameters.push(Node::new("Parameter").with("name", parameter));
                p.position += 3;
            }
        }
        let body = up_to(p, &["}"])?;
        p.expect("}")?;
        Ok(Node::new("Function")
            .with("name", function)
            .with("parameters", parameters)
            .with("body", body))
    }

    /// Assignments, local declarations, if, while, for, output, returns and
    /// commands.
    fn statement(&self, p: &mut Parser) -> Parsed {
        if p.accept("if") {
            return bash_if(p);
        }
        if p.accept("while") {
            let condition = arithmetic(p)?;
            return Ok(Node::new("While")
                .with("condition", condition)
                .with("body", do_block(p)?));
        }
        if p.accept("for") {
            return bash_for(p);
        }
        if p.accept("return") {
            return Ok(Node::new("Return"));
        }
        if p.accept("local") {
            // `local i` before a loop keeps its counter inside the function.
            if !p.is_at("=", 1) {
                p.position += 1;
                return Ok(Node::new("Skip"));
            }
            let variable = p.expect_name()?;
            p.expect("=")?;
            return Ok(Node::new("Declaration")
                .with("name", variable)
                .with("value", word(p)?)
                .with("mutable", true));
        }
        // a[index]=value
        if p.is_element_assignment().is_some() {
            let variable = p.next()?.value;
            p.position += 1;
            let index = p.expression()?;
            p.expect("]")?;
            p.expect("=")?;
            return Ok(Node::new("IndexAssignment")
                .with("name", variable)
                .with("index", index)
                .with("value", word(p)?));
        }
        if p.kind(0) == TokenType::Name && p.is_at("=", 1) {
            let variable = p.next()?.value;
            p.position += 1;
            let value = word(p)?;
            // REPLY=value; return
            return Ok(if variable == REPLY && returns(p) {
                Node::new("Return").with("value", value)
            } else {
                Node::new("Assignment")
                    .with("name", variable)
                    .with("operator", "=")
                    .with("value", value)
            });
        }
        if p.is("echo") || p.is("printf") {
            return output(p);
        }
        // f arguments; return
        let call = command(p)?;
        Ok(if returns(p) {
            Node::new("Return").with("value", call)
        } else {
            Node::new("Evaluate").with("expression", call)
        })
    }

    fn primary(&self, p: &mut Parser) -> Parsed {
        if p.is("$") {
            return substitution(p);
        }
        if p.kind(0) == TokenType::Text {
            let token = p.next()?;
            return if token.quote == Some('\'') {
                Ok(text(token.value))
            } else {
                quoted(p, &token)
            };
        }
        p.base_primary()
    }
}

// ---- writing ----

/// Whether a function is being written, the value in REPLY that the next
/// command may read, and the variables that keep values while other calls
/// run. A value a call leaves is written as a placeholder name until the
/// statement knows whether it stays in REPLY or moves to REPLY_n.
#[derive(Default)]
struct Script {
    in_function: bool,
    pending: Option<String>,
    kept: usize,
    placeholders: usize,
    moved: HashMap<String, String>,
}

const PLACEHOLDER: char = '\u{1}';

/// The variable a name stands for, placeholders included.
fn resolve(e: &mut Emitter, identifier: &str) -> String {
    if !identifier.starts_with(PLACEHOLDER) {
        return identifier.to_owned();
    }
    e.state::<Script>()
        .moved
        .get(identifier)
        .cloned()
        .unwrap_or_else(|| REPLY.to_owned())
}

/// A command with its arguments. Inside quotes or another command the
/// arguments are not quoted again.
fn command_line(e: &mut Emitter, call: &Node, nested: bool) -> Result<String> {
    let mut pieces = vec![call.str("callee").unwrap_or_default().to_owned()];
    for value in call.nodes("arguments") {
        pieces.push(word_of(e, value, nested)?);
    }
    Ok(pieces.join(" "))
}

/// A value as one word.
fn word_of(e: &mut Emitter, value: &Node, nested: bool) -> Result<String> {
    let quoted = |inner: String| {
        if nested {
            inner
        } else {
            format!("\"{inner}\"")
        }
    };
    Ok(match value.kind.as_str() {
        "Number" => format_number(value.number("value").unwrap_or(0.0)),
        "Boolean" => {
            let (yes, no) = e.syntax.words.unwrap_or(("true", "false"));
            if value.flag("value") == Some(true) {
                yes
            } else {
                no
            }
            .to_owned()
        }
        "Text" => e.quote(value.str("value").unwrap_or_default()),
        "Name" => {
            let identifier = resolve(e, value.str("name").unwrap_or_default());
            quoted(format!("${identifier}"))
        }
        "Call" => quoted(e.expression(value)?),
        "Interpolation" => e.interpolation(&value.node_list("parts"))?,
        "ArrayLiteral" => {
            let mut words = Vec::new();
            for element in value.nodes("elements") {
                words.push(word_of(e, element, false)?);
            }
            format!("({})", words.join(" "))
        }
        "Length" => quoted(e.expression(value)?),
        _ => {
            // $(((a ... reads as $(( (a ..., so the inner bracket stands apart.
            let inner = e.expression(value)?;
            if inner.starts_with('(') {
                format!("$(( {inner} ))")
            } else {
                format!("$(({inner}))")
            }
        }
    })
}

/// Calls inside a value run first, innermost first; each leaves its value
/// in REPLY, which the next call or the statement reads.
fn lift(e: &mut Emitter, expression: &Node) -> Result<Node> {
    let mut lifted = expression.clone();
    match expression.kind.as_str() {
        "Call" => {
            let values = expression
                .nodes("arguments")
                .into_iter()
                .map(|part| lift(e, part))
                .collect::<Result<Vec<_>>>()?;
            lifted.set("arguments", values);
            run(e, &lifted)?;
            let state = e.state::<Script>();
            state.placeholders += 1;
            let placeholder = format!("{PLACEHOLDER}{}", state.placeholders);
            state.pending = Some(placeholder.clone());
            return Ok(name(placeholder));
        }
        "Binary" => {
            for key in ["left", "right"] {
                let part = lift(e, field(expression, key)?)?;
                lifted.set(key, part);
            }
        }
        "Unary" => {
            let operand = lift(e, field(expression, "operand")?)?;
            lifted.set("operand", operand);
        }
        "Interpolation" => {
            let parts = expression
                .nodes("parts")
                .into_iter()
                .map(|part| lift(e, part))
                .collect::<Result<Vec<_>>>()?;
            lifted.set("parts", parts);
        }
        _ => {}
    }
    Ok(lifted)
}

/// A command line. A value in REPLY that this command does not read is kept
/// in a variable of its own first.
fn run(e: &mut Emitter, call: &Node) -> Result<()> {
    if let Some(pending) = e.state::<Script>().pending.clone() {
        let mut holds = false;
        walk(call, |current| holds |= current.is_name(&pending));
        if !holds {
            keep(e);
        }
    }
    e.state::<Script>().pending = None;
    let line = command_line(e, call, false)?;
    e.line(&line);
    Ok(())
}

fn keep(e: &mut Emitter) {
    let state = e.state::<Script>();
    state.kept += 1;
    let kept = format!("{REPLY}_{}", state.kept);
    let local = if state.in_function { "local " } else { "" };
    if let Some(pending) = state.pending.take() {
        state.moved.insert(pending, kept.clone());
    }
    e.line(&format!("{local}{kept}=${REPLY}"));
}

/// A function leaves its value in REPLY; `f x; return` returns the value f
/// left there.
fn return_value(e: &mut Emitter, value: Option<&Node>) -> Result<()> {
    let Some(value) = value else {
        e.line("return");
        return Ok(());
    };
    let lifted = lift(e, value)?;
    let pending = e.state::<Script>().pending.clone();
    if pending.is_some_and(|pending| lifted.is_name(&pending)) {
        if let Some(last) = e.lines.last_mut() {
            last.push_str("; return");
        }
        return Ok(());
    }
    let written = word_of(e, &lifted, true)?;
    e.line(&format!("{REPLY}={written}; return"));
    Ok(())
}

fn indented(e: &mut Emitter, body: &Node) -> Result<()> {
    e.depth += 1;
    e.body(body)?;
    if body.nodes("statements").is_empty() {
        e.line(":");
    }
    e.depth -= 1;
    Ok(())
}

impl EmitterDialect for Bash {
    fn terminator(&self, _: &Emitter) -> &'static str {
        ""
    }

    fn variable(&self, _: &Emitter, identifier: &str) -> String {
        identifier.to_owned()
    }

    /// Plain text in single quotes; text with a line end in $'...'.
    fn quote(&self, _: &Emitter, value: &str) -> String {
        if value.contains(['\n', '\t', '\r']) {
            let escaped = value
                .replace('\\', "\\\\")
                .replace('\'', "\\'")
                .replace('\n', "\\n")
                .replace('\t', "\\t")
                .replace('\r', "\\r");
            return format!("$'{escaped}'");
        }
        if !value.contains(['\'', '\\']) {
            return format!("'{value}'");
        }
        format!("\"{}\"", escape_quoted(value))
    }

    /// Arithmetic: names are bare. A call that cannot run before the
    /// statement (in a loop condition) runs in a subshell that prints REPLY.
    fn expression_in(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        match expression.kind.as_str() {
            "Call" => Ok(format!(
                "$({}; echo ${REPLY})",
                command_line(e, expression, true)?
            )),
            "Text" | "Interpolation" => Err(GrammarError::new("Bash arithmetic cannot hold text")),
            "Name" => Ok(resolve(e, expression.str("name").unwrap_or_default())),
            _ => e.base_expression_in(expression, parent),
        }
    }

    /// "Text with $name and $((arithmetic))".
    fn interpolation(&self, e: &mut Emitter, parts: &[Node]) -> Result<String> {
        let mut pieces = String::new();
        for (index, part) in parts.iter().enumerate() {
            match part.kind.as_str() {
                "Text" => pieces.push_str(&escape_quoted(part.str("value").unwrap_or_default())),
                "Name" => {
                    let identifier = resolve(e, part.str("name").unwrap_or_default());
                    let joined = parts.get(index + 1).is_some_and(|following| {
                        following.is("Text")
                            && following
                                .str("value")
                                .and_then(|value| value.chars().next())
                                .is_some_and(is_word_character)
                    });
                    if joined {
                        pieces.push_str(&format!("${{{identifier}}}"));
                    } else {
                        pieces.push_str(&format!("${identifier}"));
                    }
                }
                "Interpolation" => {
                    return Err(GrammarError::new("Bash text cannot hold other text"));
                }
                _ => pieces.push_str(&word_of(e, part, true)?),
            }
        }
        Ok(format!("\"{pieces}\""))
    }

    fn statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        {
            let state = e.state::<Script>();
            state.pending = None;
            state.kept = 0;
        }
        match statement.kind.as_str() {
            "Evaluate" if field(statement, "expression")?.is("Call") => {
                lift(e, field(statement, "expression")?)?;
                e.state::<Script>().pending = None;
                Ok(())
            }
            "Print" | "Declaration" | "Assignment" => {
                let mut lifted = statement.clone();
                if let Some(value) = statement.node("value") {
                    lifted.set("value", lift(e, value)?);
                }
                e.base_statement(&lifted)
            }
            // The index is one word: a[i+1]=value.
            "IndexAssignment" => {
                let value = lift(e, field(statement, "value")?)?;
                let index = e.expression(field(statement, "index")?)?.replace(' ', "");
                let written = word_of(e, &value, true)?;
                let name = statement.str("name").unwrap_or_default();
                e.line(&format!("{name}[{index}]={written}"));
                Ok(())
            }
            "Return" => return_value(e, statement.node("value")),
            "If" => {
                let mut lifted = statement.clone();
                lifted.set("condition", lift(e, field(statement, "condition")?)?);
                e.if_statement(&lifted)
            }
            _ => e.base_statement(statement),
        }
    }

    fn print(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let value = field(statement, "value")?;
        let empty = value.is("Text") && value.str("value") == Some("");
        if statement.flag("newline") == Some(true) {
            if empty {
                return Ok("echo".to_owned());
            }
            return Ok(format!("echo {}", word_of(e, value, false)?));
        }
        Ok(format!("printf '%s' {}", word_of(e, value, false)?))
    }

    /// Variables of a function are local to it.
    fn declaration(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let local = if e.state::<Script>().in_function {
            "local "
        } else {
            ""
        };
        let value = statement.node("value").cloned().unwrap_or(number(0.0));
        let written = word_of(e, &value, true)?;
        Ok(format!(
            "{local}{}={written}",
            statement.str("name").unwrap_or_default()
        ))
    }

    fn assignment(&self, e: &mut Emitter, statement: &Node) -> Result<String> {
        let written = word_of(e, field(statement, "value")?, true)?;
        Ok(format!(
            "{}={written}",
            statement.str("name").unwrap_or_default()
        ))
    }

    fn if_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("if (( {condition} )); then"));
        let mut current = statement;
        indented(e, field(current, "then")?)?;
        while let Some(otherwise) = current.node("otherwise").filter(|inner| inner.is("If")) {
            current = otherwise;
            let condition = e.expression(field(current, "condition")?)?;
            e.line(&format!("elif (( {condition} )); then"));
            indented(e, field(current, "then")?)?;
        }
        if let Some(otherwise) = current.node("otherwise") {
            e.line("else");
            indented(e, otherwise)?;
        }
        e.line("fi");
        Ok(())
    }

    fn while_statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let condition = e.expression(field(statement, "condition")?)?;
        e.line(&format!("while (( {condition} )); do"));
        indented(e, field(statement, "body")?)?;
        e.line("done");
        Ok(())
    }

    /// The bounds are computed once, before the loop; the body may change
    /// REPLY, so a bound from a call keeps its value in a variable.
    fn counting_loop(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        let variable = statement.str("variable").unwrap_or_default();
        if e.state::<Script>().in_function {
            e.line(&format!("local {variable}"));
        }
        let first = lift(e, field(statement, "start")?)?;
        let bound = lift(e, field(statement, "end")?)?;
        if e.state::<Script>().pending.is_some() {
            keep(e);
        }
        let from = e.expression(&first)?;
        let to = e.expression_in(&bound, 5.0)?;
        e.line(&format!(
            "for (( {variable} = {from}; {variable} < {to}; {variable}++ )); do"
        ));
        indented(e, field(statement, "body")?)?;
        e.line("done");
        Ok(())
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for comment in item.texts("comments") {
            e.comment(&comment);
        }
        e.line(&format!("{}() {{", item.str("name").unwrap_or_default()));
        let parameters = item.nodes("parameters");
        if !parameters.is_empty() {
            let locals = parameters
                .iter()
                .enumerate()
                .map(|(index, parameter)| {
                    format!(
                        "{}=${}",
                        parameter.str("name").unwrap_or_default(),
                        index + 1
                    )
                })
                .collect::<Vec<_>>();
            let line = format!("{}local {}", e.unit, locals.join(" "));
            e.line(&line);
        }
        e.state::<Script>().in_function = true;
        indented(e, field(item, "body")?)?;
        e.state::<Script>().in_function = false;
        e.line("}");
        Ok(())
    }

    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        Ok(format!("#!/usr/bin/env bash\n{}", e.base_program(program)?))
    }
}

/// Text inside double quotes, where $, ", \ and ` need a backslash.
fn escape_quoted(value: &str) -> String {
    let mut escaped = String::new();
    for character in value.chars() {
        if QUOTED_ESCAPES.contains(character) {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
}
