import { createElement as h, useMemo, useState } from 'react';
import { createGrammarTranslator as createTranslator } from '../../../js/src/translator.js';

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

// translateFragment accepts a program, functions or statements and returns
// the same kind of fragment; translate needs a whole program.
export function translateText(source, from, to, { fragment, ...options }) {
  const run =
    fragment && translator.translateFragment
      ? translator.translateFragment
      : translator.translate;
  try {
    return { output: run(source, from, to, options) };
  } catch (error) {
    return { error: error.message };
  }
}

function LanguageSelect({ id, label, value, onChange, groups }) {
  return h(
    'label',
    { className: 'field', htmlFor: id },
    h('span', null, label),
    h(
      'select',
      { id, value, onChange: (event) => onChange(event.target.value) },
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
  const [from, setFrom] = useState(samples[0].from);
  const [to, setTo] = useState('python');
  const [source, setSource] = useState(samples[0].source);
  const [mode, setMode] = useState(modes[0]);
  const [fragment, setFragment] = useState(true);
  const result = useMemo(
    () => translateText(source, from, to, { fragment, mode }),
    [source, from, to, fragment, mode]
  );
  const swap = () => {
    if (result.output !== undefined) {
      setSource(result.output);
    }
    setFrom(to);
    setTo(from);
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
                  setFrom(sample.from);
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
                )
          )
        )
      ),
      h(About, { groups })
    )
  );
}
