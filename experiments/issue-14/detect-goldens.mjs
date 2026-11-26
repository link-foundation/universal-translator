// Detect the language of every committed golden, one file per process
// argument, and print the time each detection takes.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createTranslator } from '../../js/src/index.js';

const translator = createTranslator();
for (const file of process.argv.slice(2)) {
  const start = performance.now();
  const best = translator.detectLanguage(readFileSync(file, 'utf8'))[0];
  const ms = Math.round(performance.now() - start);
  console.log(
    `${ms}ms\t${file}\t${best?.language ?? best?.id ?? JSON.stringify(best)}`
  );
}
