# Gutter selection investigation

Requirement 16.17 in [PR 17](https://github.com/link-foundation/universal-translator/pull/17)
remains open. The original solid blue block below the source lines has not
appeared in the recorded Chromium, desktop WebKit and Apple Safari runs.

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

## Build deployed when the issue was opened

GitHub Pages deployment `8081803241` served `ec8f530` on November 26 at
09:50 UTC. Web build artifact `15105185261` recreates the partial C translation
from the report. [Deployment workflow](https://github.com/link-foundation/universal-translator/actions/runs/45795514232)

The same five WebKit 26.4
interactions show the original three mapping bars ending at line 11. Each
frame has 39,900 background pixels of `#21302c` in the sampled blank gutter.
The page reported zero errors.

```sh
mkdir -p /tmp/gutter-deployment /tmp/gutter-captures
gh run download 45795514232 --repo link-foundation/universal-translator \
  --name universal-example-web --dir /tmp/gutter-deployment/universal-translator
python3 -m http.server 5174 --bind 127.0.0.1 --directory /tmp/gutter-deployment &
gutter_server=$!
node experiments/issue-16-gutter-cpp-c.mjs /tmp/gutter-captures \
  http://127.0.0.1:5174/universal-translator/ \
  /universal-translator/assets/monaco-DKl3p0Qm.js 'untranslated (line 1)'
kill "$gutter_server"
```

[WebKit capture of the deployment](../../screenshots/issue-16/gutter-deployed-webkit.png)
[Browser observations](logs/gutter-deployed-webkit.jsonl)

## Apple Safari comparison

The initial Safari probe reported browser text selections during dragging.
Translation could replace the editor and drop its temporary height setting.
The pointer in that probe could land outside the margin, invalidating the
selection evidence. The corrected probe applies the height to the pane by
selector, scrolls after translation and verifies that the pointer hits the
margin at least 24 CSS pixels below the last line.

Safari 27.2 hit the blank margin on both builds. The initial state, click and
drags in both directions had zero native selection characters. In every state
the deployed build had three mapping bars and the current build had eleven.
Every bar ended within the source lines. The element screenshot after the last
drag had 12,650 sampled blank-margin pixels of `#21302c` on each build. The
original report sampled at its screenshot coordinates has 50,400 pixels of
`#6383a7` in the block. These runs leave the original highlight unexplained.
[Apple Safari comparison job](https://github.com/link-foundation/universal-translator/actions/runs/46086442418/job/140797184218)

```sh
gh workflow run example-app.yml --repo link-foundation/universal-translator \
  --ref issue-16-fb080613587e -f safari_reference_run=45795514232
node experiments/issue-16-gutter-pixels.mjs \
  docs/screenshots/issue-16/gutter-deployed-safari.png 2 260 46 275
```

[Current Safari capture](../../screenshots/issue-16/gutter-current-safari.png)
[Deployed Safari capture](../../screenshots/issue-16/gutter-deployed-safari.png)
[Current observations](logs/gutter-current-safari.jsonl)
[Deployed observations](logs/gutter-deployed-safari.jsonl)

## Tracing a new occurrence

Open the app with `?debug` and filter its browser console for
`[universal-translator:gutter]`. Each gutter press or release records the
pointer position, the end of the last model line, the bottom of the last
mapping bar and the browser selection bounds, in pixels relative to the
editor. The gutter messages exclude editor text and are off by default.
The web end-to-end check verifies the default and debug paths.
