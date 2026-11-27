import { describe, expect, it } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  createGrammarWorkspace,
  createTranslator,
  grammarEngine,
  reconstructConcrete,
} from '../src/index.js';
import { sourceNode } from '../src/grammar/concrete.js';
import * as browserGrammar from '@link-foundation/universal-translator/grammar';

const fixtures = JSON.parse(
  readFileSync(
    new URL('../../data/grammar-interchange.json', import.meta.url),
    'utf8'
  )
);
const descriptor = (id = 'one', source = 'start = "hello", " ", "мир" ;') => ({
  id,
  language: 'toy',
  format: 'ebnf',
  source,
  revision: 'v1',
});

describe('executable grammar interchange', () => {
  it('exposes the same grammar APIs from the browser-safe package entry', () => {
    expect(browserGrammar.createGrammarWorkspace).toBe(createGrammarWorkspace);
    expect(browserGrammar.reconstructConcrete).toBe(reconstructConcrete);
    expect(browserGrammar.grammarEngine.Grammar).toBe(grammarEngine.Grammar);
  });
  it('verifies the pinned external runtime and its explicit browser patch', () => {
    const result = spawnSync(
      'node',
      ['scripts/update-meta-grammar.mjs', '--check'],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('198 pinned grammar files');
  });

  it('imports all nine formats into executable, byte-preserving CSTs', () => {
    expect(fixtures.map(({ format }) => format).sort()).toEqual(
      [...grammarEngine.grammarImportFormats].sort()
    );
    for (const fixture of fixtures) {
      const workspace = createGrammarWorkspace();
      workspace.import({ ...descriptor(), ...fixture });
      const result = workspace.parse('hello мир', { language: 'toy' });
      expect(result.ok).toBe(true);
      expect(reconstructConcrete(result.syntax)).toBe('hello мир');
      expect(result.syntax.end).toBe(12);
      expect(result.syntax.productions.length > 0).toBe(true);
      expect(result.syntax.grammar).toEqual([
        { id: 'one', revision: 'v1', url: undefined },
      ]);
      expect(workspace.parse('bye мир', { language: 'toy' }).ok).toBe(false);
      const converted = workspace.export('native', { language: 'toy' });
      const copy = createGrammarWorkspace();
      copy.import({
        ...descriptor('copy'),
        format: 'native',
        source: converted,
      });
      expect(copy.parse('hello мир', { language: 'toy' }).ok).toBe(true);
    }
  });

  it('preserves nesting, trivia, CRLF and error records', () => {
    const workspace = createGrammarWorkspace();
    workspace.import({
      ...descriptor(),
      format: 'native',
      source:
        'start start\nextra repeat1(class(char(" "), char("\\r"), char("\\n")))\nrule start = normal seq(literal("hello"), ref(word))\nrule word = normal literal("мир")\n',
    });
    const source = 'hello \r\n мир';
    const result = workspace.parse(source, { language: 'toy' });
    expect(result.ok).toBe(true);
    expect(reconstructConcrete(result.syntax)).toBe(source);
    expect(result.syntax.children.some(({ kind }) => kind === 'Trivia')).toBe(
      true
    );
    expect(result.syntax.productions.some(({ rule }) => rule === 'word')).toBe(
      true
    );
    const failed = workspace.parse('hello ???', { language: 'toy' });
    expect(failed.ok).toBe(false);
    expect(reconstructConcrete(failed.syntax)).toBe('hello ???');
    expect(failed.syntax.errors.length).toBe(1);
  });

  it('retains explicit missing and error leaves during bounded recovery', () => {
    const workspace = createGrammarWorkspace();
    workspace.import(descriptor('one', 'start = "hello", "!" ;'));
    for (const source of ['hello', 'hello?']) {
      const result = workspace.parse(source, {
        sourceId: 'one',
        limits: { errorRecovery: true, maxRepairs: 2 },
      });
      expect(result.ok).toBe(false);
      expect(result.rejection.reason).toBe('recovered');
      expect(reconstructConcrete(result.syntax)).toBe(source);
      expect(result.syntax.errors[0]).toEqual({
        kind: 'Error',
        start: 5,
        end: 5,
        message: 'missing',
      });
      if (source.endsWith('?')) {
        expect(result.syntax.children.at(-1).kind).toBe('Error');
        expect(result.syntax.errors.length).toBe(2);
      }
    }
  });
});

describe('grammar updates and transforms', () => {
  it('keeps unchanged merge identities while updating only changed grammars', async () => {
    const workspace = createGrammarWorkspace();
    workspace.import(descriptor('one', 'start = "hello" ;'));
    workspace.import(descriptor('two', 'root = "hello" ;'));
    const first = workspace.merge();
    expect(first.groups.length).toBe(1);
    expect(first.groups[0].identities['one:start']).toBe(
      first.groups[0].identities['two:root']
    );
    expect(workspace.merge().reused).toEqual(['toy@']);
    await workspace.refresh('two', () => ({
      source: 'root = "bye" ;',
      revision: 'v2',
    }));
    expect(workspace.parse('bye', { sourceId: 'two' }).ok).toBe(true);
    expect(workspace.parse('hello', { sourceId: 'one' }).ok).toBe(true);
    const changed = workspace.merge();
    expect(changed.groups[0].identities['one:start']).not.toBe(
      changed.groups[0].identities['two:root']
    );
    expect(workspace.sources().find(({ id }) => id === 'two').revision).toBe(
      'v2'
    );
    await workspace.refresh('two', () => 'root = "ciao" ;');
    expect(workspace.parse('ciao', { sourceId: 'two' }).ok).toBe(true);
    workspace.remove('two');
    expect(workspace.sources().length).toBe(1);
  });

  it('keeps language editions and independent source grammars separate', () => {
    const workspace = createGrammarWorkspace();
    workspace.import({ ...descriptor('old', 'start = "old" ;'), edition: '1' });
    workspace.import({ ...descriptor('new', 'start = "new" ;'), edition: '2' });
    expect(workspace.merge().groups.length).toBe(2);
    expect(workspace.parse('new', { language: 'toy', edition: '2' }).ok).toBe(
      true
    );
    expect(workspace.parse('new', { language: 'toy', edition: '1' }).ok).toBe(
      false
    );
    expect(workspace.parse('old', { sourceId: 'old' }).ok).toBe(true);
  });

  it('resolves imported dependencies again after an upstream update', () => {
    const workspace = createGrammarWorkspace();
    workspace.import(descriptor('words', 'word = "hello" ;'));
    workspace.import({
      ...descriptor('main'),
      format: 'native',
      source: 'start start\nimport words\nrule start = normal ref(word)\n',
    });
    expect(workspace.parse('hello', { sourceId: 'main' }).ok).toBe(true);
    workspace.update('words', { source: 'word = "bye" ;', revision: 'v2' });
    expect(workspace.parse('bye', { sourceId: 'main' }).ok).toBe(true);
    expect(workspace.parse('hello', { sourceId: 'main' }).ok).toBe(false);
  });

  it('bounds actual parsing work and retains the rejected input', () => {
    const workspace = createGrammarWorkspace();
    workspace.import(descriptor());
    const result = workspace.parse('hello мир', {
      language: 'toy',
      limits: { stepLimit: 1 },
    });
    expect(result.ok).toBe(false);
    expect(result.rejection.reason).toBe('stepLimit');
    expect(reconstructConcrete(result.syntax)).toBe('hello мир');
    expect(result.syntax.errors[0].message).toBe('stepLimit');
  });

  it('reapplies transformations to updates and exposes opt-in stage traces', () => {
    const seen = [];
    const workspace = createGrammarWorkspace({
      beforeImport: [(source) => source.replace('GREETING', 'hello')],
      afterImport: (grammar) =>
        grammarEngine.renameGrammarRule(grammar, 'start', 'program').grammar,
      beforeCompile: (grammar) => grammar,
      afterParse: (result) => result,
      beforeExport: (grammar) => grammar,
      afterExport: (source) => `${source}\n`,
      trace: (stage) => seen.push(stage),
    });
    workspace.import(descriptor('one', 'start = "GREETING" ;'));
    expect(workspace.parse('hello', { language: 'toy' }).ok).toBe(true);
    expect(workspace.export('ebnf', { language: 'toy' })).toContain('program');
    workspace.update('one', { source: 'start = "GREETING" ;', revision: 'v2' });
    expect(workspace.parse('hello', { language: 'toy' }).ok).toBe(true);
    expect(seen).toEqual([
      'beforeImport',
      'afterImport',
      'beforeCompile',
      'afterParse',
      'beforeExport',
      'afterExport',
      'beforeImport',
      'afterImport',
      'beforeCompile',
      'afterParse',
    ]);
  });
});

describe('grammar translator integration', () => {
  it('uses an imported grammar in the ordinary translator and preserves its source record', () => {
    const workspace = createGrammarWorkspace();
    workspace.import({
      ...descriptor(
        'say',
        'start = "say ", amount, "." ; amount = "5" | "7" ;'
      ),
      language: 'javascript',
    });
    const lower = (tree, context) => {
      const amount = tree.children.find(({ kind }) => kind === 'amount');
      const value = context.node(
        'Number',
        { value: Number(context.source.slice(amount.start, amount.end)) },
        amount
      );
      return {
        kind: 'SourceProgram',
        items: [context.node('Print', { value, newline: true }, tree)],
      };
    };
    let concrete;
    const translator = createTranslator({
      decorate: { parse: workspace.decorateParser({ javascript: lower }) },
      trace(stage, tree) {
        if (stage === 'parsed') {
          concrete = tree.syntax;
        }
      },
    });
    expect(translator.translate('say 7.', 'javascript', 'python')).toBe(
      'print(7)\n'
    );
    expect(reconstructConcrete(concrete)).toBe('say 7.');
    expect(translator.translate('print(5)', 'python', 'javascript')).toBe(
      'console.log(5);\n'
    );
    expect(() =>
      workspace.read('say 8.', { language: 'javascript' }, lower)
    ).toThrow('syntax error');
    expect(() =>
      workspace.read('say 7.', { language: 'javascript' }, () => ({}))
    ).toThrow('SourceProgram');
  });

  it('rejects invalid imports atomically and reports bad configuration', () => {
    const workspace = createGrammarWorkspace();
    workspace.import(descriptor());
    expect(() => workspace.update('one', { source: 'broken =' })).toThrow();
    expect(workspace.parse('hello мир', { sourceId: 'one' }).ok).toBe(true);
    expect(() => workspace.import({ ...descriptor(), id: 'bad:id' })).toThrow(
      'colon'
    );
    expect(() =>
      workspace.import({ ...descriptor(), format: 'unknown' })
    ).toThrow('Unsupported grammar');
    expect(() => workspace.parse('\ud800', { sourceId: 'one' })).toThrow(
      'Unicode'
    );
    expect(() => workspace.parse('', { language: 'unknown' })).toThrow(
      'No imported grammar'
    );
    expect(() => workspace.update('unknown', {})).toThrow('Unknown grammar');
    expect(() => workspace.remove('unknown')).toThrow('Unknown grammar');
    expect(() => workspace.export('unknown', { language: 'toy' })).toThrow(
      'Unsupported grammar'
    );
    expect(() => createGrammarWorkspace({ unknown: () => {} })).toThrow(
      'Unknown grammar stage'
    );
    expect(() => createGrammarWorkspace({ afterParse: 5 })).toThrow(
      'needs functions'
    );
    const invalid = createGrammarWorkspace({ afterImport: () => null });
    expect(() => invalid.import(descriptor())).toThrow('must return a Grammar');
    const lossy = createGrammarWorkspace();
    lossy.import({
      ...descriptor(),
      format: 'native',
      source:
        'start start\nrule start = normal capture("answer", literal("hello"))\n',
    });
    expect(() => lossy.export('ebnf', { language: 'toy' })).toThrow(
      'would lose'
    );
  });

  it('rejects transforms that manufacture invalid concrete source ranges', () => {
    const workspace = createGrammarWorkspace({
      afterParse: (result) => ({
        ...result,
        tree: { type: 'token', start: 0, end: 999 },
      }),
    });
    workspace.import(descriptor());
    expect(() => workspace.parse('hello мир', { language: 'toy' })).toThrow(
      'invalid source range'
    );
    expect(() => sourceNode('мир', 'Name', {}, { start: 1, end: 2 })).toThrow();
    expect(() => sourceNode('x', 'Name', {}, { start: -1, end: 2 })).toThrow(
      'invalid source range'
    );
    for (const tree of [
      {
        type: 'node',
        start: 0,
        end: 1,
        children: [{ type: 'token', start: 0, end: 2 }],
      },
      { type: 'node', start: 0, end: 1, children: [] },
      {
        type: 'node',
        start: 0,
        end: 6,
        children: [
          { type: 'token', start: 0, end: 4 },
          { type: 'token', start: 3, end: 6 },
        ],
      },
    ]) {
      const invalid = createGrammarWorkspace({
        afterParse: (result) => ({ ...result, tree }),
      });
      invalid.import(descriptor('one', 'start = "мир" ;'));
      expect(() => invalid.parse('мир', { sourceId: 'one' })).toThrow();
    }
  });
});
