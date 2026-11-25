// Versions of a natural language. A menu lists each natural language once
// (one English, one Russian); its versions are:
//
//   region       regional spellings (American and British English), chosen
//                from the reader's browser languages
//   vocabulary   smaller vocabularies to downgrade to, from the full
//                vocabulary of the language down to its semantic primes
//   standard     controlled language standards with rules of their own
//
// The full vocabulary of the language is the default version.

import { naturalLanguage, naturalLanguageIds } from './catalog.js';

// What each profile is, and the size of its vocabulary where the standard
// fixes one (in words).
const profiles = {
  'cnl-default': { kind: 'region' },
  'special-english': { kind: 'vocabulary', words: 1500 },
  globish: { kind: 'vocabulary', words: 1500 },
  'asd-ste100': { kind: 'vocabulary', words: 875 },
  'basic-english': { kind: 'vocabulary', words: 850 },
  'minimal-english': { kind: 'vocabulary', words: 65, primes: true },
  'plain-language': { kind: 'standard' },
  ace: { kind: 'standard' },
  sbvr: { kind: 'standard' },
  gellish: { kind: 'standard' },
  'e-prime': { kind: 'standard' },
};

// Browser language tags that pick a regional version.
const regions = {
  'english-british': ['en-GB', 'en-AU', 'en-NZ', 'en-IE', 'en-ZA', 'en-IN'],
};

const kindOrder = ['full', 'region', 'vocabulary', 'standard'];

// The language a version belongs to ("minimal-english" -> "english").
export const baseOf = (id) => naturalLanguage(id).base ?? id;

// The natural languages a menu lists: one entry per language.
export const baseNaturalLanguageIds = () =>
  naturalLanguageIds().filter((id) => !naturalLanguage(id).base);

// Every version of a natural language, the default (full vocabulary) first,
// then regional spellings, smaller vocabularies from the largest down to the
// semantic primes, and the controlled language standards.
export function naturalLanguageVersions(id) {
  const base = baseOf(id);
  const versions = naturalLanguageIds()
    .filter((other) => baseOf(other) === base)
    .map((other) => {
      const language = naturalLanguage(other);
      const profile =
        other === base ? { kind: 'full' } : (profiles[language.profile] ?? {});
      return {
        id: other,
        label: language.label,
        kind: profile.kind ?? 'standard',
        ...(profile.words ? { words: profile.words } : {}),
        ...(profile.primes ? { primes: true } : {}),
        default: other === base,
      };
    });
  return versions.sort(
    (left, right) =>
      kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind) ||
      (right.words ?? Infinity) - (left.words ?? Infinity) ||
      left.id.localeCompare(right.id)
  );
}

// The version of a natural language that fits the reader's languages
// (navigator.languages, most preferred first): the first tag of the same
// language decides, so en-GB picks British English and en-US the default.
export function preferredNaturalVersion(id, browserLanguages = []) {
  const base = baseOf(id);
  const regional = Object.entries(regions).filter(
    ([version]) => baseOf(version) === base
  );
  for (const tag of browserLanguages.map((value) => value.toLowerCase())) {
    for (const [version, tags] of regional) {
      if (tags.some((known) => known.toLowerCase() === tag)) {
        return version;
      }
      if (
        tags.some(
          (known) => tag.split('-')[0] === known.split('-')[0].toLowerCase()
        )
      ) {
        return base;
      }
    }
  }
  return base;
}

// The version of a natural language with the vocabulary of its semantic
// primes (Minimal English, Minimal Russian, ...), if it has one.
export function primesVersion(id) {
  return naturalLanguageVersions(id).find((version) => version.primes)?.id;
}
