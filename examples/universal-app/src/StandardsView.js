// The Standards tab: every word of a language with the meta language
// concept it stands for, editable and saved as a standard of one's own made
// from the closest language; and a standard of words defined through other
// words, grown from the semantic primes with definitions from Wikidata.

import { createElement as h, useMemo, useState } from 'react';
import { languageVocabulary } from '../../../js/src/formal/vocabulary.js';
import {
  addDefinition,
  createStandard,
  defineWord,
  expandWord,
  naturalVocabulary,
  standardEntries,
  standardSize,
  wikidataLookup,
} from '../../../js/src/natural/standards.js';
import { naturalLanguage } from '../../../js/src/natural/catalog.js';
import preCache from '../../../data/definitions/wikidata-english.lino?raw';
import { LanguagePicker } from './LanguagePicker.js';
import { entryOf } from './languages.js';
import {
  loadDefinitions,
  loadWordStandard,
  removeStandard,
  saveDefinitions,
  saveStandard,
  saveWordStandard,
  savedStandards,
} from './saved-standards.js';

const vocabularyOf = (group, choice) =>
  group === 'programming'
    ? languageVocabulary(choice)
    : naturalVocabulary(choice);

const splitWords = (text) =>
  text
    .split('\n')
    .map((word) => word.trim())
    .filter(Boolean);

function VocabularyTable({ entries, edits, filter, onEdit, t }) {
  const query = filter.trim().toLowerCase();
  const shown = entries.filter(
    (entry) =>
      !query ||
      entry.concept.toLowerCase().includes(query) ||
      (edits[entry.concept] ?? entry.words.join('\n'))
        .toLowerCase()
        .includes(query)
  );
  return h(
    'table',
    { className: 'vocabulary', id: 'vocabulary' },
    h(
      'thead',
      null,
      h(
        'tr',
        null,
        h('th', null, t('standards.concept')),
        h('th', null, t('standards.words'))
      )
    ),
    h(
      'tbody',
      null,
      shown.map((entry) => {
        const text = edits[entry.concept] ?? entry.words.join('\n');
        return h(
          'tr',
          {
            key: entry.concept,
            className: edits[entry.concept] === undefined ? '' : 'edited',
          },
          h('th', { scope: 'row' }, h('code', null, entry.concept)),
          h(
            'td',
            null,
            h('textarea', {
              'aria-label': entry.concept,
              'data-concept': entry.concept,
              rows: Math.max(1, Math.min(4, text.split('\n').length)),
              spellCheck: false,
              value: text,
              onChange: (event) => onEdit(entry.concept, event.target.value),
            })
          )
        );
      })
    )
  );
}

function SavedList({ storage, revision, onRemove, onUse, t }) {
  const saved = useMemo(() => savedStandards(storage), [storage, revision]);
  return h(
    'section',
    { className: 'saved', 'aria-labelledby': 'saved-title' },
    h('h3', { id: 'saved-title' }, t('standards.saved')),
    saved.length === 0
      ? h('p', { className: 'muted' }, t('standards.none'))
      : h(
          'ul',
          { id: 'saved-standards' },
          saved.map((item) =>
            h(
              'li',
              { key: item.id },
              h('span', null, `${item.label} `, h('code', null, item.id)),
              h(
                'button',
                { type: 'button', onClick: () => onUse(item.id) },
                t('standards.use')
              ),
              h(
                'button',
                { type: 'button', onClick: () => onRemove(item.id) },
                t('standards.remove')
              )
            )
          )
        )
  );
}

function VocabularyEditor({ entries: languages, storage, onSaved, onUse, t }) {
  const [closest, setClosest] = useState('python');
  const [edits, setEdits] = useState({});
  const [filter, setFilter] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState();
  const [revision, setRevision] = useState(0);
  const group = entryOf(languages, closest)?.group ?? 'programming';
  const vocabulary = useMemo(() => {
    try {
      return vocabularyOf(group, closest);
    } catch {
      return [];
    }
  }, [group, closest]);

  const choose = (choice) => {
    setClosest(choice);
    setEdits({});
    setStatus(undefined);
  };
  const save = () => {
    try {
      const id = saveStandard(storage, {
        closest,
        group,
        name,
        entries: vocabulary.map((entry) => ({
          concept: entry.concept,
          words:
            edits[entry.concept] === undefined
              ? entry.words
              : splitWords(edits[entry.concept]),
        })),
      });
      setStatus({ text: t('standards.savedAs', { id }) });
      setRevision((value) => value + 1);
      onSaved(id);
    } catch (error) {
      setStatus({ text: error.message, error: true });
    }
  };
  const remove = (id) => {
    removeStandard(storage, id);
    setRevision((value) => value + 1);
    onSaved(undefined);
  };

  return h(
    'section',
    { className: 'panel', 'aria-labelledby': 'standards-title' },
    h('h2', { id: 'standards-title' }, t('tabs.standards')),
    h('p', null, t('standards.intro')),
    h(
      'div',
      { className: 'standards-bar' },
      h(LanguagePicker, {
        id: 'closest',
        label: t('standards.closest'),
        value: closest,
        entries: languages,
        onChange: choose,
        t,
      }),
      h(
        'label',
        { className: 'field', htmlFor: 'vocabulary-filter' },
        h('span', null, t('standards.filter')),
        h('input', {
          id: 'vocabulary-filter',
          type: 'search',
          value: filter,
          onChange: (event) => setFilter(event.target.value),
        })
      )
    ),
    h(VocabularyTable, {
      entries: vocabulary,
      edits,
      filter,
      onEdit: (concept, text) => setEdits({ ...edits, [concept]: text }),
      t,
    }),
    h(
      'div',
      { className: 'standards-bar' },
      h(
        'label',
        { className: 'field', htmlFor: 'standard-name' },
        h('span', null, t('standards.name')),
        h('input', {
          id: 'standard-name',
          value: name,
          onChange: (event) => setName(event.target.value),
        })
      ),
      h(
        'button',
        {
          id: 'save-standard',
          type: 'button',
          className: 'primary',
          onClick: save,
        },
        t('standards.save')
      )
    ),
    status &&
      h(
        'p',
        {
          id: 'standard-status',
          role: status.error ? 'alert' : 'status',
          className: status.error ? 'error' : 'muted',
        },
        status.text
      ),
    h(SavedList, { storage, revision, onRemove: remove, onUse, t })
  );
}

function WordList({ standard, t }) {
  const entries = standardEntries(standard);
  const primitives = entries.filter((entry) => entry.kind !== 'composite');
  const composites = entries.filter((entry) => entry.kind === 'composite');
  return h(
    'div',
    { className: 'word-list' },
    h(
      'p',
      { className: 'primitives', id: 'primitive-words' },
      primitives.map((entry) =>
        h(
          'span',
          {
            key: entry.word,
            className: `chip ${entry.kind}`,
            title: entry.meaning,
          },
          entry.word
        )
      )
    ),
    h('h4', null, t('words.composite')),
    h(
      'ul',
      { id: 'composite-words' },
      composites.map((entry) =>
        h(
          'li',
          { key: entry.word },
          h(
            'details',
            null,
            h(
              'summary',
              null,
              h('strong', null, entry.word),
              ` — ${entry.definition}`
            ),
            h('p', { className: 'expansion' }, expandWord(standard, entry.word))
          )
        )
      )
    )
  );
}

function WordStandard({ storage, language, t }) {
  const definitions = useMemo(
    () => loadDefinitions(storage, preCache),
    [storage]
  );
  const lookup = useMemo(
    () => wikidataLookup({ cache: definitions, interval: 200 }),
    [definitions]
  );
  const [standard, setStandard] = useState(
    () =>
      loadWordStandard(storage, language) ??
      createStandard({ id: `${language}-words`, language })
  );
  const [word, setWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [status, setStatus] = useState();
  const [busy, setBusy] = useState(false);

  const keep = () => {
    saveWordStandard(storage, standard);
    setStandard({ ...standard });
  };
  const add = () => {
    try {
      addDefinition(standard, word, definition);
      keep();
      setStatus({ text: t('words.defined', { count: 1 }) });
      setDefinition('');
    } catch (error) {
      setStatus({ text: error.message, error: true });
    }
  };
  const define = async () => {
    setBusy(true);
    try {
      const result = await defineWord(standard, word, { lookup });
      saveDefinitions(storage, definitions);
      keep();
      setStatus({
        text: [
          t('words.defined', { count: result.added.length }),
          result.missing.length
            ? t('words.missing', { words: result.missing.join(', ') })
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
        error: !result.defined,
      });
    } catch (error) {
      setStatus({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return h(
    'section',
    { className: 'panel', 'aria-labelledby': 'words-title' },
    h(
      'h2',
      { id: 'words-title' },
      `${t('words.title')} · ${naturalLanguage(language).label}`
    ),
    h('p', null, t('words.intro', { limit: standard.limit })),
    h(
      'p',
      { id: 'standard-size', className: 'muted' },
      t('words.size', { size: standardSize(standard), limit: standard.limit })
    ),
    h(
      'div',
      { className: 'standards-bar' },
      h(
        'label',
        { className: 'field', htmlFor: 'new-word' },
        h('span', null, t('words.word')),
        h('input', {
          id: 'new-word',
          value: word,
          onChange: (event) => setWord(event.target.value),
        })
      ),
      h(
        'label',
        { className: 'field grow', htmlFor: 'new-definition' },
        h('span', null, t('words.definition')),
        h('input', {
          id: 'new-definition',
          value: definition,
          onChange: (event) => setDefinition(event.target.value),
        })
      ),
      h(
        'button',
        {
          id: 'add-word',
          type: 'button',
          onClick: add,
          disabled: !word.trim(),
        },
        t('words.add')
      ),
      h(
        'button',
        {
          id: 'define-word',
          type: 'button',
          onClick: define,
          disabled: busy || !word.trim(),
        },
        t('words.define')
      )
    ),
    status &&
      h(
        'p',
        {
          id: 'word-status',
          role: status.error ? 'alert' : 'status',
          className: status.error ? 'error' : 'muted',
        },
        status.text
      ),
    h(WordList, { standard, t })
  );
}

export function StandardsView({ entries, storage, onSaved, onUse, t }) {
  const [language, setLanguage] = useState('english');
  const natural = entries.filter((entry) => entry.group === 'natural');
  return h(
    'div',
    { className: 'standards' },
    h(VocabularyEditor, { entries, storage, onSaved, onUse, t }),
    h(
      'label',
      { className: 'field word-language', htmlFor: 'word-language' },
      h('span', null, t('words.language')),
      h(
        'select',
        {
          id: 'word-language',
          value: language,
          onChange: (event) => setLanguage(event.target.value),
        },
        natural.map((entry) =>
          h('option', { key: entry.id, value: entry.id }, entry.label)
        )
      )
    ),
    h(WordStandard, { key: language, storage, language, t })
  );
}
