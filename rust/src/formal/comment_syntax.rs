//! A block-comment scanner shared by semantic reading and concrete layout.
//! Nesting uses a counter, so source depth does not consume call-stack space.
pub(crate) fn block_comment_end(
    chars: &[char],
    index: usize,
    open: &[char],
    close: &[char],
    nested: bool,
    comment_strings: bool,
) -> (usize, bool) {
    let matches = |at: usize, mark: &[char]| chars.get(at..at + mark.len()) == Some(mark);
    let mut end = index + open.len();
    let mut depth = 1;
    let mut quoted = false;
    while end < chars.len() && depth > 0 {
        if comment_strings && chars[end] == '"' {
            quoted = !quoted;
            end += 1;
        } else if quoted {
            end += 1;
        } else if nested && matches(end, open) {
            depth += 1;
            end += open.len();
        } else if matches(end, close) {
            depth -= 1;
            end += close.len();
        } else {
            end += 1;
        }
    }
    (end, depth == 0)
}
