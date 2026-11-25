import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { runCli } from '../../bin/universal-translator.js';
import {
  detectCommentLanguage,
  translate,
  translateCommentText,
  translateComments,
} from '../src/index.js';

const read = (task) => readFileSync(`examples/programs/${task}.js`, 'utf8');
const codeOf = (source, marker) =>
  source
    .split('\n')
    .map((line) => line.split(marker)[0])
    .join('\n');

describe('comment language', () => {
  it('translates comment words through the shared meanings', () => {
    expect(
      translateCommentText('Sum of squares', { from: 'english', to: 'russian' })
    ).toBe('Сумма из квадраты');
    expect(
      translateCommentText('Сумма', { from: 'russian', to: 'english' })
    ).toBe('Sum');
    expect(
      translateCommentText('the color, 42', {
        from: 'english',
        to: 'english-british',
      })
    ).toBe('the colour, 42');
    expect(
      translateCommentText('  keep   spaces  ', {
        from: 'english',
        to: 'english',
      })
    ).toBe('  keep   spaces  ');
  });

  it('detects the language of the comments', () => {
    expect(detectCommentLanguage(['Сумма квадратов'])).toBe('russian');
    expect(detectCommentLanguage(['Summe der Quadrate'])).toBe('german');
    expect(detectCommentLanguage(['42'])).toBe('english');
  });

  it('changes only the comments when the code language stays', () => {
    const source = read('sum-of-squares');
    const russian = translate(source, 'javascript', 'javascript', {
      commentLanguage: 'russian',
    });
    expect(russian).toContain('// Сумма из квадраты in JavaScript');
    expect(codeOf(russian, '//')).toBe(codeOf(source, '//'));
    const block = '/* Sum\n *   of   squares */\nlet x = 1; // number\n';
    expect(
      translateComments(block, 'javascript', { from: 'english', to: 'german' })
    ).toBe('/* Summe\n *   von   quadrate */\nlet x = 1; // zahl\n');
  });

  it('translates comments together with the code', () => {
    const python = translate(read('sum-of-squares'), 'javascript', 'python', {
      commentLanguage: 'german',
    });
    expect(python).toContain('# Summe von quadrate in Python');
    expect(python).toContain('def sum_of_squares(limit):');
  });

  it('takes a translator of its own for the comments', () => {
    const shout = (text, { from, to }) => `${from}>${to}:${text.toUpperCase()}`;
    expect(
      translate('// hi\nlet x = 1;\n', 'javascript', 'javascript', {
        commentLanguage: 'french',
        commentFrom: 'english',
        translateComment: shout,
      })
    ).toBe('//english>french: HI\nlet x = 1;\n');
  });

  it('is available from the command line', () => {
    let output = '';
    const code = runCli(
      [
        'translate',
        'javascript',
        'javascript',
        '-',
        '--comment-language',
        'russian',
      ],
      {
        read: () => '// number\nlet x = 1;\n',
        write: (text) => (output += text),
      }
    );
    expect(code).toBe(0);
    expect(output).toBe('// число\nlet x = 1;\n');
  });
});

describe('comments inside indented blocks', () => {
  it('keeps a comment that opens an indented block', () => {
    const python =
      'def sq(n):\n    # square it\n    return n * n\n\nprint(sq(2))\n';
    const javascript = translate(python, 'python', 'javascript');
    expect(javascript).toBe(
      'function sq(n) {\n    // square it\n    return n * n;\n}\n\nconsole.log(sq(2));\n'
    );
    expect(translate(javascript, 'javascript', 'python')).toBe(python);
  });

  it('keeps comments that close an indented block', () => {
    const python =
      'def sq(n):\n    return n * n\n    # inside\n# outside\nprint(sq(2))\n';
    const javascript = translate(python, 'python', 'javascript');
    expect(javascript).toBe(
      'function sq(n) {\n    return n * n;\n    // inside\n}\n\n// outside\nconsole.log(sq(2));\n'
    );
    expect(translate(javascript, 'javascript', 'python')).toBe(
      'def sq(n):\n    return n * n\n    # inside\n\n# outside\nprint(sq(2))\n'
    );
    expect(translate('// only\n', 'javascript', 'python')).toBe('# only\n');
  });
});
