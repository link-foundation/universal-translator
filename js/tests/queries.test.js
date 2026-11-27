import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  checkDescription,
  checkText,
  createTranslator,
  naturalLanguageIds,
  queryLanguageIds,
} from '../src/index.js';
import { sameMeaning } from '../src/meta/tree.js';
import { nativeExpression } from '../../examples/queries/native-expression.mjs';
import negationPredicates from '../../examples/queries/negation.json' with { type: 'json' };

const translator = createTranslator();
const sql =
  'SELECT age + 1 FROM people AS person WHERE age >= 18 AND age < 65;';
const query = (source, from) =>
  translator.toMeta(source, from).main.statements[0].expression;

describe('compositional selection queries', () => {
  it('binds SQL negation below comparisons and preserves explicit grouping', () => {
    const condition = query(
      'SELECT age FROM people WHERE NOT age = 18;',
      'sql'
    ).condition;
    assert.equal(condition.kind, 'SqlTruth');
    assert.equal(condition.operand.kind, 'SqlUnary');
    assert.equal(condition.operand.operator, 'not');
    assert.equal(condition.operand.operand.operator, 'equal');
    for (const predicate of negationPredicates) {
      const meta = translator.toMeta(
        `SELECT age FROM people AS p WHERE ${predicate};`,
        'sql'
      );
      for (const target of [
        'sql',
        'python',
        'javascript',
        'typescript',
        'csharp',
        'english',
        'russian',
      ]) {
        const written = translator.fromMeta(meta, target);
        assert.ok(
          sameMeaning(meta, translator.toMeta(written, target)),
          `${target}: ${predicate}: ${written}`
        );
      }
    }
  });

  it('registers and detects SQL with explicit query capabilities', () => {
    assert.deepEqual(queryLanguageIds, ['sql']);
    assert.equal(
      translator.languages().find(({ id }) => id === 'sql').query,
      true
    );
    assert.equal(translator.detectLanguage(sql)[0].id, 'sql');
    assert.throws(
      () => translator.translate('print(1)', 'python', 'sql'),
      /selection queries/u
    );
    assert.throws(
      () => translator.translate(sql, 'sql', 'sql', { commonLibrary: true }),
      /no common library/u
    );
  });

  it('keeps source, scoped variable, predicate and projection as expressions', () => {
    const result = query(sql, 'sql');
    assert.equal(result.kind, 'Query');
    assert.equal(result.variable, 'person');
    assert.equal(result.source.name, 'people');
    assert.equal(result.projection.operator, 'add');
    assert.equal(result.projection.left.kind, 'Index');
    assert.equal(result.projection.left.index.value, 'age');
    assert.equal(result.condition.operand.operator, 'and');
    assert.equal(result.eager, true);
    for (const language of [
      'sql',
      'python',
      'javascript',
      'typescript',
      'csharp',
    ]) {
      const meta = translator.toMeta(sql, 'sql');
      const written = translator.fromMeta(meta, language);
      assert.ok(
        sameMeaning(meta, translator.toMeta(written, language)),
        `${language}: ${written}`
      );
    }
  });

  it('recognizes LINQ, comprehensions and chained filter/projection', () => {
    const sources = [
      [
        'csharp',
        '(from person in people where person["age"] >= 18 select person["age"] + 1).ToArray();',
      ],
      [
        'python',
        '[person["age"] + 1 for person in people if person["age"] >= 18]',
      ],
      [
        'javascript',
        'people.filter(p => p.age >= 18).map(person => person.age + 1);',
      ],
    ];
    const meta = translator.toMeta(
      'SELECT age + 1 FROM people AS p WHERE age >= 18;',
      'sql'
    );
    for (const [language, source] of sources) {
      const read = query(source, language);
      assert.equal(read.kind, 'Query', language);
      assert.equal(read.eager, true, language);
      assert.equal(read.source.name, 'people', language);
      const written = translator.fromMeta(
        translator.toMeta(source, language),
        'sql'
      );
      assert.ok(written.includes('SELECT'), written);
    }
    assert.equal(
      query('from person in people select person.Name;', 'csharp').eager,
      false
    );
    assert.equal(query('(person for person in people)', 'python').eager, false);
    assert.equal(
      query('people.filter(p => keep(p)).map(p => project(p));', 'javascript')
        .source.kind,
      'Query'
    );
    assert.equal(meta.main.statements[0].expression.kind, 'Query');
  });
});

describe('selection queries in controlled natural languages', () => {
  it('composes query questions and answers through every natural grammar', () => {
    for (const language of naturalLanguageIds()) {
      const meta = translator.toMeta(sql, 'sql');
      const text = translator.fromMeta(meta, language);
      assert.ok(text.trimEnd().endsWith('?'), `${language}: ${text}`);
      assert.deepEqual(checkDescription(language), [], language);
      const simple = translator.translate(
        'SELECT * FROM people;',
        'sql',
        language
      );
      assert.deepEqual(
        checkText(simple, language),
        [],
        `${language}: ${simple}`
      );
      assert.ok(
        sameMeaning(meta, translator.toMeta(text, language)),
        `${language}: ${text}`
      );
    }
    assert.equal(
      query(
        'Which values of person for each person in people satisfy true?',
        'english'
      ).kind,
      'Query'
    );
  });

  it('retains deferred strategy in natural questions and answer expressions', () => {
    const meta = translator.toMeta('(person for person in people)', 'python');
    for (const language of naturalLanguageIds()) {
      const text = translator.fromMeta(meta, language);
      assert.ok(
        sameMeaning(meta, translator.toMeta(text, language)),
        `${language}: ${text}`
      );
    }
    for (const language of ['python', 'csharp']) {
      const text = translator.fromMeta(meta, language);
      assert.ok(
        sameMeaning(meta, translator.toMeta(text, language)),
        `${language}: ${text}`
      );
    }
    assert.throws(() => translator.fromMeta(meta, 'sql'), /deferred iterator/u);
    assert.throws(
      () => translator.translate(sql, 'sql', 'javascript@es5'),
      /ECMAScript 2015/u
    );
    const nested =
      'Let values be the values of person for each person in people where true.';
    assert.equal(
      translator.toMeta(nested, 'english').main.statements[0].value.kind,
      'Query'
    );
  });
});

describe('selection data, scopes and execution', () => {
  it('preserves SQL strings and quoted identifiers without treating them as keywords', () => {
    const text =
      'SELECT "from" FROM "MixedCase" AS item WHERE "where" = \'it\'\'s ready\';';
    const meta = translator.toMeta(text, 'sql');
    const written = translator.fromMeta(meta, 'sql');
    assert.ok(written.includes('"MixedCase"'), written);
    assert.ok(written.includes("'it''s ready'"), written);
    assert.ok(sameMeaning(meta, translator.toMeta(written, 'sql')), written);
    assert.equal(
      query('SELECT "true" FROM people;', 'sql').projection.kind,
      'Index'
    );
    assert.equal(
      query('SELECT NULL FROM people;', 'sql').projection.kind,
      'Null'
    );
  });

  it('infers query collection results and keeps range variables in their own scope', () => {
    const source = 'p = 3.5\nvalues = [p + 1 for p in [1, 2]]';
    const meta = translator.toMeta(source, 'python');
    const binding = meta.main.statements[1];
    assert.equal(binding.type, 'array<integer>');
    assert.equal(binding.value.projection.left.type, 'integer');
    const csharp = translator.fromMeta(meta, 'csharp');
    assert.match(
      csharp,
      /var values = \(from pQuery2 in new\[\] \{1, 2\} select pQuery2 \+ 1\)\.ToArray\(\)/u
    );
    for (const [expression, type] of [
      ['[p + 1 for p in [1, 2]]', 'int[]'],
      [
        '(p + 1 for p in [1, 2])',
        'System.Collections.Generic.IEnumerable<int>',
      ],
      ['["ready" for p in [1, 2]]', 'string[]'],
    ]) {
      const written = translator.translate(
        `def values():\n    return ${expression}`,
        'python',
        'csharp'
      );
      assert.ok(written.includes(`static ${type} Values()`), written);
      assert.equal(
        translator.toMeta(written, 'csharp').functions[0].body.statements[0]
          .value.kind,
        'Query'
      );
    }
    const nested = translator.translate(
      '[[p.age for p in p.children] for p in people]',
      'python',
      'csharp'
    );
    assert.match(
      nested,
      /from pQuery2_ in people select \(from pQuery2 in pQuery2_\["children"\] select pQuery2\["age"\]/u
    );
    const method = translator.translate(
      'p = 1\nvalues = [p.compute() for p in people]',
      'python',
      'csharp'
    );
    assert.match(method, /from pQuery2 in people select pQuery2.compute\(\)/u);
    assert.match(
      translator.translate('SELECT * FROM row;', 'sql', 'csharp'),
      /from rowQuery2 in row select rowQuery2/u
    );
  });

  it('preserves filter-before-map side effects when either callback calls a function', () => {
    const source = 'people.filter(p => keep(p)).map(p => project(p));';
    const python = translator.translate(source, 'javascript', 'python');
    const result = JSON.parse(
      execFileSync(
        'python3',
        [
          '-c',
          'import json,sys\nevents=[]; people=[1,2,3]\n' +
            'def keep(p):\n events.append("k"+str(p)); return p>1\n' +
            'def project(p):\n events.append("p"+str(p)); return p+1\n' +
            'values=eval(sys.argv[1]); print(json.dumps([values,events]))',
          python,
        ],
        { encoding: 'utf8' }
      )
    );
    assert.deepEqual(result, [
      [3, 4],
      ['k1', 'k2', 'k3', 'p2', 'p3'],
    ]);
  });

  it('agrees with native SQLite, Python and JavaScript on filtered projections', () => {
    const people = [{ age: 12 }, { age: 18 }, { age: 42 }, { age: 70 }];
    const python = nativeExpression(translator.translate(sql, 'sql', 'python'));
    const javascript = nativeExpression(
      translator.translate(sql, 'sql', 'javascript')
    );
    const native = execFileSync(
      'python3',
      [
        '-c',
        'import json,sqlite3,sys\n' +
          'data=json.loads(sys.argv[1]); people=data["people"]\n' +
          'db=sqlite3.connect(":memory:"); db.execute("create table people(age integer)")\n' +
          'db.executemany("insert into people values(?)",[(p["age"],) for p in people])\n' +
          'exec(data["python"]["prefix"]); print(json.dumps([[r[0] for r in db.execute(data["sql"])],eval(data["python"]["expression"])]))',
        JSON.stringify({ people, sql, python }),
      ],
      { encoding: 'utf8' }
    );
    const [sqlite, pythonResult] = JSON.parse(native);
    const javascriptResult = JSON.parse(
      execFileSync(
        'node',
        [
          '-e',
          `${javascript.prefix}\nconst people=${JSON.stringify(people)}; console.log(JSON.stringify(${javascript.expression}));`,
        ],
        { encoding: 'utf8' }
      )
    );
    assert.deepEqual(sqlite, [19, 43]);
    assert.deepEqual(pythonResult, sqlite);
    assert.deepEqual(javascriptResult, sqlite);
  });
});
