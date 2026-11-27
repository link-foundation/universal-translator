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

## Original C++ source and C target

The [original Safari capture](data/attachments/issue-16-8.image) shows a
solid blue block below line 12 with the app theme. The C++ sample now
produces a complete C translation after the separate exception fix.

`node experiments/issue-16-gutter-cpp-c.mjs /path/to/captures` uses the
same 12 source lines, the C target, the dark app theme and the cursor on
line 12. The experiment enlarges the source editor to expose the blank
gutter. It records five WebKit 26.4 states: the initial cursor, a click
below the last line, drags in both directions across the last line, and
Select All. The click and both drags selected the closing brace. Mapping
decorations ended at the bottom of line 12 in all five states, and the
39,900 sampled pixels in the blank gutter were `#21302c` in each capture.
The browser reported no page errors. The same source and target also ran
in Chromium through Playwright MCP.

[WebKit capture after dragging toward the blank gutter](../../screenshots/issue-16/gutter-cpp-c-webkit.png)
