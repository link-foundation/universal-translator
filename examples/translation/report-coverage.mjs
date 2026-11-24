import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { createTranslator } from '../../js/src/index.js';
import {
  formatRecord,
  linkFields,
  namedLinks,
  reference,
  references,
} from '../../js/src/translation/links.js';
import { localizedGreetings } from './fixtures.mjs';
import {
  readCorpusCoverage,
  rosettaPrograms,
  rosettaTasks,
  verifyProgram,
} from './corpus-fixtures.mjs';

const coverage = readCorpusCoverage();
const helloWorld = linkFields(coverage.get('hello-world-collection'));
const rosetta = linkFields(coverage.get('rosetta-code'));
const tiobe = linkFields(coverage.get('tiobe'));
const authored = rosettaTasks(rosetta);
const partiallySupported = rosettaTasks(rosetta, 'partial-tasks');
const implemented = [...authored, ...partiallySupported];
const ranks = namedLinks(tiobe.get('ranks'), 'rank').map(references);
const translator = createTranslator();
const profiles = translator.listLanguages();
const byId = new Map(profiles.map((profile) => [profile.id, profile]));
const byTask = new Set(
  profiles.flatMap(({ forms }) => forms.map(({ task }) => task))
);
const authoredIds = new Set(authored.map(({ effect }) => effect));
const implementedIds = new Set(implemented.map(({ effect }) => effect));
const variants = namedLinks(rosetta.get('effect-variants'), 'variant').map(
  references
);
for (const [id, task] of variants) {
  assert.ok(byTask.has(id) && implementedIds.has(task));
}
assert.deepEqual(
  new Set([...implementedIds, ...variants.map(([id]) => id)]),
  byTask
);
assert.equal(ranks.length, 50);

const counts = { 'three-tasks': 0, dialect: 0, missing: 0 };
for (const [index, entry] of ranks.entries()) {
  const [rank, language, id, status = id ? 'three-tasks' : 'missing'] = entry;
  assert.equal(Number(rank), index + 1);
  assert.ok(Object.hasOwn(counts, status));
  counts[status] += 1;
  if (id) {
    const tasks = new Set(byId.get(id).forms.map(({ task }) => task));
    assert.ok(
      [...authoredIds].every((task) => tasks.has(task)),
      language
    );
  }
  if (status !== 'three-tasks') {
    console.log(
      formatRecord('ranked-language-gap', { rank, language, status })
    );
  }
}

const [inventoryPath, helloWorldPath, rustBinary, treeDirectory] =
  process.argv.slice(2);

const taskCount = Number(reference(rosetta.get('task-count')));
const inventoryTaskCount = Number(
  reference(rosetta.get('inventory-task-count'))
);
const inventoryLanguageCount = Number(
  reference(rosetta.get('inventory-language-count'))
);
let inventoryTasks;
let checkedRosetta = 0;
if (inventoryPath) {
  const input = readFileSync(inventoryPath);
  assert.equal(
    createHash('sha256').update(input).digest('hex'),
    reference(rosetta.get('sha256'))
  );
  const [header, ...rows] = input.toString('utf8').trimEnd().split('\n');
  assert.equal(header, `${inventoryLanguageCount} Total`);
  assert.equal(rows.length, inventoryTaskCount);
  inventoryTasks = new Map(
    rows.map((row) => {
      const [count, task] = row.split(' ');
      return [task, Number(count)];
    })
  );
  assert.equal(inventoryTasks.size, inventoryTaskCount);
  assert.equal(
    [...inventoryTasks.values()].reduce((total, count) => total + count, 0),
    inventoryLanguageCount
  );
  for (const { name, inventory } of implemented) {
    assert.equal(inventoryTasks.get(name), Number(inventory));
  }
}

if (treeDirectory) {
  // GitHub's Git Trees API exposes tree entries as JSON. Check the selected
  // revision and the response's truncation flag before using its counts.
  const entriesFrom = (name, sha) => {
    const input = readFileSync(join(treeDirectory, `${name}.json`), 'utf8');
    const { truncated, sha: actual, tree } = JSON.parse(input);
    assert.equal(actual, sha, name);
    assert.equal(truncated, false, name);
    return tree;
  };
  const taskEntries = entriesFrom('tasks', reference(rosetta.get('task-tree')));
  const tasks = new Map(
    taskEntries
      .filter(({ type }) => type === 'tree')
      .map(({ path, sha }) => [path, sha])
  );
  assert.equal(tasks.size, taskCount);
  for (const name of inventoryTasks.keys()) {
    assert.ok(tasks.has(name), `Missing task ${name} from source tree`);
  }
  const inventoryOmissions = [...tasks.keys()].filter(
    (name) => !inventoryTasks.has(name)
  );
  console.log(
    formatRecord('rosetta-tree-only-tasks', {
      tasks: inventoryOmissions.join(', '),
    })
  );
  for (const task of implemented) {
    const { name, tree, languages: languageCount, samples: sampleCount } = task;
    assert.equal(tasks.get(name), tree, name);
    const entries = entriesFrom(name, tree);
    const languages = entries.filter(
      ({ type, path }) => type === 'tree' && !path.includes('/')
    );
    const samples = entries.filter(
      ({ type, path }) => type === 'blob' && /^[^/]+\/(?!00-)[^/]+$/.test(path)
    );
    assert.equal(languages.length, Number(languageCount), name);
    assert.equal(samples.length, Number(sampleCount), name);
    console.log(
      formatRecord('rosetta-task-source-count', {
        task: name,
        languages: languageCount,
        samples: sampleCount,
      })
    );
    if (rosetta.has(`${task.id}-source-files`)) {
      const hashes = new Map(samples.map(({ path, sha }) => [path, sha]));
      const root = new URL('.', reference(rosetta.get('inventory')));
      for (const program of rosettaPrograms(rosetta, task)) {
        const { path } = program;
        assert.ok(hashes.has(path), path);
        const relative = path.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(new URL(`Task/${name}/${relative}`, root));
        assert.ok(response.ok, path);
        const bytes = Buffer.from(await response.arrayBuffer());
        const hash = createHash('sha1')
          .update(`blob ${bytes.length}\0`)
          .update(bytes)
          .digest('hex');
        assert.equal(hash, hashes.get(path), path);
        const source = bytes.toString('utf8');
        assert.deepEqual(Buffer.from(source), bytes, path);
        await verifyProgram(translator, source, program, rustBinary);
        checkedRosetta += 1;
      }
    }
  }
}

const programs = reference(helloWorld.get('programs'));
const humanLanguages = reference(helloWorld.get('human-languages'));
let greetingsChecked = 0;
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
    await verifyProgram(
      translator,
      source,
      {
        language,
        form,
        effect: { task: 'hello', message },
        path: anchor,
      },
      rustBinary
    );
  }
  const table = page.split('<a name="Human"></a>')[1].split('</table><p>')[0];
  const named = {
    aacute: 'á',
    acirc: 'â',
    agrave: 'à',
    aring: 'å',
    auml: 'ä',
    ecirc: 'ê',
    egrave: 'è',
    euml: 'ë',
    iexcl: '¡',
    igrave: 'ì',
    oacute: 'ó',
    ograve: 'ò',
    uuml: 'ü',
  };
  const greetings = [
    ...table.matchAll(/<tr><td>.*?<\/td>\s*<td>(.*?)<\/td>/gu),
  ].map(([, greeting]) =>
    greeting.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (_, entity) => {
      if (entity.startsWith('#')) {
        const code = entity.slice(1).replace(/^x/iu, '0x');
        return String.fromCodePoint(Number(code));
      }
      assert.ok(Object.hasOwn(named, entity), entity);
      return named[entity];
    })
  );
  assert.equal(greetings.length, Number(humanLanguages));
  assert.deepEqual(
    greetings,
    localizedGreetings().map(({ message }) => message)
  );
  greetingsChecked = greetings.length;
}

console.log(formatRecord('tiobe-coverage', counts));
console.log(
  formatRecord('hello-world-collection', {
    programs,
    'human-languages': humanLanguages,
    'source-programs-checked': helloWorldPath ? consolePrograms.length : 0,
    'localized-greetings-checked': greetingsChecked,
  })
);
console.log(
  formatRecord('rosetta-code-coverage', {
    'source-tasks': taskCount,
    'inventory-tasks': inventoryTaskCount,
    'inventory-language-count': inventoryLanguageCount,
    'authored-tasks': authored.length,
    'partially-supported-tasks': partiallySupported.length,
    'unimplemented-tasks': taskCount - implemented.length,
    'source-programs-checked': checkedRosetta,
  })
);
