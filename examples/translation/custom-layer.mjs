// Add a meta→meta layer and trace every pipeline stage.
import { createTranslator } from '../../js/src/index.js';
const traceRule = (program, { to }) => {
  console.error(`translating ${program.functions.length} functions to ${to}`);
  return program;
};
const t = createTranslator({
  layers: [[traceRule]],
  trace: (s, tree) => console.error(s, tree.kind),
});
console.log(
  t.translate('console.log("Hi");', 'javascript', 'rust', {
    mode: 'same-effect',
  })
);
