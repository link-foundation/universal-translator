// Everyday English wordings of algorithm sentences ("Let n be 0",
// "Print n", "While ..., do this") read like the canonical ones. Translation
// writes the canonical wording, the first template of each key. The Rust twin
// is rust/tests/natural_wordings.rs.
import { describe, expect, it } from 'test-anywhere';

import { translate } from '../src/index.js';

const everyday =
  'Let n be 0.\nWhile n is less than 3, do this:\n  Set n to n plus 1.\nPrint n.\n';
const canonical =
  'Create n with value 0.\nWhile n falls below 3, repeat this:\n  Change n to n plus 1.\nWrite n and end the line.\n';

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
