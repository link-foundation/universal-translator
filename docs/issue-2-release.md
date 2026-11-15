# Issue 2: package rename and first release

## Requirements and verification plan

- Rename package and lockfile root to `universal-translator`; keep their versions
  synchronized. Verify with package metadata tests and `npm pack`.
- Rename bin command and file; retain arithmetic commands and library exports.
  Verify direct, symlink, and installed tarball CLI execution, including `--version`.
- Update README, experiments, pending changesets, release probes, and pack checks.
  Verify no retired identifier remains in tracked package metadata or docs.
- Preserve the existing release workflow and OIDC permissions. Verify workflow
  regression tests and package-specific preflight exchange at the new name.
- Prepare the next release with a changeset and verify versioning in CI.
- Bootstrap the first npm release and attach its trusted publisher. Verify with
  `npm view universal-translator version`, registry-based `npx` execution, and
  a successful OIDC package exchange from `release.yml`.
- Review PR diff, merge latest main, check CI for the final SHA, update PR #3,
  and mark ready for review. Leave the PR unmerged.

## Historical evidence

The issue-58 case study came from the source template. Its retired package
identifier is redacted as `historical-template-package`; the old registry and pack
captures are historical evidence, not verification of this package's release.

## External release blocker (2026-11-15)

`npm view universal-translator version` returns E404. `npm whoami` returns
ENEEDAUTH. `gh secret list --repo link-foundation/universal-translator` returns no
repository secrets, including no `NPM_TOKEN` bootstrap credential. No npm account
session is available here to create the package or attach a trusted publisher.

The code rename and local tarball checks cannot prove a registry release or an
attached publisher. These acceptance criteria remain **unfinished** until an npm
maintainer bootstraps publication and attaches the GitHub Actions publisher for
`link-foundation/universal-translator`, workflow `release.yml`, no environment,
with publish permission. README contains the release and verification procedure.

Fixes #2
