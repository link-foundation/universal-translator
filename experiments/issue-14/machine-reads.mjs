// Which machine dialect readers accept which committed goldens: a machine
// dialect is a detection candidate only if its reader rejects other
// languages. node experiments/issue-14/machine-reads.mjs <files...>
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createTranslator } from '../../js/src/index.js';
import { machineTargetIds } from '../../js/src/formal/machine.js';

const translator = createTranslator();
for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, 'utf8');
  const accepted = [];
  const start = performance.now();
  for (const id of machineTargetIds) {
    try {
      translator.parseFragment(source, id);
      accepted.push(id);
    } catch {
      // rejected
    }
  }
  const ms = Math.round(performance.now() - start);
  console.log(`${ms}ms\t${file}\t${accepted.join(' ')}`);
}
