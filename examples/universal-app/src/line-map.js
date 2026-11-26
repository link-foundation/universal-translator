// The lines of a source and of its translation matched to each other, for
// the two editors of the Translate tab (issue 14). The translator returns
// the match as `lineMap`: pairs of 0-based [source line, target line] (see
// js/src/translation/layout.js). From it a link between both texts gives:
//
// - groups: lines that belong together (a statement written on three lines
//   on one side and on one on the other), each with a colour of a cycling
//   palette, so both editors show what translates to what;
// - ranges: the lines on the other side of a selection;
// - positions: where to scroll the other editor to. Lines matched exactly
//   are anchors; between two anchors a position moves in proportion, so a
//   part that takes ten lines on one side and two on the other scrolls
//   both editors through it together, as diff tools do.
//
// Nothing here needs Monaco or React: editor-sync.js applies it to the
// editors. A side is 0 (the source) or 1 (the target).

export const paletteSize = 6;

// Connected pairs: a line on either side joins every pair it is part of.
function components(pairs) {
  const parent = new Map();
  const find = (key) => {
    let root = key;
    while (parent.get(root) !== root) {
      root = parent.get(root);
    }
    parent.set(key, root);
    return root;
  };
  const join = (a, b) => {
    for (const key of [a, b]) {
      if (!parent.has(key)) {
        parent.set(key, key);
      }
    }
    parent.set(find(a), find(b));
  };
  for (const [source, target] of pairs) {
    join(`s${source}`, `t${target}`);
  }
  const groups = new Map();
  for (const [source, target] of pairs) {
    const root = find(`s${source}`);
    if (!groups.has(root)) {
      groups.set(root, [new Set(), new Set()]);
    }
    groups.get(root)[0].add(source);
    groups.get(root)[1].add(target);
  }
  return [...groups.values()].map((sides) =>
    sides.map((lines) => [...lines].sort((a, b) => a - b))
  );
}

// The longest chain of pairs that goes down on both sides at once: the
// anchors of scrolling (a pair that crosses another is left out).
function monotonicChain(pairs) {
  const sorted = [...pairs].sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const tails = [];
  const previous = [];
  sorted.forEach(([, target], index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sorted[tails[middle]][1] < target) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    // A later pair on the same target line keeps the earlier anchor: a
    // part of several source lines scrolls from its first line on.
    if (low < tails.length && sorted[tails[low]][1] === target) {
      return;
    }
    previous[index] = low > 0 ? tails[low - 1] : -1;
    tails[low] = index;
  });
  // Equal source lines come with the larger target first, so the chain
  // has one anchor per line on both sides.
  const chain = [];
  for (let at = tails.at(-1) ?? -1; at >= 0; at = previous[at]) {
    chain.unshift(sorted[at]);
  }
  return chain;
}

// Anchors from the start to the end of both texts.
function anchorsOf(pairs, counts) {
  const chain = monotonicChain(pairs);
  const first = chain[0];
  if (!first || (first[0] > 0 && first[1] > 0)) {
    chain.unshift([0, 0]);
  }
  const last = chain.at(-1);
  if (counts[0] > last[0] && counts[1] > last[1]) {
    chain.push([counts[0], counts[1]]);
  }
  return chain;
}

// A position (a line number with a fraction: 2.5 is half way through the
// third line) on one side, as a position on the other side.
export function mapPosition(anchors, position, side = 0) {
  const other = 1 - side;
  if (anchors.length === 0) {
    return position;
  }
  let at = -1;
  while (at + 1 < anchors.length && anchors[at + 1][side] <= position) {
    at += 1;
  }
  if (at < 0) {
    return Math.max(0, anchors[0][other] - (anchors[0][side] - position));
  }
  const [from, to] = [anchors[at], anchors[at + 1]];
  if (!to) {
    return from[other] + (position - from[side]);
  }
  const ratio = (position - from[side]) / (to[side] - from[side]);
  return from[other] + ratio * (to[other] - from[other]);
}

// A link between the lines of two texts. `counts` are their line counts.
export function lineLink(lineMap = [], counts = [0, 0]) {
  const pairs = (lineMap ?? []).filter(
    (pair) => Array.isArray(pair) && pair.length === 2
  );
  const groups = components(pairs)
    .sort((a, b) => a[0][0] - b[0][0] || a[1][0] - b[1][0])
    .map((lines, index) => ({ index, colour: index % paletteSize, lines }));
  const byLine = [new Map(), new Map()];
  for (const group of groups) {
    group.lines.forEach((lines, side) => {
      for (const line of lines) {
        byLine[side].set(line, group);
      }
    });
  }
  const anchors = anchorsOf(pairs, counts);
  return {
    pairs,
    groups,
    anchors,
    exact: pairs.length > 0,
    // The group a line belongs to, if any.
    groupAt: (side, line) => byLine[side].get(line),
    // The lines [first, last] on the other side of lines [first, last]:
    // those matched to them, or else those at the same place.
    mapRange(side, first, last = first) {
      const other = [];
      for (const pair of pairs) {
        if (pair[side] >= first && pair[side] <= last) {
          other.push(pair[1 - side]);
        }
      }
      if (other.length) {
        return { lines: [Math.min(...other), Math.max(...other)], exact: true };
      }
      const start = Math.floor(mapPosition(anchors, first, side));
      const end = Math.ceil(mapPosition(anchors, last + 1, side)) - 1;
      return { lines: [start, Math.max(start, end)], exact: false };
    },
    mapPosition: (side, position) => mapPosition(anchors, position, side),
  };
}
