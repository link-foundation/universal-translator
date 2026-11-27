import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, modulePath] = process.argv.slice(2);
const baseline = mode === '--baseline';
const { createTranslator, naturalLanguageIds } = await import(
  baseline ? pathToFileURL(resolve(modulePath)).href : '../js/src/index.js'
);
const translator = createTranslator();
const options = { encoding: 'utf8', maxBuffer: 256 * 1024 };
const js = (input, from, to) => translator.translate(input, from, to);
const rust = (input, from, to) =>
  execFileSync(
    resolve(mode || 'target/debug/universal-translator'),
    ['translate', from, to, '-', '--all-or-nothing'],
    { ...options, input }
  );
const python = (input) => execFileSync('python3', ['-'], { ...options, input });

const cases = [
  {
    name: 'arithmetic reflection subject',
    source: 'meaning = 41\nprint(type(meaning + 1))\n',
    expected: "<class 'int'>\n",
    baselineFailures: 7,
    affected: [
      'arabic',
      'indonesian',
      'persian',
      'swahili',
      'tagalog',
      'thai',
      'vietnamese',
    ],
  },
  {
    name: 'selector nested inside a call',
    source:
      'nums = [-1, 0, 1, 2]\nprint((9 + len([n for n in nums if n > 0])) // 2)\n',
    expected: '5\n',
    baselineFailures: 9,
    affected: [
      'english-ace',
      'english-asd-ste100',
      'english-basic-english',
      'english-e-prime',
      'english-globish',
      'english-plain-language',
      'english-sbvr',
      'english-special-english',
      'minimal-english',
    ],
  },
  {
    name: 'ordinary Arabic call with a contextual name',
    source: 'def نوع(value):\n    return value + 1\n\nprint(نوع(2))\n',
    expected: '3\n',
    baselineFailures: 0,
    affected: ['arabic'],
  },
];

for (const { name, source, expected, baselineFailures, affected } of cases) {
  assert.equal(python(source), expected);
  const engines = baseline
    ? [['JavaScript', js]]
    : [
        ['JavaScript', js],
        ['Rust', rust],
      ];
  for (const [engine, translate] of engines) {
    const languages = engine === 'JavaScript' ? naturalLanguageIds() : affected;
    const failed = [];
    for (const language of languages) {
      try {
        const natural = translate(source, 'python', language);
        const restored = translate(natural, language, 'python');
        assert.equal(restored, js(source, 'python', 'python'));
        assert.equal(python(restored), expected);
      } catch (error) {
        failed.push(language);
        console.log(
          JSON.stringify({ name, engine, language, error: error.message })
        );
      }
    }
    assert.equal(failed.length, baseline ? baselineFailures : 0);
    console.log(
      JSON.stringify({ name, engine, tested: languages.length, failed })
    );
  }
}
