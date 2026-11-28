#!/usr/bin/env node
// Bounded selection examples: compare SQLite, Python, Node and C# results,
// and observe eager/deferred results after changing a source row.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslator } from '../../js/src/index.js';
import {
  nativeExpression,
  nativeJavaScriptBatch,
} from './native-expression.mjs';
import nullableCases from './nullable.json' with { type: 'json' };
import negationPredicates from './negation.json' with { type: 'json' };
import projectedRows from './projected-rows.json' with { type: 'json' };

const [rustTranslator] = process.argv.slice(2);
const translator = rustTranslator
  ? {
      translate(source, from, to) {
        return execFileSync(
          rustTranslator,
          ['translate', from, to, '-', '--all-or-nothing'],
          { encoding: 'utf8', input: source, maxBuffer: 1024 * 1024 }
        );
      },
    }
  : createTranslator();
const sql =
  'SELECT age + 1 FROM people AS person WHERE age >= 18 AND age < 65;';
const people = [{ age: 12 }, { age: 18 }, { age: 42 }, { age: 70 }];
const python = nativeExpression(translator.translate(sql, 'sql', 'python'));
const javascript = nativeExpression(
  translator.translate(sql, 'sql', 'javascript')
);
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    ...options,
  }).trim();
const expected = [19, 43];

const projectedPython = nativeExpression(
  translator.translate(projectedRows.source, 'sql', 'python')
);
const projectedJavascript = nativeExpression(
  translator.translate(projectedRows.source, 'sql', 'javascript')
);
const projectedSql = translator.translate(projectedRows.source, 'sql', 'sql');
const projectedResults = JSON.parse(
  run(
    'python3',
    [
      '-c',
      [
        'import json, sqlite3, sys',
        'data = json.load(sys.stdin)',
        'people = data["people"]',
        'database = sqlite3.connect(":memory:")',
        'database.executescript(data["schema"])',
        'exec(data["python"]["prefix"])',
        'print(json.dumps([database.execute(data[query]).fetchall() for query in ("source", "sql")] + [eval(data["python"]["expression"])]))',
      ].join('\n'),
    ],
    {
      input: JSON.stringify({
        ...projectedRows,
        sql: projectedSql,
        python: projectedPython,
      }),
    }
  )
);
for (const rows of projectedResults) {
  assert.deepEqual(rows, projectedRows.rows);
}
assert.deepEqual(
  JSON.parse(
    run('node', [
      '-e',
      `${projectedJavascript.prefix}\nconst people=${JSON.stringify(projectedRows.people)}; console.log(JSON.stringify(${projectedJavascript.expression}));`,
    ])
  ),
  projectedRows.rows
);

const negationPeople = [0, 1, 2, 17, 18, 19, 64, 65, 70].map((age) => ({
  age,
}));
const negationCases = negationPredicates.map((predicate) => {
  const sql = `SELECT age FROM people AS negationPerson WHERE ${predicate};`;
  return {
    sql,
    python: nativeExpression(translator.translate(sql, 'sql', 'python')),
    javascript: nativeExpression(
      translator.translate(sql, 'sql', 'javascript')
    ),
  };
});
const negationResults = JSON.parse(
  run(
    'python3',
    [
      '-c',
      'import json,sqlite3,sys\n' +
        'd=json.load(sys.stdin); people=d["people"]\n' +
        'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer not null)")\n' +
        'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
        'results=[]\nfor c in d["cases"]:\n exec(c["python"]["prefix"]); results.append([[r[0] for r in db.execute(c["sql"])],eval(c["python"]["expression"])])\nprint(json.dumps(results))',
    ],
    { input: JSON.stringify({ people: negationPeople, cases: negationCases }) }
  )
);
const negationJavascript = JSON.parse(
  run('node', [
    '-e',
    `${[...new Set(negationCases.map((c) => c.javascript.prefix))].join('\n')}\nconst people=${JSON.stringify(negationPeople)}; console.log(JSON.stringify([${negationCases.map((c) => c.javascript.expression).join(',')}]));`,
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
  run(
    'python3',
    [
      '-c',
      'import json,sqlite3,sys\n' +
        'd=json.load(sys.stdin); people=d["people"]\n' +
        'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer not null)")\n' +
        'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
        'exec(d["python"]["prefix"]); print(json.dumps([[r[0] for r in db.execute(d["sql"])],eval(d["python"]["expression"])]))',
    ],
    { input: JSON.stringify({ sql, python, people }) }
  )
);
for (const result of pythonResults) {
  assert.deepEqual(result, expected);
}
assert.deepEqual(
  JSON.parse(
    run('node', [
      '-e',
      `${javascript.prefix}\nconst people=${JSON.stringify(people)}; console.log(JSON.stringify(${javascript.expression}));`,
    ])
  ),
  expected
);

const nullablepeople = [null, -7, -1, 0, 1, 2, 17, 18, 19].map((age) => ({
  age,
}));
const nullable = nullableCases.map(({ projection, condition }) => {
  const sql = `SELECT ${projection} FROM nullablepeople AS nullablePerson${condition ? ` WHERE ${condition}` : ''};`;
  return {
    sql,
    python: nativeExpression(translator.translate(sql, 'sql', 'python')),
    javascript: nativeExpression(
      translator.translate(sql, 'sql', 'javascript')
    ),
  };
});
const nullableResults = JSON.parse(
  run(
    'python3',
    [
      '-c',
      'import json,sqlite3,sys\n' +
        'd=json.load(sys.stdin); nullablepeople=d["people"]\n' +
        'db=sqlite3.connect(":memory:"); db.execute("create table nullablepeople(age integer)")\n' +
        'db.executemany("insert into nullablepeople values(?)",[(p["age"],) for p in nullablepeople])\n' +
        'results=[]\nfor c in d["cases"]:\n exec(c["python"]["prefix"]); results.append([[r[0] for r in db.execute(c["sql"])],eval(c["python"]["expression"])])\nprint(json.dumps(results))',
    ],
    { input: JSON.stringify({ people: nullablepeople, cases: nullable }) }
  )
);
const nullableJavascript = JSON.parse(
  run('node', [
    '-e',
    `const nullablepeople = ${JSON.stringify(nullablepeople)};\n${nativeJavaScriptBatch(nullable.map((c) => c.javascript))}`,
  ])
);
for (const [index, [sqlite, python]] of nullableResults.entries()) {
  assert.deepEqual(python, sqlite, nullable[index].sql);
  assert.deepEqual(nullableJavascript[index], sqlite, nullable[index].sql);
}

const membershipFunctions = {
  sample: 1,
  one: 1,
  two: 2,
  tail: 3,
  missing: null,
};
const membership = [
  ['sample() IN (one(), two(), tail())', [1], ['sample', 'one']],
  ['sample() IN (missing(), one(), tail())', [1], ['sample', 'missing', 'one']],
  [
    'sample() IN (two(), missing(), tail())',
    [null],
    ['sample', 'two', 'missing', 'tail'],
  ],
  ['sample() NOT IN (two(), tail())', [1], ['sample', 'two', 'tail']],
  [
    'missing() IN (one(), two(), tail())',
    [null],
    ['missing', 'one', 'two', 'tail'],
  ],
  ['sample() IN ()', [0], []],
  ['sample() NOT IN ()', [1], []],
  ['sample() IN (2, 1, tail())', [1], ['sample']],
].map(([predicate, rows, calls]) => {
  const sql = `SELECT ${predicate} FROM people;`;
  return {
    sql,
    expected: [rows, calls],
    python: nativeExpression(translator.translate(sql, 'sql', 'python')),
    javascript: nativeExpression(
      translator.translate(sql, 'sql', 'javascript')
    ),
  };
});
const membershipResults = JSON.parse(
  run(
    'python3',
    [
      '-c',
      [
        'import json, sqlite3, sys',
        'data = json.load(sys.stdin)',
        'db = sqlite3.connect(":memory:")',
        'db.execute("CREATE TABLE people(id)")',
        'db.execute("INSERT INTO people VALUES (0)")',
        'people, calls, results = [0], [], []',
        'for name, value in data["functions"].items():',
        '    function = lambda n=name, v=value: calls.append(n) or v',
        '    globals()[name] = function',
        '    db.create_function(name, 0, function)',
        'for case in data["cases"]:',
        '    sqlite = [[row[0] for row in db.execute(case["sql"])], calls.copy()]',
        '    calls.clear()',
        '    exec(case["python"]["prefix"])',
        '    python = [eval(case["python"]["expression"]), calls.copy()]',
        '    calls.clear()',
        '    results.append([sqlite, python])',
        'print(json.dumps(results))',
      ].join('\n'),
    ],
    {
      input: JSON.stringify({
        functions: membershipFunctions,
        cases: membership,
      }),
    }
  )
);
const membershipJavascript = JSON.parse(
  run('node', [
    '-e',
    [
      'const people = [0], calls = [];',
      ...Object.entries(membershipFunctions).map(
        ([name, value]) =>
          `function ${name}() { calls.push("${name}"); return ${JSON.stringify(value)}; }`
      ),
      nativeJavaScriptBatch(
        membership.map(({ javascript: { prefix, expression } }) => ({
          prefix,
          expression: `[${expression}, calls.splice(0)]`,
        }))
      ),
    ].join('\n'),
  ])
);
for (const [index, [sqlite, python]] of membershipResults.entries()) {
  const { sql, expected } = membership[index];
  assert.deepEqual(sqlite, expected, sql);
  assert.deepEqual(python, sqlite, sql);
  assert.deepEqual(membershipJavascript[index], sqlite, sql);
}

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
  const runtime = translator
    .translate('SELECT 0 IN () FROM people;', 'sql', 'csharp')
    .split('class Program')[0]
    .split('\n')
    .filter((line) => !line.startsWith('using '))
    .join('\n');
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
  const projectedLine = queryLine(
    projectedRows.source.replace('FROM people', 'FROM projectionpeople'),
    'sql'
  );
  const projectedPeople = projectedRows.people
    .map(
      ({ name, age, grade }) =>
        `new Dictionary<string,object> { ["name"] = ${JSON.stringify(name)}, ["age"] = ${age}, ["grade"] = ${grade} }`
    )
    .join(', ');
  const recordMembership = membership.map(
    (test) =>
      `Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new object[] { ${queryLine(test.sql.replace('FROM people', 'FROM effectpeople'), 'sql')}, calls.ToArray() })); calls.Clear();`
  );
  writeFileSync(
    join(folder, 'Query.csproj'),
    `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net${sdk}.0</TargetFramework><DebugType>None</DebugType><UseSharedCompilation>false</UseSharedCompilation></PropertyGroup></Project>`
  );
  writeFileSync(
    join(folder, 'Program.cs'),
    `using System;\nusing System.Collections.Generic;\n${functions
      .replace('class Program', `${runtime}\nclass Program`)
      .replace(
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
    var nullablepeople = new[] { ${nullablepeople.map((p) => `new Dictionary<string,object> { ["age"] = ${p.age === null ? 'null' : p.age} }`).join(', ')} };
    ${nullable.map((c) => `Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(${queryLine(c.sql, 'sql')}));`).join('\n    ')}
    var projectionpeople = new[] { ${projectedPeople} };
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(${projectedLine}));
    var effectpeople = new int[] { 0 };
    var calls = new List<string>();
    ${Object.entries(membershipFunctions)
      .map(
        ([name, value]) =>
          `object ${name}() { calls.Add("${name}"); return ${JSON.stringify(value)}; }`
      )
      .join('\n    ')}
    ${recordMembership.join('\n    ')}
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
    lines.slice(0, 8 + negationCases.length).map((line) => line.trim()),
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
  const nullableStart = 8 + negationCases.length;
  const projectionIndex = nullableStart + nullable.length;
  assert.deepEqual(
    lines.slice(nullableStart, projectionIndex).map((line) => JSON.parse(line)),
    nullableResults.map(([sqlite]) => sqlite)
  );
  assert.deepEqual(JSON.parse(lines[projectionIndex]), projectedRows.rows);
  assert.deepEqual(
    lines.slice(projectionIndex + 1).map((line) => JSON.parse(line)),
    membership.map(({ expected }) => expected)
  );
  console.log(
    'PASS mixed SQL projection fields across SQLite, Python, Node and C#'
  );
  console.log(
    `PASS ${nullable.length} nullable SQL value/WHERE cases across SQLite, Python, Node and C#`
  );
  console.log(
    `PASS ${membership.length} SQL IN operand call traces across SQLite, Python, Node and C#`
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
