// Write the expected translations of the layout examples: every
// `to-<language>.txt` next to a `from-<language>.txt` is the fragment
// translation of the source with the layout of the source (the default of
// the command line, the server and the web demo).
//
//   node examples/layout/write-layout.mjs [--check]
//
// The JavaScript and the Rust tests read the same files.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { translatePartial } from '../../js/src/index.js';

const folder = dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes('--check');

export function layoutCases() {
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap(({ name }) => {
      const files = readdirSync(join(folder, name));
      const source = files.find((file) => file.startsWith('from-'));
      const from = source.slice('from-'.length, -'.txt'.length);
      return files
        .filter((file) => file.startsWith('to-'))
        .map((file) => ({
          name,
          from,
          to: file.slice('to-'.length, -'.txt'.length),
          source: readFileSync(join(folder, name, source), 'utf8'),
          path: join(folder, name, file),
        }));
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let stale = 0;
  for (const item of layoutCases()) {
    const { text } = translatePartial(item.source, item.from, item.to, {
      fragment: true,
    });
    if (check) {
      if (readFileSync(item.path, 'utf8') !== text) {
        stale += 1;
        console.error(`stale: ${item.path}`);
      }
    } else {
      writeFileSync(item.path, text);
    }
  }
  process.exitCode = stale ? 1 : 0;
}
