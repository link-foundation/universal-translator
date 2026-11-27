import { expect, it } from 'test-anywhere';
import {
  regionLink,
  regionDecorations,
  textPositions,
} from '../../examples/universal-app/src/region-map.js';

const range = (start, end) => ({ start, end });
const selection = (start, end = start) => ({
  startLineNumber: 1,
  startColumn: start,
  endLineNumber: 1,
  endColumn: end,
});

it('selects the narrowest semantic region and gives its counterpart the same colour', () => {
  const link = regionLink(
    [
      { source: range(0, 9), target: range(0, 8) },
      { source: range(4, 7), target: range(3, 6) },
    ],
    ['say(foo);', 'put(foo)']
  );
  const active = link.groupAt(0, { lineNumber: 1, column: 6 });
  expect(active).toBe(link.groupAt(1, { lineNumber: 1, column: 5 }));
  expect(link.mapSelection(0, selection(5, 8))).toEqual([range(3, 6)]);
  const decorations = regionDecorations(link, 1, active);
  expect(
    decorations.find(({ options }) =>
      options.inlineClassName.includes('map-active')
    )?.range
  ).toEqual({
    startLineNumber: 1,
    startColumn: 4,
    endLineNumber: 1,
    endColumn: 7,
  });
  expect(
    decorations.every(({ options }) => options.isWholeLine === undefined)
  ).toBe(true);
});

it('keeps disjoint counterparts of a split construct and merges overlapping selections', () => {
  const link = regionLink(
    [
      { source: range(0, 6), target: range(0, 4) },
      { source: range(0, 6), target: range(5, 9) },
      { source: range(1, 3), target: range(1, 3) },
    ],
    ['print!', 'call echo']
  );
  expect(link.mapSelection(0, selection(1, 7))).toEqual([
    range(0, 4),
    range(5, 9),
  ]);
  expect(link.mapSelection(1, selection(6, 10))).toEqual([range(0, 6)]);
});

it('converts UTF-8 ranges to Monaco UTF-16 columns across CRLF and emoji', () => {
  const positions = textPositions('Я🌍\r\nx');
  expect(positions.byteAt({ lineNumber: 1, column: 4 })).toBe(6);
  expect(positions.position(8)).toEqual({ lineNumber: 2, column: 1 });
  expect(positions.range(range(2, 6))).toEqual({
    startLineNumber: 1,
    startColumn: 2,
    endLineNumber: 1,
    endColumn: 4,
  });
});

it('rejects invalid, stale and mid-character byte ranges before making decorations', () => {
  const link = regionLink(
    [
      null,
      { source: range(1, 2), target: range(0, 1) },
      { source: range(0, 4), target: range(0, 1) },
      { source: range(0, 2), target: range(0, 2) },
      { source: range(-1, 2), target: range(0, 1) },
      { source: range(0, 2), target: range(0, 1) },
    ],
    ['Я', 'x']
  );
  expect(link.groups.length).toBe(1);
  expect(regionDecorations(link, 0)[0].range).toEqual({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 2,
  });
  expect(regionLink(null).groups).toEqual([]);
});
