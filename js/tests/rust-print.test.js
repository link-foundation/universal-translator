import { describe, expect, it } from 'test-anywhere';

import { createTranslator } from '../src/index.js';

const translator = createTranslator();

describe('Rust printing macros', () => {
  it('resolves escaped braces, numbered fields, named fields and captures', () => {
    const source = `fn main() {
    let forestOwner: &str = "Fox";
    println!("{{{1}}} is {} with {name}/{forestOwner}", "first", "second", name = "third");
}`;
    const result = translator.translate(source, 'rust', 'python');
    expect(result).toContain('with third/{forest_owner}');
    expect(result).toContain('{{second}} is first');
    expect(result).toContain('forest_owner = "Fox"');
  });

  it('keeps the extra newline added by println even after a literal newline', () => {
    const result = translator.translate(
      'fn main() { println!("line\\n"); println!(); }',
      'rust',
      'rust'
    );
    expect(result).toContain('println!("line\\n");');
    expect(result).toContain('println!("");');
  });

  it('retains native argument order when fields reorder or repeat calls', () => {
    const source =
      'fn main() { println!("{item}/{0}/{item}", take(1), item = take(2)); }';
    expect(translator.translate(source, 'rust', 'rust')).toContain(
      'println!("{item}/{0}/{item}", take(1), item = take(2));'
    );
    expect(() => translator.translate(source, 'rust', 'python')).toThrow(
      'Rust format requires a native macro in python'
    );
  });

  it('keeps native formatting options and resolves captured variable names', () => {
    const source =
      'fn main() { let itemName: &str = "wide"; println!("{itemName:>6}"); }';
    const result = translator.translate(source, 'rust', 'rust');
    expect(result).toContain(
      'println!("{itemName:>6}", itemName = item_name);'
    );
  });
});
