import { describe, expect, it } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { itUnless, noPosixShell, sandboxed } from './helpers/skip.js';

const gate = resolve('scripts/check-mjs-syntax.sh');

// A failed git call would leave the fixture untracked, and the gate would
// then pass because it never saw the file under test.
function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed (${result.status ?? result.signal}): ${result.error?.message ?? result.stderr}`
    );
  }
  return result.stdout;
}

// Commits the files to a fresh repository and runs the gate there.
function runGate(files) {
  const root = mkdtempSync(join(tmpdir(), 'syntax-gate-'));
  try {
    git(['init', '-q'], root);
    for (const [file, source] of Object.entries(files)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), source);
    }
    git(['add', '.'], root);
    const tracked = git(['ls-files'], root).split('\n').filter(Boolean);
    if (tracked.length !== Object.keys(files).length) {
      throw new Error(`git tracks ${tracked.join(', ')}, not every fixture`);
    }
    return spawnSync('bash', [gate], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30000,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('JavaScript syntax gate', () => {
  for (const files of [
    { 'js/src/index.js': 'const broken = ;' },
    { 'js/tests/nested/check.test.js': 'export const broken = ;' },
    { 'scripts/nested/adapter.cjs': 'module.exports = ;' },
    { 'examples/app/src/main.mjs': 'export const broken = ;' },
  ]) {
    const [file] = Object.keys(files);
    itUnless(sandboxed, noPosixShell)(
      `rejects a syntax error in ${file}`,
      () => {
        const result = runGate({
          'scripts/valid.mjs': 'export const ready = true;',
          ...files,
        });
        // Shows what the gate checked if it ever passes again (Deno, run
        // 45649688140, reported exit 0 once without showing its output).
        expect(result.stdout).toContain(`Checking ${file}...`);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(`::error file=${file}::`);
      }
    );
  }

  // A repository without any JavaScript is not evidence of a pass.
  itUnless(sandboxed, noPosixShell)('rejects an empty inventory', () => {
    const result = runGate({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('found no tracked JavaScript files');
  });

  itUnless(sandboxed, noPosixShell)(
    'checks nested package code and skips archived investigation data',
    () => {
      const result = runGate({
        'js/src/formal/parser.js': 'export const ready = true;',
        'dev/log/issues/1/broken.js': 'const broken = ;',
        'docs/case-studies/issue-1/data/broken.mjs': 'const broken = ;',
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Checking js/src/formal/parser.js');
      expect(result.stdout).toContain('1 file(s), 0 failure(s)');
    }
  );

  it('is the syntax step of the release workflow', () => {
    const workflow = readFileSync(
      '.github/workflows/release.yml',
      'utf8'
    ).replaceAll('\r\n', '\n');
    expect(workflow).toContain(
      '- name: Check tracked JavaScript syntax\n        run: bash scripts/check-mjs-syntax.sh'
    );
  });
});
