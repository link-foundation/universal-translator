import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { translate } from '../js/src/index.js';

const [corpus, baselineModule, ...requestedLanguages] = process.argv.slice(2);
assert.ok(
  corpus && baselineModule,
  'Pass the cached solutions.json, the baseline js/src/index.js, and optional language IDs'
);
const baseline = await import(pathToFileURL(resolve(baselineModule)).href);
const languages = requestedLanguages.length
  ? requestedLanguages
  : ['c', 'cpp', 'javascript', 'python', 'rust', 'typescript'];
const solutions = JSON.parse(readFileSync(corpus, 'utf8'));

// List candidate inputs for a later native comparison. A successful reader
// and writer can still change a program's behavior.
for (const [title, byLanguage] of Object.entries(solutions)) {
  for (const language of languages) {
    const source = byLanguage[language]?.[0];
    if (
      !source?.trim() ||
      source.length > 10_000 ||
      source.split('\n').length > 140
    ) {
      continue;
    }
    let previous;
    try {
      previous = baseline.translate(source, language, language);
    } catch (error) {
      previous = error;
    }
    if (typeof previous === 'string' && previous.trim()) {
      continue;
    }
    let current;
    try {
      current = translate(source, language, language);
    } catch {
      continue;
    }
    if (current.trim()) {
      console.log(
        JSON.stringify({
          title,
          language,
          lines: source.split('\n').length,
          sha256: createHash('sha256').update(source).digest('hex'),
          previousError: previous?.message ?? 'Empty output',
        })
      );
    }
  }
}
