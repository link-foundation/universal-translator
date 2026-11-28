// Inspect ownership around commands lifted into expressions, without dumping
// the token stream or full trees. Run from the repository root with Node.
import { readFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
import {
  expressionOrigins,
  sourceOrigin,
} from '../js/src/translation/source-origins.js';

const options = { fragment: true, layout: 'target' };
const fixture = readFileSync('examples/translation/mapping.java', 'utf8');
const bash = createTranslator().translatePartial(
  fixture,
  'java',
  'bash',
  options
);
console.log(bash.text);
const translator = createTranslator({
  trace(stage, tree) {
    if (!['parsed', 'understood', 'typed', 'adapted'].includes(stage)) {
      return;
    }
    const visit = (value) => {
      if (!value || typeof value !== 'object') {
        return;
      }
      if (['CountingLoop', 'Print', 'Call'].includes(value.kind)) {
        console.log(stage, value.kind, value.variable ?? value.callee ?? '', {
          own: sourceOrigin(value)?.lines,
          expressions: expressionOrigins(value).map(({ lines }) => lines),
        });
      }
      Object.values(value).forEach(visit);
    };
    visit(tree);
  },
});
console.log(translator.translatePartial(bash.text, 'bash', 'java', options));
