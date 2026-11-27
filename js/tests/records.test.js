import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import {
  createTranslator,
  parseFragment,
  translateFragment,
} from '../src/index.js';
import { sameMeaning } from '../src/meta/tree.js';

const point = readFileSync(
  new URL('../../examples/translation/point-class.txt', import.meta.url),
  'utf8'
);
const pointInstances = readFileSync(
  new URL('../../examples/translation/point-instances.txt', import.meta.url),
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
  });

  it('round trips a program constructing different instances and reading fields', () => {
    const translator = createTranslator();
    const original = translator.toMeta(pointInstances, 'javascript');
    const statements = original.main.statements.filter(
      ({ kind }) => kind !== 'Blank'
    );
    expect(statements[0].value.kind).toBe('RecordConstruction');
    expect(statements[2].value.kind).toBe('RecordFieldRead');
    expect(statements[2].type).toBe('integer');
    const rust = translator.fromMeta(original, 'rust');
    expect(rust).toContain(
      'let first_point = Point::new(-8 as i64, 6 as i64);'
    );
    expect(rust).toContain('let horizontal: i64 = first_point.x;');
    const reread = translator.toMeta(rust, 'rust');
    expect(sameMeaning(original, reread)).toBe(true);
    const recovered = translator.fromMeta(reread, 'javascript');
    expect(recovered).toContain('const horizontal = firstPoint.x;');
    expect(
      sameMeaning(original, translator.toMeta(recovered, 'javascript'))
    ).toBe(true);
  });

  it('rejects instance aliases, writes, unknown fields, and forward class references', () => {
    const binding = 'const p = new Point(2, 3);';
    const unsupported = [
      `${point}\n${binding}\nconst alias = p;`,
      `${point}\n${binding}\np.x = 9;`,
      `${point}\n${binding}\nconsole.log(p.unknown);`,
      `${binding}\n${point}`,
      `${point}\nconst p = new Point(-0, 3);`,
      `${point}\nconst p = new Point(2147483648, 3);`,
      `${point}\nconst p = new Point(2);`,
      `${point}\nconst console = new Point(2, 3);`,
      `${point}\nconst p = new Point('%s', 'value');\nconsole.log(p.x, p.y);`,
      `${point}\nconst p = new Point('\\x25s', 'value');\nconsole.log(p.x);`,
    ];
    for (const source of unsupported) {
      expect(() => translateFragment(source, 'javascript', 'rust')).toThrow();
    }
  });

  it('rejects Rust narrowing casts, boolean casts and custom formatting', () => {
    const record = translateFragment(point, 'javascript', 'rust');
    for (const [argument, format] of [
      ['270 as u8', '{}'],
      ['true as i64', '{}'],
      ['2', '{:?}'],
    ]) {
      const source = `${record}\nfn main() {
        let p = Point::new(${argument}, 3);
        println!("${format}", p.x);
      }`;
      expect(() => translateFragment(source, 'rust', 'javascript')).toThrow();
    }
  });
});
