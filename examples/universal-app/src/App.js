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
import { languageSyntax } from '../../../js/src/formal/languages.js';
import {
  isNaturalLanguage,
  naturalLanguage,
} from '../../../js/src/natural/catalog.js';
import {
  formatRules,
  readRules,
} from '../../../js/src/translation/rules-notation.js';
import catalogText from './locales/app.lino?raw';
import { createInterfaceText, interfaceLocale } from './i18n.js';
import { defaultChoices, languageEntries } from './languages.js';
import { exampleKinds, randomExample } from './examples.js';
import { LanguagePicker } from './LanguagePicker.js';
import { RulesEditor, ruleCount, toRules, toRows } from './RulesEditor.js';
import { SettingsLink } from './SettingsLink.js';
import { StandardsView } from './StandardsView.js';
import { defaultStorage } from './saved-standards.js';
import { applySettings, saveSettings, settingsSchema } from './settings.js';
import { CodeEditor } from './CodeEditor.js';
import {
  Options,
  SideOptions,
  languageOptions,
  styleOptions,
  modes,
  swappedLanguages,
} from './Options.js';
import { useEditorSync } from './editor-sync.js';
import { debug, timed } from './debug.js';
import { linoLexicon, metaWords, sourceLexicon } from './highlight.js';
import { issueReportUrl } from './report-issue.js';

const repositoryUrl =
  import.meta.env.VITE_REPOSITORY_URL ??
  'https://github.com/link-foundation/universal-translator';

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

// The source language "auto" is detected from the text. By default every
// part that translates is kept and the rest is listed with its reason;
// all-or-nothing shows only the first error. translateFragment accepts a
// program, functions or statements; translate needs a whole program.
// Rules given as data make a translator of their own.
export function translateText(source, from, to, options) {
  return timed('translate', `${from} -> ${to}`, () =>
    translateWith(source, from, to, options)
  );
}

function translateWith(
  source,
  from,
  to,
  { fragment, allOrNothing, rules, ...options }
) {
  let current;
  try {
    current = rules ? translator.withRules(rules) : translator;
  } catch (error) {
    return { error: error.message, rulesError: error.message };
  }
  let language = from;
  let detected;
  if (from === 'auto') {
    detected = current.detectLanguage(source)[0]?.id;
    if (!detected) {
      return { error: 'Type a text to detect its language.', undetected: true };
    }
    language = detected;
  }
  try {
    if (allOrNothing) {
      const run = fragment ? current.translateFragment : current.translate;
      return { output: run(source, language, to, options), detected };
    }
    const result = current.translatePartial(source, language, to, {
      ...options,
      fragment,
    });
    if (result.readLines === 0 && !result.complete) {
      return {
        error: result.errors[0].message,
        errors: result.errors,
        coverage: result.coverage,
        detected,
      };
    }
    return {
      output: result.text,
      errors: result.errors,
      coverage: result.coverage,
      lineMap: result.lineMap,
      regionMap: result.regionMap,
      detected,
    };
  } catch (error) {
    return { error: error.message, detected };
  }
}

// The meta program of a text, or undefined when it cannot be read.
function metaProgram(source, language) {
  try {
    return translator.parseFragment(source, language).program;
  } catch {
    return undefined;
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

// Comment markers and quotes of a language (or of the language a version
// of one's own is based on).
function syntaxOf(language) {
  try {
    return isNaturalLanguage(language)
      ? naturalLanguage(language)
      : languageSyntax(language);
  } catch {
    try {
      return languageSyntax(language.split('@')[0]);
    } catch {
      return {};
    }
  }
}

// The words of the last text of each language that could be read: while a
// text is typed it is often incomplete, and its names keep their colours.
const lastWords = new Map();

// How a text is coloured: the names and functions its meta program keeps
// and the comment markers and quotes of its language (highlight.js).
export function lexiconOf(text, language) {
  if (!language) {
    return undefined;
  }
  const program = metaProgram(text, language);
  if (program) {
    lastWords.set(language, metaWords(program));
  }
  const lexicon = sourceLexicon(
    syntaxOf(language),
    lastWords.get(language) ?? {}
  );
  debug('highlight', language, {
    names: [...lexicon.names],
    functions: [...lexicon.functions],
  });
  return lexicon;
}

// Rules edited in the browser are kept in it, as indented Links Notation
// (rules saved as JSON by earlier versions are still read).
const rulesKey = 'rules';
const storedRules = () => {
  try {
    return toRows(readRules(globalThis.localStorage?.getItem(rulesKey) ?? ''));
  } catch {
    return toRows({});
  }
};

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
  for (const [text, chosen] of attempts) {
    const language =
      chosen === 'auto' ? translator.detectLanguage(text)[0]?.id : chosen;
    try {
      return translator.translateFragment(text, language, next);
    } catch {
      // try the next one
    }
  }
  return source;
}

function TextPane({
  id,
  label,
  result,
  editable,
  onChange,
  lexicon,
  editor,
  onMount,
  t,
}) {
  const failed = result.error !== undefined;
  return h(
    'div',
    {
      className: 'field pane',
      ...(editable ? {} : { 'aria-live': 'polite' }),
    },
    h('label', { htmlFor: id, id: `${id}-label` }, label),
    failed
      ? h(
          'pre',
          { id: `${id}-error`, role: 'alert', className: 'error' },
          result.undetected ? t('text.undetected') : result.error
        )
      : h(CodeEditor, {
          id,
          engine: editor.engine,
          wrap: editor.wrap,
          label,
          value: result.output ?? '',
          readOnly: !editable,
          onChange,
          onMount,
          lexicon,
        })
  );
}

// The parts a partial translation could not translate, with their reasons.
function Untranslated({ errors, coverage, t }) {
  return h(
    'div',
    { id: 'untranslated', className: 'untranslated' },
    h(
      'p',
      null,
      t('untranslated.summary', { percent: Math.round(coverage * 100) })
    ),
    h(
      'ul',
      null,
      errors.map(({ line, endLine, message }) =>
        h(
          'li',
          { key: `${line}-${endLine}` },
          h(
            'strong',
            null,
            endLine > line
              ? t('untranslated.lines', { line, endLine })
              : t('untranslated.line', { line })
          ),
          ' ',
          message
        )
      )
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
    // Always there, on one line: a long task name does not push the
    // pickers down.
    h(
      'span',
      { id: 'example-note', className: 'muted example-note', title: note },
      note
    )
  );
}

function About({ entries, t }) {
  const count = (group) =>
    entries.filter((entry) => entry.group === group).length;
  return h(
    'aside',
    { className: 'about-panel panel', 'aria-labelledby': 'about-title' },
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

// The rules of the visual editor, kept in the browser, and the languages a
// rule can be limited to.
function useRules(entries) {
  const [ruleRows, setRuleRows] = useState(storedRules);
  const rules = useMemo(() => toRules(ruleRows), [ruleRows]);
  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(rulesKey, formatRules(rules));
    } catch {
      // The rules last for this visit only.
    }
  }, [rules]);
  // Rules that cannot make a translator, with the reason.
  const rulesError = useMemo(() => {
    try {
      translator.withRules(rules);
      return '';
    } catch (error) {
      return error.message;
    }
  }, [rules]);
  const count = ruleCount(ruleRows);
  const ruleLanguages = useMemo(
    () =>
      entries.map(({ id, label, group }) => ({
        value: id,
        label,
        ...(group === 'natural' ? { natural: true } : {}),
      })),
    [entries]
  );
  return { ruleRows, setRuleRows, rules, rulesError, count, ruleLanguages };
}

// The rules on the Rules tab apply here: how many, and their problem.
function RulesNote({ count, error, onOpen, t }) {
  return h(
    'p',
    { id: 'rules-note', className: error ? 'rules-note error' : 'rules-note' },
    h(
      'span',
      { role: error ? 'alert' : undefined },
      error ? t('rules.noteError', { error }) : t('rules.note', { count })
    ),
    ' ',
    h(
      'button',
      { type: 'button', className: 'link', onClick: onOpen },
      t('rules.open')
    )
  );
}

// The languages on either side, and the swap button between them; under
// each its comment and identifier languages (`below`).
function Pickers({
  entries,
  from,
  to,
  detected,
  onFrom,
  onSwap,
  onTo,
  below,
  t,
}) {
  const detectedLabel =
    entries.find(
      (entry) =>
        entry.id === detected ||
        entry.versions.some((version) => version.id === detected)
    )?.label ?? detected;
  return h(
    'div',
    { className: 'input-grid' },
    h(LanguagePicker, {
      id: 'source',
      label: t('picker.from'),
      value: from,
      entries,
      onChange: onFrom,
      auto:
        from === 'auto' && detected
          ? t('picker.autoDetected', { language: detectedLabel })
          : t('picker.auto'),
      t,
    }),
    h(
      'button',
      {
        type: 'button',
        className: 'swap',
        onClick: onSwap,
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
      onChange: onTo,
      t,
    }),
    below[0],
    h('span', { className: 'side-gap', 'aria-hidden': true }),
    below[1]
  );
}

// The meta language of both texts, side by side.
function MetaPanes({ source, reading, result, to, editor, t }) {
  return h(
    'div',
    { className: 'code-grid meta' },
    h(TextPane, {
      id: 'source-meta',
      label: t('text.sourceMeta'),
      result: reading ? metaText(source, reading) : { output: '' },
      lexicon: linoLexicon,
      editor,
      t,
    }),
    h(TextPane, {
      id: 'target-meta',
      label: t('text.targetMeta'),
      result:
        result.error === undefined
          ? metaText(result.output, to)
          : { output: '' },
      lexicon: linoLexicon,
      editor,
      t,
    })
  );
}

// The source and its translation side by side, kept in step when both are
// Monaco editors (editor-sync.js): selection, cursor, scrolling, folding
// and the colours of the lines that match, with a strip between them.
function Editors({ source, result, update, lexicons, editor, t }) {
  const [sourcePane, setSourcePane] = useState();
  const [targetPane, setTargetPane] = useState();
  const strip = useRef();
  const linked = editor.engine !== 'plain';
  useEditorSync(
    [sourcePane, targetPane],
    strip,
    result.lineMap,
    result.regionMap,
    source,
    result.output
  );
  return h(
    'div',
    { className: linked ? 'code-grid linked' : 'code-grid' },
    h(TextPane, {
      id: 'source-text',
      label: t('text.source'),
      result: { output: source },
      editable: true,
      onChange: (text) => update({ source: text }),
      onMount: setSourcePane,
      lexicon: lexicons[0],
      editor,
      t,
    }),
    linked
      ? h('svg', {
          ref: strip,
          className: 'map-strip',
          'aria-hidden': true,
          'data-line-map': result.lineMap ? result.lineMap.length : 0,
          'data-region-map': result.regionMap ? result.regionMap.length : 0,
        })
      : null,
    h(TextPane, {
      id: 'target-text',
      label: t('text.translation'),
      result,
      onMount: setTargetPane,
      lexicon: lexicons[1],
      editor,
      t,
    })
  );
}

// The translation of the text as it is now, with the options chosen.
function useTranslation(state, rules) {
  const { source, from, to, mode, fragment, allOrNothing } = state;
  const { commentFrom, commentLanguage, identifierFrom, identifierLanguage } =
    state;
  const { braces, indent } = state;
  return useMemo(
    () =>
      translateText(source, from, to, {
        fragment,
        mode,
        allOrNothing,
        rules: rules.rules,
        ...languageOptions({
          commentFrom,
          commentLanguage,
          identifierFrom,
          identifierLanguage,
        }),
        ...styleOptions({ braces, indent }),
      }),
    [
      source,
      from,
      to,
      fragment,
      mode,
      allOrNothing,
      rules.rules,
      commentFrom,
      commentLanguage,
      identifierFrom,
      identifierLanguage,
      braces,
      indent,
    ]
  );
}

function Translate({
  entries,
  state,
  update,
  rules,
  result,
  editor,
  onWrap,
  t,
}) {
  const { source, from, to, showMeta } = state;
  const natural = entries.filter((entry) => entry.group === 'natural');
  // The language the text is read in: the one chosen, or the detected one.
  const reading = from === 'auto' ? result.detected : from;
  const failed = result.error !== undefined;
  // How each pane is coloured (highlight.js).
  const sourceLexicon = useMemo(
    () => lexiconOf(source, reading),
    [source, reading]
  );
  const targetLexicon = useMemo(
    () => (failed ? undefined : lexiconOf(result.output, to)),
    [failed, result.output, to]
  );
  // Correcting detection changes how the input is read. It never rewrites
  // the user's input with a translation or partial-translation diagnostics.
  const changeFrom = (next) => update({ from: next });
  const swap = () =>
    update({
      from: to,
      to: reading ?? 'python',
      ...swappedLanguages(state),
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
  const side = (name) =>
    h(SideOptions, { side: name, state, update, natural, t });

  return h(
    'div',
    { className: 'translator-panel' },
    h(Examples, { onExample, t }),
    h(Pickers, {
      entries,
      from,
      to,
      detected: result.detected,
      onFrom: changeFrom,
      onSwap: swap,
      onTo: (next) => update({ to: next }),
      below: [side('source'), side('target')],
      t,
    }),
    rules.count || rules.rulesError
      ? h(RulesNote, {
          count: rules.count,
          error: rules.rulesError,
          onOpen: rules.open,
          t,
        })
      : null,
    h(Editors, {
      source,
      result,
      update,
      lexicons: [sourceLexicon, targetLexicon],
      editor,
      t,
    }),
    result.errors?.length
      ? h(Untranslated, { errors: result.errors, coverage: result.coverage, t })
      : null,
    showMeta && h(MetaPanes, { source, reading, result, to, editor, t }),
    h(Options, { state, update, wrap: editor.wrap, onWrap, t })
  );
}

// The source language is detected by default.
const initialState = {
  from: 'auto',
  to: 'python',
  source: 'console.log("Hello World!");\n',
  mode: modes[0],
  fragment: true,
  showMeta: false,
  commentFrom: '',
  commentLanguage: '',
  identifierFrom: '',
  identifierLanguage: '',
  allOrNothing: false,
  braces: '',
  indent: '',
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
  const rules = useRules(entries);
  const result = useTranslation(state, rules);
  const reportUrl = useMemo(
    () =>
      issueReportUrl(repositoryUrl, { ...state, rules: rules.rules }, result),
    [state, rules.rules, result]
  );
  rules.open = () => setTab('rules');
  const editor = {
    engine: settings.editor ?? 'monaco',
    wrap: settings.wrap ?? true,
  };
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
    debug('settings', values);
    setSettings(values);
    saveSettings(schema, values, storage);
    applySettings(schema, values).catch((error) => console.warn(error));
  };
  const tabs = [
    ['translate', t('tabs.translate')],
    ['rules', t('tabs.rules')],
    ['standards', t('tabs.standards')],
  ];
  const panels = {
    translate: () =>
      h(
        'section',
        {
          className: 'workspace',
          role: 'tabpanel',
          'aria-labelledby': 'tab-translate',
        },
        h(Translate, {
          entries,
          state,
          update,
          rules,
          result,
          editor,
          onWrap: (wrap) => changeSettings({ ...settings, wrap }),
          t,
        }),
        h(About, { entries, t })
      ),
    rules: () =>
      h(
        'section',
        {
          className: 'panel',
          role: 'tabpanel',
          'aria-labelledby': 'tab-rules',
        },
        h(RulesEditor, {
          rows: rules.ruleRows,
          onChange: rules.setRuleRows,
          languages: rules.ruleLanguages,
          error: rules.rulesError,
          engine: editor.engine,
          wrap: editor.wrap,
          t,
        })
      ),
    standards: () =>
      h(
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
  };

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
    panels[tab](),
    h(AppFooter, { schema, settings, text, t, reportUrl, changeSettings })
  );
}

function AppFooter({ schema, settings, text, t, reportUrl, changeSettings }) {
  return h(
    'footer',
    { className: 'app-footer' },
    h(SettingsLink, {
      schema,
      values: settings,
      messages: text.panelMessages,
      label: t('footer.settings'),
      onChange: changeSettings,
    }),
    h(
      'a',
      {
        id: 'report-issue',
        href: reportUrl,
        target: '_blank',
        rel: 'noreferrer',
      },
      t('footer.reportIssue')
    ),
    h(
      'a',
      { href: repositoryUrl, target: '_blank', rel: 'noreferrer' },
      t('footer.sourceCode')
    )
  );
}
