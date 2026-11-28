import { debug, debugging } from './debug.js';

function selectionGeometry(gutter, { left, top }) {
  const selection = gutter.ownerDocument.getSelection();
  const bounds =
    selection?.rangeCount && !selection.isCollapsed
      ? selection.getRangeAt(0).getBoundingClientRect()
      : undefined;
  return {
    selectionType: selection?.type ?? 'None',
    selectionInGutter: [selection?.anchorNode, selection?.focusNode].some(
      (node) => node && gutter.contains(node)
    ),
    selectionBounds: bounds
      ? {
          left: bounds.left - left,
          top: bounds.top - top,
          width: bounds.width,
          height: bounds.height,
        }
      : null,
  };
}

export function observeGutter(editor, pane) {
  if (!debugging()) {
    return undefined;
  }
  const dom = editor.getDomNode();
  if (!dom) {
    return undefined;
  }
  const { ownerDocument } = dom;
  let frame;
  const marginAt = (target) => {
    const margin = target?.closest?.('.margin');
    return margin && dom.contains(margin) ? margin : undefined;
  };
  const observe = ({ type, clientX, clientY }, gutter) => {
    if (!gutter || !dom.contains(gutter)) {
      return;
    }
    const { top, left } = dom.getBoundingClientRect();
    const lines = editor.getModel()?.getLineCount() ?? 0;
    const lastLineBottom = lines
      ? editor.getBottomForLineNumber(lines) - editor.getScrollTop()
      : 0;
    const bars = [...gutter.querySelectorAll('.map-gutter')];
    debug('gutter', {
      pane,
      event: type,
      x: clientX - left,
      y: clientY - top,
      lines,
      lastLineBottom,
      mappingBars: bars.length,
      lastBarBottom: bars.length
        ? Math.max(...bars.map((bar) => bar.getBoundingClientRect().bottom)) -
          top
        : null,
      ...selectionGeometry(gutter, { left, top }),
    });
  };
  const press = (event) => observe(event, marginAt(event.target));
  const release = (event) => {
    // Pointer capture can send the release to a different element.
    const gutter = marginAt(
      ownerDocument.elementFromPoint(event.clientX, event.clientY)
    );
    if (!gutter) {
      return;
    }
    globalThis.cancelAnimationFrame(frame);
    // Read the browser selection after the pointer's default action.
    frame = globalThis.requestAnimationFrame(() => observe(event, gutter));
  };
  dom.addEventListener('pointerdown', press, true);
  ownerDocument.addEventListener('pointerup', release, true);
  return {
    dispose() {
      globalThis.cancelAnimationFrame(frame);
      dom.removeEventListener('pointerdown', press, true);
      ownerDocument.removeEventListener('pointerup', release, true);
    },
  };
}
