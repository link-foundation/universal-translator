// Run the artifact regression against the default branch without changing it.
// Usage: node experiments/verify-package-rename.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const fixture = mkdtempSync(join(tmpdir(), 'before-package-rename-'));
try {
  const paths = execFileSync(
    'git',
    [
      'ls-tree',
      '-r',
      '--name-only',
      'origin/main',
      '--',
      'package.json',
      'bin',
      'src',
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
    ],
    { encoding: 'utf8' }
  )
    .trim()
    .split('\n');
  for (const path of paths) {
    const target = join(fixture, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, execFileSync('git', ['show', `origin/main:${path}`]));
  }
  const result = spawnSync(
    process.execPath,
    [
      '--test',
      '--test-timeout=30000',
      resolve('tests/package-artifact.test.js'),
    ],
    { cwd: fixture, encoding: 'utf8' }
  );
  console.log(result.stdout);
  assert.equal(
    result.status,
    1,
    'The original artifact must fail the regression'
  );
  assert.match(result.stdout, /universal-translator/);
  console.log(
    'Confirmed: the original artifact fails the renamed-package regression.'
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
