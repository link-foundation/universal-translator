import frequencies from '../../../data/translation/corpus-frequencies.json' with { type: 'json' };

export const codeTaskFrequency = (id) =>
  frequencies.code.languageTasks[id] ?? 0;

export function readingCounts(id, phrase, meanings) {
  const entry = frequencies.prose.readings[id]?.find(({ forms }) =>
    forms.includes(phrase)
  );
  if (!entry) {
    return undefined;
  }
  const counts = meanings.map((meaning) => entry.counts[meaning]);
  return counts.every((count) => count > 0) ? counts : undefined;
}
