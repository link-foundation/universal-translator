## Problem

The `Dry-run release versioning (PR only)` step in `.github/workflows/release.yml` runs `npm run changeset:version` on every pull request. `@changesets/cli` 3.x **exits 1** when `.changeset/` has no pending changesets:

```
🦋 changeset v3.0.3
No unreleased changesets found.
🦋 Exited with code 1
Error during version bump: Command failed with exit code 1
##[error]Process completed with exit code 1.
```

The template always has pending changesets on `main` today, so this does not show yet. After a release consumes them all, the first pull request without a changeset hits it. A docs-only pull request needs no changeset (`changeset-check` is skipped for it), so its lint job fails. Every later lint step (ESLint, Prettier, duplication check, secrets scan) is skipped and reports nothing, and those are false negatives.

This happened in a repository that follows the template: https://github.com/link-foundation/universal-translator/pull/11 ([failed run](https://github.com/link-foundation/universal-translator/actions/runs/45636376875)).

## Reproduction

```bash
d=$(mktemp -d) && cd "$d" && git init -q .
echo '{"name":"r","version":"1.0.0","private":true}' > package.json
mkdir .changeset
echo '{"changelog":false,"commit":false,"access":"restricted","baseBranch":"main"}' > .changeset/config.json
echo '# Changesets' > .changeset/README.md
npm i -q @changesets/cli@3.0.3
npx --no-install changeset version; echo "exit=$?"   # exit=1
```

## Workaround / fix

Skip the dry run with a notice when nothing is pending, and leave missing changesets to `changeset-check`:

```yaml
      - name: Dry-run release versioning (PR only)
        if: github.event_name == 'pull_request'
        env:
          npm_config_offline: 'true'
          npm_config_ignore_scripts: 'true'
        run: |
          pending="$(find .changeset -maxdepth 1 -name '*.md' ! -name README.md | wc -l)"
          if [ "$pending" -eq 0 ]; then
            echo "::notice title=No changesets to version::Skipped the versioning dry run."
            exit 0
          fi
          trap 'git restore --source=HEAD --staged --worktree -- .' EXIT
          npm run changeset:version
          git status --short
```

A regression test that extracts the step script and runs it with a stub `npm` in a directory that has only `.changeset/README.md` is in `js/tests/changeset-config.test.js` of the PR above (commit 6897d89).
