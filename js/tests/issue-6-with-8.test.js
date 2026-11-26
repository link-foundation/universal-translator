// Comment languages and language versions work together with partial
// translation by default, the source language "auto" and rules as data in
// the library, the command line and the server.
import { describe, expect, it } from 'test-anywhere';

import {
  createTranslationServer,
  translatePartial,
} from '../../js/src/index.js';
import { runCli } from '../../bin/universal-translator.js';

const cli = (argv, input = '') => {
  const output = [];
  const errors = [];
  const status = runCli(argv, {
    read: () => input,
    write: (text) => output.push(text),
    stdout: (text) => output.push(text),
    stderr: (text) => errors.push(text),
  });
  return { status, output: output.join(''), errors: errors.join('\n') };
};

const commented = '// number\nlet x = 1;\nconsole.log(x);\n';

describe('comment languages and versions with partial translation', () => {
  it('writes comments in another language into a version of a language', () => {
    const result = translatePartial(commented, 'javascript', 'python@2', {
      commentLanguage: 'russian',
    });
    expect(result.complete).toBe(true);
    expect(result.text).toBe('# число\nx = 1\nprint x\n');
  });

  it('keeps comment languages and versions in parts that translate', () => {
    const source = '# number\nx = 1\nwith open(f) as g:\n    y = 2\nprint(x)\n';
    const result = translatePartial(source, 'python', 'javascript', {
      commentLanguage: 'russian',
    });
    expect(result.complete).toBe(false);
    expect(result.errors.map(({ line }) => line)).toEqual([3]);
    expect(result.text).toContain('// число');
    expect(result.text).toContain('console.log(x);');
    expect(result.text).toContain('// untranslated (line 3)');
  });

  it('passes --comment-language and --comment-from through the partial default', () => {
    const versioned = cli(
      ['translate', 'javascript', 'python@2', '--comment-language', 'russian'],
      commented
    );
    expect(versioned).toEqual({
      status: 0,
      output: '# число\nx = 1\nprint x\n',
      errors: '',
    });
    const strict = cli(
      [
        'translate',
        'javascript',
        'python',
        '--all-or-nothing',
        '--comment-from',
        'english',
        '--comment-language',
        'german',
      ],
      commented
    );
    // Word-by-word comments keep the case of the source word.
    expect(strict.output.toLowerCase()).toBe('# zahl\nx = 1\nprint(x)\n');
  });

  it('translates only the comments of a text whose language is detected', () => {
    const result = cli(
      ['translate', 'auto', 'javascript', '--comment-language', 'russian'],
      commented
    );
    expect(result.status).toBe(0);
    expect(result.errors).toBe('Detected language: javascript');
    expect(result.output).toBe('// число\nlet x = 1;\nconsole.log(x);\n');
  });

  it('refuses a comment language that does not exist before reading', () => {
    expect(() =>
      translatePartial(commented, 'javascript', 'python', {
        commentLanguage: 'klingon',
      })
    ).toThrow('No controlled natural language "klingon"');
    const result = cli(
      ['translate', 'javascript', 'python', '--comment-language', 'klingon'],
      commented
    );
    expect(result.status).toBe(1);
    expect(result.output).toBe('');
  });

  it('reads a version of a language with the rules of the language', () => {
    const source = 'flags = [1] * (n + 1)\n';
    const read = (from) =>
      translatePartial(source, from, 'javascript', { fragment: true }).text;
    expect(read('python@2')).toBe(read('python'));
    expect(read('python@2')).toContain('new Array(n + 1).fill(1)');
  });

  it('serves comment languages with detection and rules', async () => {
    const server = createTranslationServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const response = await fetch(`${base}/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: commented,
          from: 'auto',
          to: 'python@2',
          commentLanguage: 'russian',
          rules: { names: [{ find: 'x', replace: 'count' }] },
        }),
      });
      expect(await response.json()).toEqual({
        output: '# число\ncount = 1\nprint count\n',
        complete: true,
        errors: [],
        coverage: 1,
        // Comment anchors retain their mapping after translation. The
        // following line still shares source tokens after renaming.
        lineMap: [
          [0, 0],
          [1, 1],
        ],
        detected: 'javascript',
      });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
