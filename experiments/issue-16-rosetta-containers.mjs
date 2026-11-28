import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractSolutions } from '../scripts/rosetta-code.mjs';

const [wikiResponse, rustTranslator, ...selectedTasks] = process.argv.slice(2);
assert.ok(
  wikiResponse,
  'Pass the MediaWiki revisions listed in ROSETTA-CODE.md'
);
const { query } = JSON.parse(readFileSync(wikiResponse, 'utf8'));
const digest = (text) => createHash('sha256').update(text).digest('hex');
const copyInput = ' first line\n\n\tsecond line\n\0tail\n';
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
    stdin: copyInput,
    stdout: copyInput,
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
  {
    title: 'Modular exponentiation',
    revid: 417465,
    sourceSha256:
      '2790ed03a909b63e65856fd304728b99759a1fb48130ff3cec44e0a61b256b12',
    stdout: '1527229998585248450016808958343740453059\n',
    assertions: 0,
    dependency: 'Boost',
  },
  {
    title: 'URL encoding',
    revid: 419986,
    sourceSha256:
      'a11dc7bfc7f7847db503e04acf1ae3ac3b8551e8cdae3ef7bc4dfbfb666116d6',
    stdout: 'http%3A%2F%2Ffoo%20bar%2F\n',
    assertions: 0,
    dependency: 'Qt Core',
    compile: ['-fPIC'],
    link: ['-lQt6Core'],
  },
  {
    title: 'Factorial',
    revid: 420257,
    sourceSha256:
      '0a4c28ac9a2bcdf1dbf8a8b4c274548f6f1a6ab9fa5f9692e850ec586430f75b',
    stdout: '1 1 720 479001600\n',
    assertions: 0,
    dependency: 'Boost',
    compile: [
      '-include',
      'boost/iterator/counting_iterator.hpp',
      '-include',
      'algorithm',
      '-include',
      'numeric',
      '-include',
      'functional',
    ],
    driver: String.raw`
#include <iostream>
int main() {
    std::cout << factorial(0) << ' ' << factorial(1) << ' '
              << factorial(6) << ' ' << factorial(12) << '\n';
}
`,
  },
  {
    title: 'Menu',
    revid: 419426,
    sourceSha256:
      'f6c8a19a06638c85bf2b9ea10868f52994d5a1c1380132f93505853f72603bde',
    stdin: '0\n2\n',
    stdout:
      'You chose: 1) fee fie\n2) huff and puff\n3) mirror mirror\n4) tick tock\n' +
      '> 1) fee fie\n2) huff and puff\n3) mirror mirror\n4) tick tock\n' +
      '> huff and puff\n',
    assertions: 0,
  },
  {
    title: 'Non-decimal radices/Input',
    revid: 413803,
    sourceSha256:
      'e58b0b4d50349d5dc6ac6901c04bfbea13abe136039ae41bf5b3b626c9397662',
    stdout: '123459\n123459\n180154659\n4009\n',
    assertions: 0,
  },
  {
    title: 'Repeat a string',
    revid: 418530,
    solutionIndex: 1,
    sourceSha256:
      'bde269cef9e2461880a670e0f0a4448498597af4e172db5afd22595dbd4eea93',
    stdout: '*****\n',
    assertions: 0,
  },
  {
    title: 'Set right-adjacent bits',
    revid: 417616,
    sourceSha256:
      '29d9e1133b0f77e2ba2dba69870a61ee0bb3c62387c684c10e37588997fa2269',
    compile: ['-include', 'cstdint'],
    stdoutSha256:
      '71f990c7585d658782744022e0709b283bcdb6ab258ca3f7bfe7249ff79940f3',
    assertions: 0,
  },
  {
    title: 'User input/Text',
    revid: 419450,
    sourceSha256:
      '34e484ef9e41f26bc10a7efde070643bb9f8175bedd33ab246c4dd714b8614ad',
    stdin: '75000\nword remainder\n',
    stdout: 'Enter an integer:  Enter a string:  ',
    assertions: 0,
    observed: 'integer_input == 75000 && string_input == "word"',
  },
  {
    title: 'Kernighans large earthquake problem',
    revid: 420008,
    sourceSha256:
      'd8e08722f8166b962572d21dc868ce7a49f31099544d2ec8aa3113cabfcdf022',
    fixtureFiles: {
      'include/earthquake.txt': 'A B 5.9\nC D 6.0\nE F 6.1\nG H 7.25\n',
    },
    stdout:
      'E\tF\t6.1\t\nG\tH\t7.25\t\n\nNumber of quakes greater than 6 is 2\n',
    assertions: 0,
  },
  {
    title: "Pell's equation",
    revid: 413841,
    sourceSha256:
      '5f5eb1231910e5f90021ecdacb18c08398a789ba701e4835648169000295e627',
    compile: ['-include', 'cmath', '-include', 'cstdint'],
    stdoutSha256:
      '72bf30d939ab09de965cc00f8818fbc05024519b89a9cc9f2ff92aa30976849c',
    assertions: 0,
  },
  {
    title: 'Apply a callback to an array',
    revid: 420356,
    solutionIndex: 1,
    sourceSha256:
      '918536679bd3299c1011a1374c68fb8d9392bb915f7ff98f4c90ece05c32ab4d',
    stdout: '1 4 9 16 25 ',
    assertions: 0,
  },
  {
    title: 'Sort an integer array',
    revid: 418114,
    solutionIndex: 1,
    sourceSha256:
      'd67a0f00873be5e4444cc8c1bd99b153ca607f9a675ada1e9a9da4e16a069b97',
    stdout: '',
    observed: 'nums == std::vector<int>{1, 2, 2, 3, 4}',
    assertions: 0,
  },
  {
    title: 'Sum of squares',
    revid: 419113,
    solutionIndex: 2,
    sourceSha256:
      '643393ef16318cb13d0b837bb295c0e5300cf1bc6e83784979e220aa2bf07963',
    compile: [
      '-include',
      'numeric',
      '-include',
      'vector',
      '-include',
      'boost/lambda/lambda.hpp',
    ],
    dependency: 'Boost',
    stdout: '13.25\n0\n',
    assertions: 0,
    driver: String.raw`
#include <iostream>
int main() {
    std::vector<double> values{-2.0, 3.0, 0.0, 0.5};
    std::vector<double> empty;
    std::cout << vec_add_squares(values) << '\n' << vec_add_squares(empty) << '\n';
}
`,
  },
  {
    title: 'Show the epoch',
    revid: 419964,
    solutionIndex: 1,
    sourceSha256:
      '548fd8c427e710d191acbfa0af7e51da48e165fa0d4ffb83d4130b866142293e',
    dependency: 'Boost',
    stdout: '1400-Jan-01 00:00:00\n',
    assertions: 0,
  },
];
assert.equal(new Set(tasks.map(({ title }) => title)).size, tasks.length);
for (const title of selectedTasks) {
  assert.ok(
    tasks.some((task) => task.title === title),
    `Unknown task ${title}`
  );
}
const activeTasks = selectedTasks.length
  ? tasks.filter(({ title }) => selectedTasks.includes(title))
  : tasks.filter(({ dependency }) => !dependency);
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
  const cwd = join(directory, 'run');
  mkdirSync(cwd);
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
      [
        '-std=c++17',
        '-UNDEBUG',
        ...(task.compile ?? []),
        file,
        ...(task.link ?? []),
        '-o',
        binary,
      ],
      options
    );
    return execFileSync(binary, [], { ...options, input: task.stdin, cwd });
  };

  for (const task of activeTasks) {
    const page = query.pages.find(({ title }) => title === task.title);
    const revision = page?.revisions.find(({ revid }) => revid === task.revid);
    assert.ok(revision, `Missing revision ${task.revid} for ${task.title}`);
    const source = extractSolutions(revision.slots.main.content).cpp[
      task.solutionIndex ?? 0
    ];
    assert.equal(digest(source), task.sourceSha256, task.title);
    for (const [path, content] of Object.entries(task.fixtureFiles ?? {})) {
      const target = join(directory, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
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
    } else if (task.stdoutSha256) {
      assert.equal(digest(original), task.stdoutSha256, task.title);
    } else {
      assert.equal(original, task.stdout, task.title);
    }
    const checkValues = (program) => {
      const main = program.indexOf('int main');
      const close = program.lastIndexOf('}');
      assert.ok(main >= 0 && close > main, task.title);
      const terminal = /\breturn\s+0\s*;\s*$/u.exec(program.slice(main, close));
      const checkAt = terminal ? main + terminal.index : close;
      assert.ok(!/\breturn\b/u.test(program.slice(main, checkAt)), task.title);
      const checked = `${program.slice(0, checkAt)}\nif (!(${task.observed})) return 123;\n${program.slice(checkAt)}`;
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
          solutionIndex: task.solutionIndex,
          sourceSha256: task.sourceSha256,
          engine,
          stdout: original,
          assertions: task.assertions,
          observed: task.observed,
          driver: task.driver ? 'appended native caller' : undefined,
          dependency: task.dependency,
        })
      );
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
