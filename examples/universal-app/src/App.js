import { createElement as h, useEffect, useMemo, useState } from 'react';
import { createGrammarTranslator as createTranslator } from '../../../js/src/translator.js';
import { RulesEditor, toRules, toRows } from './RulesEditor.js';

const repositoryUrl =
  import.meta.env.VITE_REPOSITORY_URL ??
  'https://github.com/link-foundation/universal-translator';

const modes = ['context-dependent', 'literal', 'same-effect'];

// One fragment per kind: a whole program, a single function and a single
// statement all translate on their own, as long as they are complete.
export const samples = [
  {
    label: 'Statement',
    from: 'javascript',
    source: 'console.log("Hello World!");\n',
  },
  {
    label: 'Function',
    from: 'python',
    source:
      'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n',
  },
  {
    label: 'Program',
    from: 'rust',
    source:
      'fn main() {\n    for i in 1..=3 {\n        println!("{}", i * i);\n    }\n}\n',
  },
  {
    label: 'Sentence',
    from: 'english',
    source: 'Write “Hello World!” and end the line.\n',
  },
];

const translator = createTranslator();

// The source language "auto" is detected from the text. By default every
// part that translates is kept and the rest is listed with its reason;
// all-or-nothing shows only the first error. translateFragment accepts a
// program, functions or statements; translate needs a whole program.
export function translateText(
  source,
  from,
  to,
  { fragment, allOrNothing, rules, ...options }
) {
  let current = translator;
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
      return { error: 'Type a text to detect its language.' };
    }
    language = detected;
  }
  try {
    if (allOrNothing) {
      const run =
        fragment && current.translateFragment
          ? current.translateFragment
          : current.translate;
      return { output: run(source, language, to, options), detected };
    }
    const result = current.translatePartial(source, language, to, {
      ...options,
      fragment,
    });
    if (result.readLines === 0 && !result.complete) {
      return { error: result.errors[0].message, detected };
    }
    return {
      output: result.text,
      errors: result.errors,
      coverage: result.coverage,
      detected,
    };
  } catch (error) {
    return { error: error.message, detected };
  }
}

const storedRules = () => {
  try {
    return toRows(
      JSON.parse(globalThis.localStorage?.getItem('rules') ?? '{}')
    );
  } catch {
    return toRows({});
  }
};

function Untranslated({ errors, coverage }) {
  return h(
    'div',
    { id: 'untranslated', className: 'untranslated' },
    h(
      'p',
      null,
      `${Math.round(coverage * 100)}% of the lines translated; these parts could not be translated:`
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
            endLine > line ? `Lines ${line}-${endLine}: ` : `Line ${line}: `
          ),
          message
        )
      )
    )
  );
}

function LanguageSelect({ id, label, value, onChange, groups, auto }) {
  return h(
    'label',
    { className: 'field', htmlFor: id },
    h('span', null, label),
    h(
      'select',
      { id, value, onChange: (event) => onChange(event.target.value) },
      auto ? h('option', { value: 'auto' }, auto) : null,
      groups.map(({ label: groupLabel, languages }) =>
        h(
          'optgroup',
          { key: groupLabel, label: groupLabel },
          languages.map((language) =>
            h(
              'option',
              { key: language.id, value: language.id },
              language.label
            )
          )
        )
      )
    )
  );
}

function About({ groups }) {
  return h(
    'aside',
    { className: 'distribution-panel', 'aria-labelledby': 'about-title' },
    h('h2', { id: 'about-title' }, 'How it works'),
    h(
      'p',
      null,
      `Every text is read into a typed meta language and written back in the target. ${groups[0].languages.length} programming and ${groups[1].languages.length} natural languages are supported.`
    ),
    h(
      'p',
      null,
      'Paste a whole program, one function or one statement: a fragment only has to be complete, so a function must end with its closing.'
    ),
    h(
      'a',
      {
        className: 'download-link',
        href: repositoryUrl,
        target: '_blank',
        rel: 'noreferrer',
      },
      'Source and CLI'
    )
  );
}

export function App() {
  const groups = useMemo(
    () => [
      { label: 'Programming', languages: translator.languages() },
      { label: 'Natural', languages: translator.naturalLanguages() },
    ],
    []
  );
  const [from, setFrom] = useState('auto');
  const [to, setTo] = useState('python');
  const [source, setSource] = useState(samples[0].source);
  const [mode, setMode] = useState(modes[0]);
  const [fragment, setFragment] = useState(true);
  const [allOrNothing, setAllOrNothing] = useState(false);
  const [ruleRows, setRuleRows] = useState(storedRules);
  const rules = useMemo(() => toRules(ruleRows), [ruleRows]);
  useEffect(() => {
    globalThis.localStorage?.setItem('rules', JSON.stringify(rules));
  }, [rules]);
  const result = useMemo(
    () =>
      translateText(source, from, to, { fragment, mode, allOrNothing, rules }),
    [source, from, to, fragment, mode, allOrNothing, rules]
  );
  const ruleLanguages = useMemo(
    () => [
      ...groups[0].languages.map(({ id, label }) => ({ value: id, label })),
      ...groups[1].languages.map(({ id, label }) => ({
        value: id,
        label,
        natural: true,
      })),
    ],
    [groups]
  );
  const swap = () => {
    if (result.output !== undefined) {
      setSource(result.output);
    }
    setFrom(to);
    setTo(from === 'auto' ? (result.detected ?? 'python') : from);
  };

  return h(
    'main',
    { className: 'app-shell' },
    h(
      'section',
      { className: 'workspace', 'aria-labelledby': 'translator-title' },
      h(
        'div',
        { className: 'translator-panel' },
        h('p', { className: 'eyebrow' }, 'Natural ↔ meta ↔ formal'),
        h('h1', { id: 'translator-title' }, 'Universal Translator'),
        h(
          'div',
          { className: 'sample-list', role: 'group', 'aria-label': 'Samples' },
          samples.map((sample) =>
            h(
              'button',
              {
                key: sample.label,
                type: 'button',
                onClick: () => {
                  setFrom('auto');
                  setSource(sample.source);
                },
              },
              sample.label
            )
          )
        ),
        h(
          'div',
          { className: 'input-grid' },
          h(LanguageSelect, {
            id: 'source-language',
            label: 'From',
            value: from,
            onChange: setFrom,
            groups,
            auto:
              from === 'auto' && result.detected
                ? `Auto-detect (${result.detected})`
                : 'Auto-detect',
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'swap',
              onClick: swap,
              'aria-label': 'Swap languages',
            },
            '⇄'
          ),
          h(LanguageSelect, {
            id: 'target-language',
            label: 'To',
            value: to,
            onChange: setTo,
            groups,
          })
        ),
        h(
          'div',
          { className: 'options' },
          h(
            'label',
            { className: 'field', htmlFor: 'mode' },
            h('span', null, 'Mode'),
            h(
              'select',
              {
                id: 'mode',
                value: mode,
                onChange: (event) => setMode(event.target.value),
              },
              modes.map((name) => h('option', { key: name, value: name }, name))
            )
          ),
          h(
            'label',
            { className: 'check', htmlFor: 'fragment' },
            h('input', {
              id: 'fragment',
              type: 'checkbox',
              checked: fragment,
              onChange: (event) => setFragment(event.target.checked),
            }),
            h('span', null, 'Fragment (statement, function or program)')
          ),
          h(
            'label',
            { className: 'check', htmlFor: 'all-or-nothing' },
            h('input', {
              id: 'all-or-nothing',
              type: 'checkbox',
              checked: allOrNothing,
              onChange: (event) => setAllOrNothing(event.target.checked),
            }),
            h('span', null, 'All or nothing (no partial translation)')
          )
        ),
        h(
          'div',
          { className: 'code-grid' },
          h(
            'label',
            { className: 'field', htmlFor: 'source-text' },
            h('span', null, 'Source'),
            h('textarea', {
              id: 'source-text',
              spellCheck: false,
              value: source,
              onChange: (event) => setSource(event.target.value),
            })
          ),
          h(
            'div',
            { className: 'field', 'aria-live': 'polite' },
            h('span', null, 'Translation'),
            result.error === undefined
              ? h('pre', { id: 'target-text' }, result.output)
              : h(
                  'pre',
                  { id: 'target-error', role: 'alert', className: 'error' },
                  result.error
                ),
            result.errors?.length
              ? h(Untranslated, {
                  errors: result.errors,
                  coverage: result.coverage,
                })
              : null
          )
        ),
        h(RulesEditor, {
          rows: ruleRows,
          onChange: setRuleRows,
          languages: ruleLanguages,
          error: result.rulesError,
        })
      ),
      h(About, { groups })
    )
  );
}
