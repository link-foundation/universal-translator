import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { extractSolutions } from '../scripts/rosetta-code.mjs';

const { values } = parseArgs({
  options: {
    'rust-translator': { type: 'string' },
    revision: { type: 'string' },
  },
});
const cli = fileURLToPath(
  new URL('../bin/universal-translator.js', import.meta.url)
);
const translators = [['JavaScript', process.execPath, [cli]]];
if (values['rust-translator']) {
  translators.push(['Rust', values['rust-translator'], []]);
}
const cases = [
  {
    title: 'Rust printing and argument order',
    source: readFileSync(
      new URL('../examples/printing/rust-format.rs', import.meta.url),
      'utf8'
    ),
    targets: ['rust'],
    stdout:
      '{second} is first with third/Fox\ncall 1\ncall 2\n2/1/2\n  wide\ncall 3\ncall 4\n3/4\nline\n\n\n',
  },
];
if (values.revision) {
  const title = 'String interpolation (included)';
  const revid = 416065;
  const { query } = JSON.parse(readFileSync(values.revision, 'utf8'));
  const page = query.pages.find((candidate) => candidate.title === title);
  const revision = page?.revisions.find(
    (candidate) => candidate.revid === revid
  );
  assert.ok(revision, `Missing revision ${revid} for ${title}`);
  const [source] = extractSolutions(revision.slots.main.content).rust;
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  assert.equal(
    sourceSha256,
    '7b37cacbcadf2aa71da15467792d9645edc4ea64c30ea5cad3e68cc671f68ba8'
  );
  cases.push({
    title,
    revid,
    sourceSha256,
    source,
    targets: ['rust', 'python'],
    stdout: 'Mary had a little lamb\n'.repeat(3),
  });
}

const temporary = mkdtempSync(join(tmpdir(), 'ut-rust-print-'));
const options = { encoding: 'utf8', maxBuffer: 64 * 1024 };
try {
  const file = join(temporary, 'printing.rs');
  const executable = join(temporary, 'printing');
  function runRust(program) {
    writeFileSync(file, program);
    execFileSync(
      process.env.RUSTC ?? 'rustc',
      ['--edition=2021', file, '-o', executable],
      options
    );
    return execFileSync(executable, [], options);
  }
  for (const { source, targets, ...evidence } of cases) {
    assert.equal(runRust(source), evidence.stdout, evidence.title);
    for (const [engine, command, args] of translators) {
      for (const target of targets) {
        const generated = execFileSync(
          command,
          [...args, 'translate', 'rust', target, '-', '--all-or-nothing'],
          { ...options, input: source }
        );
        const actual =
          target === 'rust'
            ? runRust(generated)
            : execFileSync(process.env.PYTHON ?? 'python3', ['-'], {
                ...options,
                input: generated,
              });
        assert.equal(
          actual,
          evidence.stdout,
          `${evidence.title}: ${engine} → ${target}`
        );
        console.log(JSON.stringify({ ...evidence, engine, target }));
        if (target === 'python') {
          const restored = execFileSync(
            command,
            [...args, 'translate', 'python', 'rust', '-', '--all-or-nothing'],
            { ...options, input: generated }
          );
          assert.equal(runRust(restored), evidence.stdout, evidence.title);
          console.log(
            JSON.stringify({ ...evidence, engine, target: 'rust', via: target })
          );
        }
      }
    }
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
