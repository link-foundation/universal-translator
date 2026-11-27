// Run from the repository root: node examples/grammars/import-and-translate.mjs
import assert from 'node:assert/strict';
import {
  createGrammarWorkspace,
  createTranslator,
  reconstructConcrete,
} from '../../js/src/index.js';

const workspace = createGrammarWorkspace();
workspace.import({
  id: 'example-say',
  language: 'javascript',
  edition: 'example',
  revision: '1',
  format: 'ebnf',
  source: 'start = "say ", amount, "." ; amount = "5" | "7" ;',
});

// A grammar describes syntax. This reader assigns its productions a meaning.
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
const translator = createTranslator({
  decorate: {
    parse: workspace.decorateParser(
      { javascript: lower },
      { edition: 'example' }
    ),
  },
});
const reading = workspace.read(
  'say 7.',
  { language: 'javascript', edition: 'example' },
  lower
);
assert.equal(reconstructConcrete(reading.syntax), 'say 7.');
assert.equal(
  translator.translate('say 7.', 'javascript', 'python'),
  'print(7)\n'
);
console.log(translator.translate('say 7.', 'javascript', 'python').trim());

// An update retains the source identity and reruns the import transforms.
workspace.update('example-say', {
  revision: '2',
  source: 'start = "say ", amount, "." ; amount = "5" | "7" | "9" ;',
});
assert.equal(
  translator.translate('say 9.', 'javascript', 'python'),
  'print(9)\n'
);
assert.equal(workspace.parse('say 8.', { sourceId: 'example-say' }).ok, false);
console.log(translator.translate('say 9.', 'javascript', 'python').trim());
