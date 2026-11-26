// How the match between the lines of both editors is shown (issue 14), as
// in diff tools and Compiler Explorer:
//
// - every group of matched lines has a background colour of a cycling
//   palette, the same in both editors, and a bar of that colour beside its
//   line numbers;
// - the group under the cursor (in either editor) is coloured stronger;
// - a strip between the editors joins the lines of each group on the left
//   to its lines on the right.
//
// The colours are CSS classes (styles.css: map-line, map-c0 … map-c5,
// map-active). Nothing here needs Monaco: editor-sync.js gives the
// decorations to the editors and the paths to the strip.

// Monaco decorations for one side (0 the source, 1 the target) of a link
// (line-map.js); `active` is the group under the cursor, if any.
export function mappingDecorations(link, side, active, lineCount = Infinity) {
  const decorations = [];
  for (const group of link.groups) {
    const colour = `map-c${group.colour}`;
    const strong = group === active ? ' map-active' : '';
    for (const line of group.lines[side]) {
      if (line >= lineCount) {
        continue;
      }
      decorations.push({
        range: {
          startLineNumber: line + 1,
          startColumn: 1,
          endLineNumber: line + 1,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: `map-line ${colour}${strong}`,
          linesDecorationsClassName: `map-gutter ${colour}${strong}`,
        },
      });
    }
  }
  return decorations;
}

// The lines of a group on one side that are next to each other.
function runs(lines) {
  const all = [];
  for (const line of lines) {
    const last = all.at(-1);
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      all.push([line, line]);
    }
  }
  return all;
}

// The shapes of the strip between the editors, `width` wide. `span(side,
// first, last)` gives where lines first … last of a side are in the strip,
// as { top, bottom } clipped to the editor, or undefined when they cannot
// be seen. A group of lines on both sides is one band per run of lines.
export function connectorPaths(link, span, width, active) {
  const middle = width / 2;
  const paths = [];
  for (const group of link.groups) {
    const [left, right] = group.lines.map(runs);
    const count = Math.max(left.length, right.length);
    for (let at = 0; at < count; at += 1) {
      const from = left[Math.min(at, left.length - 1)];
      const to = right[Math.min(at, right.length - 1)];
      const a = span(0, ...from);
      const b = span(1, ...to);
      if (!a || !b) {
        continue;
      }
      paths.push({
        colour: group.colour,
        active: group === active,
        d: [
          `M0 ${a.top}`,
          `C${middle} ${a.top} ${middle} ${b.top} ${width} ${b.top}`,
          `L${width} ${b.bottom}`,
          `C${middle} ${b.bottom} ${middle} ${a.bottom} 0 ${a.bottom}`,
          'Z',
        ].join(' '),
      });
    }
  }
  return paths;
}
