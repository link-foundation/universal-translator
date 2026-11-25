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
  const groups = [
    ['programming', t('picker.programming')],
    ['natural', t('picker.natural')],
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
        groups.map(([group, groupLabel]) =>
          h(
            'optgroup',
            { key: group, label: groupLabel },
            entries
              .filter((it) => it.group === group)
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
