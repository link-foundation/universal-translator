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
  {
    title: 'ABC correlation',
    revid: 420238,
    sourceSha256:
      'bf34b34fd94cf1700adf443400c7c7cc7da2464c29c64d8c5e12dd926123e781',
    stdout: '1\n1\n0\n1\n',
    assertions: 0,
    driver: String.raw`
#include <iostream>
int main() {
    for (auto sample : {"abcabc", "xyz", "abcac", ""}) {
        std::cout << countabc(sample) << '\n';
    }
}
`,
  },
  {
    title: 'Approximate equality',
    revid: 418405,
    sourceSha256:
      '0610a06060407625482280c71db388f4001f893a93dc5832bf366ac4bdf88456',
    comparisons: ['1', '0', '0', '0', '1', '0', '0', '1'],
    assertions: 0,
  },
  {
    title: "Euler's identity",
    revid: 418309,
    sourceSha256:
      'f0028660573aff1315e82d2e8b793bb981d5bd430e1fa1f1f46fbf9dcbb6fdc6',
    stdout: '(0,1.22465e-16)\n',
    assertions: 0,
  },
  {
    title: 'List comprehensions',
    revid: 415006,
    sourceSha256:
      '4d98825d47dbb8c69db9941539b25b50f2db16bd64fbd81ce3ccaf9606ea37f0',
    stdout: '3 4 5 5 12 13 6 8 10 8 15 17 9 12 15 12 16 20 \n',
    assertions: 0,
  },
  {
    title: 'Generate lower case ASCII alphabet',
    revid: 418063,
    sourceSha256:
      '277ee5fc9a3390e0a79a3970689ccde2069e3f9bad3de30e657f9f1d14b8b8fc',
    stdout: '',
    observed: 'lower == "abcdefghijklmnopqrstuvwxyz"',
    assertions: 0,
  },
  {
    title: 'Find if a point is within a triangle',
    revid: 418364,
    sourceSha256:
      'ef64182697630e7a71219b705645efe90ce96a92944b3ae17c3e7a020972ea96',
    stdout: [
      'Triangle is [(1.5, 2.4), (5.1, -3.1), (-3.8, 1.2)]',
      'Point (0, 0) is within triangle? true',
      'Triangle is [(1.5, 2.4), (5.1, -3.1), (-3.8, 1.2)]',
      'Point (0, 1) is within triangle? true',
      'Triangle is [(1.5, 2.4), (5.1, -3.1), (-3.8, 1.2)]',
      'Point (3, 1) is within triangle? false',
      '',
      'Triangle is [(0.1, 0.111111), (12.5, 33.3333), (25, 11.1111)]',
      'Point (5.41429, 14.3492) is within triangle? true',
      '',
      'Triangle is [(0.1, 0.111111), (12.5, 33.3333), (-12.5, 16.6667)]',
      'Point (5.41429, 14.3492) is within triangle? true',
      '',
      '',
    ].join('\n'),
    assertions: 0,
  },
  {
    title: 'Binary digits',
    revid: 419726,
    sourceSha256:
      '138fe979e400ca4c9f446db1aa20ac663820631cd01bed2b700d3a345445f798',
    stdout: '0\n101\n110010\n10001100101000\n',
    observed: 'static_cast<void (*)(unsigned int)>(&print_bin) != nullptr',
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
    writeFileSync(
      file,
      task.driver ? `#include <string>\n${program}\n${task.driver}` : program
    );
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
    if (task.comparisons) {
      assert.deepEqual(
        original
          .trimEnd()
          .split('\n')
          .map((line) => line.split(' => ')[1]),
        task.comparisons,
        task.title
      );
    } else {
      assert.equal(original, task.stdout, task.title);
    }
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
      const flags = task.driver
        ? ['--all-or-nothing', '--fragment']
        : ['--all-or-nothing'];
      const program = execFileSync(
        command,
        [...args, 'translate', 'cpp', 'cpp', '-', ...flags],
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
          driver: task.driver ? 'appended native caller' : undefined,
        })
      );
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
