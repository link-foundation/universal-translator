// A text pane: the source (editable), the translation, the meta views and
// the rules. The Monaco editor (the default) is loaded the first time it is
// needed; the plain editor, a choice in the settings, is a textarea or a
// coloured <pre>.
// Both colour words the same way (highlight.js) and wrap long lines or not
// (the word-wrap setting).

import {
  createElement as h,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { highlightText, pieces } from './highlight.js';
import { debug } from './debug.js';
import { observeGutter } from './gutter-debug.js';

// The coloured lines of a read-only plain pane.
function Coloured({ text, lexicon }) {
  const lines = useMemo(() => {
    const all = text.split('\n');
    return highlightText(text, lexicon).map((tokens, index) =>
      pieces(all[index], tokens)
    );
  }, [text, lexicon]);
  return lines.map((parts, index) =>
    h(
      'span',
      { key: index, className: 'line' },
      parts.map(([part, type], at) =>
        type ? h('span', { key: at, className: `hl-${type}` }, part) : part
      ),
      index < lines.length - 1 ? '\n' : null
    )
  );
}

function PlainEditor({ id, value, onChange, readOnly, lexicon, className }) {
  if (!readOnly) {
    return h('textarea', {
      id,
      className,
      spellCheck: false,
      value,
      onChange: (event) => onChange(event.target.value),
    });
  }
  return h(
    'pre',
    { id, className },
    lexicon ? h(Coloured, { text: value, lexicon }) : value
  );
}

let panes = 0;

// The colours and the folding regions of a pane, set again when its
// lexicon changes.
function paneFeatures(api, module, language, lexicon) {
  const features = [
    module.colourPane(api, language, lexicon),
    module.foldPane(api, language, lexicon),
  ];
  return { dispose: () => features.forEach((it) => it.dispose()) };
}

// The Monaco pane grows with its text, between the height of the plain
// panes and 70% of the window; the pane beside it stretches to match.
// onMount({ editor, api }) is called when the editor is made, and
// onMount(undefined) when it is gone (editor-sync.js links two panes).
function MonacoEditor({
  id,
  value,
  onChange,
  onMount,
  readOnly,
  lexicon,
  wrap,
  label,
}) {
  const holder = useRef();
  const editor = useRef();
  const monaco = useRef();
  const language = useRef(`universal-translator-${(panes += 1)}`);
  const latest = useRef({ value, onChange, onMount, lexicon });
  latest.current = { value, onChange, onMount, lexicon };
  const [failed, setFailed] = useState('');

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import('./monaco.js')
      .then(async (module) => {
        const api = await module.loadMonaco();
        if (disposed) {
          return;
        }
        debug('monaco', 'loaded for', id);
        monaco.current = { api, module };
        // The lexicon of now: the text may have changed while loading.
        const provider = paneFeatures(
          api,
          module,
          language.current,
          latest.current.lexicon
        );
        module.applySkin(api);
        const instance = api.editor.create(holder.current, {
          value: latest.current.value,
          language: language.current,
          readOnly,
          ariaLabel: label,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: wrap ? 'on' : 'off',
          fontSize: 14,
          lineNumbersMinChars: 3,
          renderLineHighlight: readOnly ? 'none' : 'line',
          scrollbar: { alwaysConsumeMouseWheel: false },
          folding: true,
          showFoldingControls: 'always',
        });
        editor.current = instance;
        const gutter = observeGutter(instance, id);
        const fit = () => {
          const most = globalThis.innerHeight * 0.7;
          holder.current.style.minHeight = `${Math.min(
            most,
            Math.max(260, instance.getContentHeight())
          )}px`;
        };
        fit();
        const subscriptions = [
          instance.onDidContentSizeChange(fit),
          instance.onDidChangeModelContent(() => {
            const text = instance.getValue();
            if (text !== latest.current.value) {
              latest.current.onChange?.(text);
            }
          }),
        ];
        // The skin or the scheme changed: colour the editors anew.
        const repaint = () => module.applySkin(api);
        const observer = new globalThis.MutationObserver(repaint);
        observer.observe(globalThis.document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme', 'data-scheme', 'data-contrast'],
        });
        // Only the skin's stylesheet (settings.js) counts: Monaco writes
        // styles of its own to <head> when its theme is set.
        const skinChanged = (mutations) =>
          mutations.some(({ target, addedNodes, removedNodes }) =>
            [target, ...addedNodes, ...removedNodes].some(
              (node) => node.id === 'ui-theme'
            )
          );
        const styleObserver = new globalThis.MutationObserver((mutations) => {
          if (skinChanged(mutations)) {
            repaint();
          }
        });
        styleObserver.observe(globalThis.document.head, {
          childList: true,
          subtree: true,
        });
        const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
        media?.addEventListener('change', repaint);
        latest.current.onMount?.({ editor: instance, api });
        cleanup = () => {
          latest.current.onMount?.(undefined);
          provider.dispose();
          gutter?.dispose();
          subscriptions.forEach((it) => it.dispose());
          observer.disconnect();
          styleObserver.disconnect();
          media?.removeEventListener('change', repaint);
          instance.getModel()?.dispose();
          instance.dispose();
        };
      })
      .catch((error) => {
        debug('monaco', 'failed', error);
        setFailed(error.message);
      });
    return () => {
      disposed = true;
      cleanup();
    };
    // The editor is made once; its text and options follow below.
  }, []);

  useEffect(() => {
    const instance = editor.current;
    if (instance && instance.getValue() !== value) {
      instance.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    editor.current?.updateOptions({ wordWrap: wrap ? 'on' : 'off', readOnly });
  }, [wrap, readOnly]);

  useEffect(() => {
    if (monaco.current) {
      const { api, module } = monaco.current;
      const provider = paneFeatures(api, module, language.current, lexicon);
      return () => provider.dispose();
    }
    return undefined;
  }, [lexicon]);

  if (failed) {
    return h(PlainEditor, { id, value, onChange, readOnly, lexicon });
  }
  return h('div', {
    id,
    ref: holder,
    className: 'code-editor monaco',
    'data-editor': 'monaco',
    'data-value': value,
  });
}

// engine: 'monaco' (the default) or 'plain'.
export function CodeEditor({ engine = 'monaco', ...props }) {
  return engine === 'plain' ? h(PlainEditor, props) : h(MonacoEditor, props);
}
