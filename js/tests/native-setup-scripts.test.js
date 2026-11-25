import { describe, expect, it } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { itUnless, noPosixShell, sandboxed } from './helpers/skip.js';

// The install and smoke-test steps run scripts, so a shellcheck job and these
// tests can check what used to be inline workflow text.
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

function writeStub(file, body) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(file, 0o755);
}

// Runs a script with stub commands placed first on the PATH; `home` stubs
// are written below the temporary HOME.
function runWithStubs(script, stubs, { args = [], env = {}, home = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'native-setup-'));
  try {
    for (const [command, body] of Object.entries(stubs)) {
      writeStub(join(root, 'bin', command), body);
    }
    for (const [file, body] of Object.entries(home)) {
      writeStub(join(root, file), body);
    }
    const log = join(root, 'calls.log');
    writeFileSync(log, '');
    const githubPath = join(root, 'github-path');
    const githubEnv = join(root, 'github-env');
    const result = spawnSync('bash', [resolve(script), ...args], {
      encoding: 'utf8',
      timeout: 30000,
      env: {
        ...process.env,
        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        HOME: root,
        RUNNER_TEMP: root,
        GITHUB_PATH: githubPath,
        GITHUB_ENV: githubEnv,
        CALLS: log,
        ...env,
      },
    });
    const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
    return {
      ...result,
      root,
      calls: read(log),
      githubPath: read(githubPath),
      githubEnv: read(githubEnv),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('native translation setup scripts', () => {
  it('runs the scripts from the workflow steps', () => {
    expect(step('Install Dart, Julia, Scala, Groovy and Zig')).toContain(
      'run: bash scripts/install-native-archives.sh'
    );
    const provers = step('Install Lean and Rocq');
    expect(provers).toContain(
      'CACHE_HIT: ${{ steps.provers-cache.outputs.cache-hit }}'
    );
    expect(provers).toContain('run: bash scripts/install-provers.sh');
    const smoke = step('Smoke test the Docker image');
    expect(smoke).toContain('IMAGE: pr-check:${{ github.sha }}');
    expect(smoke).toContain(
      'run: bash scripts/smoke-test-docker-image.sh "$IMAGE"'
    );
  });

  it('pins a SHA-256 sum for every archive it downloads', () => {
    const script = readFileSync('scripts/install-native-archives.sh', 'utf8');
    const fetches = script.match(/^fetch /gm) ?? [];
    expect(fetches.length).toBe(5);
    expect(script.match(/ [0-9a-f]{64}$/gm)?.length).toBe(5);
  });

  itUnless(sandboxed, noPosixShell)(
    'fails with an annotation when no source of an archive answers',
    () => {
      const result = runWithStubs('scripts/install-native-archives.sh', {
        curl: 'echo "curl $*" >> "$CALLS"; exit 22',
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('::error::Could not download dart.zip');
      expect(result.calls).toContain('dartsdk-linux-x64-release.zip');
      expect(result.githubPath).toBe('');
      expect(result.githubEnv).toBe('');
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'reuses cached provers without downloading them',
    () => {
      const version = 'echo "$0 --version" >> "$CALLS"';
      const result = runWithStubs(
        'scripts/install-provers.sh',
        { curl: 'echo curl >> "$CALLS"; exit 22', opam: 'exit 1' },
        {
          env: { CACHE_HIT: 'true' },
          home: { '.elan/bin/lean': version, '.opam/rocq/bin/rocq': version },
        }
      );
      expect(result.status).toBe(0);
      expect(result.calls).not.toContain('curl');
      expect(result.calls).toContain('/.elan/bin/lean --version');
      expect(result.calls).toContain('/.opam/rocq/bin/rocq --version');
      expect(result.githubPath).toContain('/.elan/bin\n');
      expect(result.githubPath).toContain('/.opam/rocq/bin\n');
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'installs the provers when the cache missed',
    () => {
      const result = runWithStubs(
        'scripts/install-provers.sh',
        { curl: 'echo "curl $*" >> "$CALLS"; exit 22' },
        { env: { CACHE_HIT: 'false' } }
      );
      expect(result.status).toBe(22);
      expect(result.calls).toContain('elan-init.sh');
      expect(result.githubPath).toBe('');
    }
  );

  const dockerStub = [
    'echo "docker $*" >> "$CALLS"',
    'case "$1 $2" in',
    '  "run --rm") cat > /dev/null; echo \'print("Hi")\' ;;',
    '  "run -d") echo container-id ;;',
    'esac',
  ].join('\n');

  itUnless(sandboxed, noPosixShell)(
    'passes an image that translates over its CLI and HTTP',
    () => {
      const result = runWithStubs(
        'scripts/smoke-test-docker-image.sh',
        {
          docker: dockerStub,
          curl: 'case "$*" in *languages*) echo \'["python"]\' ;; *) echo \'println!("Hi");\' ;; esac',
        },
        { args: ['pr-check:abc'] }
      );
      expect(result.status).toBe(0);
      expect(result.calls).toContain('docker run --rm -i pr-check:abc');
      expect(result.calls).toMatch(/docker rm -f smoke-test-\d+/);
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'removes the server container when a check fails',
    () => {
      const result = runWithStubs(
        'scripts/smoke-test-docker-image.sh',
        {
          docker: dockerStub,
          curl: 'case "$*" in *languages*) echo \'["python"]\' ;; *) echo broken ;; esac',
        },
        { args: ['pr-check:abc'] }
      );
      expect(result.status).toBe(1);
      expect(result.calls).toMatch(/docker rm -f smoke-test-\d+/);
    }
  );
});
