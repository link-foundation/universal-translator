// Public positions use half-open UTF-8 byte ranges, like concrete source trees.
export function byteOffsets(source) {
  const offsets = new Uint32Array(source.length + 1);
  let position = 0;
  let bytes = 0;
  for (const character of source) {
    offsets[position] = bytes;
    position += character.length;
    const code = character.codePointAt(0);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    offsets[position] = bytes;
  }
  return offsets;
}

export function mergeSpans(spans) {
  const result = [];
  for (const [start, end] of spans.slice().sort(([a], [b]) => a - b)) {
    if (end <= start) {
      continue;
    }
    const last = result.at(-1);
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      result.push([start, end]);
    }
  }
  return result;
}

export function subtractSpans(spans, excluded) {
  const result = [];
  const cuts = mergeSpans(excluded);
  for (const [start, end] of spans) {
    let at = start;
    for (const [left, right] of cuts) {
      if (right <= at || left >= end) {
        continue;
      }
      if (left > at) {
        result.push([at, left]);
      }
      at = Math.max(at, right);
    }
    if (at < end) {
      result.push([at, end]);
    }
  }
  return result;
}

export function spanLines(source) {
  const offsets = byteOffsets(source);
  let at = 0;
  return source.split('\n').map((line) => {
    const text = line.replace(/\r$/u, '');
    const start = offsets[at];
    const end = offsets[at + text.length];
    const indent = offsets[at + /^\s*/u.exec(text)[0].length] - start;
    at += line.length + 1;
    return { start, end, indent };
  });
}

// Wrappers and partial recovery change indentation, but keep line contents.
// Split at newlines so generated wrapper text never enters an original span.
export function remapSpans(spans, before, after, lines) {
  const result = [];
  for (const [row, original] of lines.entries()) {
    const old = before[row];
    const current = after[original - 1];
    if (!old || !current) {
      continue;
    }
    const shift = current.start + current.indent - old.start - old.indent;
    for (const [start, end] of spans) {
      const left = Math.max(start, old.start + old.indent);
      const right = Math.min(end, old.end);
      if (left < right) {
        result.push([
          Math.min(current.end, left + shift),
          Math.min(current.end, right + shift),
        ]);
      }
    }
  }
  return mergeSpans(result);
}
