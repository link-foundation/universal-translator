import { expect, it } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import {
  createTranslator,
  grammarLanguageIds,
  machineTargetIds,
  naturalLanguageIds,
} from '../src/index.js';

const translator = createTranslator();
const source = readFileSync(
  new URL('../../examples/translation/comment-headers.cpp', import.meta.url),
  'utf8'
);
const meanings = ['число', 'последовательность', 'итеративно'];
const sourceLines = [0, 2, 7];
const options = {
  layout: 'target',
  commentFrom: 'english',
  commentLanguage: 'russian',
};

it('maps translated file, function and entry comments in every writer', () => {
  for (const target of [
    ...grammarLanguageIds,
    ...machineTargetIds,
    ...naturalLanguageIds(),
  ]) {
    const result = translator.translatePartial(source, 'cpp', target, options);
    expect({ target, complete: result.complete }).toEqual({
      target,
      complete: true,
    });
    const lines = result.text.split('\n');
    for (const [index, from] of sourceLines.entries()) {
      const mapped = result.lineMap
        .filter(([line]) => line === from)
        .map(([, line]) => lines[line].trim());
      expect({ target, from, mapped }).toEqual({
        target,
        from,
        mapped: [lines.find((line) => line.includes(meanings[index])).trim()],
      });
    }
  }
});

it('retains header origins when reading natural and machine languages', () => {
  for (const from of [...naturalLanguageIds(), ...machineTargetIds]) {
    const text = translator.translate(source, 'cpp', from, options);
    const result = translator.translatePartial(text, from, 'python', {
      ...options,
      commentFrom: 'russian',
    });
    expect({ from, complete: result.complete }).toEqual({
      from,
      complete: true,
    });
    const lines = text.split('\n');
    const output = result.text.split('\n');
    for (const meaning of meanings) {
      const line = lines.findIndex((text) => text.includes(meaning));
      const mapped = result.lineMap
        .filter(([source]) => source === line)
        .map(([, target]) => output[target].trim());
      expect({ from, meaning, mapped }).toEqual({
        from,
        meaning,
        mapped: [`# ${meaning}`],
      });
    }
  }
});

it('maps formal header comments independently of their translated spelling', () => {
  for (const from of grammarLanguageIds) {
    const text = translator.translate(source, 'cpp', from, options);
    const result = translator.translatePartial(text, from, 'python', {
      ...options,
      commentFrom: 'russian',
      commentLanguage: 'english',
    });
    expect({ from, complete: result.complete }).toEqual({
      from,
      complete: true,
    });
    const lines = text.split('\n');
    const output = result.text.split('\n');
    for (const [index, meaning] of meanings.entries()) {
      const line = lines.findIndex((text) => text.includes(meaning));
      const mapped = result.lineMap
        .filter(([source]) => source === line)
        .map(([, target]) => output[target].trim());
      expect({ from, meaning, mapped }).toEqual({
        from,
        meaning,
        mapped: [`# ${['number', 'sequence', 'iteratively'][index]}`],
      });
    }
  }
});
