import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';
import { itUnless, noPosixShell, sandboxed } from './helpers/skip.js';

// The CI job installs ShellCheck; elsewhere it is optional.
const noShellcheck =
  spawnSync('shellcheck', ['--version']).status === 0
    ? null
    : 'shellcheck is not on PATH';

function readWorkflow(filePath) {
  return readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n');
}

const activeWorkflows = [
  '.github/workflows/example-app.yml',
  '.github/workflows/links.yml',
  '.github/workflows/release.yml',
  '.github/workflows/security.yml',
  '.github/workflows/workflows.yml',
];

const workflowsWorkflow = readWorkflow('.github/workflows/workflows.yml');
const releaseWorkflow = readWorkflow('.github/workflows/release.yml');
const exampleAppWorkflow = readWorkflow('.github/workflows/example-app.yml');
const zizmorConfig = readFileSync('.github/zizmor.yml', 'utf8');

describe('workflow linting job', () => {
  it('uses the supported Ubuntu 24.04 label for every Linux job', () => {
    const unpinned = activeWorkflows.filter((filePath) =>
      readWorkflow(filePath).includes('ubuntu-latest')
    );

    expect(unpinned).toEqual([]);
  });

  // This job is what reports the shellcheck findings asserted below.
  it('runs actionlint from the Docker image that bundles shellcheck', () => {
    expect(workflowsWorkflow).toContain('uses: docker://rhysd/actionlint@');
    expect(workflowsWorkflow).toContain('shellcheck');
  });

  // A mutable tag of a repository we do not control is arbitrary code
  // execution in any job that holds credentials; the tag form also evades
  // the `'*': hash-pin` policy in .github/zizmor.yml, because the audit
  // that covers container references (unpinned-images) is Pedantic-persona.
  it('pins the actionlint image to a digest, not a tag', () => {
    const uses = Array.from(
      workflowsWorkflow.matchAll(
        /^\s*- uses: (docker:\/\/rhysd\/actionlint@\S+) # (.+)$/gm
      ),
      (match) => `${match[1]} # ${match[2]}`
    );

    expect(uses.length).toBe(1);
    expect(uses[0]).toMatch(
      /^docker:\/\/rhysd\/actionlint@sha256:[0-9a-f]{64} # v\d+\.\d+\.\d+$/
    );
  });

  it('documents the local actionlint reproduction against the pinned release', () => {
    expect(workflowsWorkflow).toContain(
      'docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -color'
    );
  });

  it('runs zizmor against the repository configuration', () => {
    expect(workflowsWorkflow).toContain('uses: zizmorcore/zizmor-action@');
    expect(workflowsWorkflow).toContain('config: .github/zizmor.yml');
    expect(zizmorConfig).toContain('unpinned-uses');
  });

  // zizmor-action resolves the version from a static table shipped inside
  // the action, and `latest` there is frozen at the version current when
  // the action was tagged (v0.6.4 -> zizmor 1.30.1). Naming the version
  // keeps the analyser that reproduces a CI finding pinned in the diff.
  it('pins the zizmor version the action installs', () => {
    const zizmorStep = workflowsWorkflow.slice(
      workflowsWorkflow.indexOf('zizmorcore/zizmor-action@')
    );

    expect(zizmorStep).toMatch(/version: \d+\.\d+\.\d+/);
    expect(zizmorStep).toMatch(/min-confidence: low/);
  });

  // The unpinned-images audit that covers `uses: docker://` and `container:`
  // references is Pedantic-persona, so the regular pass above never runs it.
  it('adds a narrow pedantic pass for the pedantic-only audits', () => {
    expect(workflowsWorkflow).toContain('--persona pedantic');
    expect(workflowsWorkflow).toContain('--min-severity high');
    expect(workflowsWorkflow).toContain('--min-confidence high');
  });

  it('bounds every job with a timeout backstop', () => {
    const timeouts = workflowsWorkflow.match(/^ {4}timeout-minutes: \d+$/gm);

    expect(timeouts).toEqual([
      '    timeout-minutes: 10',
      '    timeout-minutes: 10',
      '    timeout-minutes: 10',
      '    timeout-minutes: 10',
      '    timeout-minutes: 5',
    ]);
  });
});

describe('standalone shell scripts under shellcheck', () => {
  // actionlint only sees `run:` blocks, so a script the workflows call by
  // path, such as scripts/install-provers.sh, went unchecked.
  it('checks every tracked shell script and hook in a gated job', () => {
    const job = workflowsWorkflow.slice(
      workflowsWorkflow.indexOf('\n  shellcheck:\n'),
      workflowsWorkflow.indexOf('\n  status-gate-coverage:\n')
    );
    expect(job).toContain('shellcheck-py==0.11.0.1');
    expect(job).toContain(
      `git ls-files -z '*.sh' '.husky/*' | xargs -0 "$RUNNER_TEMP/shellcheck-venv/bin/shellcheck"`
    );
    const gate = workflowsWorkflow.slice(
      workflowsWorkflow.indexOf('\n  pipeline-status:\n')
    );
    expect(gate).toContain('      - shellcheck\n');
  });

  it('runs the workflow when a shell script or hook changes', () => {
    for (const trigger of ['push:', 'pull_request:']) {
      const paths = workflowsWorkflow.slice(
        workflowsWorkflow.indexOf(trigger),
        workflowsWorkflow.indexOf('workflow_dispatch:')
      );
      expect(paths).toContain("      - '**.sh'\n");
      expect(paths).toContain("      - '**/.shellcheckrc'\n");
      expect(paths).toContain("      - '.husky/**'\n");
    }
  });

  // The workflow's pedantic zizmor pass can hang on the GitHub API; the
  // wrapper warns before the step timeout turns it into a cancellation.
  it('runs the pedantic zizmor pass inside a budget', () => {
    expect(workflowsWorkflow).toContain(
      'bash scripts/run-with-budget-warning.sh 360 "Pedantic zizmor audit" pipx run zizmor==1.30.1'
    );
  });

  itUnless(
    sandboxed,
    noPosixShell,
    noShellcheck
  )('finds nothing in the tracked scripts and hooks', () => {
    const files = spawnSync('git', ['ls-files', '*.sh', '.husky/*'], {
      encoding: 'utf8',
    })
      .stdout.split('\n')
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    const result = spawnSync('shellcheck', files, {
      encoding: 'utf8',
      timeout: 60000,
    });
    expect(result.stdout).toBe('');
    expect(result.status).toBe(0);
  });
});

describe('shell blocks under shellcheck', () => {
  // SC2046: an array passes one argument per digest explicitly, so the list
  // does not depend on word splitting a command substitution.
  it('builds the manifest digest list as an array', () => {
    expect(releaseWorkflow).toContain(
      'mapfile -t digests < <(printf "${IMAGE}@sha256:%s\\n" *)'
    );
    expect(releaseWorkflow).toContain('"${digests[@]}"');
    expect(releaseWorkflow).not.toContain('$(printf "${IMAGE}@sha256:%s " *)');
  });

  // SC2034: the retry counter is used, so the log shows which attempt a flaky
  // packaging step is on.
  it('reports the packaging attempt number', () => {
    expect(exampleAppWorkflow).toContain(
      'echo "Waiting for the packaged app (attempt ${attempt}/30)"'
    );
  });
});

describe('third-party actions', () => {
  // zizmor unpinned-uses: only the publishers listed in .github/zizmor.yml may
  // be referenced by tag; everything else is pinned to a full commit hash.
  it('pins actions outside the trusted publishers to a commit hash', () => {
    const trusted =
      /^(actions|github|docker|astral-sh|lycheeverse|zizmorcore|changesets)\//;
    const unpinned = [];

    for (const [filePath, workflow] of Object.entries({
      '.github/workflows/release.yml': releaseWorkflow,
      '.github/workflows/example-app.yml': exampleAppWorkflow,
      '.github/workflows/workflows.yml': workflowsWorkflow,
      '.github/workflows/links.yml': readWorkflow(
        '.github/workflows/links.yml'
      ),
      '.github/workflows/security.yml': readWorkflow(
        '.github/workflows/security.yml'
      ),
    })) {
      for (const match of workflow.matchAll(/^\s*(?:- )?uses: (\S+)$/gm)) {
        const [, reference] = match;

        // Local composite actions and Docker references carry no upstream ref.
        if (
          reference.startsWith('./') ||
          reference.startsWith('docker://') ||
          trusted.test(reference)
        ) {
          continue;
        }

        if (!/@[0-9a-f]{40}$/.test(reference)) {
          unpinned.push(`${filePath}: ${reference}`);
        }
      }
    }

    expect(unpinned).toEqual([]);
  });

  // Same reasoning as the `'*': hash-pin` policy in .github/zizmor.yml,
  // applied to the container references that policy cannot see
  // (unpinned-images is Pedantic-persona; enforced by the narrow pedantic
  // pass in workflows.yml and asserted here so the pin survives edits).
  it('pins every container image reference to a digest', () => {
    const images = [];

    for (const [filePath, workflow] of Object.entries({
      '.github/workflows/release.yml': releaseWorkflow,
      '.github/workflows/example-app.yml': exampleAppWorkflow,
      '.github/workflows/workflows.yml': workflowsWorkflow,
      '.github/workflows/links.yml': readWorkflow(
        '.github/workflows/links.yml'
      ),
      '.github/workflows/security.yml': readWorkflow(
        '.github/workflows/security.yml'
      ),
    })) {
      for (const match of workflow.matchAll(/^\s*(?:- uses|image): (\S+)$/gm)) {
        const [, reference] = match;

        if (!reference.startsWith('docker://') && !reference.includes('@')) {
          continue;
        }

        if (reference.startsWith('docker://')) {
          if (!/^docker:\/\/[^@]+@sha256:[0-9a-f]{64}$/.test(reference)) {
            images.push(`${filePath}: ${reference}`);
          }
          continue;
        }

        if (reference.startsWith('mcr.microsoft.com/')) {
          if (!/mcr\.microsoft\.com\/.+@sha256:[0-9a-f]{64}$/.test(reference)) {
            images.push(`${filePath}: ${reference}`);
          }
        }
      }
    }

    expect(images).toEqual([]);
  });
});

describe('reproducible workflow tooling and runner policy', () => {
  it('keeps both zizmor passes and the reproduction comment on the action-supported version', () => {
    const version = workflowsWorkflow.match(
      /^\s+version: (\d+\.\d+\.\d+)$/m
    )?.[1];
    const versions = Array.from(
      workflowsWorkflow.matchAll(/zizmor==(\d+\.\d+\.\d+)/g),
      (match) => match[1]
    );
    expect(versions.length).toBe(2);
    expect(versions).toEqual([version, version]);
    expect(workflowsWorkflow).toContain('zizmorcore/zizmor-action@v0.6.4');
    expect(['1.30.0', '1.30.1']).toContain(version);
  });
  it('pins secretlint without the deprecated preset package', () => {
    const cli = releaseWorkflow.match(/-p secretlint@(\d+\.\d+\.\d+)/)?.[1];
    expect(cli).toBe('14.1.0');
    // Built into secretlint 14; installing it prints a deprecation warning.
    expect(releaseWorkflow).not.toContain(
      '@secretlint/secretlint-rule-preset-recommend@'
    );
    expect(readFileSync('.secretlintrc.json', 'utf8')).toContain(
      '@secretlint/secretlint-rule-preset-recommend'
    );
  });
  it('pins every hosted OS image in every workflow', () => {
    for (const file of activeWorkflows) {
      expect(readWorkflow(file)).not.toMatch(
        /\b(?:ubuntu|macos|windows)-latest\b/
      );
    }
  });
  it('runs a workflow policy guard in CI', () => {
    expect(workflowsWorkflow).toContain('node scripts/check-ci-workflows.mjs');
  });
});
