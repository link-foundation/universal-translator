// Region endpoints form a graph just like lines, but overlapping expressions
// stay distinct. A caret follows the smallest region containing it.
import { lineLink } from './line-map.js';

export function textPositions(text) {
  const offsets = new Map([[0, 0]]);
  const bytes = [0];
  const starts = [0];
  let byte = 0;
  let offset = 0;
  for (const character of text) {
    offset += character.length;
    const code = character.codePointAt(0);
    byte += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    offsets.set(byte, offset);
    bytes[offset] = byte;
    if (character === '\n') {
      starts.push(offset);
    }
  }
  const position = (byte) => {
    const at = offsets.get(byte);
    let low = 0;
    let high = starts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (starts[middle] <= at) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return { lineNumber: low + 1, column: at - starts[low] + 1 };
  };
  return {
    valid: (at) => offsets.has(at),
    byteAt: ({ lineNumber, column }) =>
      bytes[starts[lineNumber - 1] + column - 1],
    position,
    range: ({ start, end }) => {
      const first = position(start);
      const last = position(end);
      return {
        startLineNumber: first.lineNumber,
        startColumn: first.column,
        endLineNumber: last.lineNumber,
        endColumn: last.column,
      };
    },
  };
}

function visibleSegments(groups, side) {
  const events = [];
  for (const group of groups) {
    for (const range of group.ranges[side]) {
      const item = { ...range, group };
      events.push(
        { at: range.start, add: item },
        { at: range.end, remove: item }
      );
    }
  }
  events.sort((a, b) => a.at - b.at);
  const active = new Set();
  const segments = [];
  for (const [index, event] of events.entries()) {
    if (event.remove) {
      active.delete(event.remove);
    } else {
      active.add(event.add);
    }
    const end = events[index + 1]?.at;
    if (end === undefined || end === event.at || !active.size) {
      continue;
    }
    let smallest;
    for (const item of active) {
      if (!smallest || item.end - item.start < smallest.end - smallest.start) {
        smallest = item;
      }
    }
    const last = segments.at(-1);
    if (last?.group === smallest.group && last.end === event.at) {
      last.end = end;
    } else {
      segments.push({ start: event.at, end, group: smallest.group });
    }
  }
  return segments;
}

export function regionLink(regionMap = [], texts = ['', '']) {
  const positions = texts.map(textPositions);
  const ranges = [[], []];
  const identities = [new Map(), new Map()];
  const endpoint = (range, side) => {
    const key = `${range.start}:${range.end}`;
    if (!identities[side].has(key)) {
      identities[side].set(key, ranges[side].length);
      ranges[side].push(range);
    }
    return identities[side].get(key);
  };
  const pairs = (regionMap ?? []).flatMap((pair) => {
    const ends = [pair?.source, pair?.target];
    return ends.every(
      (range, side) =>
        range &&
        Number.isInteger(range.start) &&
        Number.isInteger(range.end) &&
        range.start < range.end &&
        positions[side].valid(range.start) &&
        positions[side].valid(range.end)
    )
      ? [[endpoint(ends[0], 0), endpoint(ends[1], 1)]]
      : [];
  });
  const groups = lineLink(pairs).groups.map(({ lines, ...group }) => ({
    ...group,
    ranges: lines.map((ids, side) => ids.map((id) => ranges[side][id])),
  }));
  const segments = [0, 1].map((side) => visibleSegments(groups, side));
  return {
    groups,
    segments,
    positions,
    groupAt(side, position) {
      const byte = positions[side].byteAt(position);
      return segments[side].find(
        ({ start, end }) => start <= byte && byte < end
      )?.group;
    },
    mapSelection(side, selection) {
      const start = positions[side].byteAt({
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      });
      const end = positions[side].byteAt({
        lineNumber: selection.endLineNumber,
        column: selection.endColumn,
      });
      const found = new Set();
      for (const segment of segments[side]) {
        if (
          start === end
            ? segment.start <= start && start < segment.end
            : segment.start < end && segment.end > start
        ) {
          found.add(segment.group);
        }
      }
      const selected = [...found]
        .flatMap((group) => group.ranges[1 - side])
        .sort((a, b) => a.start - b.start || a.end - b.end);
      const merged = [];
      for (const range of selected) {
        const last = merged.at(-1);
        if (last && range.start <= last.end) {
          last.end = Math.max(last.end, range.end);
        } else {
          merged.push({ ...range });
        }
      }
      return merged;
    },
  };
}

export function regionDecorations(link, side, active) {
  return link.segments[side].map(({ start, end, group }) => ({
    range: link.positions[side].range({ start, end }),
    options: {
      inlineClassName: `map-region map-c${group.colour}${group === active ? ' map-active' : ''}`,
    },
  }));
}
