// Finite query/helper binding probe, retained for native scope regressions.
import { createTranslator } from '../js/src/index.js';
import { sameMeaning } from '../js/src/meta/tree.js';
const translator = createTranslator();
const meta = translator.toMeta(
  'SELECT NULL FROM UtSqlValue AS UtSqlValue_;',
  'sql'
);
const written = translator.fromMeta(meta, 'csharp');
const read = translator.toMeta(written, 'csharp');
console.log(
  JSON.stringify(
    {
      written,
      main: meta.main,
      read: read.main,
      same: sameMeaning(meta, read),
    },
    null,
    2
  )
);
