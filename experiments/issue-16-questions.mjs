import { createGrammarTranslator } from '../js/src/translator.js';
const translator = createGrammarTranslator();
const cases = [
  ['type(meaning)\n', 'python', 'english'],
  ['meaning.__doc__\n', 'python', 'english'],
  ['import inspect\ninspect.getsource(meaning)\n', 'python', 'english'],
  ['meaning??\n', 'python', 'english'],
  [
    'def meaning(value):\n    """Explain the meaning.\n\n    Retain this indentation.\n    """\n    return value\n\nprint(meaning.__doc__)\n',
    'python',
    'javascript',
  ],
];
for (const [source, from, to] of cases) {
  try {
    console.log(
      JSON.stringify({
        source,
        from,
        to,
        output: translator.translate(source, from, to),
      })
    );
  } catch (error) {
    console.log(JSON.stringify({ source, from, to, error: error.message }));
  }
}
