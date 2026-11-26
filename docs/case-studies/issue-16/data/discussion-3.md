# 3: fix: rename npm package and CLI to universal-translator

Rename the npm package and installed command to `universal-translator`, replacing the template identity before its first release. The package repository now points to this repository for npm provenance.

Fixes #2

- Rename the executable and update lockfile metadata, CLI examples, metadata assertions, experiments, all pending changesets, and the package-specific OIDC exchange assertion.
- Preserve `release.yml`, its OIDC permissions, and the bootstrap token fallback. Both release modes smoke-test the published command with `--version`.
- Add a patch changeset. Keep the version bump in the existing automated release process.
- Remove the retired identifier from docs; label redacted template case-study captures as historical evidence.
- Repair the upstream FAQ link and update vulnerable locked development dependencies exposed by CI. Enable repository Dependabot alerts to restore the dependency graph required by Dependency Review; keep every security check and threshold intact.

Validation:

- 73 focused tests passed across package metadata, packed/installed artifact, credential preflight, workflow reliability, and registry smoke-test helpers. The artifact test packs into a temporary directory, installs the tarball in a clean project, and verifies offline npm exec (`npx`) version/help/arithmetic plus library imports.
- `node experiments/verify-package-rename.mjs` confirms the artifact regression fails against the original default branch on its package-name assertion.
- Full `npm run check` (lint, formatting, duplication), documentation requirements, workflow configuration checks, Changesets release planning, and `git diff --check` passed. Both npm audits pass the high-severity threshold; nine moderate example-app findings remain.
- Bun package tests: 7 passed. Deno frozen-lockfile package tests: 6 passed, 1 existing direct symlink test explicitly skipped.
- All five CI workflows passed for `bc2e17f76368320c2fcd266d3f87c424f2ac7403`: [Checks and release](https://github.com/link-foundation/universal-translator/actions/runs/43776972353), [Security](https://github.com/link-foundation/universal-translator/actions/runs/43776972267), [Example app](https://github.com/link-foundation/universal-translator/actions/runs/43776972356), [Workflows](https://github.com/link-foundation/universal-translator/actions/runs/43776972254), and [Broken Link Checker](https://github.com/link-foundation/universal-translator/actions/runs/43776972324). All nine Node/Bun/Deno jobs across Linux/macOS/Windows passed, along with Changesets versioning validation. Publication/deployment jobs that do not run on PRs were skipped as expected.

**Unfinished external acceptance criteria:** the first registry publish and trusted publisher attachment are blocked by npm account access. `npm view universal-translator version` returns E404; `npm whoami` returns ENEEDAUTH; repository secrets list is empty (no bootstrap `NPM_TOKEN`). Local tarball execution does not prove registry-based `npx universal-translator --version` works. An npm maintainer must bootstrap the package and attach the publisher for organization `link-foundation`, repository `universal-translator`, workflow `release.yml`, no environment, allowing `npm publish`. The README and [release checklist](https://github.com/link-foundation/universal-translator/blob/issue-2-15825f954cd5/docs/issue-2-release.md) document the procedure. This PR remains unmerged and issue #2 is not fully completed.



## https://github.com/link-foundation/universal-translator/pull/3#issuecomment-6903747179 by konard

<!-- hive-mind:working-session-summary -->
## Working session summary

Updated [PR #3](https://github.com/link-foundation/universal-translator/pull/3) and marked it ready for review.

- Package, CLI, docs, tests, and release checks renamed.
- All five CI workflows passed, including nine runtime/OS test jobs.
- Working tree is clean; PR remains unmerged.

**Issue #2 remains incomplete:** first npm publication and trusted publisher attachment require npm account access. The package returns E404, and no npm credentials are available. Evidence and setup instructions are documented in the PR.

---
*This summary was automatically extracted from the AI working session output.*

## https://github.com/link-foundation/universal-translator/pull/3#issuecomment-6903757913 by konard

## 🤖 Solution Draft Log
This log file contains the complete execution trace of the AI solution draft process.

### 💰 **Cost estimation:**
- Model: GPT-6.1 Sol
- Provider: OpenAI
- Public pricing estimate: $4.024039

### 📊 **Context and tokens usage:**
- 322.8K input tokens across requests (cumulative, larger than the 272K context window, so not one request's context), 27.5K / 128K (21%) output tokens

Total: (322.8K + 11.6M cached) input tokens, 27.5K output tokens, $4.024039 cost

### 🤖 **Models used:**
- Tool: OpenAI Codex
- Requested: `gpt-6.1-sol`
- Thinking level: medium (~15999 tokens)
- **Model: GPT-6.1 Sol** (`gpt-6.1-sol`)

### 📎 **Log file uploaded as Gist** (1305KB)
- [View complete solution draft log](https://gist.githubusercontent.com/konard/5a04a055d004e4d216715e15dca63df2/raw/237d912f69f02a892e06e14954a191d50d1f52c6/tmp-hive-mind-log-upload-XmDuEI-sanitized.log.txt)

---
*Now working session is ended, feel free to review and add any feedback on the solution draft.*

## https://github.com/link-foundation/universal-translator/pull/3#issuecomment-6903798429 by konard

## 🎉 Auto-merged

This pull request has been automatically merged by hive-mind.
- All CI checks have passed

### Linked issues

- 🔒 Closed by GitHub: link-foundation/universal-translator#2

## Pull request description

Rename the npm package and installed command to `universal-translator`, replacing the template identity before its first release. The package repository now points to this repository for npm provenance.

Fixes #2

- Rename the executable and update lockfile metadata, CLI examples, metadata assertions, experiments, all pending changesets, and the package-specific OIDC exchange assertion.
- Preserve `release.yml`, its OIDC permissions, and the bootstrap token fallback. Both release modes smoke-test the published command with `--version`.
- Add a patch changeset. Keep the version bump in the existing automated release process.
- Remove the retired identifier from docs; label redacted template case-study captures as historical evidence.
- Repair the upstream FAQ link and update vulnerable locked development dependencies exposed by CI. Enable repository Dependabot alerts to restore the dependency graph required by Dependency Review; keep every security check and threshold intact.

Validation:

- 73 focused tests passed across package metadata, packed/installed artifact, credential preflight, workflow reliability, and registry smoke-test helpers. The artifact test packs into a temporary directory, installs the tarball in a clean project, and verifies offline npm exec (`npx`) version/help/arithmetic plus library imports.
- `node experiments/verify-package-rename.mjs` confirms the artifact regression fails against the original default branch on its package-name assertion.
- Full `npm run check` (lint, formatting, duplication), documentation requirements, workflow configuration checks, Changesets release planning, and `git diff --check` passed. Both npm audits pass the high-severity threshold; nine moderate example-app findings remain.
- Bun package tests: 7 passed. Deno frozen-lockfile package tests: 6 passed, 1 existing direct symlink test explicitly skipped.
- All five CI workflows passed for `bc2e17f76368320c2fcd266d3f87c424f2ac7403`: [Checks and release](https://github.com/link-foundation/universal-translator/actions/runs/43776972353), [Security](https://github.com/link-foundation/universal-translator/actions/runs/43776972267), [Example app](https://github.com/link-foundation/universal-translator/actions/runs/43776972356), [Workflows](https://github.com/link-foundation/universal-translator/actions/runs/43776972254), and [Broken Link Checker](https://github.com/link-foundation/universal-translator/actions/runs/43776972324). All nine Node/Bun/Deno jobs across Linux/macOS/Windows passed, along with Changesets versioning validation. Publication/deployment jobs that do not run on PRs were skipped as expected.

**Unfinished external acceptance criteria:** the first registry publish and trusted publisher attachment are blocked by npm account access. `npm view universal-translator version` returns E404; `npm whoami` returns ENEEDAUTH; repository secrets list is empty (no bootstrap `NPM_TOKEN`). Local tarball execution does not prove registry-based `npx universal-translator --version` works. An npm maintainer must bootstrap the package and attach the publisher for organization `link-foundation`, repository `universal-translator`, workflow `release.yml`, no environment, allowing `npm publish`. The README and [release checklist](https://github.com/link-foundation/universal-translator/blob/issue-2-15825f954cd5/docs/issue-2-release.md) document the procedure. This PR remains unmerged and issue #2 is not fully completed.

