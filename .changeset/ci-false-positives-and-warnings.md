---
'@link-foundation/universal-translator': patch
---

CI reports every failure and warning, and no longer passes or fails for the wrong reason.

- Errors thrown for an unreadable request body or custom rule keep the original error as their `cause`.
- The example app preview images are rendered on pull requests too, and the main-branch writer runs with the shell and tools it needs.
- ESLint 10 runs on every file; any warning fails in changed files, and on main every warning fails.
- Rustdoc and Cargo warnings fail the Rust checks.
- Every tracked JavaScript file is syntax checked, and a change to any non-documentation file runs the checks.
- The pipeline status gate compares fork pull requests with their pull head, and step budgets no longer stop commands that finish in time.
- The versioning dry run skips pull requests without a changeset instead of hiding the lint results.
- Release scripts load `command-stream` and `lino-arguments` from the lockfile, so the offline versioning dry run works, and versioning no longer runs `npm install`.
- The example app no longer installs deprecated packages, and its moderate `minimatch` and `fast-uri` advisories are fixed.
- The Security run lists every npm advisory and live deprecation, and fails on CodeQL findings that were not reviewed and dismissed.
- The desktop example app loads every skin again: its theme files are bundled instead of read with `node:fs/promises`, which is empty in the browser build. The example app build is split below the chunk size limit and fails on any build warning.
