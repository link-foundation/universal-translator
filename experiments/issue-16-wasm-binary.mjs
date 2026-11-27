import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runWasm, runWat } from '../examples/programs/run-wasm.mjs';

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const fixture = path('../examples/programs/binary/wasm-stack.wasm');
const textFixture = path('../examples/programs/binary/wasm-stack.wat');
const cli = path('../bin/universal-translator.js');
const bytes = readFileSync(fixture);
const output = await runWasm(bytes);
assert.equal(output, '0\n9\n137\n-3\n-1\n0\n0\n');
assert.equal(await runWat(textFixture), output);

const translators = [[process.execPath, [cli]]];
if (process.env.WASM_RUST_TRANSLATOR) {
  translators.push([process.env.WASM_RUST_TRANSLATOR, []]);
}
const targets = [
  ['javascript', process.execPath, ['--input-type=module']],
  ['python', process.env.PYTHON || 'python3', ['-']],
];
for (const [binary, args] of translators) {
  for (const [target, executor, executionArgs] of targets) {
    const translated = execFileSync(
      binary,
      [...args, 'translate', 'wasm', target, fixture],
      { encoding: 'utf8' }
    );
    assert.equal(
      execFileSync(binary, [...args, 'translate', 'wasm', target, '-'], {
        input: bytes,
        encoding: 'utf8',
      }),
      translated
    );
    assert.equal(
      execFileSync(executor, executionArgs, {
        input: translated,
        encoding: 'utf8',
      }),
      output
    );
    process.stdout.write(
      `PASS WebAssembly binary → ${target} using ${binary}\n`
    );
  }
}
