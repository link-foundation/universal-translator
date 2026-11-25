# Case study: false positives, false negatives, warnings and errors in CI/CD

Issue: https://github.com/link-foundation/universal-translator/issues/10
Pull request: https://github.com/link-foundation/universal-translator/pull/11

## Requirements

| #   | Requirement (from the issue)                                                        | Where it is addressed                                    |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| R1  | Fix the failing `Example app` run on `main` (run 45623028339)                        | 6b3b57e, 2a1bb83                                         |
| R2  | Find and fix every false positive (red without a real problem)                       | 6897d89, 150e131, 1088b33, 738132c, ca695ee, e674adc, e4364a2 |
| R3  | Find and fix every false negative (green while something is broken)                  | 6b3b57e, 13780da, f96e27f, 9cf89c5, cfa3ab1, fb74d84, 26ab768, 09789a0, 4aab2bf, 727f3bf, 822375b, ce6ea41 |
| R4  | Fix every warning printed by CI                                                      | f367b67, c60ff67, 908917b, 3b015c9, 2a65e53, 4aab2bf, e674adc |
| R5  | Use the best practices of the pipeline templates (compare the full file tree)        | see "Template comparison"                                |
| R6  | Report problems that also exist in the templates                                     | see "Upstream reports"                                   |
| R7  | Follow hive-mind `docs/CI-CD-BEST-PRACTICES.md`                                      | status gates, step budgets, fail-closed gates, logs kept |
| R8  | Everything in this single pull request                                               | PR #11                                                   |

## Timeline (2026-11-25, UTC)

| Time  | Event                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------- |
| 13:24 | `Example app` on `main` fails: `Regenerate Preview Images` times out waiting for `#calculator-title`.    |
| 14:06 | Issue #10 opened with the run table (1 of 5 workflows failing on `main`).                                  |
| 14:26 | 6b3b57e: preview selectors fixed and the preview job also runs (read-only) on pull requests.             |
| 14:29 | f367b67, 2a1bb83: cache actions on Node 24, secretlint preset removed, preview images regenerated.        |
| 14:38 | c60ff67, 13780da: ESLint 10; lint warnings now fail instead of being filtered to changed lines.          |
| 14:44 | f96e27f: rustdoc and Cargo warnings fail Rust CI.                                                        |
| 14:45 | 150e131, 1088b33: status gate compares fork runs with `refs/pull/N/head`; budget wrapper fixed.          |
| 14:50 | 9cf89c5, cfa3ab1: syntax gate covers every JS file; change detection stops skipping non-JS code.         |
| 14:52 | 6897d89: versioning dry run no longer fails a pull request without a changeset.                          |
| 14:54 | 908917b, 3b015c9: files moved below the line-limit warnings.                                             |
| 15:02 | fb74d84, f58ba7e: ShellCheck job; checkout/setup-node v7.                                                |
| 15:03 | Dry run (now reached with a changeset) fails offline: `command-stream` fetched through use-m (ENOTCACHED). |
| 15:24 | 2a65e53, b8949d8, 26ab768, 09789a0: example app deprecations and advisories, npm audit report, CodeQL gate. |
| 15:30 | 738132c: release helpers loaded from the lockfile.                                                        |
| 15:35 | ca695ee: CodeQL gate fails on dismissed alert #5 → reviewed accepted-findings list.                      |
| 15:45 | 4aab2bf: Vite warnings revealed broken desktop skins on `file://`; build split; warnings fail the build. |
| 15:48 | e674adc: common library native step gets the same budget as its sibling.                                 |
| 15:49 | 9e800cf: the gate found a CodeQL alert in its own new test; fixed, and failures now name `path:line`.     |
| 15:56 | f1e873e: first run in which the test jobs got past lint. ShellCheck 0.9 on the runner reports SC2015; Deno reports a syntax fixture as clean; both CodeQL uploads fail during a GitHub outage. |
| 16:19 | e4364a2, 727f3bf: trace helpers clean under ShellCheck 0.9 and 0.11; the syntax gate fixture checks git. |
| 16:22 | 9542e1a: the new assertion shows the gate listed the fixture; Node 22's `node --check` passed it.          |
| 16:32 | 822375b, ce6ea41: untyped `.js` files checked as CommonJS or ES module; the Deno leg pins Node 24.         |
| 16:50 | Run 45655293732 green. The annotation sweep finds one warning left: Dependency Review on human-signals' OpenSSF Scorecard (2.8 < 3). ac9e65c uses the template's level 0. |

## Root causes and solutions

### Errors (red runs)

1. **Preview regeneration on `main` (R1).** `scripts/update-preview-images.mjs` waited for
   `#calculator-title`, an id from the template's calculator demo. The translator renders
   `#translator-title`, so every push to `main` timed out after 10 s
   (`ci-logs/example-app-45623028339.log`, line 283). The job ran only on `main`, so no pull request
   could catch it. Fix: wait for selectors the app renders and test that they exist in the source.
   A read-only `preview-check` job now renders the images on pull requests. Container steps run with
   `bash`; under `sh` the drift test failed with `[[: not found` and always printed "already up to date".
2. **Versioning dry run without a changeset.** `@changesets/cli` 3 exits 1 with
   "No unreleased changesets found" (`ci-logs/checks-and-release-45636376875-failed.log`). A docs-only
   pull request failed lint, and ESLint, Prettier, jscpd and secretlint were skipped. Fix: skip with a
   notice when `.changeset/` has nothing pending. This was reproduced in a clean directory
   (`npx changeset version` → `exit=1`) and reported upstream.
3. **Offline dry run.** With a changeset present, the dry run ran for the first time and failed:
   `use-m` fetched `command-stream` from a CDN while `npm_config_offline=true`
   (`evidence/offline-dry-run-before.log`). Fix: `command-stream` and `lino-arguments` are exact
   devDependencies, loaded from `node_modules` as in the template (`evidence/offline-dry-run-after.log`).
4. **CodeQL gate and dismissed alert #5.** Dismissal is stored in code scanning, not in SARIF, so the
   new strict gate failed every run. Fix: `.github/codeql/accepted-findings.json` matches rule, path
   and `primaryLocationLineHash` exactly and requires an alert URL and a reason. A stale entry fails.
   The first CI run showed the mechanism working (`evidence/codeql-gate-4aab2bf.log`): the accepted
   alert became a notice, and a new alert in the test itself was rejected and then fixed.

### False negatives (green while broken)

- **Lint warnings** were filtered to changed lines and never failed (13780da). A body-only edit that
  raised a function's complexity passed CI.
- **Rust:** `cargo doc` was never run, which hid two broken intra-doc links. Clippy's `-D warnings`
  does not cover Cargo's own warnings (f96e27f).
- **Syntax gate:** it checked only `scripts/*.mjs`, because the sources live in `js/` (9cf89c5).
- **Change detection:** it counted only an allow-list of extensions as code. A pull request that
  changed only a shell script or a Dockerfile skipped every check (cfa3ab1).
- **Shell scripts** called by workflows were never linted; actionlint only sees `run:` blocks (fb74d84).
- **npm audit:** `npm audit --audit-level=high` passed moderate advisories (minimatch, fast-uri) in
  silence. The live registry deprecation check was missing (26ab768).
- **CodeQL:** the analyze step uploads alerts and passes. `examples/` (the Electron app) was excluded
  from analysis (09789a0).
- **Desktop skins on `file://`.** Vite warned that `node:fs/promises` was externalized for the browser.
  `@link-foundation/ui-themes` reads skins with it when the page is on `file://`, which is how Electron
  loads `dist/index.html`, so every skin failed in the desktop app with
  `readFile is not a function` (`evidence/file-protocol-e2e-before.log`). The web e2e used `http://`
  and passed. Fix: the theme files are bundled through `import.meta.glob` into a lazy chunk, and a new
  `file://` e2e step (`examples/universal-app/e2e/file-protocol.e2e.mjs`) reproduces the desktop path.

### False positives (red or warned without a real problem)

- **Status gate on fork pull requests:** it compared fork runs with `refs/heads/<branch>` in the base
  repository, so the run could look superseded (150e131).
- **Budget wrapper:** `SECONDS` can tick early, so `-ge` could kill a command that was still inside
  its budget (1088b33).
- **Common library translations:** this step had a smaller budget (480 s) than its shorter sibling
  (540 s). Its 70% warning fired at 336 s on ordinary slow runners (369 s measured in run
  45623028403). Both steps now have 540 s (e674adc).

5. **ShellCheck version skew.** The `shellcheck` job pins shellcheck-py 0.11.0.1, but the test
   `finds nothing in the tracked scripts and hooks` runs the ShellCheck on the runner's PATH, which is
   0.9.0 on ubuntu-24.04. 0.9 reports SC2015 (info) for
   `trace() { [ "${verbose}" = "1" ] && echo … >&2 || true; }` in `check-pipeline-status.sh` and
   `run-with-budget-warning.sh`; 0.11 accepts it. Earlier runs never reached the test, because they
   were cancelled by newer pushes or stopped at the dry run, so run 45649688140 was the first to show
   it (`ci-logs/checks-and-release-45649688140-failed.log`). Reproduced locally with both wheels:
   0.9 exits 123, 0.11 exits 0. Fix: both helpers use an `if` statement, which both versions accept
   (e4364a2). The template pins 0.11 in its job and lint-staged and has no unpinned test, so it is
   not affected.
6. **Syntax gate blind to untyped ESM on Node 20 and 22.** The Deno test job failed
   `rejects a syntax error in js/tests/nested/check.test.js` on every run that reached it (runs
   45646051898 to 45652861265), first read as a flake. With the 727f3bf assertion, run 45652861265
   showed that the gate did list the file and `node --check` still exited 0
   (`ci-logs/checks-and-release-45652861265-test-deno.log`). The Deno leg skipped `setup-node`, so
   the gate ran on the runner's preinstalled Node. On Node 20 and 22, `node --check` passes a `.js`
   file that uses `import` or `export` when no `package.json` sets `"type"`, even with a syntax
   error; Node 24 reports it (`experiments/issue-10/node-check-untyped-esm.sh`: exit 0 on 20.20.2
   and 22.23.5, exit 1 on 24.22.3). The repository supports Node 20 and later, so this is a false
   negative of the gate itself, which the fixture caught. Every tracked `.js` file is under a typed
   `package.json` today, so no real error was hidden. Fix: the gate checks untyped `.js` files
   through stdin as CommonJS and then as an ES module (822375b), which Node 20, 22 and 24 all get
   right; with the old gate and Node 22 first on PATH, the test fails exactly as in CI. The Deno leg
   now pins Node 24 as well, as the JS template does (ce6ea41). A signal was ruled out first
   (`experiments/issue-10/deno-spawnsync-signal.mjs`), and git failures in the fixture now fail the
   test (727f3bf). The template has the same checker and also declares Node 20 and later, so this is
   reported upstream (link-foundation/js-ai-driven-development-pipeline-template#321).
7. **CodeQL upload during a GitHub outage.** In Security run 45649687987, both `Analyze` steps stopped
   at "Uploading results" with no error printed, while GitHub returned HTTP 500 to a push at the same
   minute. The code scanning API has no analysis for f1e873e. The result gate itself passed and
   accepted only alert #5, and Pipeline Status correctly failed the run
   (`ci-logs/security-45649687987-*.log`). Nothing in the repository caused it; the next push ran the
   job again.

### Warnings

| Warning (log)                                                             | Fix                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `Node.js 20 is deprecated … actions/cache@v4`, DEP0040/DEP0169 in cache steps | actions/cache v6 (f367b67)                      |
| `npm warn deprecated @secretlint/secretlint-rule-preset-recommend`         | secretlint 14 built-in rules (f367b67)          |
| `npm warn deprecated eslint@9`                                             | ESLint 10 (c60ff67)                             |
| `npm warn deprecated glob@7, inflight, boolean, rimraf@2`                   | scoped overrides + temp adapter (2a65e53)       |
| `File has 1498 lines`, `File has 1401 lines`                               | parser and workflow split (908917b, 3b015c9)    |
| Vite `Some chunks are larger than 500 kB`                                  | `manualChunks` groups, all < 500 kB (4aab2bf)   |
| Vite `Module "node:fs/promises" has been externalized`                     | bundled theme files (4aab2bf)                   |
| `Common library translations has run for 336s of its 480s budget`          | budget 540 s (e674adc)                          |
| Dependency Review: `npm/human-signals has an OpenSSF Scorecard of 2.8, which is less than this repository's threshold of 3` | scorecards listed, not warned, as in the template (ac9e65c) |

Any new Vite warning now fails the build (`evidence/vite-build-fails-on-warning.log`). Set
`VITE_ALLOW_WARNINGS=true` to look at a build locally despite a warning.

## Template comparison

The JS template (`link-foundation/js-ai-driven-development-pipeline-template`) is the reference for
this JavaScript repository. These parts were ported from it:

- the changed-files lint scope;
- the status gate `HEAD_REF`;
- the budget wrapper;
- the ShellCheck job;
- checkout/setup-node v7;
- the npm audit report and live deprecation check;
- the CodeQL result gate;
- lockfile-installed release helpers;
- the example app overrides;
- Node 24 in every test leg;
- the Dependency Review scorecard settings.

`scripts/run-with-budget-warning.sh` matches the template except for the `trace` helper, which this
repository writes as an `if` statement so that ShellCheck 0.9 accepts it as well.
`scripts/check-pipeline-status.sh` differs only in the template's unacquired-runner report, which
needs `rerun-unacquired.mjs`, and that file is not in this repository.

The other templates (Rust, Python, C++, Java, C#, Go, PHP) have no changesets dry run, CodeQL result
gate, or Vite app. A code search of the organisation found the dry-run step and the CodeQL gate only
in the JS template.

## Upstream reports

- https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/319: the CodeQL
  result gate fails forever on a reviewed and dismissed alert, and rejected findings do not name
  their file and line (`upstream/js-template-codeql-gate-dismissed-alerts.md`).
- https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/320: the
  versioning dry run fails lint when no changeset is pending (`upstream/js-template-dry-run-without-changesets.md`).
- https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/321: the
  syntax gate passes untyped `.js` files with ESM syntax errors on Node 20 and 22
  (`upstream/js-template-syntax-gate-untyped-esm.md`).

The template already contains the fixes for the other root causes above: `shell: bash` in container
jobs, correct preview upload paths, `HEAD_REF`, the budget wrapper, and lockfile helpers. This
repository had fallen behind it.

## Debug output

All debug output is off by default:

- `DEBUG=1` prints stack traces from the release scripts (`scripts/debug-print.mjs`).
- `BUDGET_VERBOSE=1` traces the budget wrapper, and `PIPELINE_STATUS_VERBOSE=1` traces the status gate.
- `VITE_ALLOW_WARNINGS=true` lets a local Vite build finish despite warnings; CI never sets it.
- `CHROMIUM_EXECUTABLE` selects the browser for the `file://` e2e.

## Files

- `ci-logs/`: raw logs of the runs named above (`gh run view --log`).
- `evidence/`: before/after logs for each fix, and the SARIF of the first accepted-findings run.
- `runs.json`, `warnings-summary.txt`: the initial inventory of the `main` runs.
- `upstream/`: the bodies of the upstream issues.
