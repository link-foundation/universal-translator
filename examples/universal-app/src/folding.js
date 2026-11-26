// Where a text can be folded, for every language the translator knows
// (issue 14). Monaco has grammars for a few dozen languages; the panes are
// coloured by highlight.js instead, so their folding regions are found
// here the same way for all of them:
//
// - brackets: ( [ { opened on one line and closed on a later one, outside
//   strings and comments; a closing bracket that starts its line stays
//   visible, like an `end` or a `}` in a code editor;
// - indentation: a line followed by lines indented deeper (Python, YAML,
//   the indented controlled natural languages, Links Notation);
// - comments: two or more comment lines in a row.
//
// Lines are 1-based, as Monaco counts them. Without a lexicon (a pane that
// shows an error) every bracket counts.

import { highlightText } from './highlight.js';

const pairs = { ')': '(', ']': '[', '}': '{' };
const skipped = new Set(['string', 'comment']);

// The type of every character of a line ('' where nothing is coloured).
function typesOf(line, tokens = []) {
  const types = new Array(line.length).fill('');
  tokens.forEach(({ from, type }, index) => {
    const to = tokens[index + 1]?.from ?? line.length;
    types.fill(type, from, to);
  });
  return types;
}

function bracketRanges(lines, tokens) {
  const ranges = [];
  const open = [];
  lines.forEach((line, index) => {
    const types = typesOf(line, tokens?.[index]);
    [...line].forEach((char, at) => {
      if (skipped.has(types[at])) {
        return;
      }
      if (char === '(' || char === '[' || char === '{') {
        open.push({ char, line: index });
        return;
      }
      const wanted = pairs[char];
      if (!wanted) {
        return;
      }
      // An unmatched closing bracket ends the brackets opened after its
      // partner, so a typo does not swallow the rest of the text.
      const partner = open.findLastIndex((it) => it.char === wanted);
      if (partner < 0) {
        return;
      }
      const start = open[partner].line;
      open.length = partner;
      const end = line.slice(0, at).trim() === '' ? index - 1 : index;
      if (end > start) {
        ranges.push({ start: start + 1, end: end + 1 });
      }
    });
  });
  return ranges;
}

const indentOf = (line) => line.match(/^[ \t]*/)[0].replace(/\t/g, '    ');

function indentRanges(lines) {
  const ranges = [];
  // Lines with text, and how deep each is indented.
  const content = lines
    .map((line, index) => ({ index, depth: indentOf(line).length, line }))
    .filter(({ line }) => line.trim() !== '');
  const open = [];
  const close = (depth) => {
    while (open.length && open.at(-1).depth >= depth) {
      const { index, last } = open.pop();
      if (last > index) {
        ranges.push({ start: index + 1, end: last + 1 });
      }
    }
  };
  for (const { index, depth } of content) {
    close(depth);
    for (const it of open) {
      it.last = index;
    }
    open.push({ index, depth, last: index });
  }
  close(-1);
  return ranges;
}

function commentRanges(lines, tokens) {
  const ranges = [];
  let start = -1;
  // A line whose every visible character is part of a comment.
  const isComment = (index) => {
    const types = typesOf(lines[index], tokens?.[index]);
    const visible = [...lines[index]]
      .map((char, at) => (char.trim() ? types[at] : undefined))
      .filter((type) => type !== undefined);
    return visible.length > 0 && visible.every((type) => type === 'comment');
  };
  for (let index = 0; index <= lines.length; index += 1) {
    if (index < lines.length && isComment(index)) {
      start = start < 0 ? index : start;
      continue;
    }
    if (start >= 0 && index - 1 > start) {
      ranges.push({ start: start + 1, end: index, kind: 'comment' });
    }
    start = -1;
  }
  return ranges;
}

// [{ start, end, kind? }], one region per start line (the longest), in
// the order of their start lines.
export function foldingRanges(text, lexicon) {
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  let tokens;
  try {
    tokens = lexicon ? highlightText(text, lexicon) : undefined;
  } catch {
    tokens = undefined;
  }
  const byStart = new Map();
  for (const range of [
    ...bracketRanges(lines, tokens),
    ...indentRanges(lines),
    ...commentRanges(lines, tokens),
  ]) {
    const known = byStart.get(range.start);
    if (!known || range.end > known.end) {
      byStart.set(range.start, range);
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}
