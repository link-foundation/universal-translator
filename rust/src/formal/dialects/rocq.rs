//! Rocq: a program is a set of pure functions that compute its output as a
//! string. The runtime in the header of every program (rocq_runtime.rs)
//! gives statements a meaning: an action takes the output written so far
//! and either goes on with a state or returns a result. Statements are
//! joined with `;;`, a variable is a `let` that a later `let` shadows, and
//! an if or a loop hands the variables it assigns back as its state:
//!
//! ```text
//! '(sum, divisor) <- loop_while (fun '(sum, divisor) => c) (fun '(sum,
//! divisor) => ... pure (sum, divisor)) (sum, divisor) ;;
//! ```
//!
//! A function is a Fixpoint whose body is an action: `value (...)` keeps the
//! result of a function that returns one, and a procedure is the action
//! itself. The last command evaluates `run main`, which Rocq prints.

use super::shared::{default_value, each_statement};
use super::{EmitterDialect, ParserDialect};
use crate::formal::emitter::{Emitter, Result, field};
use crate::formal::lexer::TokenType;
use crate::formal::parser::{Parsed, Parser};
use crate::meta::{Node, binary, block, later_calls, name};

pub(crate) struct Rocq;

/// Words that end an application: `if f x then`, `let x := f y in`.
const KEYWORDS: [&str; 11] = [
    "then", "else", "in", "with", "if", "let", "fun", "end", "match", "stop", "pure",
];

/// Marks `tt`, the argument of a function without parameters.
const UNIT_ARGUMENT: &str = "Unit";

/// The comparisons, which Rocq spells with a question mark.
pub(crate) fn comparison(operator: &str) -> Option<&'static str> {
    match operator {
        "less" => Some("<?"),
        "lessOrEqual" => Some("<=?"),
        "greater" => Some(">?"),
        "greaterOrEqual" => Some(">=?"),
        _ => None,
    }
}

fn empty() -> Node {
    Node::new("Statements").with("statements", Vec::<Node>::new())
}

/// The meta type of a Rocq type spelling.
fn meta_type(spelled: &str) -> String {
    match spelled {
        "Z" => "integer",
        "string" => "text",
        "bool" => "boolean",
        "unit" | "Action unit unit" => "nothing",
        "list Z" => "array",
        other => other,
    }
    .to_owned()
}

// ---- reading ----

/// The words of a type up to the symbol that ends it.
fn type_until(p: &mut Parser, stop: &str) -> Parsed<String> {
    let mut words = Vec::new();
    while !p.is(stop) && p.kind(0) != TokenType::End {
        words.push(p.next_value()?);
    }
    Ok(meta_type(&words.join(" ")))
}

/// The words of a command up to the full stop that ends it.
fn skip_command(p: &mut Parser) -> Parsed<Vec<String>> {
    let mut words = Vec::new();
    while !p.is(".") && p.kind(0) != TokenType::End {
        words.push(p.next_value()?);
    }
    p.next()?;
    Ok(words)
}

/// The variables an if or a loop hands back: x <- or '(a, b) <-.
fn binder(p: &mut Parser) -> Parsed<()> {
    if p.is("'") {
        pattern(p)?;
        p.expect("<-")?;
    } else if p.kind(0) == TokenType::Name && p.is_at("<-", 1) {
        p.position += 2;
    }
    Ok(())
}

/// _, x or '(a, b): the state a function of a loop receives.
fn pattern(p: &mut Parser) -> Parsed<()> {
    if p.accept("'") {
        state(p)
    } else {
        p.next()?;
        Ok(())
    }
}

/// tt, x or (a, b): a state, which only threads variables through.
fn state(p: &mut Parser) -> Parsed<()> {
    if !p.accept("(") {
        p.next()?;
        return Ok(());
    }
    let mut depth = 1;
    while depth > 0 && p.kind(0) != TokenType::End {
        let token = p.next()?;
        if token.kind == TokenType::Symbol {
            match token.value.as_str() {
                "(" => depth += 1,
                ")" => depth -= 1,
                _ => {}
            }
        }
    }
    Ok(())
}

/// (if c then ... else ...), loop_while and for_range.
fn control(p: &mut Parser) -> Parsed {
    if p.accept("(") {
        let statement = if_statement(p)?;
        p.expect(")")?;
        return Ok(statement);
    }
    if p.accept("loop_while") {
        p.expect("(")?;
        p.expect("fun")?;
        pattern(p)?;
        p.expect("=>")?;
        let condition = p.expression()?;
        p.expect(")")?;
        let (_, body) = loop_body(p, false)?;
        return Ok(Node::new("While")
            .with("condition", condition)
            .with("body", body));
    }
    p.expect("for_range")?;
    let start = atom(p)?;
    let end = atom(p)?;
    let (variable, body) = loop_body(p, true)?;
    Ok(Node::new("CountingLoop")
        .with_opt("variable", variable)
        .with("start", start)
        .with("end", end)
        .with("body", body))
}

/// (fun '(a, b) => ...) state, with the counter first in a counting loop.
fn loop_body(p: &mut Parser, counting: bool) -> Parsed<(Option<String>, Node)> {
    p.expect("(")?;
    p.expect("fun")?;
    let variable = if counting {
        Some(p.expect_name()?)
    } else {
        None
    };
    pattern(p)?;
    p.expect("=>")?;
    let body = sequence(p)?;
    p.expect(")")?;
    state(p)?;
    Ok((variable, body))
}

/// if c then ... else if d then ... else ...
fn if_statement(p: &mut Parser) -> Parsed {
    p.expect("if")?;
    let condition = p.expression()?;
    p.expect("then")?;
    let then = sequence(p)?;
    p.expect("else")?;
    let otherwise = if p.is("if") {
        Some(if_statement(p)?)
    } else {
        Some(sequence(p)?).filter(|block| !block.nodes("statements").is_empty())
    };
    Ok(Node::new("If")
        .with("condition", condition)
        .with("then", then)
        .with_opt("otherwise", otherwise))
}

/// The statements of an action up to the `pure` that ends it, or up to a
/// `stop` that is not followed by more statements.
fn sequence(p: &mut Parser) -> Parsed {
    let mut statements = Vec::new();
    while p.kind(0) != TokenType::End {
        match p.kind(0) {
            TokenType::Comment => {
                let token = p.next()?;
                statements.push(Node::new("Comment").with("text", token.value));
            }
            TokenType::Newline => {
                p.next()?;
            }
            _ if p.accept("pure") => {
                state(p)?;
                break;
            }
            _ if p.accept("stop") => {
                let value = p.expression()?;
                statements.push(Node::new("Return").with_opt(
                    "value",
                    Some(value).filter(|value| !value.is(UNIT_ARGUMENT)),
                ));
                if !p.accept(";;") {
                    break;
                }
            }
            _ => statements.push(p.statement()?),
        }
    }
    Ok(block(statements))
}

/// let x : Z := v in, let x := v in and let _ := f x in.
fn let_statement(p: &mut Parser) -> Parsed {
    p.next()?;
    let variable = p.expect_name()?;
    let kind = if p.accept(":") {
        Some(type_until(p, ":=")?)
    } else {
        None
    };
    p.expect(":=")?;
    let value = p.expression()?;
    p.expect("in")?;
    if variable == "_" {
        return Ok(Node::new("Evaluate").with("expression", value));
    }
    if let Some(kind) = kind {
        return Ok(Node::new("Declaration")
            .with("name", variable)
            .with("type", kind)
            .with("value", value));
    }
    let arguments = value.node_list("arguments");
    if value.is("Call")
        && value.str("callee") == Some("with_item")
        && arguments
            .first()
            .and_then(|array| array.str("name"))
            .is_some_and(|array| array == variable)
    {
        let mut rest = arguments.into_iter().skip(1);
        let index = rest.next().unwrap_or(Node::new("Number"));
        let element = rest.next().unwrap_or(Node::new("Number"));
        return Ok(Node::new("IndexAssignment")
            .with("name", variable)
            .with("index", index)
            .with("value", element));
    }
    Ok(Node::new("Assignment")
        .with("name", variable)
        .with("operator", "=")
        .with("value", value))
}

/// Fixpoint name (a : Z) {struct a} : Z := value (...), `with` for the next
/// function of a group, and Definition main.
fn definition(p: &mut Parser) -> Parsed {
    p.next()?;
    let function_name = p.expect_name()?;
    let mut parameters = Vec::new();
    while p.accept("(") {
        let parameter = p.expect_name()?;
        p.expect(":")?;
        let kind = type_until(p, ")")?;
        p.expect(")")?;
        // (no_arguments : unit) stands for no parameters.
        if kind != "nothing" {
            parameters.push(
                Node::new("Parameter")
                    .with("name", parameter)
                    .with("type", kind),
            );
        }
    }
    if p.accept("{") {
        type_until(p, "}")?;
        p.expect("}")?;
    }
    p.expect(":")?;
    let return_type = type_until(p, ":=")?;
    p.expect(":=")?;
    p.accept("value");
    p.expect("(")?;
    let mut statements = sequence(p)?.node_list("statements");
    p.expect(")")?;
    p.accept(".");
    // `stop default` only gives a value to a function whose last statement
    // does not return.
    if statements.last().is_some_and(|last| {
        last.is("Return")
            && last
                .node("value")
                .and_then(|value| value.str("name"))
                .is_some_and(|value| value == "default")
    }) {
        statements.pop();
    }
    Ok(Node::new("Function")
        .with("name", function_name)
        .with("parameters", parameters)
        .with("returnType", return_type)
        .with("body", block(statements)))
}

/// Whether the next token starts an argument of an application.
fn starts_atom(p: &Parser) -> bool {
    match p.kind(0) {
        TokenType::Number | TokenType::Text => true,
        TokenType::Name => !KEYWORDS.contains(&p.value(0)),
        _ => p.is("(") || p.is("["),
    }
}

/// The runtime functions the emitter writes for meta operations.
fn application(callee: String, values: Vec<Node>) -> Node {
    let mut values = values.into_iter();
    let first = values.next().unwrap_or(Node::new("Number"));
    let mut second = || values.next().unwrap_or(Node::new("Number"));
    match callee.as_str() {
        "Z.quot" => binary("divide", first, second()),
        "Z.rem" => binary("remainder", first, second()),
        "show" => first,
        "item" => Node::new("Index")
            .with("array", first)
            .with("index", second()),
        "size" => Node::new("Length").with("array", first),
        "filled" => Node::new("NewArray")
            .with("length", first)
            .with("fill", second()),
        _ => Node::new("Call").with("callee", callee).with(
            "arguments",
            std::iter::once(first).chain(values).collect::<Vec<_>>(),
        ),
    }
}

/// A literal, a parenthesized expression, a list [a; b] or a dotted name.
fn atom(p: &mut Parser) -> Parsed {
    if p.accept("(") {
        let inner = p.expression()?;
        p.expect(")")?;
        return Ok(inner);
    }
    if p.accept("[") {
        let mut elements = Vec::new();
        while !p.accept("]") {
            elements.push(p.expression()?);
            p.accept(";");
        }
        return Ok(Node::new("ArrayLiteral").with("elements", elements));
    }
    if p.kind(0) != TokenType::Name {
        return p.base_primary();
    }
    if p.is("true") || p.is("false") {
        return Ok(Node::new("Boolean").with("value", p.next_value()? == "true"));
    }
    if p.accept("tt") {
        return Ok(Node::new(UNIT_ARGUMENT));
    }
    let mut written = p.next_value()?;
    while p.is(".") && p.kind(1) == TokenType::Name {
        p.next()?;
        written = format!("{written}.{}", p.next_value()?);
    }
    Ok(name(written))
}

/// negb (a =? b) is a != b.
pub(crate) fn not_equal(expression: Node) -> Node {
    let comparison = expression
        .node("operand")
        .filter(|operand| operand.is("Binary") && operand.str("operator") == Some("equal"));
    match comparison {
        Some(operand) if expression.is("Unary") && expression.str("operator") == Some("not") => {
            operand.clone().with("operator", "notEqual")
        }
        _ => expression,
    }
}

impl ParserDialect for Rocq {
    fn item(&self, p: &mut Parser) -> Parsed {
        if p.kind(0) == TokenType::Comment {
            let token = p.next()?;
            return Ok(Node::new("Comment").with("text", token.value));
        }
        if p.is("Load") {
            let words = skip_command(p)?;
            return Ok(Node::new("Import").with("text", format!("{}.", words.join(" "))));
        }
        // #[bypass_check(guard)] lets a function call itself freely.
        if p.is("#") && p.is_at("[", 1) {
            while !p.accept("]") {
                p.next()?;
            }
            return Ok(empty());
        }
        if p.is("Fixpoint") || p.is("with") || p.is("Definition") {
            return definition(p);
        }
        // Eval and Set only run and print the program.
        skip_command(p)?;
        Ok(empty())
    }

    fn statement(&self, p: &mut Parser) -> Parsed {
        if p.is("let") {
            return let_statement(p);
        }
        if p.is("print_line") || p.is("print") {
            let newline = p.next_value()? == "print_line";
            let value = atom(p)?;
            p.expect(";;")?;
            return Ok(Node::new("Print")
                .with("value", value)
                .with("newline", newline));
        }
        if p.accept("call") {
            let expression = atom(p)?;
            p.expect(";;")?;
            return Ok(Node::new("Evaluate").with("expression", expression));
        }
        binder(p)?;
        let statement = control(p)?;
        p.expect(";;")?;
        Ok(statement)
    }

    /// f a b: a name applied to the atoms after it.
    fn primary(&self, p: &mut Parser) -> Parsed {
        let head = atom(p)?;
        if !head.is("Name") || !starts_atom(p) {
            return Ok(head);
        }
        let mut values = Vec::new();
        while starts_atom(p) {
            let value = atom(p)?;
            if !value.is(UNIT_ARGUMENT) {
                values.push(value);
            }
        }
        let callee = head.str("name").unwrap_or_default().to_owned();
        if values.is_empty() {
            return Ok(Node::new("Call")
                .with("callee", callee)
                .with("arguments", Vec::<Node>::new()));
        }
        Ok(application(callee, values))
    }
}

// ---- writing ----

/// The first and last functions of a group that call each other.
#[derive(Default)]
struct Writing {
    group: Option<(String, String)>,
}

/// The variables a block assigns that it did not declare, in order: the
/// state an if or a loop hands back.
fn assigned_variables(body: &Node) -> Vec<String> {
    let mut declared: Vec<String> = Vec::new();
    let mut assigned: Vec<String> = Vec::new();
    each_statement(body, &mut |statement| {
        let variable = statement.str("name").unwrap_or_default().to_owned();
        if statement.is("Declaration") {
            declared.push(variable);
        } else if statement.is("CountingLoop") {
            declared.push(statement.str("variable").unwrap_or_default().to_owned());
        } else if (statement.is("Assignment") || statement.is("IndexAssignment"))
            && !declared.contains(&variable)
            && !assigned.contains(&variable)
        {
            assigned.push(variable);
        }
    });
    assigned
}

/// Whether a block ends by returning, so it hands back no state.
fn returns(block: Option<&Node>) -> bool {
    block
        .and_then(|block| {
            block
                .nodes("statements")
                .last()
                .map(|last| last.is("Return"))
        })
        .unwrap_or(false)
}

/// Whether every path through an if returns.
fn always_returns(statement: &Node) -> bool {
    if !returns(statement.node("then")) {
        return false;
    }
    match statement.node("otherwise") {
        Some(rest) if rest.is("If") => always_returns(rest),
        rest => returns(rest),
    }
}

/// How a state of the given variables is bound, received and handed back.
struct State {
    binder: String,
    pattern: String,
    value: String,
}

fn state_spellings(variables: &[String]) -> State {
    match variables {
        [] => State {
            binder: String::new(),
            pattern: "_".into(),
            value: "tt".into(),
        },
        [only] => State {
            binder: format!("{only} <- "),
            pattern: only.clone(),
            value: only.clone(),
        },
        _ => {
            let tuple = format!("({})", variables.join(", "));
            State {
                binder: format!("'{tuple} <- "),
                pattern: format!("'{tuple}"),
                value: tuple,
            }
        }
    }
}

/// Adds text to the last line written.
fn append(e: &mut Emitter, text: &str) {
    if let Some(last) = e.lines.last_mut() {
        last.push_str(text);
    }
}

/// Statements of which a last return ends the action: no `;;` follows.
fn statements(e: &mut Emitter, statements: &[&Node]) -> Result<()> {
    for (index, statement) in statements.iter().enumerate() {
        if index == statements.len() - 1 && statement.is("Return") {
            e.statement(&(*statement).clone().with("final", true))?;
        } else {
            e.statement(statement)?;
        }
    }
    Ok(())
}

/// The statements of a block, one level deeper, and then `ending` unless
/// the block returns.
fn action(e: &mut Emitter, block: Option<&Node>, ending: &str) -> Result<()> {
    e.depth += 1;
    let list = block
        .map(|block| block.nodes("statements"))
        .unwrap_or_default();
    statements(e, &list)?;
    if !returns(block) {
        e.line(ending);
    }
    e.depth -= 1;
    Ok(())
}

/// A printed value is text: a literal, joined parts or a shown value.
fn printed(e: &mut Emitter, value: &Node) -> Result<String> {
    if value.is("Text") {
        return Ok(e.quote(value.str("value").unwrap_or_default()));
    }
    if value.is("Interpolation") {
        return e.expression_in(value, 8.0);
    }
    Ok(format!("(show {})", e.expression_in(value, 8.0)?))
}

fn declaration(e: &mut Emitter, statement: &Node) -> Result<String> {
    let variable = statement.str("name").unwrap_or_default();
    let value = statement.node("value");
    let array = value.is_some_and(|value| value.is("ArrayLiteral") || value.is("NewArray"));
    let kind = if array {
        "array"
    } else {
        statement.str("type").unwrap_or("integer")
    };
    let initial = match value {
        Some(value) => e.expression(value)?,
        None => e.expression(&default_value(kind))?,
    };
    Ok(format!(
        "let {variable} : {} := {initial} in",
        e.type_name(kind)
    ))
}

fn if_statement_lines(e: &mut Emitter, statement: &Node) -> Result<()> {
    let variables = if always_returns(statement) {
        Vec::new()
    } else {
        assigned_variables(&block(vec![statement.clone()]))
    };
    let state = state_spellings(&variables);
    let ending = format!("pure {}", state.value);
    let condition = e.expression(field(statement, "condition")?)?;
    e.line(&format!("{}(if {condition} then", state.binder));
    action(e, statement.node("then"), &ending)?;
    let mut rest = statement.node("otherwise");
    while let Some(next) = rest.filter(|next| next.is("If")) {
        let condition = e.expression(field(next, "condition")?)?;
        e.line(&format!("else if {condition} then"));
        action(e, next.node("then"), &ending)?;
        rest = next.node("otherwise");
    }
    e.line("else");
    action(e, rest, &ending)?;
    append(e, ") ;;");
    Ok(())
}

fn while_lines(e: &mut Emitter, statement: &Node) -> Result<()> {
    let body = field(statement, "body")?;
    let state = state_spellings(&assigned_variables(body));
    let condition = e.expression(field(statement, "condition")?)?;
    e.line(&format!(
        "{}loop_while (fun {} => {condition}) (fun {} =>",
        state.binder, state.pattern, state.pattern
    ));
    action(e, Some(body), &format!("pure {}", state.value))?;
    append(e, &format!(") {} ;;", state.value));
    Ok(())
}

fn counting_lines(e: &mut Emitter, statement: &Node) -> Result<()> {
    let body = field(statement, "body")?;
    let state = state_spellings(&assigned_variables(body));
    let variable = statement.str("variable").unwrap_or_default();
    let start = e.expression_in(field(statement, "start")?, 8.0)?;
    let end = e.expression_in(field(statement, "end")?, 8.0)?;
    e.line(&format!(
        "{}for_range {start} {end} (fun {variable} {} =>",
        state.binder, state.pattern
    ));
    action(e, Some(body), &format!("pure {}", state.value))?;
    append(e, &format!(") {} ;;", state.value));
    Ok(())
}

/// Applications bind tighter than every operator.
fn applied(written: String, parent: f64) -> String {
    if parent > 6.0 {
        format!("({written})")
    } else {
        written
    }
}

/// An application whose arguments that are not single words are
/// parenthesized.
fn call(e: &mut Emitter, callee: &str, values: &[&Node], parent: f64) -> Result<String> {
    let written = if values.is_empty() {
        "tt".to_owned()
    } else {
        values
            .iter()
            .map(|value| e.expression_in(value, 8.0))
            .collect::<Result<Vec<_>>>()?
            .join(" ")
    };
    Ok(applied(format!("{callee} {written}"), parent))
}

fn parenthesized(written: String, parent: f64) -> String {
    if parent > 0.0 {
        format!("({written})")
    } else {
        written
    }
}

/// Rocq's && and || bind as tightly as + and *, and comparisons more
/// loosely, so an operand that is an operation keeps its parentheses.
fn logical(e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
    let mut operand = |part: &Node| -> Result<String> {
        let written = e.expression(part)?;
        Ok(if part.is("Binary") {
            format!("({written})")
        } else {
            written
        })
    };
    let left = operand(field(expression, "left")?)?;
    let right = operand(field(expression, "right")?)?;
    let spelled = e
        .syntax
        .operator(expression.str("operator").unwrap_or_default())
        .unwrap_or_default();
    Ok(parenthesized(format!("{left} {spelled} {right}"), parent))
}

fn is_procedure(item: &Node) -> bool {
    item.str("returnType").is_none_or(|kind| kind == "nothing")
}

fn signature(e: &mut Emitter, item: &Node, first: bool) -> String {
    let parameters = item.nodes("parameters");
    let mut written = Vec::new();
    let mut structural = "no_arguments".to_owned();
    if parameters.is_empty() {
        written.push("(no_arguments : unit)".to_owned());
    }
    for (index, parameter) in parameters.iter().enumerate() {
        let parameter_name = parameter.str("name").unwrap_or_default();
        if index == 0 {
            structural = parameter_name.to_owned();
        }
        let kind = e.type_name(parameter.str("type").unwrap_or_default());
        written.push(format!("({parameter_name} : {kind})"));
    }
    let opening = if first { "Fixpoint" } else { "with" };
    let function_name = item.str("name").unwrap_or_default();
    let head = format!(
        "{opening} {function_name} {} {{struct {structural}}}",
        written.join(" ")
    );
    if is_procedure(item) {
        format!("{head} : Action unit unit := (")
    } else {
        let returns = e.type_name(item.str("returnType").unwrap_or_default());
        format!("{head} : {returns} := value (")
    }
}

impl EmitterDialect for Rocq {
    fn quote(&self, _e: &Emitter, value: &str) -> String {
        format!("\"{}\"", value.replace('"', "\"\""))
    }

    fn expression_in(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        match expression.kind.as_str() {
            "Interpolation" => {
                let parts = expression.node_list("parts");
                let written = e.interpolation(&parts)?;
                Ok(parenthesized(written, parent))
            }
            "Call" => call(
                e,
                expression.str("callee").unwrap_or_default(),
                &expression.nodes("arguments"),
                parent,
            ),
            "ArrayLiteral" => Ok(format!(
                "[{}]",
                expression
                    .nodes("elements")
                    .iter()
                    .map(|element| e.expression(element))
                    .collect::<Result<Vec<_>>>()?
                    .join("; ")
            )),
            "NewArray" => {
                let length = field(expression, "length")?;
                let fill = field(expression, "fill")?;
                call(e, "filled", &[length, fill], parent)
            }
            "Index" => {
                let array = field(expression, "array")?;
                let index = field(expression, "index")?;
                call(e, "item", &[array, index], parent)
            }
            "Length" => call(e, "size", &[field(expression, "array")?], parent),
            _ => e.base_expression_in(expression, parent),
        }
    }

    fn binary(&self, e: &mut Emitter, expression: &Node, parent: f64) -> Result<String> {
        let operator = expression.str("operator").unwrap_or_default();
        let left = field(expression, "left")?;
        let right = field(expression, "right")?;
        match operator {
            "divide" => return call(e, "Z.quot", &[left, right], parent),
            "remainder" => return call(e, "Z.rem", &[left, right], parent),
            "and" | "or" => return logical(e, expression, parent),
            "notEqual" => {
                let equal = expression.clone().with("operator", "equal");
                let written = e.binary(&equal, 0.0)?;
                return Ok(applied(format!("negb ({written})"), parent));
            }
            _ => {}
        }
        let spelled = comparison(operator).or(if operator == "equal" {
            e.syntax.operators.equal
        } else {
            None
        });
        match spelled {
            Some(spelled) => {
                let left = e.expression_in(left, 5.0)?;
                let right = e.expression_in(right, 5.0)?;
                Ok(parenthesized(format!("{left} {spelled} {right}"), parent))
            }
            None => e.base_binary(expression, parent),
        }
    }

    /// "text " ++ show value: text joined with the shown values.
    fn interpolation(&self, e: &mut Emitter, parts: &[Node]) -> Result<String> {
        Ok(parts
            .iter()
            .map(|part| {
                if part.is("Text") {
                    Ok(e.quote(part.str("value").unwrap_or_default()))
                } else {
                    Ok(format!("show {}", e.expression_in(part, 8.0)?))
                }
            })
            .collect::<Result<Vec<_>>>()?
            .join(" ++ "))
    }

    fn statement(&self, e: &mut Emitter, statement: &Node) -> Result<()> {
        match statement.kind.as_str() {
            "Print" => {
                let printer = if statement.flag("newline") == Some(true) {
                    "print_line"
                } else {
                    "print"
                };
                let value = printed(e, field(statement, "value")?)?;
                e.line(&format!("{printer} {value} ;;"));
            }
            "Evaluate" => {
                // A value nobody reads is bound to _.
                let expression = field(statement, "expression")?;
                let line = if expression.str("type").is_some_and(|kind| kind != "nothing") {
                    format!("let _ := {} in", e.expression(expression)?)
                } else {
                    format!("call {} ;;", e.expression_in(expression, 8.0)?)
                };
                e.line(&line);
            }
            "Return" => {
                let value = match statement.node("value") {
                    Some(value) => e.expression_in(value, 8.0)?,
                    None => "tt".to_owned(),
                };
                let more = if statement.flag("final") == Some(true) {
                    ""
                } else {
                    " ;;"
                };
                e.line(&format!("stop {value}{more}"));
            }
            "Declaration" => {
                let line = declaration(e, statement)?;
                e.line(&line);
            }
            "Assignment" => {
                let variable = statement.str("name").unwrap_or_default();
                let value = e.expression(field(statement, "value")?)?;
                e.line(&format!("let {variable} := {value} in"));
            }
            "IndexAssignment" => {
                let array = statement.str("name").unwrap_or_default();
                let index = e.expression_in(field(statement, "index")?, 8.0)?;
                let value = e.expression_in(field(statement, "value")?, 8.0)?;
                e.line(&format!(
                    "let {array} := with_item {array} {index} {value} in"
                ));
            }
            "If" => if_statement_lines(e, statement)?,
            "While" => while_lines(e, statement)?,
            "CountingLoop" => counting_lines(e, statement)?,
            _ => e.base_statement(statement)?,
        }
        Ok(())
    }

    fn function_definition(&self, e: &mut Emitter, item: &Node) -> Result<()> {
        for comment in item.texts("comments") {
            e.comment(&comment);
        }
        let function_name = item.str("name").unwrap_or_default();
        let group = e.state::<Writing>().group.clone();
        let first = group
            .as_ref()
            .is_none_or(|(first, _)| first == function_name);
        let last = group.as_ref().is_none_or(|(_, last)| last == function_name);
        if first {
            e.line("#[bypass_check(guard)]");
        }
        let heading = signature(e, item, first);
        e.line(&heading);
        let ending = if is_procedure(item) {
            "pure tt"
        } else {
            "stop default"
        };
        action(e, Some(field(item, "body")?), ending)?;
        append(e, if last { ")." } else { ")" });
        Ok(())
    }

    /// Functions that call a function defined after them are one group.
    fn program(&self, e: &mut Emitter, program: &Node) -> Result<String> {
        e.unit = "  ";
        let functions = program.node_list("functions");
        if !later_calls(&functions).is_empty() {
            let spelled = |item: Option<&Node>| {
                item.and_then(|item| item.str("name"))
                    .unwrap_or_default()
                    .to_owned()
            };
            e.state::<Writing>().group =
                Some((spelled(functions.first()), spelled(functions.last())));
        }
        let written = e.base_program(program)?;
        Ok(format!(
            "{}\n{written}",
            e.syntax.header.unwrap_or_default()
        ))
    }

    fn main(&self, e: &mut Emitter, program: &Node) -> Result<()> {
        for comment in program.texts("mainComments") {
            e.comment(&comment);
        }
        e.line("Definition main : Action unit unit := (");
        action(e, Some(field(program, "main")?), "pure tt")?;
        append(e, ").");
        e.line("");
        e.line("Eval vm_compute in run main.");
        Ok(())
    }
}
