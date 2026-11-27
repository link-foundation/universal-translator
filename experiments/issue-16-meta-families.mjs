// A finite cross-family audit of visible condition/action/expression roles.
import assert from 'node:assert/strict';
import {
  createTranslator,
  formatMeta,
  grammarLanguageIds,
  machineTargetIds,
  naturalLanguageIds,
} from '../js/src/index.js';

const source =
  'n = 1\nwhile n < 3:\n    if n == 1:\n        print(n)\n    else:\n        print(n + 1)\n    n = n * 2\n';
const translator = createTranslator();
const input = translator.toMeta(source, 'python');
const roles = (text) =>
  [
    ...text.matchAll(
      /^\s+(condition|body|then|otherwise|expression|arguments|left|right)$/gm
    ),
  ]
    .map((match) => match[1])
    .sort();
const expected = roles(formatMeta(input));
const languages = [
  ...grammarLanguageIds,
  ...naturalLanguageIds(),
  ...machineTargetIds,
];
const failures = [];
for (const language of languages) {
  try {
    const output = translator.fromMeta(input, language);
    assert.deepEqual(
      roles(formatMeta(translator.toMeta(output, language))),
      expected
    );
  } catch (error) {
    failures.push({ language, error: error.message });
  }
}
console.log(
  JSON.stringify({ tested: languages.length, expected, failures }, null, 2)
);
assert.equal(failures.length, 0);
