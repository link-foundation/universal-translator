import {
  createElement as h,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createGrammarTranslator as createTranslator } from '../../../js/src/translator.js';
import { formatMeta } from '../../../js/src/meta/notation.js';
import catalogText from './locales/app.lino?raw';
import { createInterfaceText, interfaceLocale } from './i18n.js';
import { defaultChoices, languageEntries } from './languages.js';
import { exampleKinds, randomExample } from './examples.js';
import { LanguagePicker } from './LanguagePicker.js';
import { SettingsLink } from './SettingsLink.js';
import { StandardsView } from './StandardsView.js';
import { defaultStorage } from './saved-standards.js';
import { applySettings, saveSettings, settingsSchema } from './settings.js';

const repositoryUrl =
  import.meta.env.VITE_REPOSITORY_URL ??
  'https://github.com/link-foundation/universal-translator';

const modes = ['context-dependent', 'literal', 'same-effect'];

// The Rosetta Code tasks random examples are cut from, by task name.
const programs = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../programs/*.js', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  ).map(([path, source]) => [path.split('/').at(-1).slice(0, -3), source])
);

export const translator = createTranslator();
const storage = defaultStorage();
const browserLanguages = () => globalThis.navigator?.languages ?? [];

// translateFragment accepts a program, functions or statements and returns
// the same kind of fragment; translate needs a whole program.
export function translateText(source, from, to, { fragment, ...options }) {
  const run = fragment ? translator.translateFragment : translator.translate;
  try {
    return { output: run(source, from, to, options) };
  } catch (error) {
    return { error: error.message };
  }
}

// The meta language of a text, as indented Links Notation.
function metaText(source, language) {
  try {
    return {
      output: formatMeta(translator.parseFragment(source, language).program),
    };
  } catch (error) {
    return { error: error.message };
  }
}

// A random number generator with a seed (mulberry32), so "?seed=7" shows the
// same examples every time; Math.random otherwise.
function seededRandom(search = globalThis.location?.search ?? '') {
  const seed = Number(new URLSearchParams(search).get('seed'));
  if (!Number.isFinite(seed) || seed === 0) {
    return Math.random;
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// The source in a new language: the translation already shown on the
// right, or else the source itself, written in that language; the text
// stays as it is when neither can be said in it.
export function sourceIn(next, { source, from, to, output }) {
  const attempts = [
    output !== undefined && [output, to],
    [source, from],
  ].filter(Boolean);
  for (const [text, language] of attempts) {
    try {
      return translator.translateFragment(text, language, next);
    } catch {
      // try the next one
    }
  }
  return source;
}

function TextPane({ id, label, result, editable, onChange }) {
  if (editable) {
    return h(
      'label',
      { className: 'field', htmlFor: id },
      h('span', null, label),
      h('textarea', {
        id,
        spellCheck: false,
        value: result.output,
        onChange: (event) => onChange(event.target.value),
      })
    );
  }
  return h(
    'div',
    { className: 'field', 'aria-live': 'polite' },
    h('span', null, label),
    result.error === undefined
      ? h('pre', { id }, result.output)
      : h(
          'pre',
          { id: `${id}-error`, role: 'alert', className: 'error' },
          result.error
        )
  );
}

function Examples({ onExample, t }) {
  const random = useRef();
  const [note, setNote] = useState('');
  const show = (kind) => {
    random.current ??= seededRandom();
    const example = onExample(kind, random.current);
    setNote(
      example
        ? t('examples.note', {
            kind: t(`examples.${kind}`),
            task: example.task,
          })
        : t('examples.none')
    );
  };
  return h(
    'div',
    {
      className: 'sample-list',
      role: 'group',
      'aria-label': t('examples.label'),
    },
    h('span', { className: 'muted' }, `${t('examples.label')}:`),
    exampleKinds.map((kind) =>
      h(
        'button',
        {
          key: kind,
          type: 'button',
          'data-kind': kind,
          onClick: () => show(kind),
        },
        t(`examples.${kind}`)
      )
    ),
    note && h('span', { id: 'example-note', className: 'muted' }, note)
  );
}

function Options({ state, update, natural, t }) {
  const { mode, fragment, showMeta, commentLanguage } = state;
  return h(
    'div',
    { className: 'options' },
    h(
      'label',
      { className: 'field', htmlFor: 'mode' },
      h('span', null, t('options.mode')),
      h(
        'select',
        {
          id: 'mode',
          value: mode,
          onChange: (event) => update({ mode: event.target.value }),
        },
        modes.map((name) => h('option', { key: name, value: name }, name))
      )
    ),
    h(
      'label',
      { className: 'field', htmlFor: 'comment-language' },
      h('span', null, t('options.comments')),
      h(
        'select',
        {
          id: 'comment-language',
          value: commentLanguage,
          onChange: (event) => update({ commentLanguage: event.target.value }),
        },
        h('option', { value: '' }, t('options.commentsSame')),
        natural.map((entry) =>
          h('option', { key: entry.id, value: entry.id }, entry.label)
        )
      )
    ),
    h(
      'label',
      { className: 'check', htmlFor: 'fragment' },
      h('input', {
        id: 'fragment',
        type: 'checkbox',
        checked: fragment,
        onChange: (event) => update({ fragment: event.target.checked }),
      }),
      h('span', null, t('options.fragment'))
    ),
    h(
      'label',
      { className: 'check', htmlFor: 'show-meta' },
      h('input', {
        id: 'show-meta',
        type: 'checkbox',
        checked: showMeta,
        onChange: (event) => update({ showMeta: event.target.checked }),
      }),
      h('span', null, t('options.meta'))
    )
  );
}

function About({ entries, t }) {
  const count = (group) =>
    entries.filter((entry) => entry.group === group).length;
  return h(
    'aside',
    { className: 'distribution-panel', 'aria-labelledby': 'about-title' },
    h('h2', { id: 'about-title' }, t('about.title')),
    h(
      'p',
      null,
      t('about.text', {
        programming: count('programming'),
        natural: count('natural'),
      })
    ),
    h('p', null, t('about.fragments')),
    h(
      'a',
      {
        className: 'download-link',
        href: repositoryUrl,
        target: '_blank',
        rel: 'noreferrer',
      },
      t('about.source')
    )
  );
}

function Translate({ entries, state, update, t }) {
  const { source, from, to, mode, fragment, showMeta, commentLanguage } = state;
  const result = useMemo(
    () =>
      translateText(source, from, to, {
        fragment,
        mode,
        ...(commentLanguage ? { commentLanguage } : {}),
      }),
    [source, from, to, fragment, mode, commentLanguage]
  );
  const natural = entries.filter((entry) => entry.group === 'natural');
  // The left language changes: the text is said in it (from the
  // translation on the right when there is one).
  const changeFrom = (next) =>
    update({
      from: next,
      source: sourceIn(next, { ...state, output: result.output }),
    });
  const swap = () =>
    update({
      from: to,
      to: from,
      ...(result.output === undefined ? {} : { source: result.output }),
    });
  const onExample = (kind, random) => {
    const example = randomExample(translator, {
      programs,
      languages: defaultChoices(entries, browserLanguages()),
      kind,
      random,
    });
    if (example) {
      update({ from: example.from, to: example.to, source: example.source });
    }
    return example;
  };

  return h(
    'div',
    { className: 'translator-panel' },
    h(Examples, { onExample, t }),
    h(
      'div',
      { className: 'input-grid' },
      h(LanguagePicker, {
        id: 'source',
        label: t('picker.from'),
        value: from,
        entries,
        onChange: changeFrom,
        t,
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'swap',
          onClick: swap,
          'aria-label': t('picker.swap'),
          title: t('picker.swap'),
        },
        '⇄'
      ),
      h(LanguagePicker, {
        id: 'target',
        label: t('picker.to'),
        value: to,
        entries,
        onChange: (next) => update({ to: next }),
        t,
      })
    ),
    h(Options, { state, update, natural, t }),
    h(
      'div',
      { className: 'code-grid' },
      h(TextPane, {
        id: 'source-text',
        label: t('text.source'),
        result: { output: source },
        editable: true,
        onChange: (text) => update({ source: text }),
      }),
      h(TextPane, { id: 'target-text', label: t('text.translation'), result })
    ),
    showMeta &&
      h(
        'div',
        { className: 'code-grid meta' },
        h(TextPane, {
          id: 'source-meta',
          label: t('text.sourceMeta'),
          result: metaText(source, from),
        }),
        h(TextPane, {
          id: 'target-meta',
          label: t('text.targetMeta'),
          result:
            result.error === undefined
              ? metaText(result.output, to)
              : { output: '' },
        })
      )
  );
}

const initialState = {
  from: 'javascript',
  to: 'python',
  source: 'console.log("Hello World!");\n',
  mode: modes[0],
  fragment: true,
  showMeta: false,
  commentLanguage: '',
};

export function App({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [tab, setTab] = useState('translate');
  const [state, setState] = useState(initialState);
  const [revision, setRevision] = useState(0);
  const locale = interfaceLocale(settings.locale, browserLanguages());
  const text = useMemo(
    () => createInterfaceText(catalogText, locale),
    [locale]
  );
  const { t } = text;
  const schema = useMemo(() => settingsSchema(t), [t]);
  // Saved standards are new versions: the pickers list them after saving.
  const entries = useMemo(() => languageEntries(translator), [revision]);
  const update = useCallback(
    (changes) => setState((current) => ({ ...current, ...changes })),
    []
  );

  useEffect(() => {
    document.documentElement.lang = text.locale;
    document.documentElement.dir = text.direction;
    document.title = t('app.title');
  }, [text, t]);

  const changeSettings = (values) => {
    setSettings(values);
    saveSettings(schema, values, storage);
    applySettings(schema, values).catch((error) => console.warn(error));
  };
  const tabs = [
    ['translate', t('tabs.translate')],
    ['standards', t('tabs.standards')],
  ];

  return h(
    'main',
    { className: 'app-shell' },
    h(
      'header',
      { className: 'app-header' },
      h('p', { className: 'eyebrow' }, t('app.eyebrow')),
      h('h1', { id: 'translator-title' }, t('app.title')),
      h(
        'div',
        { className: 'tabs', role: 'tablist' },
        tabs.map(([id, label]) =>
          h(
            'button',
            {
              key: id,
              id: `tab-${id}`,
              type: 'button',
              role: 'tab',
              'aria-selected': tab === id,
              onClick: () => setTab(id),
            },
            label
          )
        )
      )
    ),
    tab === 'translate'
      ? h(
          'section',
          {
            className: 'workspace',
            role: 'tabpanel',
            'aria-labelledby': 'tab-translate',
          },
          h(Translate, { entries, state, update, t }),
          h(About, { entries, t })
        )
      : h(
          'section',
          { role: 'tabpanel', 'aria-labelledby': 'tab-standards' },
          h(StandardsView, {
            entries,
            storage,
            t,
            onSaved: () => setRevision((value) => value + 1),
            onUse: (id) => {
              update({ from: id, source: sourceIn(id, state) });
              setTab('translate');
            },
          })
        ),
    h(
      'footer',
      { className: 'app-footer' },
      h(SettingsLink, {
        schema,
        values: settings,
        messages: text.panelMessages,
        label: t('footer.settings'),
        onChange: changeSettings,
      })
    )
  );
}
