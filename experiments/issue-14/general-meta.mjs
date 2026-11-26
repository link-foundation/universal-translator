// Every example program: generalize then specialize gives the same tree,
// and fromMeta of the general form writes the same text.
import { isDeepStrictEqual } from 'node:util';
import { readdirSync, readFileSync } from 'node:fs';
import {
  createTranslator,
  generalize,
  specialize,
} from '../../js/src/index.js';

const translator = createTranslator();
const dir = new URL('../../examples/programs/', import.meta.url);
let checked = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const text = readFileSync(new URL(file, dir), 'utf8');
  const meta = translator.toMeta(text, 'javascript');
  const back = specialize(generalize(meta));
  if (!isDeepStrictEqual(back, meta)) {
    console.log('tree differs', file);
  }
  for (const to of ['python', 'c', 'rust', 'english']) {
    if (
      translator.fromMeta(generalize(meta), to, { from: 'javascript' }) !==
      translator.translate(text, 'javascript', to)
    ) {
      console.log('text differs', file, to);
    }
  }
  checked++;
}
console.log('checked', checked);
