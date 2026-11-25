import { createElement as h, useState } from 'react';
import { templateKeys } from '../../../js/src/natural/catalog.js';

// A visual editor for translation rules given as data: one table per stage
// of the pipeline. The rules are the same JSON the library, the command
// line (--rules) and the server accept, and the JSON view edits them as
// text.
export const stages = [
  {
    id: 'source',
    title: 'Before reading (source text)',
    hint: 'Replace text in the source before it is read.',
  },
  {
    id: 'templates',
    title: 'Natural language wordings',
    hint: 'More wordings a natural language reads for a template.',
  },
  {
    id: 'names',
    title: 'Meta program (names)',
    hint: 'Rename variables and functions in the meta program.',
  },
  {
    id: 'output',
    title: 'After writing (target text)',
    hint: 'Replace text in the translation after it is written.',
  },
];

// The editor keeps templates as rows; the translator wants
// { language: { key: [templates] } }.
export function toRules(rows) {
  const rules = {};
  for (const stage of ['source', 'names', 'output']) {
    const list = (rows[stage] ?? [])
      .filter((row) => row.find)
      .map(({ find, replace = '', regex, language }) => ({
        find,
        replace,
        ...(stage === 'names' ? {} : { regex: Boolean(regex) }),
        ...(language && stage !== 'names' ? { language } : {}),
      }));
    if (list.length) {
      rules[stage] = list;
    }
  }
  const templates = {};
  for (const row of rows.templates ?? []) {
    if (row.language && row.key && row.text) {
      templates[row.language] ??= {};
      (templates[row.language][row.key] ??= []).push(row.text);
    }
  }
  if (Object.keys(templates).length) {
    rules.templates = templates;
  }
  return rules;
}

export function toRows(rules) {
  const rows = {
    source: rules.source ?? [],
    names: rules.names ?? [],
    output: rules.output ?? [],
    templates: [],
  };
  for (const [language, keys] of Object.entries(rules.templates ?? {})) {
    for (const [key, texts] of Object.entries(keys)) {
      for (const text of [texts].flat()) {
        rows.templates.push({ language, key, text });
      }
    }
  }
  return rows;
}

function input(props) {
  return h('input', { type: 'text', spellCheck: false, ...props });
}

function select(props, options) {
  return h(
    'select',
    props,
    options.map(({ value, label }) => h('option', { key: value, value }, label))
  );
}

function RuleRow({ stage, row, index, update, remove, languages }) {
  const id = `rule-${stage}-${index}`;
  const set = (field) => (event) =>
    update({
      ...row,
      [field]:
        event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value,
    });
  const anyLanguage = [{ value: '', label: 'Any language' }, ...languages];
  const cells =
    stage === 'templates'
      ? [
          select(
            {
              'aria-label': 'Natural language',
              id: `${id}-language`,
              value: row.language ?? '',
              onChange: set('language'),
            },
            [
              { value: '', label: 'Language…' },
              ...languages.filter((language) => language.natural),
            ]
          ),
          select(
            {
              'aria-label': 'Template',
              id: `${id}-key`,
              value: row.key ?? '',
              onChange: set('key'),
            },
            [
              { value: '', label: 'Template…' },
              ...templateKeys.map((key) => ({ value: key, label: key })),
            ]
          ),
          input({
            'aria-label': 'Wording',
            id: `${id}-text`,
            placeholder: '{left} is not above {right}',
            value: row.text ?? '',
            onChange: set('text'),
          }),
        ]
      : [
          stage === 'names'
            ? null
            : select(
                {
                  'aria-label': 'Language',
                  id: `${id}-language`,
                  value: row.language ?? '',
                  onChange: set('language'),
                },
                anyLanguage
              ),
          input({
            'aria-label': 'Find',
            id: `${id}-find`,
            placeholder: stage === 'names' ? 'name' : 'find',
            value: row.find ?? '',
            onChange: set('find'),
          }),
          input({
            'aria-label': 'Replace',
            id: `${id}-replace`,
            placeholder: stage === 'names' ? 'new name' : 'replace with',
            value: row.replace ?? '',
            onChange: set('replace'),
          }),
          stage === 'names'
            ? null
            : h(
                'label',
                { className: 'check' },
                h('input', {
                  type: 'checkbox',
                  id: `${id}-regex`,
                  checked: Boolean(row.regex),
                  onChange: set('regex'),
                }),
                h('span', null, 'Regex')
              ),
        ];
  return h(
    'div',
    { className: 'rule-row' },
    ...cells.filter(Boolean),
    h(
      'button',
      {
        type: 'button',
        className: 'remove',
        'aria-label': 'Remove rule',
        onClick: remove,
      },
      '×'
    )
  );
}

function JsonView({ rows, onChange }) {
  const current = JSON.stringify(toRules(rows), null, 2);
  const [draft, setDraft] = useState(current);
  const [problem, setProblem] = useState('');
  return h(
    'details',
    { className: 'rules-json' },
    h(
      'summary',
      { onClick: () => setDraft(current) },
      'Rules as JSON (import and export)'
    ),
    h('textarea', {
      id: 'rules-json',
      spellCheck: false,
      value: draft,
      onChange: (event) => setDraft(event.target.value),
    }),
    h(
      'button',
      {
        type: 'button',
        id: 'apply-json',
        onClick: () => {
          try {
            onChange(toRows(JSON.parse(draft)));
            setProblem('');
          } catch (error) {
            setProblem(error.message);
          }
        },
      },
      'Apply JSON'
    ),
    problem ? h('p', { className: 'error', role: 'alert' }, problem) : null
  );
}

export function RulesEditor({ rows, onChange, languages, error }) {
  const setStage = (stage, list) => onChange({ ...rows, [stage]: list });
  return h(
    'section',
    { className: 'rules-editor', 'aria-labelledby': 'rules-title' },
    h('h2', { id: 'rules-title' }, 'Translation rules'),
    h(
      'p',
      null,
      'Rules added here apply at their stage of every translation. They are kept in this browser.'
    ),
    stages.map(({ id, title, hint }) =>
      h(
        'fieldset',
        { key: id, className: 'rule-stage', id: `stage-${id}` },
        h('legend', null, title),
        h('p', { className: 'hint' }, hint),
        (rows[id] ?? []).map((row, index) =>
          h(RuleRow, {
            key: index,
            stage: id,
            row,
            index,
            languages,
            update: (next) =>
              setStage(
                id,
                rows[id].map((old, at) => (at === index ? next : old))
              ),
            remove: () =>
              setStage(
                id,
                rows[id].filter((_, at) => at !== index)
              ),
          })
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'add-rule',
            id: `add-${id}`,
            onClick: () => setStage(id, [...(rows[id] ?? []), {}]),
          },
          '+ Add rule'
        )
      )
    ),
    h(JsonView, { rows, onChange }),
    error
      ? h('p', { id: 'rules-error', role: 'alert', className: 'error' }, error)
      : null
  );
}
