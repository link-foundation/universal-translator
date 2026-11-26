// The options of the Translate tab (issue 14):
//
// - under each language picker, the natural languages of its comments and
//   of its identifiers: on the left the ones the source is written in
//   (found from the text by default), on the right the ones the
//   translation is written in (the same as the source by default);
// - below the editors, how to translate and what to show.

import { createElement as h } from 'react';

export const modes = ['context-dependent', 'literal', 'same-effect'];

// The selectors under the pickers, by side: [state key, element id, the
// label key, the key of the label of the default choice].
const sideSelectors = {
  source: [
    ['commentFrom', 'comment-from', 'options.comments', 'picker.auto'],
    ['identifierFrom', 'identifier-from', 'options.identifiers', 'picker.auto'],
  ],
  target: [
    [
      'commentLanguage',
      'comment-language',
      'options.comments',
      'options.commentsSame',
    ],
    [
      'identifierLanguage',
      'identifier-language',
      'options.identifiers',
      'options.commentsSame',
    ],
  ],
};

// The options a translation is asked with: only those chosen.
export function languageOptions(state) {
  const options = {};
  for (const key of [
    'commentFrom',
    'commentLanguage',
    'identifierFrom',
    'identifierLanguage',
  ]) {
    if (state[key]) {
      options[key] = state[key];
    }
  }
  return options;
}

// After a swap the source is the old translation: what was chosen for the
// translation is now said of the source, and the other way round.
export function swappedLanguages(state) {
  return {
    commentFrom: state.commentLanguage ?? '',
    commentLanguage: state.commentFrom ?? '',
    identifierFrom: state.identifierLanguage ?? '',
    identifierLanguage: state.identifierFrom ?? '',
  };
}

function Select({ id, label, value, first, natural, onChange }) {
  return h(
    'label',
    { className: 'field', htmlFor: id },
    h('span', null, label),
    h(
      'select',
      { id, value, onChange: (event) => onChange(event.target.value) },
      h('option', { value: '' }, first),
      natural.map((entry) =>
        h('option', { key: entry.id, value: entry.id }, entry.label)
      )
    )
  );
}

// The comment and identifier languages of one side ('source' or 'target').
export function SideOptions({ side, state, update, natural, t }) {
  return h(
    'div',
    { className: `side-options side-${side}`, 'data-side': side },
    sideSelectors[side].map(([key, id, label, first]) =>
      h(Select, {
        key,
        id,
        label: t(label),
        value: state[key] ?? '',
        first: t(first),
        natural,
        onChange: (value) => update({ [key]: value }),
      })
    )
  );
}

function Check({ id, checked, label, onChange }) {
  return h(
    'label',
    { className: 'check', htmlFor: id },
    h('input', {
      id,
      type: 'checkbox',
      checked,
      onChange: (event) => onChange(event.target.checked),
    }),
    h('span', null, label)
  );
}

// The options below the editors.
export function Options({ state, update, wrap, onWrap, t }) {
  const { mode, fragment, showMeta, allOrNothing } = state;
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
    h(Check, {
      id: 'fragment',
      checked: fragment,
      label: t('options.fragment'),
      onChange: (value) => update({ fragment: value }),
    }),
    h(Check, {
      id: 'all-or-nothing',
      checked: allOrNothing,
      label: t('options.allOrNothing'),
      onChange: (value) => update({ allOrNothing: value }),
    }),
    h(Check, {
      id: 'show-meta',
      checked: showMeta,
      label: t('options.meta'),
      onChange: (value) => update({ showMeta: value }),
    }),
    h(Check, {
      id: 'word-wrap',
      checked: wrap,
      label: t('options.wrap'),
      onChange: onWrap,
    })
  );
}
