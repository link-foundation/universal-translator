// Language detection on the committed goldens: every factorial program,
// machine code included, is detected as the language it is written in. The
// Rust twin is rust/tests/detect_goldens.rs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { createTranslator } from '../../js/src/index.js';
import { extensions } from '../../examples/programs/verify-native.mjs';

const translator = createTranslator();
const golden = (extension) =>
  readFileSync(
    `examples/programs/translated/factorial/factorial${extension}`,
    'utf8'
  );

describe('detecting the language of every golden', () => {
  for (const [language, extension] of Object.entries(extensions)) {
    it(`detects ${language} (${extension})`, () => {
      expect(translator.detectLanguage(golden(extension))[0].id).toBe(language);
    });
  }

  it('detects the JavaScript source', () => {
    const source = readFileSync('examples/programs/factorial.js', 'utf8');
    expect(translator.detectLanguage(source)[0].id).toBe('javascript');
  });

  it('tells Objective-C from C by its #import', () => {
    const [best, next] = translator.detectLanguage(golden('.m'));
    expect([best.id, next.id]).toEqual(['objc', 'c']);
  });

  it('reads machine code whole only', () => {
    const detected = translator.detectLanguage(golden('.wat'));
    const { id, reads, coverage } = detected[0];
    expect({ id, reads, coverage }).toEqual({
      id: 'wat',
      reads: true,
      coverage: 1,
    });
    expect(detected.filter((candidate) => candidate.reads).length).toBe(1);
  });

  it('breaks code ties by corpus presence after checking whole readings', () => {
    const detected = translator.detectLanguage('c');
    expect(
      detected.slice(0, 4).map(({ id, reads, score }) => [id, reads, score])
    ).toEqual([
      ['english', true, 100],
      ['julia', true, 100],
      ['python', true, 100],
      ['java', true, 100],
    ]);
    const [whole, partial] = translator.detectLanguage('x = 1\n% hello');
    expect([whole.id, whole.reads, partial.id, partial.reads]).toEqual([
      'matlab',
      true,
      'python',
      false,
    ]);
  });
});

describe('words that start with an underscore', () => {
  // "_" alone, or a word that starts with it, is one word: the tokenizer
  // moves past it and the reading ends with an ordinary error.
  it('reads Perl argument lists as natural text without hanging', () => {
    for (const text of ['_', '_x', '@_', 'my ($number) = @_;']) {
      expect(() => translator.parseFragment(text, 'english')).toThrow(
        'No sentence template matches'
      );
      expect(translator.parsePartial(text, 'english').coverage).toBe(0);
    }
  });
});
