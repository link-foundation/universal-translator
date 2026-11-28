import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';
import {
  createTranslator,
  formatMeta,
  grammarLanguageIds,
  machineTargetIds,
  naturalLanguageIds,
} from '../src/index.js';

const fixtures = [
  'control-flow',
  'queries-library',
  'nested-prose',
  'annotated-block',
];
const read = (name, extension) =>
  readFileSync(
    new URL(
      `../../examples/translation/meta-roles/${name}.${extension}`,
      import.meta.url
    ),
    'utf8'
  );

describe('explicit meta child roles shared with Rust', () => {
  for (const name of fixtures) {
    it(`shows every role in ${name}`, () => {
      const input = JSON.parse(read(name, 'json'));
      const before = JSON.stringify(input);
      expect(formatMeta(input)).toBe(read(name, 'lino'));
      expect(JSON.stringify(input)).toBe(before);
    });
  }
});

it('keeps condition/action and value/effect roles through every reader family', () => {
  const translator = createTranslator();
  const input = translator.toMeta(
    'n = 1\nwhile n < 3:\n    if n == 1:\n        print(n)\n    else:\n        print(n + 1)\n    n = n * 2\n',
    'python'
  );
  const roles = (text) =>
    [
      ...text.matchAll(
        /^\s+(condition|body|then|otherwise|expression|arguments|left|right)$/gm
      ),
    ]
      .map((match) => match[1])
      .sort();
  const expected = roles(formatMeta(input));
  expect(expected.filter((role) => role === 'condition').length).toBe(2);
  for (const language of [
    ...grammarLanguageIds,
    ...naturalLanguageIds(),
    ...machineTargetIds,
  ]) {
    const output = translator.fromMeta(input, language);
    expect({
      language,
      roles: roles(formatMeta(translator.toMeta(output, language))),
    }).toEqual({ language, roles: expected });
  }
});
