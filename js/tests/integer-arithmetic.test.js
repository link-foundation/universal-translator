import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createTranslator, naturalLanguageIds } from '../src/index.js';
import { meaningDifference, walk } from '../src/meta/tree.js';

const translator = createTranslator();
const floor = 'print(-7 // 3)\nprint(-7 % 3)\n';
const trunc =
  'int main(void) { printf("%d\\n", -7 / 3); printf("%d\\n", -7 % 3); return 0; }';
const operators = (tree) => {
  const found = [];
  walk(tree, (n) => {
    if (n.kind === 'Binary') {
      found.push(n.operator);
    }
  });
  return found;
};
const equivalent = (meta, language) => {
  const written = translator.fromMeta(meta, language);
  assert.equal(
    meaningDifference(meta, translator.toMeta(written, language)),
    undefined,
    `${language}: ${written}`
  );
};

describe('integer arithmetic rounding', () => {
  it('distinguishes source rounding and remainder signs', () => {
    for (const [language, source] of [
      ['python', floor],
      ['python@2', 'print(-7 / 3)\nprint(-7 % 3)\n'],
      ['ruby', 'puts(-7 / 3)\nputs(-7 % 3)\n'],
      ['lua', 'print(-7 // 3)\nprint(-7 % 3)\n'],
      ['r', 'print(-7 %/% 3)\nprint(-7 %% 3)\n'],
    ]) {
      assert.deepEqual(
        operators(translator.toMeta(source, language)),
        ['floorDivide', 'modulo'],
        language
      );
    }
    assert.deepEqual(operators(translator.toMeta(trunc, 'c')), [
      'divide',
      'remainder',
    ]);
    assert.deepEqual(operators(translator.toMeta('print(-7 % 3);', 'perl')), [
      'modulo',
    ]);
  });

  it('round-trips both contracts through shared helper algorithms', () => {
    for (const [source, from] of [
      [floor, 'python'],
      [trunc, 'c'],
    ]) {
      const meta = translator.toMeta(source, from);
      for (const language of [
        'javascript',
        'javascript@es5',
        'typescript',
        'python',
        'python@2',
        'ruby',
        'lua',
        'lua@5.1',
        'r',
        'perl',
        'php',
        'php@5',
        'c',
        'cpp',
        'csharp',
        'java',
        'go',
        'rust',
        'nim',
        'fortran',
        'rocq',
        'nasm',
        'gas',
        'arm64',
        'cil',
        'jvm',
        'llvm',
        'wat',
        ...naturalLanguageIds(),
      ]) {
        equivalent(meta, language);
      }
    }
  });

  it('recognizes signed-integer helpers with a local named result', () => {
    const meta = translator.toMeta(floor, 'python');
    const written = translator.fromMeta(meta, 'javascript');
    assert.match(written, /\bquotient\b/);
    const legacy = written.replace(/\bquotient\b/g, 'result');
    assert.equal(
      meaningDifference(meta, translator.toMeta(legacy, 'javascript')),
      undefined
    );
  });

  it('preserves floor and modulo compound assignments', () => {
    const source = 'value = -7\nvalue //= 3\nvalue %= 2\nprint(value)\n';
    const meta = translator.toMeta(source, 'python');
    assert.deepEqual(operators(meta), ['floorDivide', 'modulo']);
    for (const language of ['javascript', 'python', 'perl', 'rust']) {
      equivalent(meta, language);
    }
  });

  it('retains true division of real Ruby/Python 2 operands', () => {
    for (const language of ['ruby', 'python@2']) {
      const source =
        language === 'ruby' ? 'puts(-7.0 / 3)\n' : 'print(-7.0 / 3)\n';
      assert.deepEqual(operators(translator.toMeta(source, language)), [
        'realDivide',
      ]);
    }
    assert.throws(
      () => translator.translate('print(7.0 // 3)\n', 'python', 'c'),
      /Real floorDivide/
    );
  });

  it('uses fresh helper names and requires the complete unshadowed algorithm', () => {
    const source =
      'def ut_integer_floor_divide(first, second):\n    return first + second\n\nprint(-7 // 3)\n';
    const meta = translator.toMeta(source, 'python');
    equivalent(meta, 'javascript');
    const written = translator.translate(floor, 'python', 'javascript');
    for (const invalid of [
      written.replace('quotient -= 1', 'quotient += 1'),
      written.replace('return quotient;', 'return\nquotient;'),
      `${written}\nconst escaped = utIntegerFloorDivide;`,
      `${written}\nfunction shadow(utIntegerFloorDivide) { return 1; }`,
      `${written}\nfunction utIntegerFloorDivide(first, second) { return 1; }`,
      written.replace(
        'utIntegerFloorDivide(-7, 3)',
        'utIntegerFloorDivide(-7, 3, 9)'
      ),
    ]) {
      assert.ok(
        translator
          .toMeta(invalid, 'javascript')
          .functions.some((f) => f.name === 'ut-integer-floor-divide'),
        invalid
      );
    }
  });
});
