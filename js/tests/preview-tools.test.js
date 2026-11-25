import { describe, expect, it } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { itUnless, noPosixShell, notLinux, sandboxed } from './helpers/skip.js';

const workflow = readFileSync(
  '.github/workflows/example-app.yml',
  'utf8'
).replaceAll('\r\n', '\n');
const installer = readFileSync('scripts/setup-preview-gh.sh', 'utf8');

function jobBlock(name) {
  const lines = workflow.split('\n');
  const start = lines.indexOf(`  ${name}:`);
  if (start === -1) {
    return '';
  }
  const end = lines.findIndex(
    (line, index) => index > start && /^ {2}[a-zA-Z0-9_-]+:\s*$/.test(line)
  );
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

const containerImage = (block) =>
  block.match(/image: (mcr\.microsoft\.com\/playwright@sha256:[0-9a-f]+)/)?.[1];

describe('preview container jobs', () => {
  // The writer runs only on main, so the pull request job is the only place
  // a broken preview script or container tool can fail before merge.
  it('renders the preview images on pull requests in the writer container', () => {
    const check = jobBlock('preview-check');
    const writer = jobBlock('preview-regen');
    expect(check).not.toBe('');
    expect(containerImage(check)).toBe(containerImage(writer));
    expect(check).toContain("if: github.event_name == 'pull_request'");
    expect(check).toContain('contents: read');
    expect(check).not.toContain('contents: write');
    expect(check).toContain('cancel-in-progress: true');
    expect(check).toContain('run: node scripts/update-preview-images.mjs');
    expect(/git push|push-main|git commit/.test(check)).toBe(false);
    expect(jobBlock('pipeline-status')).toContain('- preview-check');
  });

  it('runs container steps with bash and the tools the writer needs', () => {
    for (const block of [
      jobBlock('preview-check'),
      jobBlock('preview-regen'),
    ]) {
      // Container jobs default to sh, where [[ ]] fails as "not found".
      expect(block).toMatch(/defaults:\n\s+run:\n\s+shell: bash/);
      expect(block).toContain('safe.directory "$GITHUB_WORKSPACE"');
      const install = block.indexOf('bash scripts/setup-preview-gh.sh');
      expect(install).toBeGreaterThan(-1);
      expect(
        block.indexOf('bash scripts/check-preview-tools.sh')
      ).toBeGreaterThan(install);
    }
  });

  it('stages strictly and reports the outcome of each writer step', () => {
    const writer = jobBlock('preview-regen');
    expect(writer).toContain('git add -- docs/screenshots/example-app/');
    expect(writer).not.toContain('|| true');
    expect(writer).toContain('REGENERATE: ${{ steps.regenerate.outcome }}');
    expect(writer).toContain('LANDED: ${{ steps.commit.outputs.landed }}');
  });

  it('verifies the pinned release bytes before extracting or exposing the CLI', () => {
    expect(installer).toContain('set -euo pipefail');
    expect(installer).toMatch(/version=\d+\.\d+\.\d+/);
    expect(installer).toMatch(/checksum=[0-9a-f]{64}\n/);
    expect(installer.indexOf('sha256sum --check')).toBeLessThan(
      installer.indexOf('tar -xzf')
    );
    expect(installer.indexOf('tar -xzf')).toBeLessThan(
      installer.indexOf('>> "$GITHUB_PATH"')
    );
  });

  itUnless(sandboxed, noPosixShell)(
    'reports a missing CLI before attempting credential setup',
    () => {
      const directory = mkdtempSync(join(tmpdir(), 'preview-tools-'));
      try {
        for (const tool of ['bash', 'curl', 'git']) {
          const location = spawnSync('bash', ['-c', `command -v ${tool}`], {
            encoding: 'utf8',
          }).stdout.trim();
          symlinkSync(location, join(directory, tool));
        }
        const result = spawnSync('bash', ['scripts/check-preview-tools.sh'], {
          encoding: 'utf8',
          env: { ...process.env, PATH: directory },
          timeout: 5000,
        });
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('missing required tool: gh');
        expect(result.stdout).not.toContain('verified');
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  );

  itUnless(
    sandboxed,
    noPosixShell,
    notLinux
  )('stops a bad download before extraction or PATH registration', () => {
    const directory = mkdtempSync(join(tmpdir(), 'preview-download-'));
    try {
      const shim = join(directory, 'download.sh');
      writeFileSync(
        shim,
        `curl() { printf 'invalid archive' > "\${@: -1}"; }\ntar() { echo 'unexpected extraction'; }\nexport -f curl tar\n${installer}`
      );
      const pathFile = join(directory, 'paths');
      writeFileSync(pathFile, '');
      const result = spawnSync('bash', [shim], {
        encoding: 'utf8',
        env: { ...process.env, RUNNER_TEMP: directory, GITHUB_PATH: pathFile },
        timeout: 5000,
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('archive checksum mismatch');
      expect(result.stdout).not.toContain('unexpected extraction');
      expect(readFileSync(pathFile, 'utf8')).toBe('');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('runs pull request and push checks when a preview helper changes', () => {
    for (const file of [
      'setup-preview-gh.sh',
      'check-preview-tools.sh',
      'push-main-with-rebase-retry.mjs',
      'run-with-budget-warning.sh',
      'update-preview-images.mjs',
    ]) {
      const listed = workflow.split(`- 'scripts/${file}'`).length - 1;
      expect(`${file} ${listed}`).toBe(`${file} 2`);
    }
  });
});
