import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'test-anywhere';

import {
  createTranslationServer,
  createTranslator,
  detectLanguage,
  parsePartial,
  translate,
  translatePartial,
} from '../../js/src/index.js';
import { runCli } from '../../bin/universal-translator.js';
import { checkDescription } from '../../js/src/natural/rules.js';
import { naturalLanguageIds } from '../../js/src/natural/catalog.js';

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

describe('comparison wordings (issue #8)', () => {
  it('reads the Russian examples of the issue', () => {
    for (const [words, operator] of [
      ['меньше или равно', '<='],
      ['больше или равно', '>='],
    ]) {
      const source = `Если n ${words} 1, сделать это:\n  Ничего не делать\n`;
      expect(translate(source, 'russian', 'javascript')).toContain(
        `n ${operator} 1`
      );
    }
  });

  it('reads other obvious variations', () => {
    const cases = [
      ['Если n меньше либо равно 1, то:\n  Ничего не делать\n', 'russian'],
      ['Если n <= 1, то:\n  Ничего не делать\n', 'russian'],
      ['Если n ≤ 1:\n  Ничего не делать\n', 'russian'],
      ['If n is less than or equal to 1, then:\n  Do nothing\n', 'english'],
      ['If n is at most 1:\n  Do nothing\n', 'english'],
      ['If n <= 1:\n  Do nothing\n', 'english'],
    ];
    for (const [source, from] of cases) {
      expect(translate(source, from, 'python')).toContain('n <= 1');
    }
  });

  it('keeps every language within its own rules', () => {
    for (const id of naturalLanguageIds()) {
      expect(checkDescription(id)).toEqual([]);
    }
  });

  it('reads Python pass as an empty statement', () => {
    const output = translate('if n <= 1:\n    pass\n', 'python', 'russian');
    expect(output).not.toContain('проход');
  });
});

describe('partial translation (issue #8)', () => {
  const source = 'x = 1\nwith open(f) as g:\n    y = 2\nprint(x)\n';

  it('translates what it can and marks the rest', () => {
    const result = translatePartial(source, 'python', 'javascript');
    expect(result.complete).toBe(false);
    expect(result.errors.map(({ line }) => line)).toContain(2);
    expect(result.text).toContain('console.log(x)');
    expect(result.text).toContain('// untranslated (line 2)');
  });

  it('counts the lines it reads', () => {
    const reading = parsePartial(source, 'python');
    expect(reading.lines).toBe(4);
    expect(reading.readLines).toBe(3);
    expect(reading.coverage).toBe(0.75);
  });

  it('is complete when everything reads', () => {
    const result = translatePartial('print(1)\n', 'python', 'javascript');
    expect(result.complete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.coverage).toBe(1);
  });

  it('marks untranslated natural sentences', () => {
    const result = translatePartial(
      'Написать 1 и закончить строку.\nЛетать к луне.\n',
      'russian',
      'python'
    );
    expect(result.errors[0].line).toBe(2);
    expect(result.text).toContain('print(1)');
  });

  it('is the default of the command line', () => {
    const run = cli(['translate', 'python', 'javascript'], source);
    expect(run.status).toBe(0);
    expect(run.output).toContain('console.log(x)');
    expect(run.errors).toContain('Translated 3 of 4 lines');
    const strict = cli(
      ['translate', 'python', 'javascript', '--all-or-nothing'],
      source
    );
    expect(strict.status).toBe(1);
    expect(strict.output).toBe('');
  });

  it('reports coverage on the command line', () => {
    const report = JSON.parse(cli(['coverage', 'python'], source).output);
    expect(report.coverage).toBe(0.75);
  });
});

describe('language detection (issue #8)', () => {
  const cases = [
    ['console.log("hi");\n', 'javascript'],
    ['def f(x):\n    return x\nprint(f(1))\n', 'python'],
    ['fn main() {\n    println!("hi");\n}\n', 'rust'],
    [
      'Если n меньше или равно 1, сделать это:\n  Ничего не делать\n',
      'russian',
    ],
    ['If n is less than 1, then:\n  Do nothing\n', 'english'],
  ];

  it('finds the language of a text', () => {
    for (const [source, id] of cases) {
      expect(detectLanguage(source)[0].id).toBe(id);
    }
  });

  it('detects nothing in an empty text', () => {
    expect(detectLanguage('  \n')).toEqual([]);
  });

  it('translates from "auto" on the command line', () => {
    const run = cli(['translate', 'auto', 'python'], cases[0][0]);
    expect(run.output).toContain('print("hi")');
    expect(run.errors).toContain('Detected language: javascript');
    expect(JSON.parse(cli(['detect'], cases[1][0]).output)[0].id).toBe(
      'python'
    );
  });
});

describe('rules as data (issue #8)', () => {
  const rules = {
    source: [{ language: 'russian', find: 'ничего', replace: 'Ничего' }],
    templates: {
      russian: { 'less-or-equal': ['{left} самое большее {right}'] },
    },
    names: [{ find: 'n', replace: 'count' }],
    output: [{ language: 'python', find: '<=', replace: '<=' }],
  };
  const source = 'Если n самое большее 1, сделать это:\n  ничего не делать\n';

  it('apply at every stage', () => {
    const translator = createTranslator({ rules });
    expect(translator.translate(source, 'russian', 'python')).toBe(
      'if count <= 1:\n    pass\n'
    );
    expect(() => translate(source, 'russian', 'python')).toThrow();
  });

  it('rewrite the output with regular expressions', () => {
    const translator = createTranslator({
      rules: { output: [{ find: '(\\d+)', replace: '[$1]', regex: true }] },
    });
    expect(translator.translate('print(1)\n', 'python', 'python')).toBe(
      'print([1])\n'
    );
  });

  it('are checked', () => {
    expect(() => createTranslator({ rules: { parse: [] } })).toThrow(
      'Unknown rule stage'
    );
    expect(() => createTranslator({ rules: { source: [{}] } })).toThrow(
      'needs a "find" text'
    );
    expect(() =>
      createTranslator({ rules: { templates: { english: { nope: ['x'] } } } })
    ).toThrow('No template "nope"');
  });

  it('are read from a file on the command line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rules-'));
    try {
      const file = join(dir, 'rules.json');
      writeFileSync(file, JSON.stringify(rules));
      const run = cli(
        ['translate', 'russian', 'python', '--rules', file],
        source
      );
      expect(run.output).toBe('if count <= 1:\n    pass\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('translation server (issue #8)', () => {
  const post = async (body) => {
    const server = createTranslationServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/translate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      return { status: response.status, body: await response.json() };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  };

  it('translates partially, detects and applies rules', async () => {
    const partial = await post({
      source: 'x = 1\nwith open(f) as g:\n    y = 2\n',
      from: 'auto',
      to: 'javascript',
    });
    expect(partial.status).toBe(200);
    expect(partial.body.detected).toBe('python');
    expect(partial.body.complete).toBe(false);
    expect(partial.body.errors[0].line).toBe(2);

    const strict = await post({
      source: 'with open(f) as g:\n    y = 2\n',
      from: 'python',
      to: 'javascript',
      allOrNothing: true,
    });
    expect(strict.status).toBe(400);

    const ruled = await post({
      source: 'print(1)\n',
      from: 'python',
      to: 'python',
      rules: { output: [{ find: '1', replace: '2' }] },
    });
    expect(ruled.body.output).toBe('print(2)\n');

    expect(
      (await post({ source: '', from: 'a', to: 'b', rules: [] })).status
    ).toBe(400);
  });
});

describe('cut texts (issue #8)', () => {
  it('end a dialect read instead of looping', () => {
    // Before the fix the Ada reader skipped declarations past the end of
    // the text forever; partial reading of Rosetta Code hung on it.
    const started = Date.now();
    const reading = parsePartial('procedure P is\n   x : Integer;\n', 'ada');
    expect(reading.lines).toBe(2);
    expect(Date.now() - started < 5000).toBe(true);
  });
});
