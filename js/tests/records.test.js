import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { parseFragment, translateFragment } from '../src/index.js';
import { sameMeaning } from '../src/meta/tree.js';

const point = readFileSync(
  new URL('../../examples/translation/point-class.txt', import.meta.url),
  'utf8'
);
const pair = `pub struct Pair<A, B> {
    pub letter: A,
    pub count: B,
}

impl<X, Y> Pair<Y, X> {
    // Assign both values.
    pub fn new(count: X, character: Y) -> Self {
        Self { count, letter: character }
    }
}
`;

describe('record definitions', () => {
  it('round trips a class constructor through Rust and meta', () => {
    const original = parseFragment(point, 'javascript');
    expect(original.kind).toBe('definitions');
    expect(original.program.definitions[0].fields).toEqual([
      { kind: 'RecordField', name: 'x', parameter: 'horizontal' },
      { kind: 'RecordField', name: 'y', parameter: 'vertical' },
    ]);
    const rust = translateFragment(point, 'javascript', 'rust');
    expect(rust).toContain('pub struct Point<Field0, Field1>');
    expect(rust).toContain('pub fn new(horizontal: Field0, vertical: Field1)');
    expect(rust).not.toContain('fn main');
    const recovered = parseFragment(rust, 'rust');
    expect(recovered.kind).toBe('definitions');
    expect(sameMeaning(original.program, recovered.program)).toBe(true);
    const javascript = translateFragment(rust, 'rust', 'javascript');
    expect(
      sameMeaning(
        original.program,
        parseFragment(javascript, 'javascript').program
      )
    ).toBe(true);
  });

  it('maps Rust generic arguments to constructor bindings and keeps comments', () => {
    const javascript = translateFragment(pair, 'rust', 'javascript');
    expect(javascript).toContain('// Assign both values.');
    expect(javascript).toContain('constructor(count, character)');
    expect(javascript).toContain('this.letter = character;');
    const rust = translateFragment(javascript, 'javascript', 'rust');
    expect(
      sameMeaning(
        parseFragment(pair, 'rust').program,
        parseFragment(rust, 'rust').program
      )
    ).toBe(true);
  });

  it('round trips several records, including a constructor with no parameters', () => {
    const source = `// Empty record.\nclass Empty { constructor() {} }\n\n${point}`;
    const rust = translateFragment(source, 'javascript', 'rust');
    const javascript = translateFragment(rust, 'rust', 'javascript');
    expect(javascript).toContain('// Empty record.');
    expect(javascript).toContain('constructor()');
    expect(
      parseFragment(javascript, 'javascript').program.definitions.length
    ).toBe(2);
  });

  it('rejects constructor effects and targets outside the supported class syntax', () => {
    for (const source of [
      'class SideEffect { constructor(x) { console.log(x); this.x = x; } }',
      'class Duplicate { constructor(x, y) { this.x = x; this.y = x; } }',
      'class Prototype { constructor(x) { this.__proto__ = x; } }',
    ]) {
      expect(() => translateFragment(source, 'javascript', 'rust')).toThrow();
    }
    expect(() =>
      translateFragment(point, 'javascript', 'javascript@es5')
    ).toThrow();
    expect(() => translateFragment(point, 'javascript@es5', 'rust')).toThrow();
    expect(() => translateFragment(point, 'javascript', 'python')).toThrow();
    expect(() =>
      translateFragment(
        `${point}\nconst p = new Point(2, 3);\n`,
        'javascript',
        'rust'
      )
    ).toThrow(/instance translation/u);
  });
});
