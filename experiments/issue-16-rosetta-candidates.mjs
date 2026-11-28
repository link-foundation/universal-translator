import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { translate } from '../js/src/index.js';

const [corpus, baselineModule, ...options] = process.argv.slice(2);
assert.ok(
  corpus && baselineModule,
  'Pass solutions.json, the baseline js/src/index.js, optional language IDs, and --solutions=<count>'
);
const baseline = await import(pathToFileURL(resolve(baselineModule)).href);
const solutionOption = options.find((option) =>
  option.startsWith('--solutions=')
);
const solutionLimit = Number(solutionOption?.slice('--solutions='.length) ?? 1);
assert.ok(
  Number.isSafeInteger(solutionLimit) && solutionLimit > 0,
  'The solution count must be a positive integer'
);
const requestedLanguages = options.filter(
  (option) => option !== solutionOption
);
const languages = requestedLanguages.length
  ? requestedLanguages
  : ['c', 'cpp', 'javascript', 'python', 'rust', 'typescript'];
const solutions = JSON.parse(readFileSync(corpus, 'utf8'));

// List candidate inputs for a later native comparison. A successful reader
// and writer can still change a program's behavior.
for (const [title, byLanguage] of Object.entries(solutions)) {
  for (const language of languages) {
    const alternatives = byLanguage[language]?.slice(0, solutionLimit) ?? [];
    for (const [index, source] of alternatives.entries()) {
      const candidate = classifyCandidate(source, language);
      if (candidate) {
        console.log(
          JSON.stringify({
            title,
            language,
            ...(index ? { solutionIndex: index } : {}),
            ...candidate,
          })
        );
      }
    }
  }
}

function classifyCandidate(source, language) {
  if (!source?.trim() || source.length > 10_000) {
    return undefined;
  }
  const lines = source.split('\n').length;
  if (lines > 140) {
    return undefined;
  }
  let previous;
  try {
    previous = baseline.translate(source, language, language);
  } catch (error) {
    previous = error;
  }
  if (typeof previous === 'string' && previous.trim()) {
    return undefined;
  }
  try {
    if (translate(source, language, language).trim()) {
      return {
        lines,
        sha256: createHash('sha256').update(source).digest('hex'),
        previousError: previous?.message ?? 'Empty output',
      };
    }
  } catch {
    // Candidates must emit a complete program through the current reader.
  }
  return undefined;
}
