// Finite native precedence audit. Substitute the old reader or writer separately.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createTranslator } from '../js/src/index.js';
import { dialects } from '../js/src/formal/dialects/index.js';
import predicates from '../examples/queries/negation.json' with { type: 'json' };
import { nativeExpression } from '../examples/queries/native-expression.mjs';

const before = process.argv.includes('--before');
const beforeWriter = process.argv.includes('--before-writer');
function previousModule(path, commit = '175f50f') {
  const old = execFileSync('git', ['show', `${commit}:${path}`], {
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
if (before || beforeWriter) {
  dialects.sql = (
    await previousModule(
      'js/src/formal/dialects/sql.js',
      before ? '175f50f' : 'c739a05'
    )
  ).sql;
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
    javascriptParts: nativeExpression(
      translator.translate(sql, 'sql', 'javascript')
    ),
    pythonParts: nativeExpression(translator.translate(sql, 'sql', 'python')),
  };
});
const people = [0, 1, 2, 17, 18, 19, 64, 65, 70].map((age) => ({ age }));
const results = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      'import json,sqlite3,sys\n' +
        'd=json.load(sys.stdin); people=d["people"]\n' +
        'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer not null)")\n' +
        'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
        'results=[]\n' +
        'for c in d["cases"]:\n' +
        ' c["expected"]=[r[0] for r in db.execute(c["sql"])]\n' +
        ' try:\n' +
        '  exec(c["pythonParts"]["prefix"]); c["pythonResult"]=eval(c["pythonParts"]["expression"])\n' +
        ' except Exception as error: c["pythonError"]=str(error)\n' +
        ' results.append(c)\n' +
        'print(json.dumps(results))',
    ],
    {
      encoding: 'utf8',
      input: JSON.stringify({ people, cases }),
      maxBuffer: 2 * 1024 * 1024,
    }
  )
);
for (const result of results) {
  const { prefix, expression } = result.javascriptParts;
  result.javascriptResult = JSON.parse(
    execFileSync(
      'node',
      [
        '-e',
        `${prefix}\nconst people=${JSON.stringify(people)}; console.log(JSON.stringify(${expression}));`,
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 }
    )
  );
  result.python = result.pythonParts.expression;
  result.javascript = result.javascriptParts.expression;
  delete result.pythonParts;
  delete result.javascriptParts;
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
      reader: before ? '175f50f' : beforeWriter ? 'c739a05' : 'current',
      writer: beforeWriter ? '175f50f' : 'current',
      results,
      failures,
    },
    null,
    2
  )
);
process.exitCode = Number(failures > 0);
