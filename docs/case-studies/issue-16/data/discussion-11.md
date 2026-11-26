# 11: CI/CD without false positives, false negatives, warnings or errors: example app on main, strict lint, ShellCheck, CodeQL and npm audit gates, desktop skins on file://

## Summary

Fixes #10

Each CI/CD workflow was checked for errors, false positives (red without a real problem), false negatives (green while something is broken) and warnings. Every one found is fixed in this pull request. The full case study is in [`dev/log/issues/10/pulls/11/README.md`](https://github.com/link-foundation/universal-translator/blob/issue-10-ac0b270fdd45/dev/log/issues/10/pulls/11/README.md). It has the requirements table, a timeline, root causes, the template comparison, the raw CI logs (`ci-logs/`) and before/after evidence (`evidence/`).

## Errors (red runs)

| Problem | Root cause | Fix |
| --- | --- | --- |
| `Example app` failed on every push to `main` (run 45623028339) | `scripts/update-preview-images.mjs` waited for `#calculator-title`, an id from the template's calculator. The translator renders `#translator-title`. The job only ran on `main`. | Wait for selectors the app renders (a test checks they exist). A read-only `preview-check` job renders the images on pull requests. Container steps use `bash`. Preview images regenerated. (6b3b57e, 2a1bb83) |
| Versioning dry run failed any pull request without a changeset, and the lint steps after it never ran | `@changesets/cli` 3 exits 1 with "No unreleased changesets found" | Skip with a notice when nothing is pending (6897d89) |
| The offline dry run failed with `ENOTCACHED` | `use-m` fetched `command-stream` from a CDN while `npm_config_offline=true` | Release helpers are exact devDependencies loaded from the lockfile (738132c) |
| The new CodeQL gate failed every run | Alert #5 was dismissed in code scanning, and the SARIF file does not record dismissals | `.github/codeql/accepted-findings.json` matches the rule, path and `primaryLocationLineHash` exactly, needs an alert URL and a reason, and fails when an entry is stale. Rejected findings print `path:line`. (ca695ee, 9e800cf) |
| `finds nothing in the tracked scripts and hooks` failed on Node, Bun and Deno (run 45649688140) | The job pins ShellCheck 0.11, but the test runs the runner's ShellCheck 0.9, which reports SC2015 for `[ ] && echo \|\| true` | The trace helpers use an `if` statement, which both versions accept (e4364a2, 0ba9e7c) |
| Deno failed `rejects a syntax error in js/tests/nested/check.test.js` on every run since the fixture was added (runs 45646051898 to 45652861265) | The Deno leg ran the gate on the runner's preinstalled Node. On Node 20 and 22, `node --check` exits 0 for an untyped `.js` file that uses `export`, even with a syntax error; Node 24 reports it. The repository supports Node 20 and later, so the gate itself had a false negative | Untyped `.js` files are checked through stdin as CommonJS, then as an ES module (822375b). Every test leg pins Node 24, as the template does (ce6ea41). The fixture also fails on git errors (727f3bf) |
| CodeQL `Analyze` failed at "Uploading results" (run 45649687987) | A transient GitHub outage; no analysis exists for that commit | No code change; the next run uploads normally |

## False negatives (green while broken)

- Lint warnings were filtered to changed lines and never failed. Now any warning fails (13780da), and the eight hidden warnings are fixed (c60ff67).
- `cargo doc` never ran (two broken intra-doc links), and Cargo's own warnings passed Clippy (f96e27f).
- The syntax gate checked only `scripts/*.mjs`, not `js/` (9cf89c5). On Node 20 and 22 it also passed untyped `.js` files with ESM syntax errors (822375b).
- Change detection skipped every check for shell scripts, Dockerfiles, CSS and similar files (cfa3ab1).
- Shell scripts called by workflows were never linted. They now go through ShellCheck (fb74d84).
- `npm audit --audit-level=high` passed moderate advisories in silence. There is now a full advisory report and a live deprecation check (26ab768).
- CodeQL uploaded alerts but never failed the run, and it skipped `examples/` (09789a0).
- **Desktop app skins were broken on `file://`.** Vite only warned that `node:fs/promises` was externalized, and every skin failed in Electron with `readFile is not a function`. Theme files are now bundled. A new `file://` e2e reproduces the problem, and any Vite warning fails the build (4aab2bf).

## False positives

- The status gate compared fork pull requests with `refs/heads/<branch>` instead of `refs/pull/N/head` (150e131).
- The budget wrapper could kill a command up to 1 s before its budget ended (1088b33).
- The common library translations step had a smaller budget than its shorter sibling, so its 70% warning fired on ordinary slow runners (e674adc).

## Warnings removed

- Node 20 deprecation and DEP0040/DEP0169 from `actions/cache@v4`: moved to v6 (f367b67).
- Deprecated secretlint preset (f367b67).
- Deprecated ESLint 9: moved to ESLint 10 (c60ff67).
- `npm warn deprecated glob@7/inflight/boolean/rimraf@2` in the example app (2a65e53).
- Line-limit warnings for `parser.js` (1498 lines) and `release.yml` (1425 lines) (908917b, 3b015c9).
- Vite chunk-size and externalized-module warnings (4aab2bf).
- Native translation budget warning (e674adc).
- `actions/checkout` and `actions/setup-node` moved to v7, as the templates use (f58ba7e).
- Dependency Review warned that `npm/human-signals` (through `command-stream` and `execa`) has an OpenSSF Scorecard of 2.8, below the default 3. Scorecards are still listed in the summary, but a low one no longer warns, as in the template (ac9e65c).

## Template best practices and upstream reports

The parts the [JS pipeline template](https://github.com/link-foundation/js-ai-driven-development-pipeline-template) already did better were ported:

- changed-files lint scope;
- `HEAD_REF` in the status gate;
- the budget wrapper (identical except the `trace` helper, which avoids SC2015 on the runner's ShellCheck 0.9);
- the ShellCheck job;
- the npm audit report;
- the CodeQL result gate;
- lockfile-loaded release helpers;
- the example app overrides;
- Node 24 pinned in every test leg;
- the Dependency Review scorecard settings.

Three problems also exist in the template and are reported there with a reproduction, workaround and fix:

- link-foundation/js-ai-driven-development-pipeline-template#319: the CodeQL gate fails forever on a dismissed alert, and its failures do not name a location.
- link-foundation/js-ai-driven-development-pipeline-template#320: the dry run fails when no changeset is pending.
- link-foundation/js-ai-driven-development-pipeline-template#321: the syntax gate passes untyped `.js` files with ESM syntax errors on Node 20 and 22.

A code search found these steps only in the JS template, so the other language templates are not affected.

## How to reproduce and verify

- Preview selectors: `js/tests/universal-app.test.js` ("waits for preview selectors that the app renders") checks that every selector the preview script waits for exists in the app source. Before the fix the script timed out on `#calculator-title` (`ci-logs/example-app-45623028339.log`).
- Desktop skins: `npm run build` in `examples/universal-app`, then `node examples/universal-app/e2e/file-protocol.e2e.mjs examples/universal-app/dist/index.html`. This fails before 4aab2bf (`evidence/file-protocol-e2e-before.log`).
- Dry run: `npx changeset version` in a clean checkout with no changeset gives `exit=1`.
- CodeQL gate: `js/tests/codeql-results.test.js` covers accepted, stale, edited-line and rejected findings.
- Syntax gate: `js/tests/javascript-syntax.test.js`. With the old gate and Node 22 first on `PATH`, `deno test -A js/tests/javascript-syntax.test.js` fails with "Expected 0 to be 1", as in CI. `experiments/issue-10/node-check-untyped-esm.sh` shows the Node behaviour.
- Budget wrapper and timeouts: `js/tests/ci-timeouts.test.js` and `js/tests/run-with-budget-warning.test.js`.

Debug output is off by default: `DEBUG=1` prints release script stack traces, `BUDGET_VERBOSE=1` and `PIPELINE_STATUS_VERBOSE=1` trace the budget wrapper and the status gate, `VITE_ALLOW_WARNINGS=true` lets a local Vite build finish despite warnings, and `CHROMIUM_EXECUTABLE` picks the browser for the `file://` e2e.



## https://github.com/link-foundation/universal-translator/pull/11#issuecomment-7168938380 by konard

<!-- hive-mind:working-session-summary -->
## Working session summary

Every error, false positive, false negative and warning I found in CI is fixed in https://github.com/link-foundation/universal-translator/pull/11, and the PR is now ready for review.

On the latest commit (`7db88d3`), all five workflows pass: Security, Broken Link Checker, Checks and release, Workflows and Example app. Of the 43 check runs, 33 succeeded and 10 were skipped; nothing failed. The skipped runs are jobs that only run in certain cases. Across all of them there are no warning or error annotations, only three notices: the reviewed CodeQL finding, the link checker's summary link and the web build artifact.

**The last warning** came from Dependency Review on every pull request. It reported that `human-signals` has an OpenSSF Scorecard of 2.8, below the default threshold of 3; it gets pulled in through `command-stream` and `execa`. A low scorecard is not a vulnerability, so I copied the JS template's settings: scorecards are still listed in the summary, but a low one no longer raises a warning. The gate is still high-severity vulnerabilities, and a test checks these settings (`ac9e65c`).

**Main fixes across the PR:**
- **Example app on `main`:** it failed on every push because the preview script waited for an element id from the template's calculator app. It now waits for elements the translator renders, and a new job checks the previews on pull requests too.
- **False negatives (green while broken):**
  - Lint warnings never failed the build.
  - `cargo doc` never ran, and Cargo's own warnings passed.
  - The syntax check missed most JavaScript files. On Node 20 and 22 it also passed `.js` files with syntax errors, which made one Deno test fail on every run.
  - Shell scripts were never linted, and moderate npm advisories passed silently.
  - CodeQL findings never failed the run.
  - The desktop app's skins were broken when opened from `file://`. The build only printed a warning about it.
- **False positives (red without a real problem):**
  - The versioning dry run failed any pull request without a changeset.
  - The offline dry run tried to download a package from a CDN.
  - The status check compared fork pull requests with the wrong branch.
  - The time-budget wrapper could kill a command that was still within its budget.
  - The CodeQL check failed on an alert the maintainers had already dismissed.
- **Warnings removed:** deprecated actions and packages (including ESLint 9), files near the line limit, Vite size and module warnings, and a step budget that was too small.

**Upstream:** three of these problems also exist in the JS pipeline template. I reported each with a reproduction, workaround and fix: #319 (CodeQL check), #320 (dry run) and #321 (syntax check). A code search found these steps only in the JS template, so the other language templates aren't affected.

The case study is in `dev/log/issues/10/pulls/11/README.md`, with the raw CI logs and before/after evidence next to it. Debug output stays off unless you set `DEBUG=1`, `BUDGET_VERBOSE=1` or `PIPELINE_STATUS_VERBOSE=1`. `main` is merged into the branch, there are no new comments on the issue or PR, and the description still says "Fixes #10".

---
*This summary was automatically extracted from the AI working session output.*

## https://github.com/link-foundation/universal-translator/pull/11#issuecomment-7169134610 by konard

## 🤖 Solution Draft Log
This log file contains the complete execution trace of the AI solution draft process.

### 💰 Cost: **$34.454940**

### 📊 **Context and tokens usage:**

**Claude Opus 5.5:** (12 sub-sessions)
1. 111.2K / 1M (11%) input tokens, 14.6K / 128K (11%) output tokens
2. 116.6K / 1M (12%) input tokens, 28.9K / 128K (23%) output tokens
3. 116.2K / 1M (12%) input tokens, 32.4K / 128K (25%) output tokens
4. 116.1K / 1M (12%) input tokens, 28.5K / 128K (22%) output tokens
5. 114.8K / 1M (11%) input tokens, 29.3K / 128K (23%) output tokens
6. 115.8K / 1M (12%) input tokens, 24.1K / 128K (19%) output tokens
7. 115.6K / 1M (12%) input tokens, 32.2K / 128K (25%) output tokens
8. 116.5K / 1M (12%) input tokens, 42.7K / 128K (33%) output tokens
9. 116.9K / 1M (12%) input tokens, 28.3K / 128K (22%) output tokens
10. 116.7K / 1M (12%) input tokens, 37.1K / 128K (29%) output tokens
11. 116.9K / 1M (12%) input tokens, 45.2K / 128K (35%) output tokens
12. 48.5K / 1M (5%) input tokens, 5.5K / 128K (4%) output tokens

Total: (38.1K new + 1.6M cache writes + 64.9M cache reads) input tokens, 506.4K output tokens, $34.454940 cost

### 🤖 **Models used:**
- Tool: Anthropic Claude Code
- Requested: `opus` (`claude-opus-5-5`)
- Thinking level: high (~23999 tokens)
- **Model: Claude Opus 5.5** (`claude-opus-5-5`)

### 📎 **Log file uploaded as Gist** (26155KB)
- [View complete solution draft log](https://gist.githubusercontent.com/konard/d25824ffcabb8f6225033f64150ca890/raw/1ec9c7874e2042472a4a9fd90677e74ee256ef07/tmp-hive-mind-log-upload-Xugbyv-sanitized.log.txt)

---
*Now working session is ended, feel free to review and add any feedback on the solution draft.*

## https://github.com/link-foundation/universal-translator/pull/11#issuecomment-7169267170 by konard

## 🎉 Auto-merged

This pull request has been automatically merged by hive-mind.
- All CI checks have passed

### Linked issues

- 🔒 Closed by GitHub: link-foundation/universal-translator#10

## Pull request description

## Summary

Fixes #10

Each CI/CD workflow was checked for errors, false positives (red without a real problem), false negatives (green while something is broken) and warnings. Every one found is fixed in this pull request. The full case study is in [`dev/log/issues/10/pulls/11/README.md`](https://github.com/link-foundation/universal-translator/blob/issue-10-ac0b270fdd45/dev/log/issues/10/pulls/11/README.md). It has the requirements table, a timeline, root causes, the template comparison, the raw CI logs (`ci-logs/`) and before/after evidence (`evidence/`).

## Errors (red runs)

| Problem | Root cause | Fix |
| --- | --- | --- |
| `Example app` failed on every push to `main` (run 45623028339) | `scripts/update-preview-images.mjs` waited for `#calculator-title`, an id from the template's calculator. The translator renders `#translator-title`. The job only ran on `main`. | Wait for selectors the app renders (a test checks they exist). A read-only `preview-check` job renders the images on pull requests. Container steps use `bash`. Preview images regenerated. (6b3b57e, 2a1bb83) |
| Versioning dry run failed any pull request without a changeset, and the lint steps after it never ran | `@changesets/cli` 3 exits 1 with "No unreleased changesets found" | Skip with a notice when nothing is pending (6897d89) |
| The offline dry run failed with `ENOTCACHED` | `use-m` fetched `command-stream` from a CDN while `npm_config_offline=true` | Release helpers are exact devDependencies loaded from the lockfile (738132c) |
| The new CodeQL gate failed every run | Alert #5 was dismissed in code scanning, and the SARIF file does not record dismissals | `.github/codeql/accepted-findings.json` matches the rule, path and `primaryLocationLineHash` exactly, needs an alert URL and a reason, and fails when an entry is stale. Rejected findings print `path:line`. (ca695ee, 9e800cf) |
| `finds nothing in the tracked scripts and hooks` failed on Node, Bun and Deno (run 45649688140) | The job pins ShellCheck 0.11, but the test runs the runner's ShellCheck 0.9, which reports SC2015 for `[ ] && echo \|\| true` | The trace helpers use an `if` statement, which both versions accept (e4364a2, 0ba9e7c) |
| Deno failed `rejects a syntax error in js/tests/nested/check.test.js` on every run since the fixture was added (runs 45646051898 to 45652861265) | The Deno leg ran the gate on the runner's preinstalled Node. On Node 20 and 22, `node --check` exits 0 for an untyped `.js` file that uses `export`, even with a syntax error; Node 24 reports it. The repository supports Node 20 and later, so the gate itself had a false negative | Untyped `.js` files are checked through stdin as CommonJS, then as an ES module (822375b). Every test leg pins Node 24, as the template does (ce6ea41). The fixture also fails on git errors (727f3bf) |
| CodeQL `Analyze` failed at "Uploading results" (run 45649687987) | A transient GitHub outage; no analysis exists for that commit | No code change; the next run uploads normally |

## False negatives (green while broken)

- Lint warnings were filtered to changed lines and never failed. Now any warning fails (13780da), and the eight hidden warnings are fixed (c60ff67).
- `cargo doc` never ran (two broken intra-doc links), and Cargo's own warnings passed Clippy (f96e27f).
- The syntax gate checked only `scripts/*.mjs`, not `js/` (9cf89c5). On Node 20 and 22 it also passed untyped `.js` files with ESM syntax errors (822375b).
- Change detection skipped every check for shell scripts, Dockerfiles, CSS and similar files (cfa3ab1).
- Shell scripts called by workflows were never linted. They now go through ShellCheck (fb74d84).
- `npm audit --audit-level=high` passed moderate advisories in silence. There is now a full advisory report and a live deprecation check (26ab768).
- CodeQL uploaded alerts but never failed the run, and it skipped `examples/` (09789a0).
- **Desktop app skins were broken on `file://`.** Vite only warned that `node:fs/promises` was externalized, and every skin failed in Electron with `readFile is not a function`. Theme files are now bundled. A new `file://` e2e reproduces the problem, and any Vite warning fails the build (4aab2bf).

## False positives

- The status gate compared fork pull requests with `refs/heads/<branch>` instead of `refs/pull/N/head` (150e131).
- The budget wrapper could kill a command up to 1 s before its budget ended (1088b33).
- The common library translations step had a smaller budget than its shorter sibling, so its 70% warning fired on ordinary slow runners (e674adc).

## Warnings removed

- Node 20 deprecation and DEP0040/DEP0169 from `actions/cache@v4`: moved to v6 (f367b67).
- Deprecated secretlint preset (f367b67).
- Deprecated ESLint 9: moved to ESLint 10 (c60ff67).
- `npm warn deprecated glob@7/inflight/boolean/rimraf@2` in the example app (2a65e53).
- Line-limit warnings for `parser.js` (1498 lines) and `release.yml` (1425 lines) (908917b, 3b015c9).
- Vite chunk-size and externalized-module warnings (4aab2bf).
- Native translation budget warning (e674adc).
- `actions/checkout` and `actions/setup-node` moved to v7, as the templates use (f58ba7e).
- Dependency Review warned that `npm/human-signals` (through `command-stream` and `execa`) has an OpenSSF Scorecard of 2.8, below the default 3. Scorecards are still listed in the summary, but a low one no longer warns, as in the template (ac9e65c).

## Template best practices and upstream reports

The parts the [JS pipeline template](https://github.com/link-foundation/js-ai-driven-development-pipeline-template) already did better were ported:

- changed-files lint scope;
- `HEAD_REF` in the status gate;
- the budget wrapper (identical except the `trace` helper, which avoids SC2015 on the runner's ShellCheck 0.9);
- the ShellCheck job;
- the npm audit report;
- the CodeQL result gate;
- lockfile-loaded release helpers;
- the example app overrides;
- Node 24 pinned in every test leg;
- the Dependency Review scorecard settings.

Three problems also exist in the template and are reported there with a reproduction, workaround and fix:

- link-foundation/js-ai-driven-development-pipeline-template#319: the CodeQL gate fails forever on a dismissed alert, and its failures do not name a location.
- link-foundation/js-ai-driven-development-pipeline-template#320: the dry run fails when no changeset is pending.
- link-foundation/js-ai-driven-development-pipeline-template#321: the syntax gate passes untyped `.js` files with ESM syntax errors on Node 20 and 22.

A code search found these steps only in the JS template, so the other language templates are not affected.

## How to reproduce and verify

- Preview selectors: `js/tests/universal-app.test.js` ("waits for preview selectors that the app renders") checks that every selector the preview script waits for exists in the app source. Before the fix the script timed out on `#calculator-title` (`ci-logs/example-app-45623028339.log`).
- Desktop skins: `npm run build` in `examples/universal-app`, then `node examples/universal-app/e2e/file-protocol.e2e.mjs examples/universal-app/dist/index.html`. This fails before 4aab2bf (`evidence/file-protocol-e2e-before.log`).
- Dry run: `npx changeset version` in a clean checkout with no changeset gives `exit=1`.
- CodeQL gate: `js/tests/codeql-results.test.js` covers accepted, stale, edited-line and rejected findings.
- Syntax gate: `js/tests/javascript-syntax.test.js`. With the old gate and Node 22 first on `PATH`, `deno test -A js/tests/javascript-syntax.test.js` fails with "Expected 0 to be 1", as in CI. `experiments/issue-10/node-check-untyped-esm.sh` shows the Node behaviour.
- Budget wrapper and timeouts: `js/tests/ci-timeouts.test.js` and `js/tests/run-with-budget-warning.test.js`.

Debug output is off by default: `DEBUG=1` prints release script stack traces, `BUDGET_VERBOSE=1` and `PIPELINE_STATUS_VERBOSE=1` trace the budget wrapper and the status gate, `VITE_ALLOW_WARNINGS=true` lets a local Vite build finish despite warnings, and `CHROMIUM_EXECUTABLE` picks the browser for the `file://` e2e.


## https://github.com/link-foundation/universal-translator/pull/11#discussion_r4697268530 by github-advanced-security[bot]

## CodeQL / Incomplete URL substring sanitization

'[https://github.com/link-foundation/universal-translator/security/code-scanning/5](1)' can be anywhere in the URL, and arbitrary hosts may come before or after it.

[Show more details](https://github.com/link-foundation/universal-translator/security/code-scanning/6)

## https://github.com/link-foundation/universal-translator/pull/11#pullrequestreview-6060638049 by github-advanced-security[bot]


