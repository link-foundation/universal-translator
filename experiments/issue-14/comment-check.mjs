import { readFileSync } from 'node:fs';
import { translate, translateComments } from '../../js/src/index.js';
const source = readFileSync(
  new URL('../../examples/programs/sum-of-squares.js', import.meta.url),
  'utf8'
);
console.log(
  translate(source, 'javascript', 'javascript', { commentLanguage: 'russian' })
    .split('\n')
    .slice(0, 2)
    .join('\n')
);
console.log(
  JSON.stringify(
    translateComments(
      '/* Sum\n *   of   squares */\nlet x = 1; // number\n',
      'javascript',
      { from: 'english', to: 'german' }
    )
  )
);
