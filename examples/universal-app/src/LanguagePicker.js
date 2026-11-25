// One select of languages (one entry per language) and, when the language
// has more than one, a select of its versions: Python 3 or 2, American or
// British English down to the semantic primes, standards of one's own.

import { createElement as h } from 'react';
import { defaultChoice, entryOf } from './languages.js';

const browserLanguages = () => globalThis.navigator?.languages ?? [];

export function LanguagePicker({ id, label, value, entries, onChange, t }) {
  const entry = entryOf(entries, value) ?? entries[0];
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
          value: entry.id,
          onChange: (event) =>
            onChange(
              defaultChoice(
                entries.find((it) => it.id === event.target.value),
                browserLanguages()
              )
            ),
        },
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
    entry.versions.length > 1 &&
      h(
        'label',
        { className: 'field version', htmlFor: `${id}-version` },
        h('span', null, t('picker.version')),
        h(
          'select',
          {
            id: `${id}-version`,
            value,
            onChange: (event) => onChange(event.target.value),
          },
          entry.versions.map((version) =>
            h('option', { key: version.id, value: version.id }, version.label)
          )
        )
      )
  );
}
