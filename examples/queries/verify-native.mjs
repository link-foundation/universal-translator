#!/usr/bin/env node
// Bounded selection examples: compare SQLite, Python, Node and C# results,
// and observe eager/deferred results after changing a source row.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslator } from '../../js/src/index.js';
import negationPredicates from './negation.json' with { type: 'json' };

const translator = createTranslator();
const sql =
  'SELECT age + 1 FROM people AS person WHERE age >= 18 AND age < 65;';
const people = [{ age: 12 }, { age: 18 }, { age: 42 }, { age: 70 }];
const python = translator.translate(sql, 'sql', 'python');
const javascript = translator.translate(sql, 'sql', 'javascript');
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    ...options,
  }).trim();
const expected = [19, 43];
const negationPeople = [0, 1, 2, 17, 18, 19, 64, 65, 70].map((age) => ({
  age,
}));
const negationCases = negationPredicates.map((predicate) => {
  const sql = `SELECT age FROM people AS negationPerson WHERE ${predicate};`;
  return {
    sql,
    python: translator.translate(sql, 'sql', 'python'),
    javascript: translator.translate(sql, 'sql', 'javascript'),
  };
});
const negationResults = JSON.parse(
  run('python3', [
    '-c',
    'import json,sqlite3,sys\n' +
      'd=json.loads(sys.argv[1]); people=d["people"]\n' +
      'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer not null)")\n' +
      'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
      'print(json.dumps([[[r[0] for r in db.execute(c["sql"])],eval(c["python"])] for c in d["cases"]]))',
    JSON.stringify({ people: negationPeople, cases: negationCases }),
  ])
);
const negationJavascript = JSON.parse(
  run('node', [
    '-e',
    `const people=${JSON.stringify(negationPeople)}; console.log(JSON.stringify([${negationCases.map((c) => c.javascript.trim().replace(/;$/u, '')).join(',')}]));`,
  ])
);
for (const [index, [sqlite, python]] of negationResults.entries()) {
  assert.deepEqual(python, sqlite, negationPredicates[index]);
  assert.deepEqual(
    negationJavascript[index],
    sqlite,
    negationPredicates[index]
  );
}
const pythonResults = JSON.parse(
  run('python3', [
    '-c',
    'import json,sqlite3,sys\n' +
      'd=json.loads(sys.argv[1]); people=d["people"]\n' +
      'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer not null)")\n' +
      'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
      'print(json.dumps([[r[0] for r in db.execute(d["sql"])],eval(d["python"])]))',
    JSON.stringify({ sql, python, people }),
  ])
);
for (const result of pythonResults) {
  assert.deepEqual(result, expected);
}
assert.deepEqual(
  JSON.parse(
    run(process.execPath, [
      '-e',
      `const people=${JSON.stringify(people)}; console.log(JSON.stringify(${javascript.trim().replace(/;$/u, '')}));`,
    ])
  ),
  expected
);

const folder = mkdtempSync(join(tmpdir(), 'universal-query-'));
try {
  const sdk = Number(run('dotnet', ['--version']).split('.')[0]);
  const queryLine = (source, from) =>
    translator
      .translate(source, from, 'csharp')
      .split('\n')
      .find((line) => line.trimStart().startsWith('(from '))
      .trim()
      .replace(/;$/u, '');
  const eager = queryLine(sql, 'sql');
  const deferred = queryLine(
    '(person["age"] + 1 for person in people if person["age"] >= 18 and person["age"] < 65)',
    'python'
  );
  const functions = translator.translate(
    [
      'def integers():',
      '    return [p + 1 for p in [1, 2]]',
      'def deferred_integers():',
      '    return (p + 1 for p in [1, 2])',
      'def labels():',
      '    return ["ready" for p in [1, 2]]',
      'def nested():',
      '    return [[p + 1 for p in [1, 2]] for p in [1, 2]]',
    ].join('\n'),
    'python',
    'csharp'
  );
  const shadowed = translator
    .translate('p = 3.5\nvalues = [p + 1 for p in [1, 2]]', 'python', 'csharp')
    .split('static void Main() {')[1]
    .split('\n    }')[0];
  writeFileSync(
    join(folder, 'Query.csproj'),
    `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net${sdk}.0</TargetFramework><DebugType>None</DebugType><UseSharedCompilation>false</UseSharedCompilation></PropertyGroup></Project>`
  );
  writeFileSync(
    join(folder, 'Program.cs'),
    `using System;\nusing System.Collections.Generic;\n${functions.replace(
      'static void Main() {',
      `static void Main() {
    var people = new[] { ${people.map((p) => `new Dictionary<string,int> { ["age"] = ${p.age} }`).join(', ')} };
    var eager = ${eager};
    var deferred = ${deferred};
    Console.WriteLine(string.Join(",", eager));
    people[1]["age"] = 21;
    Console.WriteLine(string.Join(",", eager));
    Console.WriteLine(string.Join(",", deferred));
    ${shadowed}
    Console.WriteLine(string.Join(",", values));
    Console.WriteLine(string.Join(",", Integers()));
    Console.WriteLine(string.Join(",", DeferredIntegers()));
    Console.WriteLine(string.Join(",", Labels()));
    Console.WriteLine(string.Join(";", Nested().Select(row => string.Join(",", row))));
    people = new[] { ${negationPeople.map((p) => `new Dictionary<string,int> { ["age"] = ${p.age} }`).join(', ')} };
    ${negationCases.map((c) => `Console.WriteLine(string.Join(",", ${queryLine(c.sql, 'sql')}));`).join('\n    ')}
`
    )} `
  );
  const env = {
    ...process.env,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_NOLOGO: '1',
  };
  run('dotnet', ['build', '--disable-build-servers', '-m:1', '-v:q'], {
    cwd: folder,
    env,
  });
  const lines = run(
    'dotnet',
    [join(folder, 'bin', 'Debug', `net${sdk}.0`, 'Query.dll')],
    { env }
  ).split('\n');
  assert.deepEqual(
    lines.map((line) => line.trim()),
    [
      '19,43',
      '19,43',
      '22,43',
      '2,3',
      '2,3',
      '2,3',
      'ready,ready',
      '2,3;2,3',
      ...negationResults.map(([sqlite]) => sqlite.join(',')),
    ]
  );
  console.log('PASS SQLite, Python, Node and C# filtered projections: [19,43]');
  console.log(
    'PASS C# eager [19,43] versus deferred [22,43] after source mutation'
  );
  console.log(
    'PASS native C# query bindings, typed returns and nested/shadowed scopes'
  );
  console.log(
    `PASS ${negationCases.length} SQL negation/grouping predicates across SQLite, Python, Node and C#`
  );
} finally {
  rmSync(folder, { recursive: true, force: true });
}
