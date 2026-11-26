// One select of languages (one entry per language) and a select of its
// versions: Python 3 or 2, American or
// British English down to the semantic primes, standards of one's own.
// With `auto` the first choice is to detect the language of the text.

import { createElement as h } from 'react';
import { defaultChoice, entryOf } from './languages.js';

const browserLanguages = () => globalThis.navigator?.languages ?? [];

export function LanguagePicker({
  id,
  label,
  value,
  entries,
  onChange,
  auto,
  t,
}) {
  const detecting = Boolean(auto) && value === 'auto';
  const entry = detecting ? undefined : (entryOf(entries, value) ?? entries[0]);
  // Assembly and intermediate languages are programming languages with
  // a group of their own.
  const groups = [
    [
      t('picker.programming'),
      (it) => it.group === 'programming' && !it.machine,
    ],
    [t('picker.machine'), (it) => it.machine],
    [t('picker.natural'), (it) => it.group === 'natural'],
  ];
  return h(
    'div',
    { className: 'picker' },
    h(
      'label',
      { className: 'field', htmlFor: `${id}-language` },
      h('span', null, label),
      h(
        'select',
        {
          id: `${id}-language`,
          value: detecting ? 'auto' : entry.id,
          onChange: (event) =>
            onChange(
              event.target.value === 'auto'
                ? 'auto'
                : defaultChoice(
                    entries.find((it) => it.id === event.target.value),
                    browserLanguages()
                  )
            ),
        },
        auto ? h('option', { value: 'auto' }, auto) : null,
        groups.map(([groupLabel, member]) =>
          h(
            'optgroup',
            { key: groupLabel, label: groupLabel },
            entries
              .filter(member)
              .map((it) => h('option', { key: it.id, value: it.id }, it.label))
          )
        )
      )
    ),
    // The version select is always there (disabled when there is nothing
    // to choose), so the pickers keep their width and place.
    h(
      'label',
      { className: 'field version', htmlFor: `${id}-version` },
      h('span', null, t('picker.version')),
      h(
        'select',
        {
          id: `${id}-version`,
          value: entry ? value : '',
          disabled: !entry || entry.versions.length < 2,
          onChange: (event) => onChange(event.target.value),
        },
        entry
          ? entry.versions.map((version) =>
              h('option', { key: version.id, value: version.id }, version.label)
            )
          : h('option', { value: '' }, '—')
      )
    )
  );
}
