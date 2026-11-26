// Which committed tasks lose meaning when written in an older version and read back.
import { readdirSync, readFileSync } from 'node:fs';
import { createTranslator } from '../../js/src/index.js';
import { splitVersion } from '../../js/src/formal/versions.js';
import { sameMeaning } from '../../js/src/meta/tree.js';
const translator = createTranslator();
const targets = process.argv.slice(2);
const tasks = readdirSync('examples/programs').filter((f) => f.endsWith('.js'));
for (const target of targets) {
  for (const file of tasks) {
    const meta = translator.toMeta(
      readFileSync(`examples/programs/${file}`, 'utf8'),
      'javascript'
    );
    const written = translator.fromMeta(meta, target);
    const back = translator.toMeta(written, splitVersion(target).id);
    const a = JSON.stringify(meta),
      b = JSON.stringify(back);
    if (!sameMeaning(meta, back)) {
      console.log(target, file, a.length, b.length);
    }
  }
}
