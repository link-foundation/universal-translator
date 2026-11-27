// Finite native precedence audit. Substitute the old reader or writer separately.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createTranslator } from '../js/src/index.js';
import { dialects } from '../js/src/formal/dialects/index.js';
import predicates from '../examples/queries/negation.json' with { type: 'json' };

const before = process.argv.includes('--before');
const beforeWriter = process.argv.includes('--before-writer');
function previousModule(path) {
  const old = execFileSync('git', ['show', `175f50f:${path}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024,
  }).replace(
    /from '([.][^']+)'/g,
    (_, relative) =>
      `from ${JSON.stringify(new URL(relative, new URL(`../${path}`, import.meta.url)).href)}`
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(old).toString('base64')}`
  );
}
if (before) {
  dialects.sql = (await previousModule('js/src/formal/dialects/sql.js')).sql;
}
const translator = createTranslator(
  beforeWriter
    ? { emit: (await previousModule('js/src/formal/emitter.js')).emitProgram }
    : {}
);
const cases = predicates.map((predicate) => {
  const sql = `SELECT age FROM people AS p WHERE ${predicate};`;
  return {
    sql,
    python: translator.translate(sql, 'sql', 'python'),
    javascript: translator.translate(sql, 'sql', 'javascript'),
  };
});
const people = [0, 1, 2, 17, 18, 19, 64, 65, 70].map((age) => ({ age }));
const results = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      'import json,sqlite3,sys\n' +
        'd=json.loads(sys.argv[1]); people=d["people"]\n' +
        'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer not null)")\n' +
        'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
        'results=[]\n' +
        'for c in d["cases"]:\n' +
        ' c["expected"]=[r[0] for r in db.execute(c["sql"])]\n' +
        ' try: c["pythonResult"]=eval(c["python"])\n' +
        ' except Exception as error: c["pythonError"]=str(error)\n' +
        ' results.append(c)\n' +
        'print(json.dumps(results))',
      JSON.stringify({ people, cases }),
    ],
    { encoding: 'utf8', maxBuffer: 128 * 1024 }
  )
);
for (const result of results) {
  result.javascriptResult = JSON.parse(
    execFileSync(
      'node',
      [
        '-e',
        `const people=${JSON.stringify(people)}; console.log(JSON.stringify(${result.javascript.trim().replace(/;$/u, '')}));`,
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 }
    )
  );
  try {
    assert.deepEqual(result.pythonResult, result.expected);
    assert.deepEqual(result.javascriptResult, result.expected);
    result.passed = true;
  } catch {
    result.passed = false;
  }
}
const failures = results.filter((result) => !result.passed).length;
console.log(
  JSON.stringify(
    {
      reader: before ? '175f50f' : 'current',
      writer: beforeWriter ? '175f50f' : 'current',
      results,
      failures,
    },
    null,
    2
  )
);
process.exitCode = Number(failures > 0);
