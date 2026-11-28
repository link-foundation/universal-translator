import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  createTranslator,
  checkText,
  naturalLanguageIds,
} from '../src/index.js';
import { sameMeaning, rewrite } from '../src/meta/tree.js';
import { emitProgram } from '../src/formal/emitter.js';
import { objpakRuntime } from '../src/formal/objpak-runtime.js';
import { parseProgram } from '../src/formal/parser.js';
import { languageSyntax } from '../src/formal/languages.js';
import {
  nativeExpression,
  nativeJavaScriptBatch,
} from '../../examples/queries/native-expression.mjs';
import cases from '../../examples/queries/nullable.json' with { type: 'json' };
import betweenMethods from '../../data/runtime/sql-between.json' with { type: 'json' };
import inMethods from '../../data/runtime/sql-in.json' with { type: 'json' };

const translator = createTranslator();
const selection = ({ projection, condition }) =>
  `SELECT ${projection} FROM people AS p${condition ? ` WHERE ${condition}` : ''};`;
const native = (command, source, input) =>
  JSON.parse(
    execFileSync(command, ['-c', source], {
      encoding: 'utf8',
      input,
      maxBuffer: 1024 * 1024,
    })
  );

describe('nullable SQL values', () => {
  it('round trips every nullable operator through four host grammars and SQL', () => {
    for (const test of cases) {
      const source = selection(test);
      const meta = translator.toMeta(source, 'sql');
      for (const language of [
        'sql',
        'python',
        'javascript',
        'typescript',
        'csharp',
      ]) {
        const written = translator.fromMeta(meta, language);
        assert.ok(
          sameMeaning(meta, translator.toMeta(written, language)),
          `${source}: ${language}: ${written}`
        );
      }
    }
  });

  it('keeps nullable operations distinct from ordinary host operations', () => {
    const q = translator.toMeta(
      'SELECT NULL + age FROM people WHERE NOT age = 18;',
      'sql'
    ).main.statements[0].expression;
    assert.equal(q.projection.kind, 'SqlBinary');
    assert.equal(q.projection.left.kind, 'Null');
    assert.equal(q.condition.kind, 'SqlTruth');
    assert.equal(q.condition.operand.kind, 'SqlUnary');
    const ordinary = translator.toMeta(
      '[p + 1 for p in people if p > 0]',
      'python'
    ).main.statements[0].expression;
    assert.equal(ordinary.projection.kind, 'Binary');
    assert.equal(ordinary.condition.kind, 'Binary');
  });

  it('agrees with SQLite on nullable arithmetic, comparisons and every three-valued truth pair', () => {
    const people = [null, -7, -1, 0, 1, 2, 17, 18, 19].map((age) => ({ age }));
    const programs = cases.map((test) => {
      const sql = selection(test);
      return {
        sql,
        python: nativeExpression(translator.translate(sql, 'sql', 'python')),
        javascript: nativeExpression(
          translator.translate(sql, 'sql', 'javascript')
        ),
      };
    });
    const results = native(
      'python3',
      'import json,sqlite3,sys\n' +
        'd=json.load(sys.stdin); people=d["people"]\n' +
        'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer)")\n' +
        'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
        'results=[]\nfor c in d["programs"]:\n exec(c["python"]["prefix"]); results.append([[r[0] for r in db.execute(c["sql"])],eval(c["python"]["expression"])])\nprint(json.dumps(results))',
      JSON.stringify({ people, programs })
    );
    const javascript = JSON.parse(
      execFileSync(
        'node',
        [
          '-e',
          `const people = ${JSON.stringify(people)};\n${nativeJavaScriptBatch(programs.map((p) => p.javascript))}`,
        ],
        { encoding: 'utf8', maxBuffer: 1024 * 1024 }
      )
    );
    results.forEach(([sqlite, python], i) => {
      assert.deepEqual(python, sqlite, programs[i].sql);
      assert.deepEqual(javascript[i], sqlite, programs[i].sql);
    });
  });

  it('matches the SQLite call sequence for a scalar BETWEEN', () => {
    const sql = 'SELECT sample() BETWEEN lower() AND upper() FROM people;';
    const sqlite = native(
      'python3',
      [
        'import json, sqlite3, sys',
        'db = sqlite3.connect(":memory:")',
        'db.execute("CREATE TABLE people(id)")',
        'db.execute("INSERT INTO people VALUES (0)")',
        'calls = []',
        'for name, value in [("sample", 1), ("lower", 0), ("upper", 2)]:',
        '    db.create_function(name, 0, lambda n=name, v=value: calls.append(n) or v)',
        'print(json.dumps([[row[0] for row in db.execute(sys.stdin.read())], calls]))',
      ].join('\n'),
      sql
    );
    const { prefix, expression } = nativeExpression(
      translator.translate(sql, 'sql', 'javascript')
    );
    const javascript = JSON.parse(
      execFileSync(
        'node',
        [
          '-e',
          `${prefix}
          const people = [0], calls = [];
          function sample() { calls.push('sample'); return 1; }
          function lower() { calls.push('lower'); return 0; }
          function upper() { calls.push('upper'); return 2; }
          console.log(JSON.stringify([${expression}, calls]));`,
        ],
        { encoding: 'utf8', maxBuffer: 4096 }
      )
    );
    assert.deepEqual(sqlite, [[1], ['sample', 'lower', 'upper']]);
    assert.deepEqual(javascript, sqlite);
  });

  it('uses each natural grammar vocabulary for NULL and SQL truth operations', () => {
    const source =
      'SELECT NULL + age FROM people WHERE NOT (age IS NULL) OR age IS NOT FALSE;';
    const meta = translator.toMeta(source, 'sql');
    for (const language of naturalLanguageIds()) {
      const written = translator.fromMeta(meta, language);
      for (const sql of [
        'SELECT NULL + 1 FROM people;',
        'SELECT NOT NULL FROM people;',
        'SELECT 1 FROM people WHERE NULL;',
        'SELECT 1 IS NOT FALSE FROM people;',
        'SELECT 1 BETWEEN 0 AND 2 FROM people;',
      ]) {
        const simple = translator.translate(sql, 'sql', language);
        assert.deepEqual(
          checkText(simple, language),
          [],
          `${language}: ${simple}`
        );
      }
      assert.ok(
        sameMeaning(meta, translator.toMeta(written, language)),
        `${language}: ${written}`
      );
    }
  });

  it('retains a range predicate through every natural grammar', () => {
    const meta = translator.toMeta(
      'SELECT age FROM people WHERE age BETWEEN NULL AND 2;',
      'sql'
    );
    for (const language of naturalLanguageIds()) {
      const written = translator.fromMeta(meta, language);
      assert.ok(
        sameMeaning(meta, translator.toMeta(written, language)),
        language
      );
    }
  });
});

describe('SQL value helper versions', () => {
  it('reads older value helpers and only trusts ranges from the extended helper', () => {
    for (const language of ['python', 'javascript', 'typescript', 'csharp']) {
      const meta = translator.toMeta('SELECT NULL FROM people;', 'sql');
      const written = translator.fromMeta(meta, language);
      const method = betweenMethods[language].replaceAll('$SQL$', 'UtSqlValue');
      assert.ok(written.includes(method), language);
      const legacy = written.replace(method, '');
      assert.ok(
        sameMeaning(meta, translator.toMeta(legacy, language)),
        language
      );
      assert.throws(
        () =>
          translator.toMeta(
            legacy.replace(
              'UtSqlValue.nullValue()',
              'UtSqlValue.between(1, 0, 2)'
            ),
            language
          ),
        /Unsupported SQL value library call/u
      );
    }
  });

  it('rejects a legacy Python helper that hides a newer helper of the same name', () => {
    const { prefix, expression } = nativeExpression(
      translator.translate(
        'SELECT 1 BETWEEN 0 AND 2 FROM people;',
        'sql',
        'python'
      )
    );
    const legacy = prefix.replace(
      betweenMethods.python.replaceAll('$SQL$', 'UtSqlValue'),
      ''
    );
    assert.throws(
      () =>
        translator.toMeta(
          `${prefix}\n\n${legacy}\n\n${expression}\n`,
          'python'
        ),
      /SQL value library/u
    );
  });
});

describe('literal SQL membership', () => {
  it('retains nonempty and empty choices in every controlled grammar', () => {
    const meta = translator.toMeta(
      'SELECT age IN (NULL, 18) FROM people WHERE age NOT IN ();',
      'sql'
    );
    const projection = meta.main.statements[0].expression.projection;
    assert.equal(projection.kind, 'SqlIn');
    assert.equal(projection.type, 'object');
    assert.deepEqual(
      projection.choices.elements.map(({ kind }) => kind),
      ['Null', 'Number']
    );
    for (const language of naturalLanguageIds()) {
      const written = translator.fromMeta(meta, language);
      assert.ok(
        sameMeaning(meta, translator.toMeta(written, language)),
        `${language}: ${written}`
      );
    }
  });

  it('requires a verified membership helper and nullary operands', () => {
    const meta = translator.toMeta('SELECT 1 IN (2) FROM people;', 'sql');
    for (const language of ['python', 'javascript', 'typescript', 'csharp']) {
      const written = translator.fromMeta(meta, language);
      const method = inMethods[language].replaceAll('$SQL$', 'UtSqlValue');
      const choice = language === 'python' ? 'lambda: 2' : '() => 2';
      assert.ok(written.includes(method), language);
      assert.ok(written.includes(choice), language);
      for (const invalid of [
        written.replace(method, ''),
        written.replace(choice, '2'),
      ]) {
        assert.throws(
          () => translator.toMeta(invalid, language),
          /Unsupported SQL value library call/u
        );
      }
    }
  });

  it('requires a comma-delimited list of scalar expressions', () => {
    for (const input of ['people', '(1,)', '(SELECT age FROM people)']) {
      assert.throws(() =>
        translator.toMeta(`SELECT age IN ${input} FROM people;`, 'sql')
      );
    }
  });
});

describe('SQL value helper contracts', () => {
  it('preserves Unicode source bytes and the verified helper production', () => {
    for (const language of ['python', 'javascript', 'typescript', 'csharp']) {
      const written = translator.translate(
        "SELECT 'é😀' FROM people WHERE age IS NULL;",
        'sql',
        language
      );
      const parsed = parseProgram(written, languageSyntax(language));
      assert.equal(parsed.syntax.children.map((n) => n.text).join(''), written);
      const bytes = Buffer.from(written);
      for (const child of parsed.syntax.children) {
        assert.equal(
          bytes.subarray(child.start, child.end).toString(),
          child.text
        );
      }
      assert.ok(
        parsed.syntax.productions.some((n) => n.rule === 'sqlValueLibrary')
      );
      assert.throws(() =>
        translator.toMeta(
          written.replace('numeric or NULL value', 'changed value'),
          language
        )
      );
    }
  });

  it('rejects JavaScript and TypeScript helpers with a changed return newline', () => {
    for (const language of ['javascript', 'typescript']) {
      const written = translator.translate(
        'SELECT NULL FROM people;',
        'sql',
        language
      );
      for (const newline of ['\n', '\u2028', '\u2029', '/* é😀\n */']) {
        assert.throws(() =>
          translator.toMeta(
            written.replace('return null;', `return${newline}null;`),
            language
          )
        );
      }
    }
  });

  it('retains ranges with Unicode whitespace and multiple independent helper libraries', () => {
    const { prefix, expression } = nativeExpression(
      translator.translate('SELECT NULL FROM people;', 'sql', 'javascript')
    );
    const source = `${prefix.replace('static nullValue', '/* é😀 */ static\u00a0nullValue')}\n${objpakRuntime.javascript.replaceAll('$SET$', 'UtObjpakSet').replace('static create', '/* é😀 */ static create')}\n${prefix.replaceAll('UtSqlValue', 'UtSqlValue_')}\n${expression};\n`;
    const parsed = parseProgram(source, languageSyntax('javascript'));
    assert.equal(parsed.syntax.children.map((n) => n.text).join(''), source);
    assert.equal(
      parsed.syntax.productions.filter((p) => p.concept === 'LibraryDefinition')
        .length,
      3
    );
    const bytes = Buffer.from(source);
    for (const child of parsed.syntax.children) {
      assert.equal(
        bytes.subarray(child.start, child.end).toString(),
        child.text
      );
    }
    assert.equal(
      translator.toMeta(source, 'javascript').main.statements[0].expression
        .projection.kind,
      'Null'
    );
  });

  it('avoids helper collisions and rejects reassignment, escaping, shadowing and unknown calls', () => {
    const source = 'SELECT NULL FROM UtSqlValue AS record;';
    for (const language of ['python', 'javascript', 'typescript', 'csharp']) {
      const meta = translator.toMeta(source, 'sql');
      const written = translator.fromMeta(meta, language);
      const raw = rewrite(meta, (part) =>
        part.kind === 'Name'
          ? { ...part, name: 'UtSqlValue' }
          : part.kind === 'Query'
            ? { ...part, variable: 'UtSqlValue_' }
            : part
      );
      assert.match(emitProgram(raw, language), /class UtSqlValue__/u);
      assert.ok(
        sameMeaning(meta, translator.toMeta(written, language)),
        language
      );
    }
    const { prefix, expression } = nativeExpression(
      translator.translate('SELECT NULL FROM people;', 'sql', 'javascript')
    );
    for (const body of [
      `UtSqlValue = 1;\n${expression};`,
      `UtSqlValue.binary = other;\n${expression};`,
      `const alias = UtSqlValue;\n${expression};`,
      'UtSqlValue.unknown();',
      'UtSqlValue.binary("wrong", 1, 2);',
      'people.map(UtSqlValue => UtSqlValue.nullValue());',
    ]) {
      assert.throws(
        () => translator.toMeta(`${prefix}\n${body}`, 'javascript'),
        /SQL value library/u
      );
    }
    assert.throws(
      () =>
        translator.translate(
          'SELECT NULL FROM people;',
          'sql',
          'javascript@es5'
        ),
      /ECMAScript 2015/u
    );
  });
});
