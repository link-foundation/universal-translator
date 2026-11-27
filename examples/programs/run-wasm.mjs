#!/usr/bin/env node
// Assemble a WebAssembly text file with wat2wasm (WABT; WAT2WASM names the
// executable when it is not on PATH) and run its exported main function. The
// host provides the print_integer, print_text and print_newline imports and
// writes what they print to standard output.
//
//   node examples/programs/run-wasm.mjs program.wat

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function runWat(file) {
  const directory = mkdtempSync(join(tmpdir(), 'wat-'));
  try {
    const binary = join(directory, 'program.wasm');
    const assembled = spawnSync(
      process.env.WAT2WASM || 'wat2wasm',
      [file, '-o', binary],
      { encoding: 'utf8' }
    );
    if (assembled.status !== 0) {
      throw new Error(assembled.stderr || String(assembled.error));
    }
    return await runWasm(readFileSync(binary));
  } finally {
    rmSync(directory, { recursive: true });
  }
}

export async function runWasm(bytes) {
  let output = '';
  const host = {};
  const decoder = new globalThis.TextDecoder();
  const { instance } = await globalThis.WebAssembly.instantiate(bytes, {
    env: {
      print_integer: (value) => {
        output += String(value);
      },
      print_text: (address, length) => {
        output += decoder.decode(
          new Uint8Array(host.memory.buffer, address, length)
        );
      },
      print_newline: () => {
        output += '\n';
      },
    },
  });
  host.memory = instance.exports.memory;
  instance.exports.main();
  return output;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(await runWat(process.argv[2]));
}
