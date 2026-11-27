import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createTranslator } from '../src/index.js';
import { meaningDifference, walk } from '../src/meta/tree.js';
const t = createTranslator();
const source = `def first():
    print(101)
    return -7

def second():
    print(202)
    return 3

def combine(left, right):
    return left - right

print(first() // second())
print(first() % second())
print(combine(first(), second()))
print(first() - second())
count = 0
while first() // second() < -2 and count < 2:
    count += 1
if 1 < 0 and first() // second() < 0:
    print(999)
`;
describe('C-family operand evaluation order', () => {
  it('sequences scalar calls and arithmetic at their original expression site', () => {
    const meta = t.toMeta(source, 'python');
    for (const to of ['c', 'cpp', 'objc']) {
      const written = t.fromMeta(meta, to, { from: 'python' });
      assert.match(written, /ut_?evaluation1 = first\(\)/i);
      assert.match(written, /ut_?evaluation2 = second\(\)/i);
      const read = t.toMeta(written, to);
      assert.match(t.fromMeta(read, 'cpp'), /ut_evaluation1 = first\(\)/);
      const roundTrip = t.fromMeta(read, 'python');
      assert.equal(
        meaningDifference(meta, t.toMeta(roundTrip, 'python')),
        undefined
      );
    }
  });
  it('keeps user comma expressions and assignments without private temporaries', () => {
    const meta = t.toMeta(
      'int main(void) { int x = 0; printf("%d\\n", (x = 2, x + 1)); return 0; }',
      'c'
    );
    const kinds = [];
    walk(meta, (n) => kinds.push(n.kind));
    assert.ok(kinds.includes('ExpressionSequence'));
    assert.ok(kinds.includes('AssignmentExpression'));
    assert.match(t.fromMeta(meta, 'c'), /\(\(x = 2\), x \+ 1\)/);
  });
  it('does not erase escaping, rebound, reordered or changed temporaries', () => {
    const written = t.translate(
      'def first():\n    return 7\n\ndef second():\n    return 3\n\nprint(first() // second())\n',
      'python',
      'c'
    );
    for (const invalid of [
      written.replace('int ut_evaluation1 = 0;', 'int ut_evaluation1 = 9;'),
      written.replace(
        'ut_integer_floor_divide(ut_evaluation1, ut_evaluation2)',
        'ut_integer_floor_divide(ut_evaluation2, ut_evaluation1)'
      ),
      written.replace(
        'int ut_evaluation1 = 0;',
        'int ut_evaluation1 = 0; printf("%d\\n", ut_evaluation1);'
      ),
      written
        .replace('ut_evaluation1 = first()', 'ut_evaluation1 = second()')
        .replace('ut_evaluation2 = second()', 'ut_evaluation1 = second()'),
    ]) {
      let retained = false;
      const read = t.toMeta(invalid, 'c');
      walk(read, (n) => {
        retained ||= n.kind === 'ExpressionSequence';
      });
      assert.ok(retained, invalid);
      assert.throws(
        () => t.fromMeta(read, 'python'),
        /Cannot emit ExpressionSequence/
      );
    }
  });
  it('avoids collisions and preserves nested function returns', () => {
    const meta = t.toMeta(
      'def first():\n    return 7\n\ndef combine(left, right):\n    ut_evaluation1 = 8\n    return first() - ut_evaluation1\n\nprint(combine(first(), 3))\n',
      'python'
    );
    const written = t.fromMeta(meta, 'c', { from: 'python' });
    assert.match(written, /int ut_evaluation2 = 0;/);
    const roundTrip = t.translate(written, 'c', 'python');
    assert.equal(
      meaningDifference(meta, t.toMeta(roundTrip, 'python')),
      undefined
    );
  });
});
