// Source positions are metadata, separate from the meaning and public fields
// of a node. Weak keys release them with the parse or transformed program.
const origins = new WeakMap();

export const sourceOrigin = (tree) => origins.get(tree);

export function withOrigin(tree, origin) {
  if (tree && origin) {
    origins.set(tree, origin);
  }
  return tree;
}

export const inheritOrigin = (tree, source) =>
  withOrigin(tree, sourceOrigin(source));

export const mapOrigins = (items, change) =>
  items.map((item, index) => inheritOrigin(change(item, index), item));

const containers = new Set(['Block', 'Function', 'Class', 'Program']);
const statements = new Set([
  'Declaration',
  'Assignment',
  'IndexAssignment',
  'Print',
  'Evaluate',
  'Return',
  'Throw',
  'Try',
  'Catch',
  'If',
  'While',
  'CountingLoop',
  'ForEach',
  'Comment',
]);

// An expression may have been lifted from another statement, such as a Bash
// command whose REPLY is read by the following echo. Keep both origins.
export function expressionOrigins(tree) {
  const result = [];
  const visit = (value, root = false) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    if (!root && (containers.has(value.kind) || statements.has(value.kind))) {
      return;
    }
    const origin = sourceOrigin(value);
    if (origin) {
      result.push(origin);
    }
    Object.values(value).forEach((item) => visit(item));
  };
  visit(tree, true);
  return result;
}

export function sourceLocator(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      starts.push(index + 1);
    }
  }
  const lineOf = (offset) => {
    let low = 0;
    let high = starts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (starts[middle] <= offset) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return low;
  };
  return (start, end) => {
    const first = lineOf(start);
    const last = lineOf(Math.max(start, end - 1));
    return {
      source,
      lines: Array.from({ length: last - first + 1 }, (_, i) => first + i),
      range: [first, last],
    };
  };
}

export function registerOrigins(tree, locations, source) {
  const locate = sourceLocator(source);
  const visit = (value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    Object.values(value).forEach(visit);
    const location = locations.get(value);
    // Dialects may clone a statement while combining adjacent commands. Its
    // inherited range still needs the same child-ownership pass as raw nodes.
    const own = location
      ? locate(location.start, location.end)
      : sourceOrigin(value);
    if (!own) {
      return;
    }
    const first = own.lines[0];
    const last = own.lines.at(-1);
    const lines = new Set(own.lines);
    // A block header owns its punctuation, while nested statements own their
    // individual lines. Shared boundary lines can belong to several nodes.
    const exclude = (child) => {
      if (!child || typeof child !== 'object') {
        return;
      }
      if (statements.has(child.kind)) {
        // A lifted command can lie outside the consuming statement's own
        // span. Those lines belong exclusively to the consuming statement.
        for (const origin of expressionOrigins(child)) {
          const owned = origin.range
            ? Array.from(
                { length: origin.range[1] - origin.range[0] + 1 },
                (_, index) => origin.range[0] + index
              )
            : origin.lines;
          for (const line of owned) {
            if (line !== first && line !== last) {
              lines.delete(line);
            }
          }
        }
      } else {
        Object.values(child).forEach(exclude);
      }
    };
    if (containers.has(value.kind) || statements.has(value.kind)) {
      Object.values(value).forEach(exclude);
    }
    withOrigin(value, { ...own, source, lines: [...lines] });
  };
  visit(tree);
}

// A fragment is parsed inside its language's executable wrapper. Positions
// from that wrapper refer back to the original input, never generated lines.
export function remapOrigins(tree, source, lines) {
  const visit = (value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    const origin = sourceOrigin(value);
    if (origin) {
      withOrigin(value, {
        source,
        lines: [
          ...new Set(
            origin.lines.flatMap((line) =>
              lines[line] === undefined ? [] : [lines[line] - 1]
            )
          ),
        ],
      });
    }
    Object.values(value).forEach(visit);
  };
  visit(tree);
  return tree;
}
