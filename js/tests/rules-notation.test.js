// Issue 12: translation rules are written as indented Links Notation, not
// JSON. The same file is read by the JavaScript and the Rust command line
// (rust/tests/rules_notation.rs).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'test-anywhere';

import {
  createTranslationServer,
  createTranslator,
  formatRules,
  readRules,
} from '../../js/src/index.js';
import { runCli } from '../../bin/universal-translator.js';

const exampleFile = new URL(
  '../../examples/rules/russian-at-most.lino',
  import.meta.url
);
const example = readFileSync(exampleFile, 'utf8');

const exampleRules = {
  source: [{ find: 'ничего', replace: 'Ничего', language: 'russian' }],
  templates: { russian: { 'less-or-equal': ['{left} самое большее {right}'] } },
  names: [{ find: 'n', replace: 'count' }],
  output: [
    { find: 'pass', replace: 'pass  # ничего', language: 'python' },
    {
      find: '(\\d+)',
      replace: '[$1]',
      regex: true,
      language: 'javascript',
    },
  ],
};

const russian = 'Если n самое большее 1, сделать это:\n  ничего не делать\n';

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

describe('rules as Links Notation', () => {
  it('reads the example rule file', () => {
    expect(readRules(example)).toEqual(exampleRules);
  });

  it('writes the same text back', () => {
    expect(formatRules(exampleRules)).toBe(example);
    expect(formatRules(readRules(example))).toBe(example);
  });

  it('uses "name:" only for stages, languages and template keys', () => {
    for (const line of example.split('\n').filter(Boolean)) {
      expect(/^\s*\(/.test(line) || /^\s*[\w-]+:( |$)/.test(line)).toBe(true);
    }
    expect(example).not.toContain('{"');
  });

  it('quotes texts with spaces, brackets and quotes', () => {
    const rules = {
      source: [{ find: "it's (x)", replace: 'a b' }],
      names: [{ find: 'x', replace: 'y' }],
    };
    const text = formatRules(rules);
    expect(text).toBe(
      "source:\n  (find 'it''s (x)') (replace 'a b')\nnames:\n  (find x) (replace y)\n"
    );
    expect(readRules(text)).toEqual(rules);
  });

  it('reads a rule without "replace" and writes nothing for no rules', () => {
    expect(readRules('output:\n  (find x)\n')).toEqual({
      output: [{ find: 'x' }],
    });
    expect(formatRules({})).toBe('');
    expect(readRules('')).toEqual({});
  });

  it('still reads rules written as JSON', () => {
    expect(readRules(JSON.stringify(exampleRules))).toEqual(exampleRules);
  });

  it('says what is wrong', () => {
    expect(() => readRules('parse:\n  (find x)\n')).toThrow(
      'Unknown rule stage "parse"'
    );
    expect(() => readRules('names:\n  (find x) (with y)\n')).toThrow(
      'The names rule 1 has no field "with"'
    );
    expect(() => readRules('output:\n  (find x) (find y)\n')).toThrow(
      '"find" twice'
    );
    expect(() => readRules('output:\n  (find x) (regex maybe)\n')).toThrow(
      'use true or false'
    );
    expect(() => readRules('names:\n  (find a)\nnames:\n  (find b)\n')).toThrow(
      'given twice'
    );
  });

  it('translates with the rules given as text', () => {
    const translator = createTranslator({ rules: example });
    expect(translator.translate(russian, 'russian', 'python')).toBe(
      'if count <= 1:\n    pass  # ничего\n'
    );
    expect(translator.translate(russian, 'russian', 'javascript')).toContain(
      'count <= [1]'
    );
  });

  it('reads a .lino rule file on the command line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rules-'));
    try {
      const file = join(dir, 'rules.lino');
      writeFileSync(file, example);
      const result = cli(
        ['translate', 'russian', 'python', '--rules', file],
        russian
      );
      expect(result.errors).toBe('');
      expect(result.output).toBe('if count <= 1:\n    pass  # ничего\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is accepted by the server as text', async () => {
    const post = async (body, settings) => {
      const server = createTranslationServer(settings);
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
    const plain = await post({
      source: 'print(1)\n',
      from: 'python',
      to: 'python',
      rules: 'output:\n  (find 1) (replace 2)\n',
    });
    expect(plain.body.output).toBe('print(2)\n');
    const regex = {
      source: 'print(1)\n',
      from: 'python',
      to: 'python',
      rules: "output:\n  (find '\\d') (replace 2) (regex true)\n",
    };
    const refused = await post(regex);
    expect(refused.status).toBe(400);
    expect(refused.body.error).toContain('only plain text rules');
    expect((await post(regex, { allowRegexRules: true })).body.output).toBe(
      'print(2)\n'
    );
    const broken = await post({ ...regex, rules: 'parse:\n  (find x)\n' });
    expect(broken.status).toBe(400);
    expect(broken.body.error).toContain('Unknown rule stage');
  });
});
