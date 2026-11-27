// Match semantic nodes after final layout. Spelling is deliberately absent
// from the matching rule: a print can become an echo, a sentence or instructions.
import { commentOrigins, expressionOrigins } from './source-origins.js';
import { mergeSpans, remapSpans, spanLines } from './source-spans.js';

const metadata = new Set([
  'type',
  'returnType',
  'mutable',
  'bindingMutable',
  'contentMutable',
  'syntax',
  'comments',
  'mainComments',
  'annotations',
  'parameterAnnotations',
  'trailing',
  'block',
  'blankAfter',
]);
const containers = new Set(['Program', 'Block', 'Blank']);

function ownedSpans(origins, source, lines, bytes) {
  const spans = mergeSpans(
    origins
      .filter((origin) => origin.source === source)
      .flatMap(
        (origin) =>
          origin.spans ??
          origin.lines.flatMap((row) => {
            const line = lines[row];
            return line && line.end > line.start + line.indent
              ? [[line.start + line.indent, line.end]]
              : [];
          })
      )
  );
  return spans.flatMap(([start, end]) => {
    const whitespace = (at) => [9, 10, 12, 13, 32].includes(bytes[at]);
    while (start < end && whitespace(start)) {
      start += 1;
    }
    while (end > start && whitespace(end - 1)) {
      end -= 1;
    }
    return start < end ? [[start, end]] : [];
  });
}

function collector(intern) {
  const identities = new Map();
  const identify = (key) => {
    if (!identities.has(key)) {
      identities.set(key, identities.size);
    }
    return identities.get(key);
  };
  return (tree, source) => {
    const result = new Map();
    const lines = spanLines(source);
    const bytes = new globalThis.TextEncoder().encode(source);
    const add = (key, spans) => {
      if (!spans.length) {
        return;
      }
      if (!result.has(key)) {
        result.set(key, []);
      }
      result.get(key).push(spans);
    };
    const visit = (value) => {
      if (!value || typeof value !== 'object') {
        return identify(JSON.stringify(value));
      }
      if (Array.isArray(value)) {
        return identify(JSON.stringify(value.map(visit)));
      }
      const fields = Object.entries(value)
        .filter(([key]) => !metadata.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, visit(child)]);
      const key = identify(JSON.stringify(fields));
      if (value.kind && !containers.has(value.kind)) {
        add(key, ownedSpans(expressionOrigins(value), source, lines, bytes));
      }
      // Comment translations can change every word. Their owner and ordinal
      // retain identity, including headers moved before function definitions.
      for (const field of ['comments', 'mainComments']) {
        commentOrigins(value[field]).forEach((origin, index) => {
          if (origin) {
            add(
              intern(`${key}:${field}:${index}`),
              ownedSpans([origin], source, lines, bytes)
            );
          }
        });
      }
      return key;
    };
    visit(tree);
    return result;
  };
}

function readRegions(source, language, parseFragment, parsePartial, collect) {
  try {
    return collect(parseFragment(source, language).program, source);
  } catch {
    // Partial recovery has already established which fragments are readable.
    // Reuse its bounded segmentation, then map dedented fragments back by line.
    const result = new Map();
    const after = spanLines(source);
    for (const part of parsePartial(source, language).parts) {
      if (part.status !== 'read') {
        continue;
      }
      const before = spanLines(part.source);
      const positions = before.map((_, row) => part.start + row + 1);
      const entries = collect(
        parseFragment(part.source, language).program,
        part.source
      );
      for (const [key, groups] of entries) {
        if (!result.has(key)) {
          result.set(key, []);
        }
        result
          .get(key)
          .push(
            ...groups.map((spans) =>
              remapSpans(spans, before, after, positions)
            )
          );
      }
    }
    return result;
  }
}

function rowAt(lines, byte) {
  let low = 0;
  let high = lines.length;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (lines[middle].start <= byte) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}

function matchEntries(before, after, related, sourceLines, targetLines, add) {
  const match = (spans, candidates) => {
    for (const other of candidates) {
      for (const left of spans) {
        for (const right of other) {
          if (
            related.has(
              `${rowAt(sourceLines, left[0])}:${rowAt(targetLines, right[0])}`
            )
          ) {
            add(left, right);
          }
        }
      }
    }
  };
  for (const [key, sources] of before) {
    const targets = after.get(key) ?? [];
    // Equal repeated subtrees pair in semantic order. Unequal occurrences
    // may expand or contract, but only within established line ownership.
    sources.forEach((spans, index) =>
      match(
        spans,
        sources.length === targets.length ? [targets[index]] : targets
      )
    );
  }
}

export function createRegionMapper({ parseFragment, parsePartial }) {
  return (source, target, from, to, lineMap) => {
    const comments = new Map();
    const collect = collector((key) => {
      if (!comments.has(key)) {
        comments.set(key, `comment:${comments.size}`);
      }
      return comments.get(key);
    });
    const sourceLines = spanLines(source);
    const targetLines = spanLines(target);
    const related = new Set(lineMap.map(([a, b]) => `${a}:${b}`));
    const result = new Map();
    const covered = new Set();
    const add = (left, right) => {
      const source = { start: left[0], end: left[1] };
      const target = { start: right[0], end: right[1] };
      if (source.start < source.end && target.start < target.end) {
        result.set(`${left}:${right}`, { source, target });
        covered.add(
          `${rowAt(sourceLines, source.start)}:${rowAt(targetLines, target.start)}`
        );
      }
    };
    try {
      const before = readRegions(
        source,
        from,
        parseFragment,
        parsePartial,
        collect
      );
      const after = readRegions(
        target,
        to,
        parseFragment,
        parsePartial,
        collect
      );
      matchEntries(before, after, related, sourceLines, targetLines, add);
    } catch {
      // Custom reader/writer stages may intentionally use unrelated grammars.
      // Their recorded line ownership still supplies valid coarse regions.
    }
    for (const [a, b] of lineMap) {
      const left = sourceLines[a];
      const right = targetLines[b];
      if (left && right && !covered.has(`${a}:${b}`)) {
        add(
          [left.start + left.indent, left.end],
          [right.start + right.indent, right.end]
        );
      }
    }
    return [...result.values()].sort(
      (a, b) =>
        a.source.start - b.source.start ||
        a.source.end - b.source.end ||
        a.target.start - b.target.start ||
        a.target.end - b.target.end
    );
  };
}
