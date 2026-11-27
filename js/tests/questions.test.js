import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cleanDocumentation } from '../src/formal/documentation.js';
import {
  checkDescription,
  checkText,
  createTranslator,
  naturalLanguageIds,
} from '../src/index.js';

const translator = createTranslator();
const question = (source, from = 'python') =>
  translator.toMeta(source, from).main.statements[0].expression;
const docstring =
  'Explain the meaning.\n\n    Keep indentation and "quotes".\n    ';
const documented = `def meaning(value):\n    """${docstring}"""\n    return value\n\nprint(meaning.__doc__)\n`;
const aspects = [
  ['type(meaning)\n', 'type'],
  ['meaning.__doc__\n', 'documentation'],
  ['import inspect\ninspect.getsource(meaning)\n', 'source'],
  ['meaning??\n', 'details'],
];

describe('compositional introspection questions', () => {
  it('composes recursive grammar phrases through formal operators and back', () => {
    const source =
      'Tell me the source of the kind of (the documentation of meaning)?\n';
    const read = question(source, 'english');
    assert.equal(read.aspect, 'source');
    assert.equal(read.subject.aspect, 'type');
    assert.equal(read.subject.subject.aspect, 'documentation');
    assert.equal(read.subject.subject.subject.name, 'meaning');
    const canonical =
      'What is the source of the type of the documentation of meaning?\n';
    for (const target of ['english', 'python', 'javascript', 'typescript']) {
      const rendered = translator.translate(source, 'english', target);
      assert.equal(
        translator.translate(rendered, target, 'english'),
        canonical
      );
    }
  });

  it('distinguishes all four aspects and keeps the ordinary subject expression', () => {
    for (const [source, aspect] of aspects) {
      const result = question(source);
      assert.equal(result.kind, 'Question');
      assert.equal(result.aspect, aspect);
      assert.equal(result.subject.name, 'meaning');
      const python = translator.translate(source, 'python', 'python');
      assert.equal(question(python).aspect, aspect);
    }
    const nested = question('type(meaning(2 + 3))\n');
    assert.equal(nested.subject.kind, 'Call');
    assert.equal(nested.subject.arguments[0].kind, 'Binary');
    assert.throws(() => question('meaning()??\n'), /requires an entity name/u);
  });

  it('resolves inspect imports and aliases without capturing shadowed procedures', () => {
    for (const source of [
      'import inspect as details\ndetails.getsource(meaning)\n',
      'from inspect import getsource as source_of\nsource_of(meaning)\n',
    ]) {
      assert.equal(question(source).aspect, 'source');
    }
    for (const source of [
      'type = custom\ntype(meaning)\n',
      'from custom import type\ntype(meaning)\n',
      'import inspect\nimport custom as inspect\ninspect.getsource(meaning)\n',
      'import custom\ncustom.getsource(meaning)\n',
    ]) {
      const expression = translator
        .toMeta(source, 'python')
        .main.statements.at(-1).expression;
      assert.equal(expression.kind, 'Call');
    }
    const source =
      'import inspect\ndef source_of(inspect):\n    return inspect.getsource(meaning)\n';
    assert.equal(
      translator.toMeta(source, 'python').functions[0].body.statements[0].value
        .kind,
      'Call'
    );
  });

  it('round trips questions through every natural-language grammar', () => {
    for (const language of naturalLanguageIds()) {
      for (const [source, aspect] of aspects) {
        const text = translator.translate(source, 'python', language);
        assert.deepEqual(checkDescription(language), [], language);
        assert.deepEqual(checkText(text, language), [], `${language}: ${text}`);
        assert.ok(text.trimEnd().endsWith('?'), `${language}: ${text}`);
        assert.equal(question(text, language).aspect, aspect, language);
        assert.equal(
          question(translator.translate(text, language, 'python')).aspect,
          aspect,
          language
        );
      }
    }
    assert.equal(
      translator.translate('What is the type of meaning?', 'english', 'python'),
      'type(meaning)\n'
    );
    assert.equal(
      translator.translate(
        'Какова документация сущности meaning?',
        'russian',
        'python'
      ),
      '(meaning).__doc__\n'
    );
  });

  it('keeps existing identifiers when introducing contextual question words', () => {
    const text = translator.translate(
      'const source = 1; const information = source; console.log(information);',
      'javascript',
      'english'
    );
    assert.ok(text.includes('Create source with value 1.'), text);
    assert.ok(text.includes('Create information with value source.'), text);
    assert.equal(
      translator.toMeta(text, 'english').main.statements[1].value.name,
      'source'
    );
  });

  it('composes question answers inside expressions and print statements', () => {
    const source = 'print(meaning.__doc__)\n';
    for (const language of naturalLanguageIds()) {
      const text = translator.translate(source, 'python', language);
      const result = translator.toMeta(text, language).main.statements[0];
      assert.equal(result.kind, 'Print', language);
      assert.equal(result.value.kind, 'Question', language);
      assert.equal(result.value.aspect, 'documentation', language);
    }
  });
});

describe('runtime documentation', () => {
  it('preserves multiline runtime documentation across code and natural languages', () => {
    assert.equal(
      translator.toMeta(documented, 'python@3.12').functions[0].documentation
        .value,
      docstring
    );
    for (const language of [
      'javascript',
      'typescript',
      ...naturalLanguageIds(),
    ]) {
      const text = translator.translate(documented, 'python@3.12', language);
      if (naturalLanguageIds().includes(language)) {
        assert.deepEqual(checkText(text, language), [], `${language}: ${text}`);
      }
      const read = translator.toMeta(text, language);
      assert.equal(read.functions[0].documentation.value, docstring, language);
      const python = translator.translate(text, language, 'python');
      assert.equal(
        translator.toMeta(python, 'python').functions[0].documentation.value,
        docstring,
        language
      );
    }
  });

  it('distinguishes Python docstring editions and preserves their runtime values', () => {
    for (const from of ['python', 'python@3', 'python@3.13']) {
      const read = translator.toMeta(documented, from);
      assert.equal(
        read.functions[0].documentation.value,
        cleanDocumentation(docstring),
        from
      );
    }
    for (const from of ['python@2', 'python@3.5', 'python@3.12']) {
      const read = translator.toMeta(documented, from);
      assert.equal(read.functions[0].documentation.value, docstring, from);
      const python = translator.translate(documented, from, 'python@3.13');
      assert.equal(
        translator.toMeta(python, 'python@3.13').functions[0].documentation
          .value,
        docstring
      );
      assert.equal(
        execFileSync('python3', ['-c', python], { encoding: 'utf8' }),
        `${docstring}\n`
      );
    }
    assert.equal(
      cleanDocumentation('  Title\n\n\tIndented\n\t  child\n\t'),
      'Title\n\nIndented\n  child\n'
    );
    assert.equal(cleanDocumentation('\n\n'), '\n\n');
  });

  it('rejects documentation outside a definition or with a non-text value', () => {
    assert.throws(
      () => translator.toMeta('Documentation is 3.', 'english'),
      /Documentation/u
    );
    assert.throws(
      () => translator.toMeta('Documentation is “orphan”.', 'english'),
      /Documentation/u
    );
  });

  it('keeps f-strings distinct from Python docstring literals', () => {
    for (const literal of [
      'f"not documentation"',
      'f"""not documentation"""',
    ]) {
      const source = `def meaning():\n    ${literal}\n    return 3\n`;
      const read = translator.toMeta(source, 'python');
      assert.equal(read.functions[0].documentation, undefined);
      const written = translator.translate(source, 'python', 'python');
      assert.equal(
        translator.toMeta(written, 'python').functions[0].documentation,
        undefined
      );
    }
  });

  it('retains later documentation assignments after earlier reads', () => {
    const source =
      'function meaning(value) { return value; }\nconsole.log(meaning.__doc__);\nmeaning.__doc__ = "later";\nconsole.log(meaning.__doc__);\n';
    const read = translator.toMeta(source, 'javascript');
    assert.equal(read.functions[0].documentation, undefined);
    assert.equal(read.main.statements[1].kind, 'PropertyAssignment');
    const python = translator.translate(source, 'javascript', 'python');
    assert.ok(python.indexOf('print(') < python.indexOf('__doc__ = "later"'));
  });

  it('executes translated documentation reads with the original contents', () => {
    const expected = execFileSync('python3', ['-c', documented], {
      encoding: 'utf8',
    });
    const version = execFileSync(
      'python3',
      ['-c', 'import sys; print(sys.version_info.minor)'],
      { encoding: 'utf8' }
    ).trim();
    const from = Number(version) >= 13 ? 'python@3.13' : 'python@3.12';
    const javascript = translator.translate(documented, from, 'javascript');
    assert.equal(
      execFileSync('node', ['--input-type=module', '-'], {
        input: javascript,
        encoding: 'utf8',
      }),
      expected
    );
    const python = translator.translate(javascript, 'javascript', 'python');
    assert.equal(
      execFileSync('python3', ['-c', python], { encoding: 'utf8' }),
      expected
    );
  });

  it('reads native JavaScript reflection back into the same question', () => {
    for (const [source, aspect] of aspects.slice(0, 3)) {
      const javascript = translator.translate(source, 'python', 'javascript');
      assert.equal(question(javascript, 'javascript').aspect, aspect);
    }
  });
});
