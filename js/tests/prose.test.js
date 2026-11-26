// Natural texts that the controlled grammars do not read are
// detected by their known words and translated freely, word by word through
// the shared vocabulary (the parts are listed in `prose`). The Rust twin is
// rust/tests/prose.rs.
import { describe, expect, it } from 'test-anywhere';

import {
  detectLanguage,
  translateComments,
  translatePartial,
} from '../src/index.js';

const detected = (text) => detectLanguage(text)[0].id;

describe('prose', () => {
  it('detects the language of a greeting and of a question', () => {
    expect(detected('Привет')).toBe('russian');
    expect(detected('Привет мир')).toBe('russian');
    expect(detected('Как хорошо покакать?')).toBe('russian');
    expect(detected('Hello world')).toBe('english');
  });

  it('translates prose freely and lists it', () => {
    for (const from of ['russian', 'minimal-russian']) {
      const result = translatePartial('Как хорошо покакать?', from, 'english');
      expect(result.text).toBe('How good to poop?\n');
      expect(result.complete).toBe(true);
      expect(result.prose).toEqual([{ line: 1, endLine: 1 }]);
    }
    expect(translatePartial('Привет мир', 'russian', 'english').text).toBe(
      'Hello world\n'
    );
    expect(translatePartial('Hello world', 'english', 'russian').text).toBe(
      'Привет мир\n'
    );
  });

  it('translates a Russian comment to English', () => {
    expect(
      translateComments('// Привет мир\nlet x = 1;\n', 'javascript', {
        to: 'english',
      })
    ).toBe('// Hello world\nlet x = 1;\n');
  });
});
