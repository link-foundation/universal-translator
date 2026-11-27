// Finite writer regression: comment text must not close PHP code mode.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslator } from '../js/src/index.js';
const before = process.argv.includes('--before');
let emit;
if (before) {
  const source = execFileSync(
    'git',
    ['show', 'bb09ccd:js/src/formal/emitter.js'],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    }
  ).replace(
    /from '([.][^']+)'/g,
    (_, relative) =>
      `from ${JSON.stringify(new URL(relative, new URL('../js/src/formal/emitter.js', import.meta.url)).href)}`
  );
  ({ emitProgram: emit } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  ));
}
const translator = createTranslator(emit ? { emit } : {});
const source = readFileSync(
  new URL('../examples/runtime-headers/comment-tags.py', import.meta.url),
  'utf8'
);
const php = translator.translate(source, 'python', 'php');
const expected = 'one\ntwo\nthree\n';
const directory = mkdtempSync(join(tmpdir(), 'translator-comment-tags-'));
let native;
try {
  const file = join(directory, 'comments.php');
  writeFileSync(file, php);
  native = spawnSync('php', ['-d', 'memory_limit=32M', file], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024,
  });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log(
  JSON.stringify(
    {
      writer: before ? 'bb09ccd' : 'current',
      php,
      expected,
      status: native.status,
      stdout: native.stdout,
      stderr: native.stderr,
    },
    null,
    2
  )
);
process.exitCode = Number(
  Boolean(native.error) || native.status !== 0 || native.stdout !== expected
);
