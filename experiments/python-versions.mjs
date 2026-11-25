// Write every example program as Python 2 and read it back:
//   node experiments/python-versions.mjs [--show name]
import { readdirSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';

import { createTranslator } from '../js/src/index.js';
import { meaningDifference, sameMeaning } from '../js/src/meta/tree.js';

const translator = createTranslator();
const folder = new URL('../examples/programs/', import.meta.url);
const show = process.argv[process.argv.indexOf('--show') + 1];
for (const file of readdirSync(folder).filter((name) => name.endsWith('.js'))) {
  const source = readFileSync(new URL(file, folder), 'utf8');
  const meta = translator.toMeta(source, 'javascript');
  try {
    const python2 = translator.translate(source, 'javascript', 'python@2');
    if (show && file.startsWith(show)) {
      console.log(python2);
    }
    const back = translator.toMeta(python2, 'python');
    console.log(
      file,
      sameMeaning(meta, back) || JSON.stringify(meaningDifference(meta, back))
    );
  } catch (error) {
    console.log(file, 'ERROR', error.message);
  }
}
