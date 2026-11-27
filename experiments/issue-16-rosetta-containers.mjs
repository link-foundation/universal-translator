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
  'Pass the MediaWiki response for revisions 420325, 417505, 419626 and 420026'
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
    return execFileSync(binary, [], options);
  };

  for (const task of tasks) {
    const page = query.pages.find(({ title }) => title === task.title);
    const revision = page?.revisions.find(({ revid }) => revid === task.revid);
    assert.ok(revision, `Missing revision ${task.revid} for ${task.title}`);
    const [source] = extractSolutions(revision.slots.main.content).cpp;
    assert.equal(digest(source), task.sourceSha256, task.title);
    const original = run(source, task);
    assert.equal(original, task.stdout, task.title);
    for (const [engine, command, args] of translators) {
      const program = execFileSync(
        command,
        [...args, 'translate', 'cpp', 'cpp', '-', '--all-or-nothing'],
        { ...options, input: source }
      );
      assert.equal(run(program, task), original, `${task.title} via ${engine}`);
      console.log(
        JSON.stringify({
          title: task.title,
          revid: task.revid,
          sourceSha256: task.sourceSha256,
          engine,
          stdout: original,
          assertions: task.assertions,
        })
      );
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
