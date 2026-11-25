// Time parsePartial per Rosetta solution to find slow readings.
import { readFileSync } from 'node:fs';
import { parsePartial } from '../js/src/index.js';
const stored = JSON.parse(
  readFileSync('.cache/rosetta-code/solutions.json', 'utf8')
);
for (const [title, solutions] of Object.entries(stored)) {
  for (const [id, list] of Object.entries(solutions)) {
    const lines = list[0].split('\n').length;
    process.stderr.write(`${title} ${id} ${lines} lines... `);
    const t = Date.now();
    parsePartial(list[0], id);
    process.stderr.write(`${Date.now() - t} ms\n`);
  }
}
