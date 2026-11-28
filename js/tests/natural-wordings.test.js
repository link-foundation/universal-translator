// Everyday wordings of algorithm sentences ("Let n be 0", "Print n",
// "While ..., do this", "Increase n by 1") read like the canonical ones in
// English, Russian and every other natural language. Translation
// writes the canonical wording, the first template of each key. The Rust twin
// is rust/tests/natural_wordings.rs.
import { describe, expect, it } from 'test-anywhere';
import assert from 'node:assert/strict';

import { detectLanguage, translate } from '../src/index.js';
import {
  naturalLanguage,
  naturalLanguageIds,
  registerNaturalLanguage,
  unregisterNaturalLanguage,
} from '../src/natural/catalog.js';

const everyday =
  'Let n be 0.\nWhile n is less than 3, do this:\n  Set n to n plus 1.\nPrint n.\n';
const canonical =
  'Create n with value 0.\nWhile n falls below 3, repeat this:\n  Change n to n plus 1.\nWrite n and end the line.\n';

describe('declarative controlled grammar', () => {
  const prefix =
    'natural:\n  id: message-grammar\n  extends: english\n  grammar:\n';

  it('allows profile productions to reuse terms and other productions', () => {
    const id = registerNaturalLanguage(`${prefix}    terms:
      message: 'message' 'notice'
      send-message: 'Send @message'
      message-value: '@send-message {value}'
    productions:
      print: '@message-value'
      print-line: '@print now'
`);
    try {
      const output = 'console.log(7);\n';
      assert.equal(translate('Send notice 7 now.', id, 'javascript'), output);
      assert.equal(
        translate(output, 'javascript', id),
        'Send message 7 now.\n'
      );
    } finally {
      unregisterNaturalLanguage(id);
    }
  });

  it('rejects missing terms, cycles, excessive alternatives and unclosed slots', () => {
    for (const [grammar, error] of [
      [
        '    productions:\n      print-line: "@absent {value}"',
        /Unknown natural grammar rule "absent"/u,
      ],
      [
        '    terms:\n      one: "@two"\n      two: "@one"',
        /Natural grammar recursion at "one"/u,
      ],
      [
        '    terms:\n      print-line: "Say"\n    productions:\n      print-line: "Print {value}"',
        /Repeated natural grammar rule "print-line"/u,
      ],
      [
        '    terms:\n      action: "@print-line"\n    productions:\n      print-line: "@action {value}"',
        /Natural grammar recursion at "action"/u,
      ],
      [
        '    terms:\n      word: a b c d e\n    productions:\n      print-line: "@word @word @word {value}"',
        /Too many natural grammar alternatives/u,
      ],
      [
        '    productions:\n      print-line: "Say {value"',
        /Unclosed slot in a template/u,
      ],
    ]) {
      assert.throws(
        () => registerNaturalLanguage(`${prefix}${grammar}\n`),
        error
      );
    }
    assert.ok(!naturalLanguageIds().includes('message-grammar'));
  });

  it('applies the grammar depth bound in either declaration order', () => {
    const terms = Array.from({ length: 24 }, (_, index) =>
      index === 0
        ? '      term-0: "Speak {value}"'
        : `      term-${index}: "@term-${index - 1}"`
    );
    const source = (rules, index) =>
      `${prefix}    terms:\n${rules.join('\n')}\n    productions:\n      print-line: "@term-${index}"\n`;
    try {
      const id = registerNaturalLanguage(source(terms, 22));
      assert.equal(
        translate('Speak 7.', id, 'javascript'),
        'console.log(7);\n'
      );
      unregisterNaturalLanguage(id);
      for (const rules of [terms, [...terms].reverse()]) {
        assert.throws(
          () => registerNaturalLanguage(source(rules, 23)),
          /Natural grammar recursion/u
        );
      }
    } finally {
      if (naturalLanguageIds().includes('message-grammar')) {
        unregisterNaturalLanguage('message-grammar');
      }
    }
  });
});

describe('grammatical case in controlled algorithms', () => {
  it('reads nominative and accusative constants as the same boolean', () => {
    for (const value of ['истина', 'истину']) {
      expect(translate(`Вернуть ${value}.`, 'russian', 'python')).toBe(
        'def _ut_main0():\n    return True\n    return 0\n\nraise SystemExit(_ut_main0())\n'
      );
    }
    expect(translate('return True\n', 'python', 'russian')).toBe(
      'Вернуть истину.\n'
    );
  });

  it('keeps an inflected comparison operand tied to its declaration', () => {
    const source =
      'Создать число со значением 7.\nЕсли делитель не больше числа, сделать это:\n  Вернуть истину.\n';
    expect(translate(source, 'russian', 'python')).toBe(
      'def _ut_main0():\n    number = 7\n    if divisor <= number:\n        return True\n    return 0\n\nraise SystemExit(_ut_main0())\n'
    );
    expect(
      translate('if divisor <= number:\n    return True\n', 'python', 'russian')
    ).toContain('не больше числа');
  });
});

describe('everyday English wordings', () => {
  it('read like the canonical sentences', () => {
    expect(translate(everyday, 'english', 'python')).toBe(
      translate(canonical, 'english', 'python')
    );
  });

  it('read each statement', () => {
    const cases = [
      ['Let total be 1.\n', 'total = 1'],
      ['Let total be 1.\nSet total to 2.\n', 'total = 2'],
      ['Print 7.\n', 'print(7)'],
      ['Display 7.\n', 'print(7)'],
      ['Show 7.\n', 'print(7)'],
      [
        'For each i from 1 to 3, do this:\n  Print i.\n',
        'for i in range(1, 4):',
      ],
      ['For each i from 1 to 3:\n  Print i.\n', 'for i in range(1, 4):'],
      [
        'Define twice using x:\n  Return x times 2.\nPrint twice of (4).\n',
        'return x * 2',
      ],
    ];
    for (const [source, expected] of cases) {
      expect(translate(source, 'english', 'python')).toContain(expected);
    }
  });

  it('are written back in the canonical wording', () => {
    expect(
      translate(
        translate(everyday, 'english', 'javascript'),
        'javascript',
        'english'
      )
    ).toBe(canonical);
  });
});

describe('symbols and unmarked headings in English', () => {
  it('reads arithmetic written with symbols', () => {
    const cases = [
      ['Let n be 0.\nSet n to n + 1.\n', 'n += 1'],
      ['Let n be 2 * 3 + 1.\nPrint n.\n', 'n = 2 * 3 + 1'],
      ['Let n be 7 - 2.\nPrint n % 4.\n', 'print(ut_integer_remainder(n, 4))'],
    ];
    for (const [source, expected] of cases) {
      expect(translate(source, 'english', 'python')).toContain(expected);
    }
  });

  it('opens a block after a heading without its colon', () => {
    const source =
      'Let n be 0.\nwhile n is less than 3, do this\n  Print n.\n  Set n to n plus 1.\n';
    expect(translate(source, 'english', 'python')).toBe(
      'n = 0\nwhile n < 3:\n    print(n)\n    n += 1\n'
    );
  });

  it('keeps a sentence without its full stop a statement', () => {
    expect(translate('Print 7\nPrint 8\n', 'english', 'python')).toBe(
      'print(7)\nprint(8)\n'
    );
  });
});

describe('increasing and decreasing a variable', () => {
  it('reads English increase, add to, decrease and subtract from', () => {
    const source =
      'Let n be 0.\nIncrease n by 1.\nAdd 2 to n.\nDecrease n by 1.\nSubtract 1 from n.\nPrint n.\n';
    expect(translate(source, 'english', 'javascript')).toBe(
      'let n = 0;\nn += 1;\nn += 2;\nn -= 1;\nn -= 1;\nconsole.log(n);\n'
    );
  });

  it('is written back as the canonical assignment', () => {
    expect(
      translate('Let n be 0.\nIncrease n by 1.\n', 'english', 'english')
    ).toBe('Create n with value 0.\nChange n to n plus 1.\n');
  });
});

describe('everyday Russian wordings', () => {
  const everyday = [
    'Пусть n равно 0.',
    'Пока n меньше 3, сделать это:',
    '  Установить n в n + 1.',
    'Напечатать n.',
    'Увеличить n на 2.',
    'Уменьшить n на 1.',
    'Вывести n.',
    'Для каждого i от 1 до 3, сделать это:',
    '  Показать i.',
    '',
  ].join('\n');

  it('read like the canonical sentences', () => {
    expect(translate(everyday, 'russian', 'python')).toBe(
      [
        'n = 0',
        'while n < 3:',
        '    n += 1',
        'print(n)',
        'n += 2',
        'n -= 1',
        'print(n)',
        'for i in range(1, 4):',
        '    print(i)',
        '',
      ].join('\n')
    );
  });

  it('read each statement', () => {
    const cases = [
      ['Пусть n будет 5.\n', 'n = 5'],
      ['Пусть n равно 0.\nПрисвоить n значение 4.\n', 'n = 4'],
      ['Вывести 7.\n', 'print(7)'],
      ['вывести 7\n', 'print(7)'],
    ];
    for (const [source, expected] of cases) {
      expect(translate(source, 'russian', 'python')).toContain(expected);
    }
  });

  it('are detected as Russian that reads', () => {
    const [first] = detectLanguage(everyday);
    expect([first.id, first.reads]).toEqual(['russian', true]);
  });
});

// What a sentence of each key with the name n and the value 2 reads as, after
// a declaration of n (a declaration alone is never reassigned).
const everydayKeys = {
  declare: 'const n = 2;',
  assign: 'n = 2;',
  increase: 'n += 2;',
  decrease: 'n -= 2;',
  'print-line': 'console.log(n);',
};

describe('everyday wordings in every natural language', () => {
  const languages = naturalLanguageIds().filter(
    (id) => !naturalLanguage(id).base
  );

  it('give every language increase and decrease', () => {
    expect(languages.length).toBeGreaterThanOrEqual(30);
    for (const id of languages) {
      const { templates } = naturalLanguage(id);
      expect([id, Boolean(templates.increase && templates.decrease)]).toEqual([
        id,
        true,
      ]);
    }
  });

  it('read every wording of a statement as the statement', () => {
    for (const id of languages) {
      const language = naturalLanguage(id);
      const declare = translate('let n = 0;\n', 'javascript', id).trim();
      for (const [key, expected] of Object.entries(everydayKeys)) {
        for (const wording of language.templates[key]) {
          const value = key === 'print-line' ? 'n' : '2';
          const sentence = `${wording.replace('{name}', 'n').replace('{value}', value)}${language.sentenceEnd}`;
          const text =
            key === 'declare' ? `${sentence}\n` : `${declare}\n${sentence}\n`;
          const last = translate(text, id, 'javascript')
            .trim()
            .split('\n')
            .at(-1);
          expect([sentence, last]).toEqual([sentence, expected]);
        }
      }
    }
  });
});
