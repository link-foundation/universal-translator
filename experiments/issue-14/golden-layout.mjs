// Which committed translations of the golden tasks match the default
// (source) layout and which only the target layout.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

import { extensions } from '../../examples/programs/verify-native.mjs';

const cli = (args) =>
  execFileSync('node', ['bin/universal-translator.js', ...args], {
    encoding: 'utf8',
  });
const ids = cli(['languages'])
  .trim()
  .split('\n')
  .map((line) => line.split('\t'))
  .filter(([, label]) => !label.endsWith('(natural)'))
  .map(([id]) => id);
for (const task of process.argv.slice(2)) {
  for (const id of ids) {
    const ext = extensions?.[id];
    const golden = `examples/programs/translated/${task}/${task}${ext}`;
    if (!ext || !existsSync(golden)) {
      console.log('no golden', task, id);
      continue;
    }
    const want = readFileSync(golden, 'utf8');
    const source = `examples/programs/${task}.js`;
    const plain = cli(['translate', 'javascript', id, source]);
    const target = cli([
      'translate',
      'javascript',
      id,
      source,
      '--layout',
      'target',
    ]);
    console.log(
      task,
      id,
      plain === want ? 'source' : target === want ? 'TARGET' : 'NEITHER'
    );
  }
}
