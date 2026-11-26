// Monaco, the default editor of the text panes (the plain editor, a choice
// in the settings, needs none of it). It is loaded the first time a pane
// needs it (the package is large). The ESM
// editor API comes without its features: the ones a text pane uses are
// imported here (find, folding, brackets, clipboard, the context menu,
// several cursors and line operations). Every word is coloured by
// highlight.js, the highlighting taken from the meta language, through a
// tokens provider; the colours are the CSS variables of the skin. Where a
// pane folds is found by folding.js, the same way for every language.

import { initialState, highlightLine } from './highlight.js';
import { foldingRanges } from './folding.js';
import { debug } from './debug.js';

let loading;

export function loadMonaco() {
  loading ??= Promise.all([
    import('monaco-editor/editor/editor.api.js'),
    import('monaco-editor/editor/editor.worker.js?worker'),
    import('monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js'),
    import('monaco-editor/editor/contrib/clipboard/browser/clipboard.js'),
    import('monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js'),
    import('monaco-editor/editor/contrib/find/browser/findController.js'),
    import('monaco-editor/editor/contrib/folding/browser/folding.js'),
    import('monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js'),
    import('monaco-editor/editor/contrib/multicursor/browser/multicursor.js'),
    import('monaco-editor/editor/contrib/wordHighlighter/browser/wordHighlighter.js'),
    // The icon font: the arrows of the folding regions, the find widget.
    import('monaco-editor/features/codicon/register.js'),
  ]).then(([monaco, { default: EditorWorker }]) => {
    globalThis.MonacoEnvironment = { getWorker: () => new EditorWorker() };
    return monaco;
  });
  return loading;
}

// The state between lines: inside a block comment or a quoted text.
class LineState {
  constructor(value) {
    this.value = value;
  }

  clone() {
    return new LineState(this.value);
  }

  equals(other) {
    return (
      other instanceof LineState &&
      JSON.stringify(other.value) === JSON.stringify(this.value)
    );
  }
}

// One Monaco language per pane: each pane is coloured by its own lexicon
// (the words of its own meta program). Setting the provider again makes
// Monaco colour the text anew.
// A pane with no lexicon (a translation that failed) is plain text.
export function colourPane(monaco, language, lexicon) {
  if (!monaco.languages.getLanguages().some(({ id }) => id === language)) {
    monaco.languages.register({ id: language });
  }
  return monaco.languages.setTokensProvider(language, {
    getInitialState: () => new LineState(initialState()),
    tokenize(line, state) {
      if (!lexicon) {
        return { tokens: [{ startIndex: 0, scopes: '' }], endState: state };
      }
      const result = highlightLine(line, state.value, lexicon);
      return {
        tokens: result.tokens.map(({ from, type }) => ({
          startIndex: from,
          scopes: type,
        })),
        endState: new LineState(result.state),
      };
    },
  });
}

// The folding regions of a pane: brackets, indentation and comment lines
// (folding.js), for languages Monaco has no grammar for as well.
export function foldPane(monaco, language, lexicon) {
  return monaco.languages.registerFoldingRangeProvider(language, {
    provideFoldingRanges: (model) =>
      foldingRanges(model.getValue(), lexicon).map(({ start, end, kind }) => ({
        start,
        end,
        ...(kind === 'comment'
          ? { kind: monaco.languages.FoldingRangeKind.Comment }
          : {}),
      })),
  });
}

export const tokenTypes = [
  'keyword',
  'variable',
  'function',
  'string',
  'number',
  'comment',
  'delimiter',
  'attribute',
  'type',
];

// A CSS colour (any syntax: color-mix gives oklab()) as #rrggbb, as
// Monaco wants it: the browser paints one pixel with it and reads it back.
let canvas;
function hex(colour, doc) {
  canvas ??= doc.createElement('canvas').getContext('2d', {
    willReadFrequently: true,
  });
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillStyle = '#000000';
  canvas.fillStyle = colour || '#000000';
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

// Setting a theme is done only when its colours differ from the last one:
// Monaco restyles every editor of the page on each setTheme.
let painted = '';

export function applySkin(monaco, doc = globalThis.document) {
  const style = globalThis.getComputedStyle(doc.documentElement);
  const read = (name) => hex(style.getPropertyValue(name).trim(), doc);
  const dark = style.getPropertyValue('color-scheme').includes('dark')
    ? true
    : globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches &&
      doc.documentElement.dataset.scheme !== 'light';
  const theme = {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: tokenTypes.map((type) => ({
      token: type,
      foreground: read(`--hl-${type}`).slice(1),
    })),
    colors: {
      'editor.background': read('--field'),
      'editor.foreground': read('--ink'),
      'editorLineNumber.foreground': read('--muted'),
      'editorGutter.background': read('--field'),
    },
  };
  const signature = JSON.stringify(theme);
  if (signature === painted) {
    return false;
  }
  painted = signature;
  debug('monaco', 'skin', theme);
  monaco.editor.defineTheme('universal-translator', theme);
  monaco.editor.setTheme('universal-translator');
  return true;
}
