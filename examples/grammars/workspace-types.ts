// Compile-time example of the public grammar workspace API.
import {
  createGrammarWorkspace,
  grammarEngine,
  reconstructConcrete,
  type GrammarDescriptor,
  type GrammarReading,
} from '@link-foundation/universal-translator/grammar';

const descriptor: GrammarDescriptor = {
  id: 'greeting',
  language: 'greeting',
  format: 'ebnf',
  source: 'start = "hello" ;',
};
const workspace = createGrammarWorkspace({
  afterImport: (grammar) => grammar,
  afterParse: (reading, context) => {
    const language: string | undefined = context.language;
    console.assert(language === 'greeting');
    return reading;
  },
});
workspace.import(descriptor);
const reading: GrammarReading = workspace.parse('hello', {
  language: 'greeting',
  limits: { maxDepth: 64 },
});
console.assert(reconstructConcrete(reading.syntax) === 'hello');
const native = workspace.export('native', { sourceId: 'greeting' });
const grammar: grammarEngine.Grammar = grammarEngine.parseNativeGrammar(native);
console.assert(
  grammarEngine.createGrammarParser(grammar).parseTree('hello').ok
);
