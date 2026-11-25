import { createElement as h, useEffect, useState } from 'react';
import { templateKeys } from '../../../js/src/natural/catalog.js';
import {
  formatRules,
  readRules,
} from '../../../js/src/translation/rules-notation.js';
import { CodeEditor } from './CodeEditor.js';
import { linoLexicon } from './highlight.js';

// A visual editor for translation rules given as data, on a tab of its
// own: one table per stage of the pipeline, and the same rules as indented
// Links Notation, the text the command line (--rules) and the server read. Every label is in the interface language (rules.* in
// locales/app.lino); each stage has a title and a hint there.
export const stages = ['source', 'templates', 'names', 'output'];

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

// How many rules the rows make.
export function ruleCount(rows) {
  const rules = toRules(rows);
  return (
    ['source', 'names', 'output'].reduce(
      (sum, stage) => sum + (rules[stage]?.length ?? 0),
      0
    ) +
    Object.values(rules.templates ?? {})
      .flatMap((keys) => Object.values(keys))
      .flat().length
  );
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

function RuleRow({ stage, row, index, update, remove, languages, t }) {
  const id = `rule-${stage}-${index}`;
  const set = (field) => (event) =>
    update({
      ...row,
      [field]:
        event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value,
    });
  const anyLanguage = [
    { value: '', label: t('rules.anyLanguage') },
    ...languages,
  ];
  const cells =
    stage === 'templates'
      ? [
          select(
            {
              'aria-label': t('rules.naturalLanguage'),
              id: `${id}-language`,
              value: row.language ?? '',
              onChange: set('language'),
            },
            [
              { value: '', label: t('rules.chooseLanguage') },
              ...languages.filter((language) => language.natural),
            ]
          ),
          select(
            {
              'aria-label': t('rules.template'),
              id: `${id}-key`,
              value: row.key ?? '',
              onChange: set('key'),
            },
            [
              { value: '', label: t('rules.chooseTemplate') },
              ...templateKeys.map((key) => ({ value: key, label: key })),
            ]
          ),
          input({
            'aria-label': t('rules.wording'),
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
                  'aria-label': t('rules.language'),
                  id: `${id}-language`,
                  value: row.language ?? '',
                  onChange: set('language'),
                },
                anyLanguage
              ),
          input({
            'aria-label': t('rules.find'),
            id: `${id}-find`,
            placeholder: t(stage === 'names' ? 'rules.name' : 'rules.findText'),
            value: row.find ?? '',
            onChange: set('find'),
          }),
          input({
            'aria-label': t('rules.replace'),
            id: `${id}-replace`,
            placeholder: t(
              stage === 'names' ? 'rules.newName' : 'rules.replaceText'
            ),
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
                h('span', null, t('rules.regex'))
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
        'aria-label': t('rules.remove'),
        'data-action': 'remove-rule',
        onClick: remove,
      },
      '×'
    )
  );
}

// The rules as indented Links Notation, the text the command line
// (--rules) and the server read: it follows the tables, and a text typed
// here replaces them when it is applied.
function TextView({ rows, onChange, engine, wrap, t }) {
  const current = formatRules(toRules(rows));
  const [draft, setDraft] = useState(current);
  const [problem, setProblem] = useState('');
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (!edited) {
      setDraft(current);
    }
  }, [current, edited]);
  const apply = () => {
    try {
      onChange(toRows(readRules(draft)));
      setProblem('');
      setEdited(false);
    } catch (error) {
      setProblem(error.message);
    }
  };
  return h(
    'section',
    { className: 'rules-text', 'aria-labelledby': 'rules-text-title' },
    h('h3', { id: 'rules-text-title' }, t('rules.text')),
    h('p', { className: 'hint' }, t('rules.textHint')),
    h(
      'div',
      { className: 'field' },
      h(CodeEditor, {
        id: 'rules-text',
        engine,
        wrap,
        label: t('rules.text'),
        value: draft,
        lexicon: linoLexicon,
        onChange: (text) => {
          setDraft(text);
          setEdited(true);
        },
      })
    ),
    h(
      'div',
      { className: 'actions' },
      h(
        'button',
        {
          type: 'button',
          id: 'apply-rules',
          className: 'primary',
          disabled: !edited,
          onClick: apply,
        },
        t('rules.applyText')
      ),
      h(
        'button',
        {
          type: 'button',
          id: 'reset-rules-text',
          disabled: !edited,
          onClick: () => {
            setEdited(false);
            setDraft(current);
            setProblem('');
          },
        },
        t('rules.resetText')
      )
    ),
    problem
      ? h(
          'p',
          { id: 'rules-text-error', className: 'error', role: 'alert' },
          problem
        )
      : null
  );
}

export function RulesEditor({
  rows,
  onChange,
  languages,
  error,
  engine,
  wrap,
  t,
}) {
  const setStage = (stage, list) => onChange({ ...rows, [stage]: list });
  return h(
    'section',
    { className: 'rules-editor', 'aria-labelledby': 'rules-title' },
    h('h2', { id: 'rules-title' }, t('rules.title')),
    h('p', null, t('rules.intro')),
    stages.map((id) =>
      h(
        'fieldset',
        { key: id, className: 'rule-stage', id: `stage-${id}` },
        h('legend', null, t(`rules.${id}.title`)),
        h('p', { className: 'hint' }, t(`rules.${id}.hint`)),
        (rows[id] ?? []).map((row, index) =>
          h(RuleRow, {
            key: index,
            stage: id,
            row,
            index,
            languages,
            t,
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
          `+ ${t('rules.add')}`
        )
      )
    ),
    h(TextView, { rows, onChange, engine, wrap, t }),
    error
      ? h('p', { id: 'rules-error', role: 'alert', className: 'error' }, error)
      : null
  );
}
