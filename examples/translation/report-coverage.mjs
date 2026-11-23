import assert from 'node:assert/strict';
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
const profiles = createTranslator().listLanguages();
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

const [inventoryPath, helloWorldPath] = process.argv.slice(2);
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
}

console.log(formatRecord('tiobe-coverage', counts));
console.log(
  formatRecord('hello-world-collection', {
    programs,
    'human-languages': humanLanguages,
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
