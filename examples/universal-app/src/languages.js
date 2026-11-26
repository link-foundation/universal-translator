// The languages a picker lists: one entry per language (one Python, one
// English), each with the versions to choose from. A choice is the
// identifier the translator reads: "python", "python@2", "english-british".

import { versionsOf } from '../../../js/src/formal/versions.js';
import {
  baseNaturalLanguageIds,
  naturalLanguageVersions,
  preferredNaturalVersion,
} from '../../../js/src/natural/variants.js';
import { naturalLanguage } from '../../../js/src/natural/catalog.js';

function programmingEntry({ id, label, machine }) {
  const versions = versionsOf(id).map((version) => ({
    id: version.default ? id : `${id}@${version.version}`,
    label: version.default
      ? `${version.label} (default)`
      : `${version.label}${version.custom ? ' ★' : ''}`,
    kind: version.custom ? 'own' : 'version',
  }));
  // A language without built-in versions still has its default spelling
  // when versions of one's own are added to it.
  if (!versions.some((version) => version.id === id)) {
    versions.unshift({ id, label, kind: 'version' });
  }
  return {
    id,
    label,
    group: 'programming',
    ...(machine ? { machine: true } : {}),
    versions,
  };
}

const versionLabel = (version) =>
  [
    version.label,
    version.words ? `${version.words} words` : '',
    version.kind === 'own' ? '★' : '',
  ]
    .filter(Boolean)
    .join(' · ');

function naturalEntry(id) {
  return {
    id,
    label: naturalLanguage(id).label,
    group: 'natural',
    versions: naturalLanguageVersions(id).map((version) => ({
      id: version.id,
      label: versionLabel(version),
      kind: version.kind,
    })),
  };
}

// [{ id, label, group, versions: [{ id, label, kind }] }]
export function languageEntries(translator) {
  return [
    ...translator.languages().map(programmingEntry),
    ...baseNaturalLanguageIds()
      .map(naturalEntry)
      .sort((left, right) => left.label.localeCompare(right.label)),
  ];
}

// The entry a choice belongs to ("python@2" -> python, "minimal-english"
// -> english).
export function entryOf(entries, choice) {
  return (
    entries.find((entry) =>
      entry.versions.some((version) => version.id === choice)
    ) ?? entries.find((entry) => entry.id === choice.split('@')[0])
  );
}

// The version a language starts with: the reader's regional spelling for
// natural languages (American or British English from navigator.languages),
// the default version for programming languages.
export function defaultChoice(entry, browserLanguages = []) {
  return entry.group === 'natural'
    ? preferredNaturalVersion(entry.id, browserLanguages)
    : entry.id;
}

// Every choice of every entry, for random examples.
export const allChoices = (entries) =>
  entries.flatMap((entry) => entry.versions.map((version) => version.id));

// One choice per language, in the version the reader would start with.
export const defaultChoices = (entries, browserLanguages) =>
  entries.map((entry) => defaultChoice(entry, browserLanguages));
