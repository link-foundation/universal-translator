// Time one parseFragment of a cached Rosetta solution prefix: node ... title lang lines
import { readFileSync } from 'node:fs';
import { parseFragment } from '../js/src/index.js';
const [title, id, n = 1000] = process.argv.slice(2);
const code = JSON.parse(
  readFileSync('.cache/rosetta-code/solutions.json', 'utf8')
)[title][id][0];
const text = `${code.split('\n').slice(0, Number(n)).join('\n')}\n`;
const t = Date.now();
try {
  parseFragment(text, id);
  console.log('ok');
} catch (e) {
  console.log('fail', String(e.message).split('\n')[0]);
}
console.log(Date.now() - t, 'ms');
