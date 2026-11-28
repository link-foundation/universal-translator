// Regenerate the aggregate code and prose counts from the pinned corpora.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const corpus = process.argv[2];
assert(corpus, 'Pass the pinned Tatoeba English–Russian .txt.gz file');

const rosetta = {
  path: 'docs/case-studies/issue-8/data/rosetta-code/coverage.json',
  sha256: 'ec4115e5d301e246cc09ba47ab77a45a40f236dbd97e893e413c36e809b2ecba',
};
const tatoeba = {
  url: 'https://raw.githubusercontent.com/Helsinki-NLP/Tatoeba-Challenge/bd05f087e91e359a88594bd6d6c99a079e0ac621/data/release/test/v2023-09-26/tatoeba-test-v2023-09-26.eng-rus.txt.gz',
  sha256: 'e7b420bb017e8191c41f4bdaf3725b764dcfcfae580b57c36e11bb5e884f025d',
};

function verified(file, sha256) {
  const bytes = readFileSync(file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
  return bytes;
}

const report = JSON.parse(
  verified(new URL(`../${rosetta.path}`, import.meta.url), rosetta.sha256)
);
const languageTasks = {};
for (const { languages } of report.tasks) {
  for (const language of Object.keys(languages)) {
    languageTasks[language] = (languageTasks[language] ?? 0) + 1;
  }
}
assert.deepEqual(
  languageTasks,
  Object.fromEntries(
    Object.entries(report.summary.languages).map(([id, { tasks }]) => [
      id,
      tasks,
    ])
  )
);

const forms = ['мир', 'мира', 'миру', 'миром', 'мире'];
const rows = gunzipSync(verified(corpus, tatoeba.sha256), {
  maxOutputLength: 8 * 1024 * 1024,
})
  .toString('utf8')
  .trimEnd()
  .split('\n');
const senseBySentence = new Map();
const words = (text) =>
  text
    .normalize('NFC')
    .toLowerCase()
    .match(/[\p{L}\p{M}]+/gu) ?? [];
for (const row of rows) {
  const [from, to, english, russian, extra] = row.split('\t');
  assert(from === 'eng' && to === 'rus' && russian && extra === undefined);
  const tokens = words(russian);
  if (!tokens.some((token) => forms.includes(token))) {
    continue;
  }
  const glosses = words(english);
  const world = glosses.includes('world') || glosses.includes('worlds');
  const peace = glosses.includes('peace');
  if (world === peace) {
    continue;
  }
  const gloss = world ? 1 : 2;
  const key = tokens.join(' ');
  senseBySentence.set(key, (senseBySentence.get(key) ?? 0) | gloss);
}
const counts = { 'concept:world': 0, 'concept:peace': 0 };
for (const senses of senseBySentence.values()) {
  if (senses === 1) {
    counts['concept:world'] += 1;
  } else if (senses === 2) {
    counts['concept:peace'] += 1;
  }
}
assert(Object.values(counts).every((count) => count > 0));
const frequencies = {
  code: {
    source: { ...rosetta, tasks: report.tasks.length },
    languageTasks: Object.fromEntries(Object.entries(languageTasks).sort()),
  },
  prose: {
    source: { ...tatoeba, rows: rows.length },
    readings: { russian: [{ forms, counts }] },
  },
};
if (process.argv.includes('--check')) {
  const checkedIn = new URL(
    '../data/translation/corpus-frequencies.json',
    import.meta.url
  );
  assert.deepEqual(frequencies, JSON.parse(readFileSync(checkedIn, 'utf8')));
  process.stdout.write(
    `Verified ${report.tasks.length} task counts and ${senseBySentence.size} aligned Russian sentences\n`
  );
} else {
  process.stdout.write(`${JSON.stringify(frequencies, null, 2)}\n`);
}
