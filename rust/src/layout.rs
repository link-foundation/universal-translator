//! Layout: the concrete syntax a translation keeps from its source.
//!
//! The grammar reads a source into a meta tree and writes the target from
//! it, so the target is laid out the way its emitter writes every program.
//! This pass gives the target the whitespace of the source back, as far as
//! the two texts share tokens (a concrete syntax tree view of both sides):
//! the spaces between tokens next to each other on both sides, the step of
//! indentation, the blank lines between lines and around the code, and the
//! line ends. It also maps the lines of the target to the lines of the
//! source, which the web demo uses to keep both editors in step.
//!
//! This is a port of `js/src/translation/layout.js`, step by step, so both
//! write the same characters.

use std::collections::{BTreeMap, HashMap, HashSet};

use crate::formal::languages::Syntax;

fn is_gap(c: char) -> bool {
    (c as u32) <= 0x20 && c != '\n' && c != '\r'
}

fn is_word_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_' || c == '$' || (c as u32) > 0x7f
}

const OPENING: &[char] = &['(', '[', '{'];
const CLOSING: &[char] = &[')', ']', '}'];
const SEPARATORS: &[char] = &[',', ';'];
/// Marks that hold the tokens around them together: member access, labels,
/// annotations, character literals.
const STICKY: &[char] = &['.', ':', '@', '#', '\'', '`', '\\', '?', '%', '&'];

/// The kind of a layout token.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Comment,
    String,
    Word,
    Operator,
    Open,
    Close,
    Separator,
    Sticky,
}

fn mark_kind(c: char) -> Kind {
    if OPENING.contains(&c) {
        Kind::Open
    } else if CLOSING.contains(&c) {
        Kind::Close
    } else if SEPARATORS.contains(&c) {
        Kind::Separator
    } else {
        Kind::Sticky
    }
}

fn is_operator_char(c: char) -> bool {
    !is_word_char(c)
        && (c as u32) > 0x20
        && !OPENING.contains(&c)
        && !CLOSING.contains(&c)
        && !SEPARATORS.contains(&c)
        && !STICKY.contains(&c)
}

/// Names are matched the way naming conventions spell them: totalCount,
/// total_count, TotalCount and $total are one name.
fn word_key(chars: &[char]) -> String {
    let key: String = chars
        .iter()
        .filter(|c| **c != '_' && **c != '$')
        .map(|c| c.to_ascii_lowercase())
        .collect();
    if key.is_empty() {
        chars.iter().collect()
    } else {
        key
    }
}

/// Languages whose meaning changes with the spaces inside a line.
const SPACE_SENSITIVE: &[&str] = &["bash"];

fn count_breaks(chars: &[char]) -> usize {
    chars.iter().filter(|c| **c == '\n').count()
}

fn starts_at(chars: &[char], index: usize, mark: &[char]) -> bool {
    mark.iter()
        .enumerate()
        .all(|(offset, c)| chars.get(index + offset) == Some(c))
}

/// The token marks of a language: line and block comments, string quotes.
#[derive(Clone, Debug, Default)]
pub struct Marks {
    pub line_comment: Option<Vec<char>>,
    pub block_comment: Option<(Vec<char>, Vec<char>)>,
    pub quotes: Vec<char>,
    pub doubled_quotes: bool,
}

impl Marks {
    pub fn of(syntax: &Syntax) -> Self {
        Marks {
            line_comment: (!syntax.line_comment.is_empty())
                .then(|| syntax.line_comment.chars().collect()),
            block_comment: syntax
                .block_comment
                .map(|(open, close)| (open.chars().collect(), close.chars().collect())),
            quotes: syntax.quotes.to_vec(),
            doubled_quotes: syntax.doubled_quotes,
        }
    }
}

fn trim_spaces(chars: &[char]) -> String {
    let mut start = 0;
    let mut end = chars.len();
    while start < end && is_gap(chars[start]) {
        start += 1;
    }
    while end > start && (is_gap(chars[end - 1]) || chars[end - 1] == '\r') {
        end -= 1;
    }
    chars[start..end].iter().collect()
}

fn run_while(chars: &[char], index: usize, test: impl Fn(char) -> bool) -> usize {
    let mut end = index;
    while end < chars.len() && test(chars[end]) {
        end += 1;
    }
    end
}

fn read_block_comment(
    chars: &[char],
    index: usize,
    marks: &Marks,
) -> Option<(Kind, usize, String)> {
    let (open, close) = marks.block_comment.as_ref()?;
    if !starts_at(chars, index, open) {
        return None;
    }
    let mut end = index + open.len();
    while end < chars.len() && !starts_at(chars, end, close) {
        end += 1;
    }
    end = chars.len().min(end + close.len());
    let inner_start = index + open.len();
    let inner_end = inner_start.max(end.saturating_sub(close.len()));
    let inner = &chars[inner_start.min(chars.len())..inner_end.min(chars.len())];
    Some((Kind::Comment, end, format!("c{}", trim_spaces(inner))))
}

fn read_line_comment(chars: &[char], index: usize, marks: &Marks) -> Option<(Kind, usize, String)> {
    let mark = marks.line_comment.as_ref()?;
    if !starts_at(chars, index, mark) {
        return None;
    }
    let mut end = run_while(chars, index, |c| c != '\n');
    while end > index && chars[end - 1] == '\r' {
        end -= 1;
    }
    let text = trim_spaces(&chars[(index + mark.len()).min(end)..end]);
    Some((Kind::Comment, end, format!("c{text}")))
}

fn read_string(chars: &[char], index: usize, marks: &Marks) -> Option<(Kind, usize, String)> {
    let quote = chars[index];
    if !marks.quotes.contains(&quote) {
        return None;
    }
    let mut end = index + 1;
    while end < chars.len() && chars[end] != quote {
        end += if chars[end] == '\\' && !marks.doubled_quotes {
            2
        } else {
            1
        };
    }
    end = chars.len().min(end + 1);
    let inner_end = (index + 1).max(end - 1);
    let inner: String = chars[index + 1..inner_end].iter().collect();
    Some((Kind::String, end, format!("s{inner}")))
}

fn read_token(chars: &[char], index: usize, marks: &Marks) -> (Kind, usize, String) {
    let c = chars[index];
    read_block_comment(chars, index, marks)
        .or_else(|| read_line_comment(chars, index, marks))
        .or_else(|| read_string(chars, index, marks))
        .unwrap_or_else(|| {
            if is_word_char(c) {
                let end = run_while(chars, index, is_word_char);
                (
                    Kind::Word,
                    end,
                    format!("w{}", word_key(&chars[index..end])),
                )
            } else if is_operator_char(c) {
                // Operators are runs of marks, so += is not read as + and =.
                let end = run_while(chars, index, is_operator_char);
                let text: String = chars[index..end].iter().collect();
                (Kind::Operator, end, format!("p{text}"))
            } else {
                (mark_kind(c), index + 1, format!("p{c}"))
            }
        })
}

/// A token with its character offsets and the 0-based lines of its first
/// and last character.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Token {
    pub kind: Kind,
    pub start: usize,
    pub end: usize,
    pub line: usize,
    pub last: usize,
    pub key: String,
}

/// Cut a text into tokens.
pub fn layout_tokens(chars: &[char], marks: &Marks) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut line = 0;
    let mut index = 0;
    while index < chars.len() {
        let c = chars[index];
        if c == '\n' || c == '\r' || is_gap(c) {
            line += usize::from(c == '\n');
            index += 1;
            continue;
        }
        let (kind, end, key) = read_token(chars, index, marks);
        let last = line + count_breaks(&chars[index..end]);
        tokens.push(Token {
            kind,
            start: index,
            end,
            line,
            last,
            key,
        });
        line = last;
        index = end;
    }
    tokens
}

type Range = (usize, usize, usize, usize);

/// Tokens that occur once in both ranges, in an order both ranges agree on
/// (the longest increasing run of their target positions).
fn unique_anchors(a: &[usize], b: &[usize], (a0, a1, b0, b1): Range) -> Vec<(usize, usize)> {
    // id -> (count in a, count in b, last j)
    let mut counts: HashMap<usize, (usize, usize, usize)> = HashMap::new();
    for &id in &a[a0..a1] {
        counts.entry(id).or_insert((0, 0, 0)).0 += 1;
    }
    for (j, id) in b.iter().enumerate().take(b1).skip(b0) {
        if let Some(count) = counts.get_mut(id) {
            count.1 += 1;
            count.2 = j;
        }
    }
    let candidates: Vec<(usize, usize)> = (a0..a1)
        .filter_map(|i| {
            let (in_a, in_b, j) = counts[&a[i]];
            (in_a == 1 && in_b == 1).then_some((i, j))
        })
        .collect();
    let mut tails: Vec<usize> = Vec::new();
    let mut previous: Vec<Option<usize>> = vec![None; candidates.len()];
    for (k, &(_, j)) in candidates.iter().enumerate() {
        let low = tails.partition_point(|&tail| candidates[tail].1 < j);
        previous[k] = if low > 0 { Some(tails[low - 1]) } else { None };
        if low == tails.len() {
            tails.push(k);
        } else {
            tails[low] = k;
        }
    }
    let mut anchors = Vec::new();
    let mut k = tails.last().copied();
    while let Some(at) = k {
        anchors.push(candidates[at]);
        k = previous[at];
    }
    anchors.reverse();
    anchors
}

/// The largest table of the longest common subsequence (cells).
const TABLE_LIMIT: usize = 1_000_000;

fn common_subsequence(
    a: &[usize],
    b: &[usize],
    (a0, a1, b0, b1): Range,
    pairs: &mut Vec<(usize, usize)>,
) {
    let n = a1 - a0;
    let m = b1 - b0;
    if n * m > TABLE_LIMIT {
        return;
    }
    let width = m + 1;
    let mut table = vec![0u32; (n + 1) * width];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            table[i * width + j] = if a[a0 + i] == b[b0 + j] {
                table[(i + 1) * width + j + 1] + 1
            } else {
                table[(i + 1) * width + j].max(table[i * width + j + 1])
            };
        }
    }
    let (mut i, mut j) = (0, 0);
    while i < n && j < m {
        if a[a0 + i] == b[b0 + j] {
            pairs.push((a0 + i, b0 + j));
            i += 1;
            j += 1;
        } else if table[(i + 1) * width + j] >= table[i * width + j + 1] {
            i += 1;
        } else {
            j += 1;
        }
    }
}

fn align_range(a: &[usize], b: &[usize], range: Range, pairs: &mut Vec<(usize, usize)>) {
    let (mut a0, mut a1, mut b0, mut b1) = range;
    while a0 < a1 && b0 < b1 && a[a0] == b[b0] {
        pairs.push((a0, b0));
        a0 += 1;
        b0 += 1;
    }
    let mut suffix = Vec::new();
    while a0 < a1 && b0 < b1 && a[a1 - 1] == b[b1 - 1] {
        a1 -= 1;
        b1 -= 1;
        suffix.push((a1, b1));
    }
    suffix.reverse();
    if a0 < a1 && b0 < b1 {
        let anchors = unique_anchors(a, b, (a0, a1, b0, b1));
        if anchors.is_empty() {
            common_subsequence(a, b, (a0, a1, b0, b1), pairs);
        } else {
            let (mut from_a, mut from_b) = (a0, b0);
            for (i, j) in anchors {
                align_range(a, b, (from_a, i, from_b, j), pairs);
                pairs.push((i, j));
                from_a = i + 1;
                from_b = j + 1;
            }
            align_range(a, b, (from_a, a1, from_b, b1), pairs);
        }
    }
    pairs.extend(suffix);
}

/// Pairs (source token, target token) of equal tokens, in order.
pub fn align_tokens<'a>(source: &'a [Token], target: &'a [Token]) -> Vec<(usize, usize)> {
    let mut ids: HashMap<&str, usize> = HashMap::new();
    let mut id_of = |tokens: &'a [Token]| -> Vec<usize> {
        tokens
            .iter()
            .map(|token| {
                let next = ids.len();
                *ids.entry(token.key.as_str()).or_insert(next)
            })
            .collect()
    };
    let a = id_of(source);
    let b = id_of(target);
    let mut pairs = Vec::new();
    align_range(&a, &b, (0, a.len(), 0, b.len()), &mut pairs);
    pairs
}

fn word_like(kind: Kind) -> bool {
    matches!(kind, Kind::Word | Kind::String)
}

fn spaces_only(gap: &[char]) -> bool {
    gap.iter().all(|c| *c == ' ' || *c == '\t')
}

/// Whether the spaces between two target tokens may become `wanted`.
fn may_respace(left: Kind, right: Kind, wanted: &[char], present: &[char]) -> bool {
    if left == Kind::Sticky || right == Kind::Sticky {
        return false;
    }
    if !wanted.is_empty() && !present.is_empty() {
        return true;
    }
    if left == Kind::Comment || right == Kind::Comment {
        return false;
    }
    !((word_like(left) && word_like(right))
        || (left == Kind::Operator && right == Kind::Operator)
        || (left == Kind::Word && right == Kind::Open))
}

/// The offset of the first line that holds content.
fn first_content(chars: &[char]) -> Option<usize> {
    let mut start = 0;
    for (index, c) in chars.iter().enumerate() {
        if *c == '\n' {
            start = index + 1;
        } else if !is_gap(*c) && *c != '\r' {
            return Some(start);
        }
    }
    None
}

fn last_content(chars: &[char]) -> usize {
    let mut end = chars.len();
    while end > 0 && (is_gap(chars[end - 1]) || chars[end - 1] == '\n' || chars[end - 1] == '\r') {
        end -= 1;
    }
    end
}

fn leading_spaces(line: &str) -> &str {
    let count = line.chars().take_while(|c| *c == ' ' || *c == '\t').count();
    &line[..count]
}

fn blank_line(line: &str) -> bool {
    line.chars().all(is_gap)
}

/// The step of indentation of a text: the shortest indentation of a line
/// that holds code, made of one kind of space.
fn indent_unit(lines: &[String], inside: &HashSet<usize>, offset: usize) -> String {
    let mut unit = "";
    for (index, line) in lines.iter().enumerate() {
        let spaces = leading_spaces(line);
        if !spaces.is_empty()
            && !blank_line(line)
            && !inside.contains(&(index + offset))
            && (unit.is_empty() || spaces.len() < unit.len())
        {
            unit = spaces;
        }
    }
    let first = unit.chars().next();
    if unit.chars().all(|c| Some(c) == first) {
        unit.to_owned()
    } else {
        String::new()
    }
}

/// A line indented by whole steps of `from` is indented by as many steps of
/// `to`.
fn reindent(line: &str, from: &str, to: &str) -> String {
    let spaces = leading_spaces(line);
    if spaces.len().is_multiple_of(from.len()) && spaces == from.repeat(spaces.len() / from.len()) {
        format!(
            "{}{}",
            to.repeat(spaces.len() / from.len()),
            &line[spaces.len()..]
        )
    } else {
        line.to_owned()
    }
}

/// Lines strictly inside tokens that run over several lines (strings, block
/// comments): their blank lines belong to the token.
fn inside_lines(tokens: &[Token]) -> HashSet<usize> {
    tokens
        .iter()
        .flat_map(|token| token.line + 1..=token.last)
        .collect()
}

/// The source lines each target line holds tokens of: (first, last).
fn line_spans(
    pairs: &[(usize, usize)],
    source: &[Token],
    target: &[Token],
) -> BTreeMap<usize, (usize, usize)> {
    let mut spans: BTreeMap<usize, (usize, usize)> = BTreeMap::new();
    for &(i, j) in pairs {
        let line = source[i].line;
        spans
            .entry(target[j].line)
            .and_modify(|span| *span = (span.0.min(line), span.1.max(line)))
            .or_insert((line, line));
    }
    spans
}

struct Side {
    chars: Vec<char>,
    tokens: Vec<Token>,
}

/// The spaces between tokens next to each other on both sides.
fn respaced_gaps(
    pairs: &[(usize, usize)],
    source: &Side,
    target: &Side,
    language: &str,
) -> HashMap<usize, String> {
    let mut gaps = HashMap::new();
    if SPACE_SENSITIVE.contains(&language) {
        return gaps;
    }
    // Target tokens j whose gap to j + 1 lies between aligned tokens.
    let aligned: HashSet<usize> = pairs
        .windows(2)
        .filter(|pair| pair[1].0 == pair[0].0 + 1 && pair[1].1 == pair[0].1 + 1)
        .map(|pair| pair[0].1)
        .collect();
    let kind = |j: usize| target.tokens.get(j).map(|token| token.kind);
    for &(i, j) in pairs {
        // An operator takes the spaces of the source on both sides or on
        // none, so a half aligned operator is not spaced on one side only.
        if !aligned.contains(&j)
            || (kind(j) == Some(Kind::Operator) && (j == 0 || !aligned.contains(&(j - 1))))
            || (kind(j + 1) == Some(Kind::Operator) && !aligned.contains(&(j + 1)))
        {
            continue;
        }
        let wanted = &source.chars[source.tokens[i].end..source.tokens[i + 1].start];
        let present = &target.chars[target.tokens[j].end..target.tokens[j + 1].start];
        if spaces_only(wanted)
            && spaces_only(present)
            && wanted != present
            && may_respace(
                target.tokens[j].kind,
                target.tokens[j + 1].kind,
                wanted,
                present,
            )
        {
            gaps.insert(j, wanted.iter().collect());
        }
    }
    gaps
}

/// The target text from its first content line to its last content
/// character, with the gaps replaced.
fn respaced_body(target: &Side, start: usize, gaps: &HashMap<usize, String>) -> String {
    let mut text = String::new();
    let mut at = start;
    for (j, token) in target.tokens.iter().enumerate() {
        text.extend(&target.chars[at.min(token.end)..token.end]);
        at = token.end;
        if let Some(gap) = gaps.get(&j) {
            text.push_str(gap);
            at = target.tokens[j + 1].start;
        }
    }
    let end = last_content(&target.chars);
    text.extend(&target.chars[at..at.max(end)]);
    text
}

/// A translation with the whitespace of its source, and the 0-based lines
/// of the target matched to the lines of the source.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Layout {
    pub text: String,
    pub lines: Vec<(usize, usize)>,
}

fn map_lines(
    pairs: &[(usize, usize)],
    source: &[Token],
    target: &[Token],
    target_line: impl Fn(usize) -> usize,
) -> Vec<(usize, usize)> {
    let mut lines: Vec<(usize, usize)> = Vec::new();
    for &(i, j) in pairs {
        let pair = (source[i].line, target_line(target[j].line));
        if lines.last() != Some(&pair) {
            lines.push(pair);
        }
    }
    lines
}

/// The blank lines of the source between two target lines that hold the
/// tokens of two source lines with only blank lines between them.
struct Blanks<'a> {
    spans: BTreeMap<usize, (usize, usize)>,
    inside_source: HashSet<usize>,
    inside_target: &'a HashSet<usize>,
    source_lines: &'a [&'a str],
    target_lead: usize,
}

impl Blanks<'_> {
    fn wanted(&self, previous: usize, current: usize) -> Option<Vec<String>> {
        let (before, after) = (previous + self.target_lead, current + self.target_lead);
        if (before + 1..=after).any(|line| self.inside_target.contains(&line)) {
            return None;
        }
        let (first, second) = (self.spans.get(&before)?, self.spans.get(&after)?);
        if second.0 <= first.1 {
            return None;
        }
        if (first.1 + 1..=second.0).any(|line| self.inside_source.contains(&line)) {
            return None;
        }
        let between = &self.source_lines[first.1 + 1..second.0];
        between
            .iter()
            .all(|line| blank_line(line))
            .then(|| between.iter().map(|line| (*line).to_owned()).collect())
    }
}

/// Whether a text ends its lines with CRLF only.
fn crlf_only(text: &str) -> bool {
    let chars: Vec<char> = text.chars().collect();
    text.contains("\r\n")
        && chars
            .iter()
            .enumerate()
            .all(|(index, c)| *c != '\n' || (index > 0 && chars[index - 1] == '\r'))
}

/// Give `target` the whitespace of `source`. `from` and `to` are the token
/// marks of their languages; `language` is the target language without its
/// version. `respace: false` only maps the lines.
pub fn transfer_layout(
    source: &str,
    target: &str,
    from: &Marks,
    to: &Marks,
    respace: bool,
    language: &str,
) -> Layout {
    let source_chars: Vec<char> = source.chars().collect();
    let target_chars: Vec<char> = target.chars().collect();
    let source_side = Side {
        tokens: layout_tokens(&source_chars, from),
        chars: source_chars,
    };
    let target_side = Side {
        tokens: layout_tokens(&target_chars, to),
        chars: target_chars,
    };
    let pairs = align_tokens(&source_side.tokens, &target_side.tokens);
    let (source_start, target_start) = match (
        first_content(&source_side.chars),
        first_content(&target_side.chars),
    ) {
        (Some(source_start), Some(target_start)) if respace => (source_start, target_start),
        _ => {
            return Layout {
                text: target.to_owned(),
                lines: map_lines(&pairs, &source_side.tokens, &target_side.tokens, |line| {
                    line
                }),
            };
        }
    };
    let gaps = respaced_gaps(&pairs, &source_side, &target_side, language);
    let mut body: Vec<String> = respaced_body(&target_side, target_start, &gaps)
        .split('\n')
        .map(str::to_owned)
        .collect();
    let source_lines: Vec<&str> = source
        .split('\n')
        .map(|line| line.strip_suffix('\r').unwrap_or(line))
        .collect();
    let inside_source = inside_lines(&source_side.tokens);
    let inside_target = inside_lines(&target_side.tokens);
    let target_lead = count_breaks(&target_side.chars[..target_start]);
    // Indentation in the steps of the source (two spaces, a tab).
    let owned_source: Vec<String> = source_lines.iter().map(|line| (*line).to_owned()).collect();
    let source_unit = indent_unit(&owned_source, &inside_source, 0);
    let target_unit = indent_unit(&body, &inside_target, target_lead);
    if !source_unit.is_empty() && !target_unit.is_empty() && source_unit != target_unit {
        for (index, line) in body.iter_mut().enumerate() {
            if !inside_target.contains(&(index + target_lead)) {
                *line = reindent(line, &target_unit, &source_unit);
            }
        }
    }
    let blanks = Blanks {
        spans: line_spans(&pairs, &source_side.tokens, &target_side.tokens),
        inside_source,
        inside_target: &inside_target,
        source_lines: &source_lines,
        target_lead,
    };
    let mut lines: Vec<String> = Vec::new();
    let mut placed: HashMap<usize, usize> = HashMap::new();
    let mut previous: Option<usize> = None;
    for (index, line) in body.iter().enumerate() {
        if blank_line(line) && !inside_target.contains(&(index + target_lead)) {
            continue;
        }
        if let Some(previous) = previous {
            match blanks.wanted(previous, index) {
                Some(wanted) => lines.extend(wanted),
                None => lines.extend(body[previous + 1..index].iter().cloned()),
            }
        }
        placed.insert(index + target_lead, lines.len());
        lines.push(line.clone());
        previous = Some(index);
    }
    // Blank lines around the code, as the source has them.
    let lead: String = source_side.chars[..source_start].iter().collect();
    let breaks = count_breaks(&source_side.chars[last_content(&source_side.chars)..]);
    let mut text = format!("{lead}{}{}", lines.join("\n"), "\n".repeat(breaks.max(1)));
    if crlf_only(source) {
        text = text.replace("\r\n", "\n").replace('\n', "\r\n");
    }
    let source_lead = count_breaks(&source_side.chars[..source_start]);
    let lines = map_lines(&pairs, &source_side.tokens, &target_side.tokens, |line| {
        placed.get(&line).copied().unwrap_or(0) + source_lead
    });
    Layout { text, lines }
}
