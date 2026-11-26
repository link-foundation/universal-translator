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

  it('keeps the verb form, the object case and the genitive of a sentence', () => {
    const text = (source, from, to) => translatePartial(source, from, to).text;
    const sentences = {
      'Greets someone': {
        russian: 'Приветствует кого-то\n',
        ukrainian: 'Вітає когось\n',
        polish: 'Wita kogoś\n',
        german: 'Grüßt jemanden\n',
        french: 'Salue quelqu’un\n',
        spanish: 'Saluda a alguien\n',
      },
      'Prints the sum': {
        russian: 'Печатает сумму\n',
        ukrainian: 'Друкує суму\n',
        polish: 'Drukuje sumę\n',
      },
      'Returns the factorial of n': {
        russian: 'Возвращает факториал n\n',
        ukrainian: 'Повертає факторіал n\n',
        polish: 'Zwraca silnię n\n',
        spanish: 'Devuelve el factorial de n\n',
      },
    };
    for (const [source, targets] of Object.entries(sentences)) {
      for (const [language, expected] of Object.entries(targets)) {
        expect(text(source, 'english', language)).toBe(expected);
      }
    }
    // The lemma is the infinitive, a finite form never is.
    expect(text('to print', 'english', 'russian')).toBe('печатать\n');
    expect(text('Print', 'english', 'russian')).toBe('Печатать\n');
    // A noun keeps its form where it is no object or no singular nominative.
    expect(text('Prints the name', 'english', 'russian')).toBe(
      'Печатает имя\n'
    );
    expect(text('Sorts the numbers', 'english', 'russian')).toBe(
      'Сортирует числа\n'
    );
  });

  it('reads the verb forms and the cases back', () => {
    const text = (source, from, to) => translatePartial(source, from, to).text;
    expect(text('Печатает сумму', 'russian', 'english')).toBe('Prints sum\n');
    expect(text('Приветствует кого-то', 'russian', 'english')).toBe(
      'Greets someone\n'
    );
    expect(text('Saluda a alguien', 'spanish', 'english')).toBe(
      'Greets someone\n'
    );
    expect(text('Возвращает факториал n', 'russian', 'english')).toBe(
      'Returns factorial n\n'
    );
    expect(text('Печатать сумму', 'russian', 'english')).toBe('To print sum\n');
  });

  it('translates a Russian comment to English', () => {
    expect(
      translateComments('// Привет мир\nlet x = 1;\n', 'javascript', {
        to: 'english',
      })
    ).toBe('// Hello world\nlet x = 1;\n');
  });
});
