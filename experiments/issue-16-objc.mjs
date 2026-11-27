import { readFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
const translator = createTranslator();
const source = readFileSync(
  new URL('./issue-14/hello-objc.m', import.meta.url),
  'utf8'
);
const meta = translator.toMeta(source, 'objc');
console.log(JSON.stringify(meta, null, 2));
for (const target of ['python', 'javascript', 'rust']) {
  console.log(target, translator.fromMeta(meta, target));
}
