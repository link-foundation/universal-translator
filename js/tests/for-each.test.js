// The for-each loop of the meta language: ForEach { variable, array, body }.
// Languages with a for-each syntax write it natively, the others write the
// counting loop over a fresh index. The Rust twin is rust/tests/for_each.rs.
import { describe, expect, it } from 'test-anywhere';

import { createGrammarTranslator } from '../src/translator.js';
import { grammarLanguageIds } from '../src/formal/languages.js';
import { meaningDifference, walk } from '../src/meta/tree.js';

const translator = createGrammarTranslator();

const source = `const numbers = [3, 4, 5];
let total = 0;
for (const number of numbers) {
  total += number;
}
console.log(total);
`;

const kinds = (meta) => {
  const found = [];
  walk(meta, (node) => found.push(node.kind));
  return found;
};

describe('for-each loop', () => {
  it('reads for...of as a ForEach over the array', () => {
    const meta = translator.toMeta(source, 'javascript');
    const loop = meta.main.statements.find(({ kind }) => kind === 'ForEach');
    expect(loop.variable).toBe('number');
    expect(loop.array.name).toBe('numbers');
    expect(kinds(meta)).not.toContain('CountingLoop');
  });

  it('reads a range loop as a counting loop, not a for-each loop', () => {
    const meta = translator.toMeta(
      'let total = 0;\nfor (let index = 0; index < 3; index++) {\n  total += index;\n}\n',
      'javascript'
    );
    expect(kinds(meta)).toContain('CountingLoop');
    expect(kinds(meta)).not.toContain('ForEach');
  });

  it('reads Python for x in a: over an array', () => {
    const meta = translator.toMeta(
      'numbers = [3, 4]\nfor number in numbers:\n    print(number)\n',
      'python'
    );
    const loop = meta.main.statements.find(({ kind }) => kind === 'ForEach');
    expect(loop.variable).toBe('number');
    expect(loop.array.name).toBe('numbers');
  });

  it('still reads Python for i in range(n): as a counting loop', () => {
    const meta = translator.toMeta(
      'for index in range(3):\n    print(index)\n',
      'python'
    );
    expect(kinds(meta)).toContain('CountingLoop');
  });

  it('types the loop variable with the element type of the array', () => {
    const meta = translator.toMeta(source, 'javascript');
    const loop = meta.main.statements.find(({ kind }) => kind === 'ForEach');
    expect(loop.type).toBe('integer');
  });

  it('writes the loop natively in the languages that have one', () => {
    const written = {
      javascript: 'for (const number of numbers) {',
      python: 'for number in numbers:',
      java: 'for (int number : numbers) {',
      go: 'for _, number := range numbers {',
      rust: 'for &number in &numbers {',
      kotlin: 'for (number in numbers) {',
      php: 'foreach ($numbers as $number) {',
      csharp: 'foreach (int number in numbers) {',
      lua: 'for _, number in ipairs(numbers) do',
    };
    for (const [language, line] of Object.entries(written)) {
      expect(translator.translate(source, 'javascript', language)).toContain(
        line
      );
    }
  });

  it('writes a counting loop over a fresh index where there is no for-each', () => {
    const c = translator.translate(source, 'javascript', 'c');
    expect(c).toContain(
      'for (int index = 0; index < (int) (sizeof numbers / sizeof numbers[0]); index++) {'
    );
    expect(c).toContain('int number = numbers[index];');
    const pascal = translator.translate(source, 'javascript', 'pascal');
    expect(pascal).toContain('Number := Numbers[Index];');
  });

  it('picks an index that no name of the program uses', () => {
    const named = source.replace('total', 'index');
    const c = translator.translate(named, 'javascript', 'c');
    expect(c).toContain('for (int position = 0;');
    expect(c).toContain('int number = numbers[position];');
  });

  it('writes a counting loop when the body changes the loop variable', () => {
    const changing = `const numbers = [3, 4];
for (let number of numbers) {
  number += 1;
  console.log(number);
}
`;
    const python = translator.translate(changing, 'javascript', 'python');
    expect(python).not.toContain('for number in numbers');
    expect(python).toContain('numbers[index]');
  });

  it('round-trips JavaScript to meta and back to the same program', () => {
    const meta = translator.toMeta(source, 'javascript');
    const written = translator.fromMeta(meta, 'javascript');
    expect(written).toContain('for (const number of numbers) {');
    expect(
      meaningDifference(meta, translator.toMeta(written, 'javascript'))
    ).toBeUndefined();
  });

  it('keeps its meaning through every grammar language', () => {
    const meta = translator.toMeta(source, 'javascript');
    for (const language of grammarLanguageIds) {
      const text = translator.fromMeta(meta, language);
      const back = translator.toMeta(text, language);
      expect([language, meaningDifference(meta, back)]).toEqual([
        language,
        undefined,
      ]);
    }
  });

  it('writes a sentence in the controlled languages that have one', () => {
    const meta = translator.toMeta(source, 'javascript');
    const english = translator.fromMeta(meta, 'english');
    expect(english).toContain('For each number in numbers, repeat this');
    expect(
      meaningDifference(meta, translator.toMeta(english, 'english'))
    ).toBeUndefined();
  });

  it('lowers the loop in the controlled languages without a sentence', () => {
    const meta = translator.toMeta(source, 'javascript');
    const german = translator.fromMeta(meta, 'german');
    expect(
      meaningDifference(meta, translator.toMeta(german, 'german'))
    ).toBeUndefined();
  });
});
