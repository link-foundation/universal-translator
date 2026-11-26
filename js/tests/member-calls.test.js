import { describe, expect, it } from 'test-anywhere';
import { createTranslator } from '../src/index.js';

const translator = createTranslator();

describe('member calls on computed receivers', () => {
  it('keeps the receiver before a member call', () => {
    expect(
      translator.translate(
        'factory().first(1).second(2);\n',
        'javascript',
        'python'
      )
    ).toBe('factory().first(1).second(2)\n');
  });

  it('continues Java fluent calls on the next line', () => {
    expect(
      translator.translate(
        'ResponseEntity\n    .status(HttpStatus.CREATED)\n    .body(user);\n',
        'java',
        'python'
      )
    ).toBe('ResponseEntity.status(HttpStatus.CREATED).body(user)\n');
  });

  it('reads multiline calls back to the same expression', () => {
    const source = 'factory()\n  .first(1)\n  .second(2);\n';
    const result = translator.translate(source, 'javascript', 'python');
    expect(translator.translate(result, 'python', 'javascript')).toBe(
      'factory().first(1).second(2);\n'
    );
  });
});
