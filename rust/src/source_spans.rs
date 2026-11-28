//! Half-open UTF-8 source spans shared by readers and region mapping.

pub(crate) type Span = (usize, usize);

pub(crate) fn merge(mut spans: Vec<Span>) -> Vec<Span> {
    spans.sort_unstable();
    let mut result: Vec<Span> = Vec::new();
    for (start, end) in spans {
        if start >= end {
            continue;
        }
        if let Some(last) = result.last_mut().filter(|last| start <= last.1) {
            last.1 = last.1.max(end);
        } else {
            result.push((start, end));
        }
    }
    result
}

pub(crate) fn subtract(spans: &[Span], excluded: Vec<Span>) -> Vec<Span> {
    let cuts = merge(excluded);
    let mut result = Vec::new();
    for &(start, end) in spans {
        let mut at = start;
        for &(left, right) in &cuts {
            if right <= at || left >= end {
                continue;
            }
            if left > at {
                result.push((at, left));
            }
            at = at.max(right);
        }
        if at < end {
            result.push((at, end));
        }
    }
    result
}

pub(crate) struct Line {
    pub(crate) start: usize,
    pub(crate) end: usize,
    pub(crate) indent: usize,
}

pub(crate) fn lines(source: &str) -> Vec<Line> {
    let mut at = 0;
    source
        .split('\n')
        .map(|line| {
            let text = line.strip_suffix('\r').unwrap_or(line);
            let result = Line {
                start: at,
                end: at + text.len(),
                indent: text.len() - text.trim_start().len(),
            };
            at += line.len() + 1;
            result
        })
        .collect()
}

pub(crate) fn remap(
    spans: &[Span],
    before: &[Line],
    after: &[Line],
    positions: &[Option<usize>],
) -> Vec<Span> {
    let mut result = Vec::new();
    for (row, original) in positions.iter().enumerate() {
        let Some(old) = before.get(row) else { continue };
        let Some(current) = original.and_then(|row| after.get(row - 1)) else {
            continue;
        };
        for &(start, end) in spans {
            let left = start.max(old.start + old.indent);
            let right = end.min(old.end);
            if left < right {
                let offset = |at: usize| {
                    (current.start + current.indent + at - old.start - old.indent).min(current.end)
                };
                result.push((offset(left), offset(right)));
            }
        }
    }
    merge(result)
}
