import { expect, it } from 'test-anywhere';
import {
  createTranslator,
  grammarLanguageIds,
  machineTargetIds,
  naturalLanguageIds,
} from '../src/index.js';
import { sourceOrigin } from '../src/translation/source-origins.js';

const translator = createTranslator();
const bytes = (text) => Buffer.from(text, 'utf8');
const spelling = (text, { start, end }) =>
  bytes(text).subarray(start, end).toString();
const translation = (source, from = 'javascript', to = 'python') =>
  translator.translatePartial(source, from, to, {
    fragment: true,
    layout: 'target',
  });

it('distinguishes independent statements and repeated names on one physical line', () => {
  const source =
    'const first = 1; console.log(first); const second = 2; console.log(second);';
  const result = translation(source);
  expect(result.complete).toBe(true);
  expect(Array.isArray(result.regionMap)).toBe(true);
  for (const name of ['first', 'second']) {
    const uses = result.regionMap.filter(
      (pair) =>
        spelling(source, pair.source) === name &&
        spelling(result.text, pair.target) === name
    );
    expect(uses.length).toBe(1);
    expect(uses[0].source.start).toBe(
      bytes(source.slice(0, source.indexOf(`(${name})`) + 1)).length
    );
    expect(uses[0].target.start).toBe(
      bytes(result.text.slice(0, result.text.indexOf(`(${name})`) + 1)).length
    );
  }
  const declarations = result.regionMap.filter((pair) =>
    spelling(source, pair.source).startsWith('const ')
  );
  expect(
    declarations.map((pair) => spelling(result.text, pair.target))
  ).toEqual(['first = 1', 'second = 2']);
});

it('uses UTF-8 ranges and keeps original indentation and CRLF in wrapped fragments', () => {
  const source = '\r\n\treturn "Привет 🌍";\r\n';
  const result = translation(source, 'c', 'python');
  const text = result.regionMap.filter(
    (pair) => spelling(source, pair.source) === '"Привет 🌍"'
  );
  expect(text.length).toBe(1);
  expect(spelling(result.text, text[0].target)).toBe('"Привет 🌍"');
  expect(text[0].source).toEqual({ start: 10, end: bytes(source).length - 3 });
});

it('excludes nested same-line statements from the region owned by their condition', () => {
  const source = 'if (true) { console.log(1); console.log(2); }';
  const result = translation(source);
  const headers = result.regionMap.filter((pair) =>
    spelling(source, pair.source).startsWith('if ')
  );
  expect(headers.length > 0).toBe(true);
  expect(
    headers.every((pair) => !spelling(source, pair.source).includes('console'))
  ).toBe(true);
  for (const value of ['1', '2']) {
    expect(
      result.regionMap.some(
        (pair) =>
          spelling(source, pair.source) === value &&
          spelling(result.text, pair.target) === value
      )
    ).toBe(true);
  }
});

it('retains precise parser spans without exposing them as semantic fields', () => {
  const source = 'if (true) { console.log(1); console.log(2); }';
  const condition = translator.toMeta(source, 'javascript').main.statements[0];
  const origin = sourceOrigin(condition);
  const written = origin.spans
    .map(([start, end]) => spelling(source, { start, end }))
    .join('');
  expect(written.includes('console')).toBe(false);
  expect(written.startsWith('if (true) {')).toBe(true);
  expect(Object.hasOwn(condition, 'spans')).toBe(false);
});

it('retains many-to-many regions through Bash call lowering and its inverse', () => {
  const source = 'function fib(n) { return n; }\nconsole.log(fib(5));\n';
  const result = translation(source, 'javascript', 'bash');
  const prints = result.regionMap.filter(
    (pair) => spelling(source, pair.source) === 'console.log(fib(5));'
  );
  expect(
    prints
      .map((pair) => spelling(result.text, pair.target))
      .some((text) => text.includes('fib 5'))
  ).toBe(true);
  expect(
    prints
      .map((pair) => spelling(result.text, pair.target))
      .some((text) => text.includes('echo "$REPLY"'))
  ).toBe(true);
  const inverse = translation(result.text, 'bash', 'javascript');
  const call = result.text.indexOf('fib 5');
  const echo = result.text.indexOf('echo "$REPLY"');
  for (const at of [call, echo]) {
    expect(
      inverse.regionMap.some(
        (pair) =>
          pair.source.start <= at &&
          pair.source.end > at &&
          spelling(inverse.text, pair.target).includes('console.log')
      )
    ).toBe(true);
  }
});

it('provides valid semantic regions for all current reader and writer families', () => {
  const source = 'const value = 5;\nconsole.log(value + 2);\n';
  for (const language of [
    ...grammarLanguageIds,
    ...machineTargetIds,
    ...naturalLanguageIds(),
  ]) {
    const forward = translator.translatePartial(
      source,
      'javascript',
      language,
      { layout: 'target' }
    );
    const inverse = translator.translatePartial(
      forward.text,
      language,
      'python',
      { layout: 'target' }
    );
    for (const [before, result] of [
      [source, forward],
      [forward.text, inverse],
    ]) {
      expect({ language, complete: result.complete }).toEqual({
        language,
        complete: true,
      });
      expect(result.regionMap.length > 0).toBe(true);
      for (const pair of result.regionMap) {
        expect(
          pair.source.start >= 0 && pair.source.end <= bytes(before).length
        ).toBe(true);
        expect(
          pair.target.start >= 0 && pair.target.end <= bytes(result.text).length
        ).toBe(true);
        expect(spelling(before, pair.source).trim().length > 0).toBe(true);
        expect(spelling(result.text, pair.target).trim().length > 0).toBe(true);
        expect(spelling(before, pair.source).includes('\ufffd')).toBe(false);
        expect(spelling(result.text, pair.target).includes('\ufffd')).toBe(
          false
        );
      }
    }
  }
});
