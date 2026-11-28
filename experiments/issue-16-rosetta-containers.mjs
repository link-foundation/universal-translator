import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractSolutions } from '../scripts/rosetta-code.mjs';

const [wikiResponse, rustTranslator] = process.argv.slice(2);
assert.ok(
  wikiResponse,
  'Pass the MediaWiki revisions listed in ROSETTA-CODE.md'
);
const { query } = JSON.parse(readFileSync(wikiResponse, 'utf8'));
const digest = (text) => createHash('sha256').update(text).digest('hex');
const tasks = [
  {
    title: 'Queue/Usage',
    revid: 420325,
    sourceSha256:
      '9817bba8d92cd8c7e566c922a0d62aeba1305712304d21cdd909fe5d4e206c8e',
    stdout: '',
    assertions: 19,
  },
  {
    title: 'Order two numerical lists',
    revid: 417505,
    sourceSha256:
      '4752e59fbf4d6f7eb603159f34df8553a7ee092bd612124bcad36cb0c3953fd0',
    stdout: 'false\n',
    assertions: 0,
  },
  {
    title: 'Jewels and stones',
    revid: 419626,
    sourceSha256:
      'ca42e7b599a3fb251aef227a867e801cf3fa6062fe0cf924711d4e732561361e',
    stdout: '3\n0\n',
    assertions: 0,
  },
  {
    title: 'String append',
    revid: 420026,
    sourceSha256:
      'a3bbf3d8933188b5ec5a14214c4bf5464cb07dafa97e79b8783b50f3133b638b',
    stdout: 'Hello , world!\n',
    assertions: 0,
  },
  {
    title: 'Array length',
    revid: 419956,
    sourceSha256:
      '3d1a0dc91ea31a01d7d9d0a8598efc0e12efe48b5d452fe669b6fc1f808e3c5f',
    stdout: '2',
    assertions: 0,
  },
  {
    title: 'String length',
    revid: 420285,
    sourceSha256:
      '9ef1ac9c0aa99ec023cc8e624f97420c8eb56c37c7b89f68c7db55bf254bcf2a',
    stdout: '',
    assertions: 0,
    observed: 'length == 13 && size == 13 && bytes == 13',
  },
  {
    title: 'Character codes',
    revid: 419019,
    sourceSha256:
      'f87fce6a1d7a8dced18fe98df2555b349fcae7a71ab82c26a214beaa51c2861c',
    stdout: '97\na\n',
    assertions: 0,
  },
  {
    title: 'Formatted numeric output',
    revid: 412804,
    sourceSha256:
      'a4b2bd56246fa4a03121a002af7c03f75f8867500eb8c1344e26bc086744712b',
    stdout: '00007.125\n',
    assertions: 0,
  },
  {
    title: 'Hello world/Newbie',
    revid: 417360,
    sourceSha256:
      '6f1e387f2700654e86d4d87a4176f71dd478474c4012448c7ce754263eb63fcb',
    stdout: 'Hello, World!\n',
    assertions: 0,
  },
  {
    title: 'Copy stdin to stdout',
    revid: 417213,
    sourceSha256:
      'b721bf0677eaf7c524d45b335a9b25480a6249a5f40d3da1730cba454ae57fbc',
    stdin: ' first line\n\n\tsecond line\n',
    stdout: ' first line\n\n\tsecond line\n',
    assertions: 0,
  },
  {
    title: 'Reverse a string',
    revid: 420276,
    sourceSha256:
      '7bb7130263cd8b8a9f2fe4749eefb07057ff786881ac769e9d60205d9da88881',
    stdin: '012 ab  \n',
    stdout: '  ba 210\n',
    assertions: 0,
  },
  {
    title: 'Shortest common supersequence',
    revid: 418354,
    sourceSha256:
      'fbfc542a5fa55844e8583484418659ee509e072cbfe3f6278a3b78e62d765ef6',
    stdout: 'abdcabdab\n',
    assertions: 0,
  },
  {
    title: 'Substring',
    revid: 418506,
    sourceSha256:
      '525da75ab91b9634b2e8d2d6cfb9559371c8c4567a1bd1eb78bb28f74f03b971',
    stdout: '3456\n3456789\n012345678\n2345\n4567\n',
    assertions: 0,
  },
];
const cli = fileURLToPath(
  new URL('../bin/universal-translator.js', import.meta.url)
);
const translators = [['JavaScript', process.execPath, [cli]]];
if (rustTranslator) {
  translators.push(['Rust', rustTranslator, []]);
}

const directory = mkdtempSync(join(tmpdir(), 'rosetta-containers-'));
const options = { encoding: 'utf8', maxBuffer: 32 * 1024 };
try {
  const file = join(directory, 'program.cpp');
  const binary = join(directory, 'program');
  const run = (program, task) => {
    assert.ok(program.trim().length, `${task.title}: empty program`);
    assert.equal(
      [...program.matchAll(/\bassert\s*\(/gu)].length,
      task.assertions,
      task.title
    );
    writeFileSync(file, program);
    execFileSync(
      process.env.CXX ?? 'c++',
      ['-std=c++17', '-UNDEBUG', file, '-o', binary],
      options
    );
    return execFileSync(binary, [], { ...options, input: task.stdin });
  };

  for (const task of tasks) {
    const page = query.pages.find(({ title }) => title === task.title);
    const revision = page?.revisions.find(({ revid }) => revid === task.revid);
    assert.ok(revision, `Missing revision ${task.revid} for ${task.title}`);
    const [source] = extractSolutions(revision.slots.main.content).cpp;
    assert.equal(digest(source), task.sourceSha256, task.title);
    const original = run(source, task);
    assert.equal(original, task.stdout, task.title);
    const checkValues = (program) => {
      const main = program.indexOf('int main');
      const close = program.lastIndexOf('}');
      assert.ok(main >= 0 && close > main, task.title);
      assert.ok(!/\breturn\b/u.test(program.slice(main, close)), task.title);
      const checked = `${program.slice(0, close)}\nif (!(${task.observed})) return 123;\n${program.slice(close)}`;
      assert.equal(run(checked, task), original, task.title);
    };
    if (task.observed) {
      checkValues(source);
    }
    for (const [engine, command, args] of translators) {
      const program = execFileSync(
        command,
        [...args, 'translate', 'cpp', 'cpp', '-', '--all-or-nothing'],
        { ...options, input: source }
      );
      assert.equal(run(program, task), original, `${task.title} via ${engine}`);
      if (task.observed) {
        checkValues(program);
      }
      console.log(
        JSON.stringify({
          title: task.title,
          revid: task.revid,
          sourceSha256: task.sourceSha256,
          engine,
          stdout: original,
          assertions: task.assertions,
          observed: task.observed,
        })
      );
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
