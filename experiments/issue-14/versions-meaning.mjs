// Every committed task written in every older language version and read
// back keeps its meaning.
import { readdirSync, readFileSync } from 'node:fs';
import { createTranslator } from '../../js/src/index.js';
import { sameMeaning } from '../../js/src/meta/tree.js';

const translator = createTranslator();
for (const target of ['python@2', 'lua@5.1', 'php@5', 'csharp@5']) {
  for (const file of readdirSync('examples/programs').filter((f) =>
    f.endsWith('.js')
  )) {
    const meta = translator.toMeta(
      readFileSync(`examples/programs/${file}`, 'utf8'),
      'javascript'
    );
    const written = translator.fromMeta(meta, target);
    const back = translator.toMeta(written, target.split('@')[0]);
    if (!sameMeaning(meta, back)) {
      console.log(`differs: ${target} ${file}`);
    }
  }
}
console.log('done');
