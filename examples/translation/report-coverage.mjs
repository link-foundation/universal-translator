import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createTranslator } from '../../src/index.js';
import {
  formatRecord,
  linkFields,
  namedLinks,
  parseLinks,
  reference,
  references,
} from '../../src/translation/links.js';

const snapshot = new URL(
  '../../docs/case-studies/issue-1/data/corpus-coverage.lino',
  import.meta.url
);
const coverage = linkFields(parseLinks(readFileSync(snapshot, 'utf8')));
const helloWorld = linkFields(coverage.get('hello-world-collection'));
const rosetta = linkFields(coverage.get('rosetta-code'));
const tiobe = linkFields(coverage.get('tiobe'));
const authored = namedLinks(rosetta.get('authored-tasks'), 'task').map(
  references
);
const ranks = namedLinks(tiobe.get('ranks'), 'rank').map(references);
const translator = createTranslator();
const profiles = translator.listLanguages();
const byId = new Map(profiles.map((profile) => [profile.id, profile]));
const byTask = new Set(
  profiles.flatMap(({ forms }) => forms.map(({ task }) => task))
);
assert.deepEqual(new Set(authored.map(([id]) => id)), byTask);
assert.equal(ranks.length, 50);

const counts = { 'three-tasks': 0, dialect: 0, missing: 0 };
for (const [index, entry] of ranks.entries()) {
  const [rank, language, id, status = id ? 'three-tasks' : 'missing'] = entry;
  assert.equal(Number(rank), index + 1);
  assert.ok(Object.hasOwn(counts, status));
  counts[status] += 1;
  if (id) {
    const tasks = new Set(byId.get(id).forms.map(({ task }) => task));
    assert.deepEqual(tasks, byTask);
  }
  if (status !== 'three-tasks') {
    console.log(
      formatRecord('ranked-language-gap', { rank, language, status })
    );
  }
}

const [inventoryPath, helloWorldPath, rustBinary] = process.argv.slice(2);
const taskCount = Number(reference(rosetta.get('task-count')));
const entryCount = Number(reference(rosetta.get('entry-count')));
if (inventoryPath) {
  const input = readFileSync(inventoryPath);
  assert.equal(
    createHash('sha256').update(input).digest('hex'),
    reference(rosetta.get('sha256'))
  );
  const [header, ...rows] = input.toString('utf8').trimEnd().split('\n');
  assert.equal(header, `${entryCount} Total`);
  assert.equal(rows.length, taskCount);
  const entries = new Map(
    rows.map((row) => {
      const [count, task] = row.split(' ');
      return [task, Number(count)];
    })
  );
  assert.equal(entries.size, taskCount);
  assert.equal(
    [...entries.values()].reduce((total, count) => total + count, 0),
    entryCount
  );
  for (const [, task, count] of authored) {
    assert.equal(entries.get(task), Number(count));
  }
}

const programs = reference(helloWorld.get('programs'));
const humanLanguages = reference(helloWorld.get('human-languages'));
const consolePrograms = namedLinks(
  helloWorld.get('verified-console-programs'),
  'program'
).map(references);
for (const [anchor, language, form] of consolePrograms) {
  assert.ok(
    byId
      .get(language)
      ?.forms.some(({ task, name }) => task === 'hello' && name === form),
    `Missing Hello World Collection form for ${anchor}`
  );
}
if (helloWorldPath) {
  const input = readFileSync(helloWorldPath);
  assert.equal(
    createHash('sha256').update(input).digest('hex'),
    reference(helloWorld.get('sha256'))
  );
  const page = input.toString('utf8');
  assert.equal(
    page.match(/<b>(\d+) Hello World programs<\/b>/u)?.[1],
    programs
  );
  assert.equal(
    page.match(/<b>(\d+) <a href="#Human">human<\/a> languages<\/b>/u)?.[1],
    humanLanguages
  );
  // The checksum pins the markup. The selected snippets contain only inline
  // links and the three entities used for source punctuation.
  const entities = { amp: '&', gt: '>', lt: '<' };
  for (const [anchor, language, form, message] of consolePrograms) {
    const section = page.split(`<a name="${anchor}"></a>`);
    assert.equal(section.length, 2, anchor);
    const block = section[1]
      .split('<a name="')[0]
      .match(/<pre>([\s\S]*?)<\/pre>/u);
    assert.ok(block, anchor);
    const source = block[1]
      .replace(/<\/?a(?:\s[^>]*)?>/gu, '')
      .replace(/&(amp|gt|lt);/gu, (_, name) => entities[name]);
    const document = translator.parse(source, language);
    assert.equal(translator.restore(document), source, anchor);
    assert.equal(document.interpretation?.form, form, anchor);
    assert.deepEqual(document.interpretation.effect, {
      task: 'hello',
      message,
    });
    if (rustBinary) {
      const rust = (args) =>
        execFileSync(rustBinary, args, { encoding: 'utf8', input: source });
      assert.equal(rust(['roundtrip', language]), source, anchor);
      const args = ['translate', language, 'meta', '--mode', 'same-effect'];
      const meta = translator.translate(source, language, 'meta', {
        mode: 'same-effect',
      });
      assert.equal(rust(args), meta, anchor);
    }
  }
}

console.log(formatRecord('tiobe-coverage', counts));
console.log(
  formatRecord('hello-world-collection', {
    programs,
    'human-languages': humanLanguages,
    'source-programs-checked': helloWorldPath ? consolePrograms.length : 0,
  })
);
console.log(
  formatRecord('rosetta-code-coverage', {
    tasks: taskCount,
    entries: entryCount,
    'authored-tasks': authored.length,
    'unimplemented-tasks': taskCount - authored.length,
  })
);
