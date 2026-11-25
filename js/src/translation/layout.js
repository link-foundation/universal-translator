// Layout: the concrete syntax a translation keeps from its source.
//
// The grammar reads a source into a meta tree and writes the target from
// it, so the target is laid out the way its emitter writes every program.
// This pass gives the target the whitespace of the source back, as far as
// the two texts share tokens (a concrete syntax tree view of both sides):
//
// - both texts are cut into the same kind of tokens (words, strings,
//   comments, punctuation) with the comment and quote marks of their
//   languages;
// - the tokens are aligned (common prefix and suffix, tokens that occur
//   once on both sides as anchors, a longest common subsequence between
//   them);
// - two tokens next to each other on one line of the source and of the
//   target take the spaces of the source between them, unless the change
//   could join two tokens into one or turn a call into a grouping;
// - the blank lines before the first and after the last line of the source
//   are kept.
//
// Indentation and line breaks stay as the target writes them: they carry
// the block structure of languages such as Python. The same alignment also
// maps every line of the target to the lines of the source it comes from,
// which the web demo uses to keep both editors in step.
//
// The Rust port (rust/src/layout.rs) follows this file step by step, so
// both write the same characters.

const newlineChars = new Set(['\n', '\r']);
const isGap = (char) => char.codePointAt(0) <= 0x20 && !newlineChars.has(char);
const isWordChar = (char) =>
  /[A-Za-z0-9_$]/.test(char) || char.codePointAt(0) > 0x7f;

const opening = new Set(['(', '[', '{']);
const closing = new Set([')', ']', '}']);
const separators = new Set([',', ';']);
// Marks that hold the tokens around them together: member access, labels,
// annotations, character literals.
const sticky = new Set(['.', ':', '@', '#', "'", '`', '\\', '?', '%', '&']);

const markKind = (char) => {
  if (opening.has(char)) {
    return 'open';
  }
  if (closing.has(char)) {
    return 'close';
  }
  return separators.has(char) ? 'separator' : 'sticky';
};
const isOperatorChar = (char) =>
  !isWordChar(char) &&
  char.codePointAt(0) > 0x20 &&
  !opening.has(char) &&
  !closing.has(char) &&
  !separators.has(char) &&
  !sticky.has(char);

// Names are matched the way naming conventions spell them: totalCount,
// total_count, TotalCount and $total are one name.
function wordKey(chars) {
  const key = chars
    .filter((char) => char !== '_' && char !== '$')
    .map((char) => (char >= 'A' && char <= 'Z' ? char.toLowerCase() : char))
    .join('');
  return key || chars.join('');
}

// Languages whose meaning changes with the spaces inside a line.
const spaceSensitive = new Set(['bash']);

const countBreaks = (chars) => chars.filter((char) => char === '\n').length;

const startsAt = (chars, index, mark) =>
  [...mark].every((char, offset) => chars[index + offset] === char);

// The token marks of a language: line and block comments, string quotes.
export function layoutSyntax(syntax = {}) {
  return {
    lineComment: syntax.lineComment ? [...syntax.lineComment] : undefined,
    blockComment: syntax.blockComment
      ? syntax.blockComment.map((mark) => [...mark])
      : undefined,
    quotes: syntax.quotes ?? ['"'],
    doubledQuotes: Boolean(syntax.doubledQuotes),
  };
}

const trimSpaces = (chars) => {
  let start = 0;
  let end = chars.length;
  while (start < end && isGap(chars[start])) {
    start += 1;
  }
  while (end > start && (isGap(chars[end - 1]) || chars[end - 1] === '\r')) {
    end -= 1;
  }
  return chars.slice(start, end).join('');
};

const runWhile = (chars, index, test) => {
  let end = index;
  while (end < chars.length && test(chars[end])) {
    end += 1;
  }
  return end;
};

// Readers of one token at an index: [kind, end, key] or undefined.
const tokenReaders = [
  (chars, index, { blockComment }) => {
    if (!blockComment || !startsAt(chars, index, blockComment[0])) {
      return undefined;
    }
    const [open, close] = blockComment;
    let end = index + open.length;
    while (end < chars.length && !startsAt(chars, end, close)) {
      end += 1;
    }
    end = Math.min(chars.length, end + close.length);
    const inner = chars.slice(
      index + open.length,
      Math.max(index + open.length, end - close.length)
    );
    return ['comment', end, `c${trimSpaces(inner)}`];
  },
  (chars, index, { lineComment }) => {
    if (!lineComment || !startsAt(chars, index, lineComment)) {
      return undefined;
    }
    let end = runWhile(chars, index, (char) => char !== '\n');
    while (end > index && chars[end - 1] === '\r') {
      end -= 1;
    }
    const text = trimSpaces(chars.slice(index + lineComment.length, end));
    return ['comment', end, `c${text}`];
  },
  (chars, index, { quotes, doubledQuotes }) => {
    const quote = chars[index];
    if (!quotes.includes(quote)) {
      return undefined;
    }
    let end = index + 1;
    while (end < chars.length && chars[end] !== quote) {
      end += chars[end] === '\\' && !doubledQuotes ? 2 : 1;
    }
    end = Math.min(chars.length, end + 1);
    const inner = chars.slice(index + 1, Math.max(index + 1, end - 1));
    return ['string', end, `s${inner.join('')}`];
  },
  (chars, index) => {
    if (!isWordChar(chars[index])) {
      return undefined;
    }
    const end = runWhile(chars, index, isWordChar);
    return ['word', end, `w${wordKey(chars.slice(index, end))}`];
  },
  // Operators are runs of marks, so += is not read as + and =.
  (chars, index) => {
    if (!isOperatorChar(chars[index])) {
      return undefined;
    }
    const end = runWhile(chars, index, isOperatorChar);
    return ['operator', end, `p${chars.slice(index, end).join('')}`];
  },
  (chars, index) => [markKind(chars[index]), index + 1, `p${chars[index]}`],
];

// Cut a text (an array of characters) into tokens with their character
// offsets and 0-based line numbers (of their first and last character).
export function layoutTokens(chars, marks) {
  const tokens = [];
  let line = 0;
  let index = 0;
  while (index < chars.length) {
    const char = chars[index];
    if (char === '\n' || char === '\r' || isGap(char)) {
      line += char === '\n' ? 1 : 0;
      index += 1;
      continue;
    }
    let read;
    for (const reader of tokenReaders) {
      read ??= reader(chars, index, marks);
    }
    const [kind, end, key] = read;
    const last = line + countBreaks(chars.slice(index, end));
    tokens.push({ kind, start: index, end, line, last, key });
    line = last;
    index = end;
  }
  return tokens;
}

// Tokens that occur once in both ranges, in an order both ranges agree on
// (the longest increasing run of their target positions).
function uniqueAnchors(a, b, [a0, a1, b0, b1]) {
  const counts = new Map();
  for (let i = a0; i < a1; i += 1) {
    const count = counts.get(a[i]) ?? { a: 0, b: 0, i: 0, j: 0 };
    count.a += 1;
    count.i = i;
    counts.set(a[i], count);
  }
  for (let j = b0; j < b1; j += 1) {
    const count = counts.get(b[j]);
    if (count) {
      count.b += 1;
      count.j = j;
    }
  }
  const candidates = [];
  for (let i = a0; i < a1; i += 1) {
    const count = counts.get(a[i]);
    if (count.a === 1 && count.b === 1) {
      candidates.push([i, count.j]);
    }
  }
  const tails = [];
  const previous = [];
  candidates.forEach(([, j], k) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (candidates[tails[middle]][1] < j) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    previous[k] = low > 0 ? tails[low - 1] : -1;
    tails[low] = k;
  });
  const anchors = [];
  for (let k = tails.length ? tails.at(-1) : -1; k >= 0; k = previous[k]) {
    anchors.unshift(candidates[k]);
  }
  return anchors;
}

// The largest table of the longest common subsequence (cells).
const tableLimit = 1_000_000;

function commonSubsequence(a, b, [a0, a1, b0, b1], pairs) {
  const n = a1 - a0;
  const m = b1 - b0;
  if (n * m > tableLimit) {
    return;
  }
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[a0 + i] === b[b0 + j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[a0 + i] === b[b0 + j]) {
      pairs.push([a0 + i, b0 + j]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
}

function alignRange(a, b, range, pairs) {
  let [a0, a1, b0, b1] = range;
  while (a0 < a1 && b0 < b1 && a[a0] === b[b0]) {
    pairs.push([a0, b0]);
    a0 += 1;
    b0 += 1;
  }
  const suffix = [];
  while (a0 < a1 && b0 < b1 && a[a1 - 1] === b[b1 - 1]) {
    a1 -= 1;
    b1 -= 1;
    suffix.unshift([a1, b1]);
  }
  if (a0 < a1 && b0 < b1) {
    const anchors = uniqueAnchors(a, b, [a0, a1, b0, b1]);
    if (anchors.length) {
      let fromA = a0;
      let fromB = b0;
      for (const [i, j] of anchors) {
        alignRange(a, b, [fromA, i, fromB, j], pairs);
        pairs.push([i, j]);
        fromA = i + 1;
        fromB = j + 1;
      }
      alignRange(a, b, [fromA, a1, fromB, b1], pairs);
    } else {
      commonSubsequence(a, b, [a0, a1, b0, b1], pairs);
    }
  }
  pairs.push(...suffix);
}

// Pairs [source token, target token] of equal tokens, in order.
export function alignTokens(sourceTokens, targetTokens) {
  const ids = new Map();
  const id = (token) => {
    if (!ids.has(token.key)) {
      ids.set(token.key, ids.size);
    }
    return ids.get(token.key);
  };
  const a = sourceTokens.map(id);
  const b = targetTokens.map(id);
  const pairs = [];
  alignRange(a, b, [0, a.length, 0, b.length], pairs);
  return pairs;
}

const wordLike = (kind) => kind === 'word' || kind === 'string';
const spacesOnly = (gap) => gap.every((char) => char === ' ' || char === '\t');

// Whether the spaces between two target tokens may become `wanted`.
function mayRespace(left, right, wanted, present) {
  if (left === 'sticky' || right === 'sticky') {
    return false;
  }
  if (wanted.length && present.length) {
    return true;
  }
  if (left === 'comment' || right === 'comment') {
    return false;
  }
  return !(
    (wordLike(left) && wordLike(right)) ||
    (left === 'operator' && right === 'operator') ||
    (left === 'word' && right === 'open')
  );
}

const firstContent = (chars) => {
  let start = 0;
  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] === '\n') {
      start = index + 1;
    } else if (!isGap(chars[index]) && chars[index] !== '\r') {
      return start;
    }
  }
  return -1;
};

const lastContent = (chars) => {
  let end = chars.length;
  while (
    end > 0 &&
    (isGap(chars[end - 1]) || newlineChars.has(chars[end - 1]))
  ) {
    end -= 1;
  }
  return end;
};

const leadingSpaces = (line) => {
  const chars = [...line];
  let count = 0;
  while (
    count < chars.length &&
    (chars[count] === ' ' || chars[count] === '\t')
  ) {
    count += 1;
  }
  return chars.slice(0, count).join('');
};

// The step of indentation of a text: the shortest indentation of a line
// that holds code, made of one kind of space.
function indentUnit(lines, inside, offset) {
  let unit = '';
  lines.forEach((line, index) => {
    const spaces = leadingSpaces(line);
    if (
      spaces &&
      !blankLine(line) &&
      !inside.has(index + offset) &&
      (!unit || spaces.length < unit.length)
    ) {
      unit = spaces;
    }
  });
  return unit && [...unit].every((char) => char === unit[0]) ? unit : '';
}

// A line indented by whole steps of `from` is indented by as many steps of
// `to`.
function reindent(line, from, to) {
  const spaces = leadingSpaces(line);
  const steps = spaces.length / from.length;
  return Number.isInteger(steps) && spaces === from.repeat(steps)
    ? to.repeat(steps) + line.slice(spaces.length)
    : line;
}

const blankLine = (line) => [...line].every((char) => isGap(char));

// Lines strictly inside tokens that run over several lines (strings, block
// comments): their blank lines belong to the token.
function insideLines(tokens) {
  const inside = new Set();
  for (const token of tokens) {
    for (let line = token.line + 1; line <= token.last; line += 1) {
      inside.add(line);
    }
  }
  return inside;
}

// The source lines each target line holds tokens of: [first, last].
function lineSpans(pairs, sourceTokens, targetTokens) {
  const spans = new Map();
  for (const [i, j] of pairs) {
    const line = sourceTokens[i].line;
    const span = spans.get(targetTokens[j].line);
    spans.set(
      targetTokens[j].line,
      span ? [Math.min(span[0], line), Math.max(span[1], line)] : [line, line]
    );
  }
  return spans;
}

// The spaces between tokens next to each other on both sides.
function respacedGaps(pairs, sides, language) {
  const [source, target] = sides;
  const gaps = new Map();
  if (spaceSensitive.has(language)) {
    return gaps;
  }
  // Target tokens j whose gap to j + 1 lies between aligned tokens.
  const aligned = new Set();
  pairs.forEach(([i, j], at) => {
    const next = pairs[at + 1];
    if (next && next[0] === i + 1 && next[1] === j + 1) {
      aligned.add(j);
    }
  });
  const kind = (j) => target.tokens[j].kind;
  pairs.forEach(([i, j]) => {
    // An operator takes the spaces of the source on both sides or on none,
    // so a half aligned operator is not spaced on one side only.
    if (
      !aligned.has(j) ||
      (kind(j) === 'operator' && !aligned.has(j - 1)) ||
      (kind(j + 1) === 'operator' && !aligned.has(j + 1))
    ) {
      return;
    }
    const wanted = source.chars.slice(
      source.tokens[i].end,
      source.tokens[i + 1].start
    );
    const present = target.chars.slice(
      target.tokens[j].end,
      target.tokens[j + 1].start
    );
    if (
      spacesOnly(wanted) &&
      spacesOnly(present) &&
      wanted.join('') !== present.join('') &&
      mayRespace(
        target.tokens[j].kind,
        target.tokens[j + 1].kind,
        wanted,
        present
      )
    ) {
      gaps.set(j, wanted.join(''));
    }
  });
  return gaps;
}

// The target text from its first content line to its last content
// character, with the gaps replaced.
function respacedBody(target, start, gaps) {
  let text = '';
  let at = start;
  target.tokens.forEach((token, j) => {
    text += target.chars.slice(at, token.end).join('');
    at = token.end;
    if (gaps.has(j)) {
      text += gaps.get(j);
      at = target.tokens[j + 1].start;
    }
  });
  const end = lastContent(target.chars);
  return text + target.chars.slice(at, Math.max(at, end)).join('');
}

// The target with the whitespace of the source, and the lines of the
// target matched to the lines of the source.
//
// `source` and `target` are texts; `from` and `to` the syntax of their
// languages (see layoutSyntax). `respace: false` only maps the lines.
export function transferLayout(source, target, from, to, options = {}) {
  const { respace = true, language } = options;
  const sourceSide = { chars: [...source] };
  const targetSide = { chars: [...target] };
  sourceSide.tokens = layoutTokens(sourceSide.chars, layoutSyntax(from));
  targetSide.tokens = layoutTokens(targetSide.chars, layoutSyntax(to));
  const pairs = alignTokens(sourceSide.tokens, targetSide.tokens);
  const mapLines = (targetLine) => {
    const lines = [];
    for (const [i, j] of pairs) {
      const pair = [
        sourceSide.tokens[i].line,
        targetLine(targetSide.tokens[j].line),
      ];
      const last = lines.at(-1);
      if (!last || last[0] !== pair[0] || last[1] !== pair[1]) {
        lines.push(pair);
      }
    }
    return lines;
  };
  const sourceStart = firstContent(sourceSide.chars);
  const targetStart = firstContent(targetSide.chars);
  if (!respace || sourceStart < 0 || targetStart < 0) {
    return { text: target, lines: mapLines((line) => line) };
  }
  const gaps = respacedGaps(pairs, [sourceSide, targetSide], language);
  let body = respacedBody(targetSide, targetStart, gaps).split('\n');
  // Blank lines between two target lines that hold the tokens of two
  // source lines with only blank lines between them: as many as the source.
  const sourceLines = source.split('\n').map((line) => line.replace(/\r$/, ''));
  const spans = lineSpans(pairs, sourceSide.tokens, targetSide.tokens);
  const insideSource = insideLines(sourceSide.tokens);
  const insideTarget = insideLines(targetSide.tokens);
  const targetLead = countBreaks(targetSide.chars.slice(0, targetStart));
  // Indentation in the steps of the source (two spaces, a tab).
  const sourceUnit = indentUnit(sourceLines, insideSource, 0);
  const targetUnit = indentUnit(body, insideTarget, targetLead);
  if (sourceUnit && targetUnit && sourceUnit !== targetUnit) {
    body = body.map((line, index) =>
      insideTarget.has(index + targetLead)
        ? line
        : reindent(line, targetUnit, sourceUnit)
    );
  }
  const wantedBlanks = (previous, current) => {
    const [before, after] = [previous + targetLead, current + targetLead];
    const [first, second] = [spans.get(before), spans.get(after)];
    for (let line = before + 1; line <= after; line += 1) {
      if (insideTarget.has(line)) {
        return undefined;
      }
    }
    if (!first || !second || second[0] <= first[1]) {
      return undefined;
    }
    const between = sourceLines.slice(first[1] + 1, second[0]);
    for (let line = first[1] + 1; line <= second[0]; line += 1) {
      if (insideSource.has(line)) {
        return undefined;
      }
    }
    return between.every(blankLine) ? between : undefined;
  };
  const lines = [];
  const placed = [];
  let previous = -1;
  body.forEach((line, index) => {
    if (blankLine(line) && !insideTarget.has(index + targetLead)) {
      return;
    }
    if (previous >= 0) {
      lines.push(
        ...(wantedBlanks(previous, index) ?? body.slice(previous + 1, index))
      );
    }
    placed[index + targetLead] = lines.length;
    lines.push(line);
    previous = index;
  });
  // Blank lines around the code, as the source has them.
  const lead = sourceSide.chars.slice(0, sourceStart);
  const breaks = countBreaks(
    sourceSide.chars.slice(lastContent(sourceSide.chars))
  );
  let text = `${lead.join('')}${lines.join('\n')}${'\n'.repeat(Math.max(1, breaks))}`;
  if (source.includes('\r\n') && !/(^|[^\r])\n/.test(source)) {
    text = text.replace(/\r?\n/g, '\r\n');
  }
  const sourceLead = countBreaks(lead);
  return { text, lines: mapLines((line) => placed[line] + sourceLead) };
}
