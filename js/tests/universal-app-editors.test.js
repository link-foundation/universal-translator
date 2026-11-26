// The linked editors of the web app: the line match between source and
// translation, folding regions and the decorations and connector paths that
// show the match. Only modules without Monaco or React are imported here.
import { describe, it, expect } from 'test-anywhere';
import { languageSyntax } from '../src/formal/languages.js';
import { foldingRanges } from '../../examples/universal-app/src/folding.js';
import { sourceLexicon } from '../../examples/universal-app/src/highlight.js';
import {
  lineLink,
  mapPosition,
  paletteSize,
} from '../../examples/universal-app/src/line-map.js';
import {
  connectorPaths,
  mappingDecorations,
} from '../../examples/universal-app/src/mapping.js';

const python = sourceLexicon(languageSyntax('python'));
const javascript = sourceLexicon(languageSyntax('javascript'));

describe('line-map: groups of matched lines', () => {
  const link = lineLink(
    [
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
    ],
    [5, 3]
  );

  it('joins the lines that share a match into one group', () => {
    expect(link.exact).toBe(true);
    expect(link.groups.map(({ lines }) => lines)).toEqual([
      [[0], [0]],
      [[1, 2], [1]],
      [[3, 4], [2]],
    ]);
  });

  it('gives groups the colours of a cycling palette', () => {
    expect(link.groups.map(({ colour }) => colour)).toEqual([0, 1, 2]);
    const many = lineLink(
      Array.from({ length: paletteSize + 1 }, (_, line) => [line, line]),
      [paletteSize + 1, paletteSize + 1]
    );
    expect(many.groups.map(({ colour }) => colour)).toEqual([
      ...Array.from({ length: paletteSize }, (_, colour) => colour),
      0,
    ]);
  });

  it('finds the group of a line on either side', () => {
    expect(link.groupAt(0, 2)).toBe(link.groups[1]);
    expect(link.groupAt(1, 1)).toBe(link.groups[1]);
    expect(link.groupAt(0, 9)).toBe(undefined);
    expect(link.groupAt(1, 3)).toBe(undefined);
  });

  it('orders groups by their first source line and joins chains', () => {
    const chained = lineLink(
      [
        [4, 5],
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [5, 6]
    );
    expect(chained.groups.map(({ lines }) => lines)).toEqual([
      [
        [0, 1],
        [0, 1],
      ],
      [[4], [5]],
    ]);
  });

  it('ignores malformed pairs and a missing line map', () => {
    const odd = lineLink([[0, 0], 'x', [1], [1, 1, 1]], [2, 2]);
    expect(odd.pairs).toEqual([[0, 0]]);
    expect(lineLink(null, [3, 3]).groups).toEqual([]);
  });

  it('has no groups and is not exact without a match', () => {
    const none = lineLink([], [4, 2]);
    expect(none.exact).toBe(false);
    expect(none.groups).toEqual([]);
    expect(none.anchors).toEqual([
      [0, 0],
      [4, 2],
    ]);
  });
});

describe('line-map: the other side of a selection', () => {
  const link = lineLink(
    [
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
    ],
    [5, 3]
  );

  it('gives the matched lines of a selected line', () => {
    expect(link.mapRange(0, 1)).toEqual({ lines: [1, 1], exact: true });
    expect(link.mapRange(1, 2)).toEqual({ lines: [3, 4], exact: true });
  });

  it('spans the matched lines of a selected range', () => {
    expect(link.mapRange(0, 0, 4)).toEqual({ lines: [0, 2], exact: true });
    expect(link.mapRange(1, 0, 1)).toEqual({ lines: [0, 2], exact: true });
  });

  it('falls back to the same place for lines that are not matched', () => {
    const sparse = lineLink(
      [
        [0, 0],
        [1, 1],
      ],
      [10, 2]
    );
    expect(sparse.mapRange(0, 5)).toEqual({ lines: [1, 1], exact: false });
    expect(sparse.mapRange(0, 5, 6)).toEqual({ lines: [1, 1], exact: false });
  });

  it('maps a position of either side through the anchors', () => {
    expect(link.mapPosition(0, 3.5)).toBe(2.25);
    expect(link.mapPosition(1, 2)).toBe(3);
  });
});

describe('line-map: scroll positions between anchors', () => {
  // A part of ten lines on the left that is two lines on the right.
  const link = lineLink(
    [
      [0, 0],
      [10, 2],
    ],
    [11, 3]
  );

  it('uses the lines matched exactly as anchors, from start to end', () => {
    expect(link.anchors).toEqual([
      [0, 0],
      [10, 2],
      [11, 3],
    ]);
  });

  it('moves in proportion between two anchors', () => {
    expect(link.mapPosition(0, 5)).toBe(1);
    expect(link.mapPosition(0, 2.5)).toBe(0.5);
    expect(link.mapPosition(1, 1)).toBe(5);
    expect(link.mapPosition(1, 0.5)).toBe(2.5);
  });

  it('is exact at the anchors on both sides', () => {
    expect(link.mapPosition(0, 0)).toBe(0);
    expect(link.mapPosition(0, 10)).toBe(2);
    expect(link.mapPosition(1, 2)).toBe(10);
    expect(link.mapPosition(1, 3)).toBe(11);
  });

  it('moves one to one beyond the last anchor', () => {
    expect(mapPosition(link.anchors, 12, 0)).toBe(4);
    expect(mapPosition(link.anchors, 5, 1)).toBe(13);
  });

  it('moves one to one before the first anchor, never below zero', () => {
    const anchors = [[3, 5]];
    expect(mapPosition(anchors, 2, 0)).toBe(4);
    expect(mapPosition(anchors, 0, 0)).toBe(2);
    expect(mapPosition([[3, 1]], 0, 0)).toBe(0);
  });

  it('returns the position itself without anchors', () => {
    expect(mapPosition([], 3.5, 0)).toBe(3.5);
    expect(mapPosition([], 3.5, 1)).toBe(3.5);
  });

  it('adds the start and the end of both texts as anchors', () => {
    const middle = lineLink([[3, 5]], [8, 9]);
    expect(middle.anchors).toEqual([
      [0, 0],
      [3, 5],
      [8, 9],
    ]);
    expect(middle.mapPosition(0, 0)).toBe(0);
    expect(middle.mapPosition(0, 8)).toBe(9);
  });

  it('keeps one anchor for a part of several lines: its first line', () => {
    const several = lineLink(
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 1],
      ],
      [4, 2]
    );
    expect(several.anchors).toEqual([
      [0, 0],
      [3, 1],
      [4, 2],
    ]);
  });

  it('leaves out a pair that crosses another', () => {
    const crossed = lineLink(
      [
        [0, 1],
        [1, 0],
      ],
      [2, 2]
    );
    expect(crossed.groups.length).toBe(2);
    const { anchors } = crossed;
    anchors.slice(1).forEach(([source, target], index) => {
      expect(source).toBeGreaterThan(anchors[index][0]);
      expect(target).toBeGreaterThan(anchors[index][1]);
    });
  });
});

describe('folding: brackets', () => {
  it('folds a bracket opened and closed on later lines', () => {
    const text = 'f(\n  1,\n  2\n)\n';
    expect(foldingRanges(text, javascript)).toEqual([{ start: 1, end: 3 }]);
  });

  it('keeps a closing bracket that starts its line visible', () => {
    const text = 'f(1,\n  2)\n';
    expect(foldingRanges(text, javascript)).toEqual([{ start: 1, end: 2 }]);
    const block = '{\n  1\n}';
    expect(foldingRanges(block, javascript)).toEqual([{ start: 1, end: 2 }]);
  });

  it('folds nested brackets as nested regions', () => {
    const text = '{\n  [\n    1\n  ]\n}';
    expect(foldingRanges(text, javascript)).toEqual([
      { start: 1, end: 4 },
      { start: 2, end: 3 },
    ]);
  });

  it('does not fold brackets opened and closed on one line', () => {
    expect(foldingRanges('f(1, [2])\ng(3)', javascript)).toEqual([]);
  });

  it('ignores brackets inside strings and comments', () => {
    const text = 'a = [ "]"\n  1\n]';
    expect(foldingRanges(text, javascript)).toEqual([{ start: 1, end: 2 }]);
    // Without a lexicon every bracket counts, so the string closes it.
    expect(foldingRanges(text)).toEqual([{ start: 1, end: 2 }]);
    const note = 'x = {\n// }\n1 }';
    expect(foldingRanges(note, javascript)).toEqual([{ start: 1, end: 3 }]);
  });

  it('does not let an unmatched closing bracket end its neighbours', () => {
    expect(foldingRanges('a)\n[\n1\n]', javascript)).toEqual([
      { start: 2, end: 3 },
    ]);
  });

  it('reads lines that end with a carriage return', () => {
    expect(foldingRanges('a(\r\n 1\r\n)', javascript)).toEqual([
      { start: 1, end: 2 },
    ]);
  });

  it('finds no region in an empty or a one-line text', () => {
    expect(foldingRanges('', javascript)).toEqual([]);
    expect(foldingRanges('x = 1', javascript)).toEqual([]);
  });
});

describe('folding: indentation', () => {
  it('folds a line followed by lines indented deeper', () => {
    const text = 'def f(a):\n    x = 1\n    return x\n';
    expect(foldingRanges(text, python)).toEqual([{ start: 1, end: 3 }]);
  });

  it('folds nested blocks and stops where the indentation returns', () => {
    const text = [
      'def f(a):',
      '    if a:',
      '        b = 1',
      '        c = 2',
      '    return a',
      'print(f(1))',
    ].join('\n');
    expect(foldingRanges(text, python)).toEqual([
      { start: 1, end: 5 },
      { start: 2, end: 4 },
    ]);
  });

  it('skips blank lines and counts a tab as four spaces', () => {
    const text = 'a:\n\n\tb\n\n    c\nd';
    expect(foldingRanges(text)).toEqual([{ start: 1, end: 5 }]);
  });

  it('works without a lexicon', () => {
    expect(foldingRanges('a\n  b\n  c')).toEqual([{ start: 1, end: 3 }]);
  });

  it('keeps the longest region of a start line', () => {
    const text = 'if x: {\n  a\n  b\n}';
    expect(foldingRanges(text, javascript)).toEqual([{ start: 1, end: 3 }]);
  });
});

describe('folding: comments', () => {
  it('folds two or more comment lines in a row', () => {
    const text = '# one\n# two\n# three\nx = 1';
    expect(foldingRanges(text, python)).toEqual([
      { start: 1, end: 3, kind: 'comment' },
    ]);
  });

  it('does not fold a single comment line', () => {
    expect(foldingRanges('# one\nx = 1', python)).toEqual([]);
  });

  it('folds a run that ends the text and separate runs apart', () => {
    const text = '// a\n// b\nlet x = 1;\n// c\n// d';
    expect(foldingRanges(text, javascript)).toEqual([
      { start: 1, end: 2, kind: 'comment' },
      { start: 4, end: 5, kind: 'comment' },
    ]);
  });

  it('does not take a line with code before the comment as a comment', () => {
    const text = 'x = 1  # a\ny = 2  # b';
    expect(foldingRanges(text, python)).toEqual([]);
  });

  it('needs a lexicon to know what a comment is', () => {
    expect(foldingRanges('# one\n# two\n# three')).toEqual([]);
  });

  it('orders regions of every kind by their start lines', () => {
    const text = '// a\n// b\nlet x = [\n1\n];';
    expect(foldingRanges(text, javascript)).toEqual([
      { start: 1, end: 2, kind: 'comment' },
      { start: 3, end: 4 },
    ]);
  });
});

describe('mapping: decorations per side', () => {
  const link = lineLink(
    [
      [0, 0],
      [1, 0],
      [2, 1],
    ],
    [3, 2]
  );
  const wholeLine = (line) => ({
    startLineNumber: line,
    startColumn: 1,
    endLineNumber: line,
    endColumn: 1,
  });

  it('decorates every matched line of the side with its colour', () => {
    const source = mappingDecorations(link, 0);
    expect(source.map(({ range }) => range)).toEqual([
      wholeLine(1),
      wholeLine(2),
      wholeLine(3),
    ]);
    expect(source.map(({ options }) => options.className)).toEqual([
      'map-line map-c0',
      'map-line map-c0',
      'map-line map-c1',
    ]);
    expect(source[2].options).toEqual({
      isWholeLine: true,
      className: 'map-line map-c1',
      linesDecorationsClassName: 'map-gutter map-c1',
    });
  });

  it('uses the lines of the other side for the other editor', () => {
    const target = mappingDecorations(link, 1);
    expect(target.map(({ range }) => range.startLineNumber)).toEqual([1, 2]);
    expect(target.map(({ options }) => options.className)).toEqual([
      'map-line map-c0',
      'map-line map-c1',
    ]);
  });

  it('marks the active group stronger on both sides', () => {
    const active = link.groupAt(1, 1);
    for (const side of [0, 1]) {
      const classes = mappingDecorations(link, side, active).map(
        ({ options }) => options.className
      );
      expect(classes.filter((name) => name.includes('map-active'))).toEqual([
        'map-line map-c1 map-active',
      ]);
    }
    const gutter = mappingDecorations(link, 0, active)[2].options;
    expect(gutter.linesDecorationsClassName).toBe(
      'map-gutter map-c1 map-active'
    );
  });

  it('leaves out lines beyond the line count of the editor', () => {
    const lines = mappingDecorations(link, 0, undefined, 2).map(
      ({ range }) => range.startLineNumber
    );
    expect(lines).toEqual([1, 2]);
  });

  it('has nothing to decorate without a match', () => {
    expect(mappingDecorations(lineLink([], [2, 2]), 0)).toEqual([]);
  });
});

describe('mapping: connector paths', () => {
  // Line n of a side is 10 high, from n * 10 down.
  const span = (side, first, last) => ({
    top: first * 10,
    bottom: (last + 1) * 10,
  });

  it('draws one band from the left lines to the right lines', () => {
    const link = lineLink([[0, 0]], [1, 1]);
    expect(connectorPaths(link, span, 100)).toEqual([
      {
        colour: 0,
        active: false,
        d: 'M0 0 C50 0 50 0 100 0 L100 10 C50 10 50 10 0 10 Z',
      },
    ]);
  });

  it('joins the lines of a group that differ in height', () => {
    const link = lineLink(
      [
        [0, 0],
        [1, 0],
        [2, 1],
      ],
      [3, 2]
    );
    const paths = connectorPaths(link, span, 100, link.groups[1]);
    expect(paths.map(({ colour, active }) => [colour, active])).toEqual([
      [0, false],
      [1, true],
    ]);
    expect(paths[0].d).toBe(
      'M0 0 C50 0 50 0 100 0 L100 10 C50 10 50 20 0 20 Z'
    );
    expect(paths[1].d).toBe(
      'M0 20 C50 20 50 10 100 10 L100 20 C50 20 50 30 0 30 Z'
    );
  });

  it('makes a band for every run of lines of a group', () => {
    const link = lineLink(
      [
        [0, 0],
        [2, 0],
        [3, 1],
        [4, 1],
      ],
      [5, 2]
    );
    const paths = connectorPaths(link, span, 60);
    expect(paths.map(({ colour }) => colour)).toEqual([0, 0, 1]);
    // The second run on the left meets the only run on the right.
    expect(paths[1].d).toBe(
      'M0 20 C30 20 30 0 60 0 L60 10 C30 10 30 30 0 30 Z'
    );
    // Lines 3 and 4 are one run: a band 20 high.
    expect(paths[2].d).toBe(
      'M0 30 C30 30 30 10 60 10 L60 20 C30 20 30 50 0 50 Z'
    );
  });

  it('skips a band when either end cannot be seen', () => {
    const link = lineLink(
      [
        [0, 0],
        [1, 1],
      ],
      [2, 2]
    );
    const hidden = (side, first, last) =>
      side === 1 && first === 1 ? undefined : span(side, first, last);
    const paths = connectorPaths(link, hidden, 100);
    expect(paths.map(({ colour }) => colour)).toEqual([0]);
    expect(connectorPaths(link, () => undefined, 100)).toEqual([]);
  });

  it('has no path without a match', () => {
    expect(connectorPaths(lineLink([], [2, 2]), span, 100)).toEqual([]);
  });
});
