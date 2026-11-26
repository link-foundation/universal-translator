// Time reading one file as one language, whole and partially:
// node experiments/issue-14/detect-one.mjs <file> <language>
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createTranslator } from '../../js/src/index.js';

const [file, id] = process.argv.slice(2);
const source = readFileSync(file, 'utf8');
const translator = createTranslator();
for (const [label, run] of [
  ['whole', () => translator.parseFragment(source, id)],
  ['partial', () => translator.parsePartial(source, id).coverage],
]) {
  const start = performance.now();
  let result;
  try {
    result = run();
    result = typeof result === 'number' ? result : 'ok';
  } catch (error) {
    result = `throws ${error.message.slice(0, 50)}`;
  }
  console.log(
    `${id}\t${label}\t${Math.round(performance.now() - start)}ms\t${result}`
  );
}
