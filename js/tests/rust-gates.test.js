import { describe, expect, it } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { itUnless, noPosixShell, sandboxed } from './helpers/skip.js';

const workflow = readFileSync(
  '.github/workflows/release.yml',
  'utf8'
).replaceAll('\r\n', '\n');

function step(name) {
  const start = workflow.indexOf(`- name: ${name}\n`);
  expect(start).toBeGreaterThan(-1);
  const end = workflow.indexOf('\n      - ', start + 1);
  return workflow.slice(start, end === -1 ? undefined : end);
}

// Runs the checker around a shell snippet that stands in for Cargo.
function check(snippet) {
  return spawnSync(
    'bash',
    ['scripts/check-cargo-warnings.sh', 'bash', '-c', snippet],
    { encoding: 'utf8', timeout: 5000 }
  );
}

describe('Rust warning gates', () => {
  it('fails Clippy on Cargo warnings as well as on lints', () => {
    expect(step('Lint Rust')).toContain(
      'run: bash scripts/check-cargo-warnings.sh cargo clippy --locked --all-targets -- -D warnings'
    );
  });

  it('denies rustdoc warnings such as broken intra-doc links', () => {
    const docs = step('Check Rust documentation');
    expect(docs).toContain('RUSTDOCFLAGS: -D warnings');
    expect(docs).toContain('run: cargo doc --locked --no-deps');
  });

  itUnless(sandboxed, noPosixShell)(
    'fails on a warning that Cargo exits 0 for',
    () => {
      const result = check(
        "echo 'warning: unused manifest key: package.bogus' >&2"
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('unused manifest key');
      expect(result.stderr).toContain('::error::Cargo reported warnings');
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'passes clean output and keeps a failing exit status',
    () => {
      const clean = check("echo '    Finished `dev` profile'");
      expect(clean.status).toBe(0);
      expect(clean.stdout).toContain('Finished');
      expect(check('echo "error[E0425]: oops"; exit 101').status).toBe(101);
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'ignores a warning word that does not start a line',
    () => {
      expect(check("echo 'note: no warning: here'").status).toBe(0);
    }
  );
});
