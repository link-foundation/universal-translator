// Finite native SQL NULL audit; --before substitutes the prior SQL reader.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createTranslator } from '../js/src/index.js';
import { dialects } from '../js/src/formal/dialects/index.js';
import { nativeExpression } from '../examples/queries/native-expression.mjs';
import fixtures from '../examples/queries/nullable.json' with { type: 'json' };

const before = process.argv.includes('--before');
if (before) {
  const source = execFileSync(
    'git',
    ['show', 'c739a05:js/src/formal/dialects/sql.js'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 }
  ).replace(
    /from '([.][^']+)'/g,
    (_, relative) =>
      `from ${JSON.stringify(new URL(relative, new URL('../js/src/formal/dialects/sql.js', import.meta.url)).href)}`
  );
  dialects.sql = (
    await import(
      `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    )
  ).sql;
}
const translator = createTranslator();
const people = [null, -7, -1, 0, 1, 2, 17, 18, 19].map((age) => ({ age }));
const cases = fixtures.map(({ projection, condition }) => {
  const sql = `SELECT ${projection} FROM people AS p${condition ? ` WHERE ${condition}` : ''};`;
  try {
    return {
      sql,
      python: nativeExpression(translator.translate(sql, 'sql', 'python')),
      javascript: nativeExpression(
        translator.translate(sql, 'sql', 'javascript')
      ),
      restoredSql: translator.translate(
        translator.translate(sql, 'sql', 'javascript'),
        'javascript',
        'sql'
      ),
    };
  } catch (error) {
    return { sql, translationError: error.message };
  }
});
const results = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      'import json,sqlite3,sys\n' +
        'd=json.load(sys.stdin); people=d["people"]\n' +
        'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer)")\n' +
        'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
        'for c in d["cases"]:\n' +
        ' c["expected"]=[r[0] for r in db.execute(c["sql"])]\n' +
        ' if "restoredSql" in c: c["restoredResult"]=[r[0] for r in db.execute(c["restoredSql"])]\n' +
        ' if "python" in c:\n' +
        '  try:\n   exec(c["python"]["prefix"]); c["pythonResult"]=eval(c["python"]["expression"])\n' +
        '  except Exception as error: c["pythonError"]=str(error)\n' +
        'print(json.dumps(d["cases"]))',
    ],
    {
      encoding: 'utf8',
      input: JSON.stringify({ people, cases }),
      maxBuffer: 4 * 1024 * 1024,
    }
  )
);
for (const c of results) {
  if (c.javascript) {
    try {
      c.javascriptResult = JSON.parse(
        execFileSync(
          'node',
          [
            '-e',
            `${c.javascript.prefix}\nconst people=${JSON.stringify(people)}; console.log(JSON.stringify(${c.javascript.expression}));`,
          ],
          {
            encoding: 'utf8',
            maxBuffer: 64 * 1024,
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        )
      );
    } catch (error) {
      c.javascriptError = error.stderr?.toString() ?? error.message;
    }
  }
  try {
    assert.deepEqual(c.pythonResult, c.expected);
    assert.deepEqual(c.javascriptResult, c.expected);
    assert.deepEqual(c.restoredResult, c.expected);
    c.passed = true;
  } catch {
    c.passed = false;
  }
  // One canonical helper is already versioned; retain emitted expressions here.
  if (c.python) {
    c.python = c.python.expression;
  }
  if (c.javascript) {
    c.javascript = c.javascript.expression;
  }
}
const failures = results.filter((c) => !c.passed).length;
console.log(
  JSON.stringify(
    { reader: before ? 'c739a05' : 'current', people, results, failures },
    null,
    2
  )
);
process.exitCode = Number(failures > 0);
