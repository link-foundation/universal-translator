import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { extractSolutions } from '../scripts/rosetta-code.mjs';

const { values } = parseArgs({
  options: {
    revision: { type: 'string' },
    'rust-translator': { type: 'string' },
  },
});
let source = readFileSync(
  new URL('../examples/programs/library/c-stdio-stream.c', import.meta.url),
  'utf8'
);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (values.revision) {
  const { query } = JSON.parse(readFileSync(values.revision, 'utf8'));
  const page = query.pages.find(
    ({ title }) => title === 'Copy stdin to stdout'
  );
  const revision = page?.revisions.find(({ revid }) => revid === 417213);
  assert.ok(revision, 'Expected revision 417213 of Copy stdin to stdout');
  [source] = extractSolutions(revision.slots.main.content).c;
  assert.equal(
    digest(source),
    '563b6eb0a68c96ec2743b38e5c86da4259ea324dc002fd227c7cae75d9bedb8b'
  );
}

const cli = fileURLToPath(
  new URL('../bin/universal-translator.js', import.meta.url)
);
const translators = [['JavaScript', process.execPath, [cli]]];
if (values['rust-translator']) {
  translators.push(['Rust', values['rust-translator'], []]);
}
const directory = mkdtempSync(join(tmpdir(), 'translator-c-stdio-'));
const file = join(directory, 'program.c');
const binary = join(directory, 'program');
const options = { maxBuffer: 32 * 1024 };
const input = Buffer.concat([
  Buffer.from(' first line\n\n\tsecond line\n'),
  Buffer.from([0, 128, 255]),
  Buffer.from('tail\n'),
]);
const run = (program) => {
  writeFileSync(file, program);
  execFileSync(
    process.env.CC ?? 'cc',
    [
      '-std=c99',
      '-pedantic-errors',
      '-Wall',
      '-Wextra',
      '-Werror',
      file,
      '-o',
      binary,
    ],
    options
  );
  return execFileSync(binary, [], { ...options, input });
};

try {
  const original = run(source);
  assert.deepEqual(original, input);
  for (const [engine, command, args] of translators) {
    const emitted = execFileSync(
      command,
      [...args, 'translate', 'c', 'c', '-', '--all-or-nothing'],
      { ...options, input: source, encoding: 'utf8' }
    );
    const result = run(emitted);
    assert.deepEqual(result, original, engine);
    console.log(
      JSON.stringify({
        engine,
        ...(values.revision ? { revid: 417213 } : {}),
        sourceSha256: digest(source),
        bytes: result.length,
        stdoutSha256: digest(result),
      })
    );
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
