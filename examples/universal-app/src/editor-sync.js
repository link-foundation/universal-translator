// The source and the translation editors kept in step (issue 14): what is
// selected on one side is selected on the other, the cursor and the scroll
// follow, a part folded on one side is folded on the other, and the lines
// that match are coloured alike (mapping.js) with a strip between the
// editors joining them. The match is the `lineMap` of the translation
// (line-map.js); without one (a natural language on one side) the editors
// still scroll together, in proportion to their lengths.
//
// A change made here to the other editor must not come back: the cursor is
// moved with the source 'api', which is not followed, scrolling and folding
// done here are ignored while `applying` is set, and folding follows only
// the regions whose state changed since the last look.

import { useEffect, useRef } from 'react';
import { lineLink } from './line-map.js';
import { regionLink, regionDecorations } from './region-map.js';
import { connectorPaths, mappingDecorations } from './mapping.js';
import { debug } from './debug.js';

const foldingId = 'editor.contrib.folding';
// monaco.editor.CursorChangeReason.ContentFlush: the text was replaced.
const contentFlush = 1;
// After a text changes its folding regions are found again: folding is
// not followed meanwhile.
const settleTime = 500;

const lineCount = (editor) => editor.getModel()?.getLineCount() ?? 0;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// The height of line `line` (1-based) of an editor, as laid out.
const lineHeight = (editor, line) =>
  Math.max(
    editor.getBottomForLineNumber(line) - editor.getTopForLineNumber(line),
    1
  );

// The line at the top of an editor, with the fraction of it scrolled past
// (0-based: 2.5 is half way through the third line).
export function topPosition(editor) {
  const count = lineCount(editor);
  const scroll = editor.getScrollTop();
  let low = 1;
  let high = count;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (editor.getTopForLineNumber(middle) <= scroll) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  const top = editor.getTopForLineNumber(low);
  const fraction = clamp((scroll - top) / lineHeight(editor, low), 0, 1);
  return low - 1 + fraction;
}

// Scrolls an editor so that a position (as topPosition gives it) is at
// its top.
export function scrollToPosition(editor, position) {
  const count = lineCount(editor);
  if (!count) {
    return;
  }
  const at = clamp(position, 0, count);
  const line = Math.min(count, Math.floor(at) + 1);
  const fraction = at - (line - 1);
  editor.setScrollTop(
    editor.getTopForLineNumber(line) + fraction * lineHeight(editor, line)
  );
}

// The lines [first, last] (0-based) of a selection; a selection that ends
// at the start of a line does not take that line.
function selectionLines(selection) {
  const first = selection.startLineNumber - 1;
  let last = selection.endLineNumber - 1;
  if (last > first && selection.endColumn === 1) {
    last -= 1;
  }
  return [first, last];
}

// The folded regions of an editor, by their first line (0-based).
function foldedStarts(regions) {
  const starts = new Set();
  for (let index = 0; index < (regions?.length ?? 0); index += 1) {
    if (regions.isCollapsed(index)) {
      starts.add(regions.getStartLineNumber(index) - 1);
    }
  }
  return starts;
}

async function foldingModel(editor) {
  try {
    return (await editor.getContribution(foldingId)?.getFoldingModel()) ?? null;
  } catch {
    return null;
  }
}

// The first region that starts in lines [first, last] (0-based).
function regionStartingIn(regions, first, last) {
  for (let index = 0; index < regions.length; index += 1) {
    const start = regions.getStartLineNumber(index) - 1;
    if (start >= first && start <= last) {
      return index;
    }
  }
  return -1;
}

// What changed between two sets of folded lines: [[line, folded], ...].
function foldChanges(before, after) {
  return [
    ...[...after].filter((line) => !before.has(line)).map((l) => [l, true]),
    ...[...before].filter((line) => !after.has(line)).map((l) => [l, false]),
  ];
}

// The strip between the editors: a band per group of matched lines.
function drawStrip(state) {
  const { strip, editors, link, active } = state;
  if (!strip?.isConnected) {
    return;
  }
  const box = strip.getBoundingClientRect();
  const span = (side, first, last) => {
    const editor = editors[side];
    const node = editor.getDomNode();
    if (!node || last >= lineCount(editor)) {
      return undefined;
    }
    const rect = node.getBoundingClientRect();
    const offset = rect.top - box.top - editor.getScrollTop();
    const top = offset + editor.getTopForLineNumber(first + 1);
    const bottom = offset + editor.getBottomForLineNumber(last + 1);
    const [low, high] = [rect.top - box.top, rect.bottom - box.top];
    if (bottom <= low || top >= high) {
      return undefined;
    }
    return { top: clamp(top, low, high), bottom: clamp(bottom, low, high) };
  };
  const paths = connectorPaths(link, span, box.width, active);
  strip.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  strip.innerHTML = paths
    .map(
      ({ colour, active: strong, d }) =>
        `<path class="map-link map-c${colour}${strong ? ' map-active' : ''}" d="${d}"/>`
    )
    .join('');
}

function makeState(api, editors, strip) {
  const state = {
    api,
    editors,
    strip,
    link: lineLink([], editors.map(lineCount)),
    regions: regionLink(),
    activeRegion: undefined,
    active: undefined,
    applying: false,
    settledAt: 0,
    folded: [new Set(), new Set()],
    collections: editors.map((editor) => editor.createDecorationsCollection()),
    frame: 0,
    disposed: false,
  };
  // Paints the colours of both editors and, at the next frame, the strip.
  state.paint = () => {
    state.collections.forEach((collection, side) => {
      collection.set([
        ...mappingDecorations(
          state.link,
          side,
          state.active,
          lineCount(editors[side])
        ),
        ...regionDecorations(state.regions, side, state.activeRegion),
      ]);
    });
    state.redraw();
  };
  state.redraw = () => {
    if (state.frame || state.disposed) {
      return;
    }
    state.frame = globalThis.requestAnimationFrame(() => {
      state.frame = 0;
      if (!state.disposed) {
        drawStrip(state);
      }
    });
  };
  return state;
}

// The cursor or the selection moved on one side: the same lines are
// selected on the other side and the group under the cursor is coloured.
function followSelection(state, side, event) {
  if (
    state.applying ||
    event.source === 'api' ||
    event.reason === contentFlush
  ) {
    return;
  }
  const { selection } = event;
  const [first, last] = selectionLines(selection);
  state.active = state.link.groupAt(side, selection.positionLineNumber - 1);
  state.activeRegion = state.regions.groupAt(side, {
    lineNumber: selection.startLineNumber,
    column: selection.startColumn,
  });
  const other = state.editors[1 - side];
  const count = lineCount(other);
  if (count) {
    const { lines } = state.link.mapRange(side, first, last);
    const [from, to] = lines.map((line) => clamp(line, 0, count - 1) + 1);
    const model = other.getModel();
    state.applying = true;
    try {
      const regions = state.regions.mapSelection(side, selection);
      if (regions.length) {
        const ranges = regions.map((range) =>
          state.regions.positions[1 - side].range(range)
        );
        if (selection.isEmpty()) {
          other.setPosition({
            lineNumber: ranges[0].startLineNumber,
            column: ranges[0].startColumn,
          });
        } else {
          other.setSelections(
            ranges.map(
              (range) =>
                new state.api.Selection(
                  range.startLineNumber,
                  range.startColumn,
                  range.endLineNumber,
                  range.endColumn
                )
            )
          );
        }
        other.revealRangeInCenterIfOutsideViewport(ranges[0]);
      } else if (selection.isEmpty()) {
        other.setPosition({
          lineNumber: from,
          column: model.getLineFirstNonWhitespaceColumn(from) || 1,
        });
      } else {
        other.setSelection({
          startLineNumber: from,
          startColumn: 1,
          endLineNumber: to,
          endColumn: model.getLineMaxColumn(to),
        });
      }
      other.revealLinesInCenterIfOutsideViewport(from, to);
    } finally {
      state.applying = false;
    }
  }
  state.paint();
}

// One editor scrolled: the other scrolls to the matching line.
function followScroll(state, side, event) {
  state.redraw();
  if (state.applying || !event.scrollTopChanged) {
    return;
  }
  const position = state.link.mapPosition(
    side,
    topPosition(state.editors[side])
  );
  state.applying = true;
  try {
    scrollToPosition(state.editors[1 - side], position);
  } finally {
    state.applying = false;
  }
}

// Regions were folded or unfolded on one side: the matching regions on
// the other side follow.
async function followFolding(state, side) {
  const quiet = state.applying || Date.now() < state.settledAt;
  const model = await foldingModel(state.editors[side]);
  const after = foldedStarts(model?.regions);
  const changes = foldChanges(state.folded[side], after);
  state.folded[side] = after;
  state.redraw();
  if (quiet || state.disposed || !changes.length) {
    return;
  }
  const other = await foldingModel(state.editors[1 - side]);
  if (!other || state.disposed) {
    return;
  }
  const { regions } = other;
  const toggled = new Map();
  for (const [line, folded] of changes) {
    const { lines } = state.link.mapRange(side, line);
    const index = regionStartingIn(regions, ...lines);
    if (index >= 0 && regions.isCollapsed(index) !== folded) {
      toggled.set(index, regions.toRegion(index));
    }
  }
  debug('sync', 'folding', side, changes, [...toggled.keys()]);
  if (toggled.size) {
    state.applying = true;
    try {
      other.toggleCollapseState([...toggled.values()]);
    } finally {
      state.applying = false;
    }
  }
  state.folded[1 - side] = foldedStarts(other.regions);
}

// After a text changed, the folded regions are looked at again before
// folding is followed.
function settle(state) {
  state.settledAt = Date.now() + settleTime;
  globalThis.clearTimeout(state.settleTimer);
  state.settleTimer = globalThis.setTimeout(async () => {
    const models = await Promise.all(state.editors.map(foldingModel));
    models.forEach((model, side) => {
      state.folded[side] = foldedStarts(model?.regions);
    });
    state.redraw();
  }, settleTime + 100);
}

// Links two Monaco editors ([source, target]); `strip` is the <svg>
// between them, if any. update(lineMap) is called whenever either text or
// the translation changes.
export function linkEditors(api, editors, strip) {
  const state = makeState(api, editors, strip);
  const subscriptions = editors.flatMap((editor, side) => [
    editor.onDidChangeCursorSelection((event) =>
      followSelection(state, side, event)
    ),
    editor.onDidScrollChange((event) => followScroll(state, side, event)),
    editor.onDidChangeHiddenAreas(() => followFolding(state, side)),
    editor.onDidChangeModelContent(() => settle(state)),
    editor.onDidLayoutChange(() => state.redraw()),
    editor.onDidContentSizeChange(() => state.redraw()),
  ]);
  const resize = () => state.redraw();
  globalThis.addEventListener?.('resize', resize);
  return {
    update(lineMap, regionMap) {
      state.link = lineLink(lineMap, editors.map(lineCount));
      state.regions = regionLink(
        regionMap,
        editors.map((editor) => editor.getModel()?.getValue() ?? '')
      );
      const position = editors[0].getPosition();
      state.active =
        position && editors[0].hasTextFocus()
          ? state.link.groupAt(0, position.lineNumber - 1)
          : undefined;
      state.activeRegion =
        position && editors[0].hasTextFocus()
          ? state.regions.groupAt(0, position)
          : undefined;
      debug('sync', 'line map', lineMap, state.link.groups.length);
      state.paint();
    },
    dispose() {
      state.disposed = true;
      globalThis.cancelAnimationFrame(state.frame);
      globalThis.clearTimeout(state.settleTimer);
      globalThis.removeEventListener?.('resize', resize);
      subscriptions.forEach((it) => it.dispose());
      for (const collection of state.collections) {
        try {
          collection.clear();
        } catch {
          // The editor is gone already.
        }
      }
      if (strip) {
        strip.innerHTML = '';
      }
    },
  };
}

// The React side: `panes` are [source, target] as CodeEditor's onMount
// gives them ({ editor, api } or undefined); the link is made when both
// are there and follows `lineMap` and the texts (whose line counts it
// needs).
export function useEditorSync(
  panes,
  strip,
  lineMap,
  regionMap,
  source,
  target
) {
  const [sourcePane, targetPane] = panes;
  const link = useRef();
  useEffect(() => {
    if (!sourcePane || !targetPane) {
      return undefined;
    }
    const linked = linkEditors(
      sourcePane.api,
      [sourcePane.editor, targetPane.editor],
      strip.current
    );
    link.current = linked;
    return () => {
      linked.dispose();
      link.current = undefined;
    };
  }, [sourcePane, targetPane, strip]);
  useEffect(() => {
    link.current?.update(lineMap, regionMap);
  }, [sourcePane, targetPane, lineMap, regionMap, source, target]);
}
