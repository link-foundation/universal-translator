// Reads every wording of declare, assign, increase, decrease and print-line
// of every base natural language back to JavaScript, in JavaScript and, when
// a Rust binary is given, in Rust too (issue 6, item 10).
//   node experiments/issue-14/everyday-wordings.mjs [rust-binary]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { translate } from '../../js/src/index.js';
import {
  naturalLanguage,
  naturalLanguageIds,
} from '../../js/src/natural/catalog.js';

const rustBinary = process.argv[2];
const folder = mkdtempSync(join(tmpdir(), 'everyday-'));
const expected = {
  declare: 'const n = 2;',
  assign: 'n = 2;',
  increase: 'n += 2;',
  decrease: 'n -= 2;',
  'print-line': 'console.log(n);',
};
let failures = 0;
let checked = 0;
for (const id of naturalLanguageIds()) {
  const language = naturalLanguage(id);
  if (language.base) {
    continue;
  }
  const declare = translate('let n = 0;\n', 'javascript', id).trim();
  for (const [key, want] of Object.entries(expected)) {
    for (const wording of language.templates[key] ?? []) {
      const sentence =
        wording
          .replace('{name}', 'n')
          .replace('{value}', key === 'print-line' ? 'n' : '2') +
        language.sentenceEnd;
      const text =
        key === 'declare' ? `${sentence}\n` : `${declare}\n${sentence}\n`;
      const lines = (output) => output.trim().split('\n').at(-1);
      let got;
      try {
        got = lines(translate(text, id, 'javascript'));
      } catch (error) {
        got = `error: ${error.message}`;
      }
      checked += 1;
      if (got !== want) {
        failures += 1;
        console.log(`${id} ${key} «${sentence}»: ${got}`);
      }
      if (rustBinary) {
        const file = join(folder, 'text.txt');
        writeFileSync(file, text);
        let rust;
        try {
          rust = lines(
            execFileSync(rustBinary, ['translate', id, 'javascript', file], {
              encoding: 'utf8',
              stdio: 'pipe',
            })
          );
        } catch (error) {
          rust = `error: ${error.stderr}`;
        }
        if (rust !== got) {
          failures += 1;
          console.log(
            `${id} ${key} «${sentence}»: Rust ${rust}, JavaScript ${got}`
          );
        }
      }
    }
  }
}
console.log(`${checked} wordings checked, ${failures} failures`);
process.exitCode = failures ? 1 : 0;
