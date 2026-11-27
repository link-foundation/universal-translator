# Gutter selection investigation

Requirement 16.17 in [PR 17](https://github.com/link-foundation/universal-translator/pull/17)
remains open: the original solid blue block below the source lines has not been
reproduced in the available Chromium and WebKit versions.

`experiments/issue-16-gutter-selection.mjs` makes five bounded WebKit selections
around the source margin and final line. Run it against the example application's
development server on port 5173. It saves the actual DOM selections, Monaco
decorations, screenshots and browser errors under the case-study logs directory,
and closes its browser in `finally`.

`docs/screenshots/issue-16/gutter-investigation.png` and
`gutter-webkit-before.png` preserve inspected states; neither reproduces the
original artifact and neither establishes that it is fixed. Empty search results
are retained as `data/prior-art/monaco-blue-gutter.json` and
`monaco-safari-selection.json`. Existing bounds checks and coverage-rejection
regressions address separately demonstrated defects.

The `logs/investigation-*` files preserve the earlier working logs without
overwriting the original committed records. The `data/*-latest.json` snapshots
refresh the issue and all three pull-request discussion channels. They do not
replace the original historical archive.
