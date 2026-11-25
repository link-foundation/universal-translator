# Issue 12 Case Study: Improve And Polish The UI/UX And The Entire Codebase

Issue: https://github.com/link-foundation/universal-translator/issues/12
Pull request: https://github.com/link-foundation/universal-translator/pull/13

## Data Collected

| File                                                                                                                                                       | What it is                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [data/issue.json](data/issue.json)                                                                                                                         | The issue as `gh issue view --json` gives it                                                       |
| [data/issue-comments.json](data/issue-comments.json)                                                                                                       | Its comments (none when the work started)                                                          |
| [data/pr-comments.json](data/pr-comments.json), [data/pr-review-comments.json](data/pr-review-comments.json), [data/pr-reviews.json](data/pr-reviews.json) | Conversation, inline comments and reviews of PR 13                                                 |
| [data/screenshot-1.png](data/screenshot-1.png), [data/screenshot-2.png](data/screenshot-2.png)                                                             | The two screenshots of the issue: the title and the inputs at different places for two examples    |
| [data/before-translate.png](data/before-translate.png)                                                                                                     | The demo before the work, light scheme                                                             |
| [data/before-glass-light.png](data/before-glass-light.png), [data/before-glass-dark.png](data/before-glass-dark.png)                                       | The glass skin before the work: light applies, dark does not                                       |
| [data/before-layout-shift.json](data/before-layout-shift.json)                                                                                             | Boxes of the pickers and panes measured with Playwright after each random example, before the work |
| [upstream/](upstream/)                                                                                                                                     | The two reports filed to link-foundation/ui, as sent                                               |
| [../../screenshots/issue-12/](../../screenshots/issue-12/)                                                                                                 | The demo after the work                                                                            |

Experiments (all in `experiments/`, rerunnable):

- `issue-12-meta-view.mjs`, `issue-12-meta-fields.mjs`, `issue-12-meta-parity.sh`: the meta view
  before and after, and JS against Rust on every example program (text view and `--json`).
- `issue-12-lino-shapes.mjs`, `issue-12-rules-roundtrip.mjs`: how Links Notation keeps rules
  and multi-line quoted texts.
- `issue-12-highlight-probe.mjs`, `issue-12-meta-highlight-probe.mjs`, `issue-12-natural-names.mjs`,
  `issue-12-params.mjs`: highlighting taken from meta programs, natural-language names included.
- `issue-12-monaco-spans.mjs`: the spans, classes and colours Monaco renders for a translated pane.
- `issue-12-skin-specificity.mjs`: why skins applied in the light scheme only.
- `issue-12-vite-theme-url.mjs`: what Vite makes of ui-themes' theme file URL without the workaround.
- `theme-probe.mjs`: root attributes and colours after a shared settings link.
- `issue-12-screenshots.mjs`: takes the screenshots of `docs/screenshots/issue-12` (all but the
  settings drawer) from the preview server.

## Timeline

| Time (UTC, 2026-11-25) | Event                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14:21                  | Issue 12 opened with two screenshots                                                                                                                                                                                                                    |
| 14:31                  | PR 13 opened as a draft (`a213bd5`)                                                                                                                                                                                                                     |
| 14:40–15:00            | Data collected; the layout jumps measured (`before-layout-shift.json`); the glass skin reproduced in a dark OS scheme: `data-theme="glass"` is set and its stylesheet is loaded, yet `--color-surface` stays `#141a18` (the app's) instead of `#0b1626` |
| 15:03                  | `b2f389c` Meta view without field labels and block markers, JS and Rust                                                                                                                                                                                 |
| 15:07–15:10            | `851d590`, `25ed051` Rules as indented Links Notation in JS and Rust (`readRules`/`formatRules`, `read_rules`/`format_rules`); the CLIs and the server read it, JSON is still read                                                                      |
| 15:22                  | `173139e` Saved standards and word standards stored as Links Notation; `monaco-editor` added                                                                                                                                                            |
| 16:44                  | `79164d3` The demo: Rules tab, optional Monaco editor, highlighting from the meta language, word wrap, equal panes, "How it works" below, skins that apply, `?debug`                                                                                    |
| 16:48                  | `f0219fd` Unit tests for the highlighting and the standards storage (node, bun, deno)                                                                                                                                                                   |
| 16:55                  | `5f57683` Browser end-to-end test for all of it                                                                                                                                                                                                         |
| 16:59                  | `35fca8d` Experiments for the two skin causes                                                                                                                                                                                                           |
| 17:00                  | Reported upstream: link-foundation/ui#292 and link-foundation/ui#293                                                                                                                                                                                    |
| 17:04                  | `4bfaf9a` Changeset; the upstream reports kept in `upstream/`                                                                                                                                                                                           |
| 17:09–17:17            | `72160bb` Check boxes aligned with the controls above them (E2E checks every row); `276275c` screenshots retaken by a script                                                                                                                            |
| 17:22                  | `5b7a512` Audit finding B1: the JS CLI in shell pipes (`EAGAIN`, `EPIPE`)                                                                                                                                                                               |
| 17:27                  | `0221357` Audit finding P9: `coverage` and `detect` print Links Notation by default                                                                                                                                                                     |

## Requirements

| #   | Requirement (from the issue)                                                 | Where it is done                                                                                                                                                                                                                                     | How it is checked                                                                                                                                     |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Content of any size; the title and the inputs do not jump                    | `styles.css` (fixed control heights, pickers of a fixed width, the example note on its own line of fixed height, panes between `--pane-min` and `--pane-max`)                                                                                        | E2E `keepsTheLayoutStill`: title and picker positions equal for a one-line and a 30-line text                                                         |
| 2   | Optional Monaco editor with our highlighting from the meta language          | `CodeEditor.js`, `monaco.js`, `highlight.js`; setting "Text editor" (plain or Monaco)                                                                                                                                                                | E2E `editsInMonaco` (both panes Monaco, `gcd` and `48` coloured differently); `js/tests/universal-app-issue-12.test.js`                               |
| 3   | Left and right panes always of the same height                               | `.pane` grid rows stretch both panes; Monaco grows its holder and the other pane follows                                                                                                                                                             | E2E `keepsTheLayoutStill` and `editsInMonaco`                                                                                                         |
| 4   | "How it works" moves down                                                    | `App.js`: an `about-panel` below the translator, full width                                                                                                                                                                                          | Screenshots                                                                                                                                           |
| 5   | Word wrap on/off                                                             | `#word-wrap` check beside the options and a "Word wrap" setting; `data-wrap` on the root; Monaco `wordWrap`                                                                                                                                          | E2E `wrapsLongLines`                                                                                                                                  |
| 6   | Rules on their own tab                                                       | `App.js` tab `rules`; `RulesEditor.js` (rows and the Links Notation text); a note on the Translate tab while rules are in use                                                                                                                        | E2E `detectsAndTranslatesPartially`, `editsRulesAsLinksNotation`                                                                                      |
| 7   | Every element carefully aligned                                              | One control height (`--control-height`), one radius, labels on one baseline, the swap button square, the options row wrapping without gaps on narrow screens                                                                                         | Screenshots (desktop, mobile, dark, glass)                                                                                                            |
| 8   | No JSON by default for rules, standards or settings: indented Links Notation | Rules: `js/src/translation/rules-notation.js`, `rust/src/custom_rules.rs`; the CLIs' `--rules` and the server read `.lino`; the demo stores rules, standards, word standards and settings as Links Notation (JSON of earlier versions is still read) | `js/tests/rules-notation.test.js`, Rust tests, `universal-app-issue-12.test.js`, E2E (localStorage `rules` starts with `output:`)                     |
| 9   | In the meta language `x:` only for unique things; no `body: block`           | `js/src/meta/notation.js`, `rust/src/meta/notation.rs`: one line per node, children nested, no block lines, `otherwise` for the second branch                                                                                                        | `js/tests/meta-notation.test.js`, `rust/tests/grammar.rs`, `issue-12-meta-parity.sh` (13 example programs, JS = Rust)                                 |
| 10  | The whole codebase and all earlier issues and PRs delivered                  | Audit of issues 1, 6 and 8 against the code, below                                                                                                                                                                                                   | See "Audit of earlier issues"                                                                                                                         |
| 11  | Skins do not work: find out why, report upstream                             | `styles.css` palette scoped to the app skin; panel radius, opacity and blur from the theme tokens; Monaco takes the skin colours                                                                                                                     | E2E `changesTheSettings` (glass changes the panel in light and dark); `issue-12-skin-specificity.mjs`; link-foundation/ui#292, link-foundation/ui#293 |
| 12  | Case study with data, timeline, requirements, root causes, solutions         | This folder                                                                                                                                                                                                                                          | —                                                                                                                                                     |
| 13  | Debug output where data is missing                                           | `examples/universal-app/src/debug.js`: `?debug` or localStorage `universal-translator.debug=1`; the CLIs already have `--trace`                                                                                                                      | Manual                                                                                                                                                |
| 14  | Issues in other repositories reported with repro, workaround and fix         | link-foundation/ui#292, link-foundation/ui#293                                                                                                                                                                                                       | —                                                                                                                                                     |
| 15  | Apply everything to the whole codebase (JS and Rust alike)                   | Meta view and rules in both; the CLIs alike                                                                                                                                                                                                          | Parity scripts and tests in both                                                                                                                      |

## Root Causes

### The title and the inputs jumped

Measured before the work (`data/before-layout-shift.json`, 1280×900):

- The note of a random example ("Function: …") wrapped onto its own line and pushed the pickers
  32 px down.
- A picker changed width (188 ↔ 322 px) when its version select appeared or disappeared, so the
  pickers moved sideways.
- Each pane grew with its own text: the source and the translation started at different heights
  (593 vs 536 px) and had different heights (318 vs 375 px).

The fix gives every row a fixed height whatever its content: the example note sits on a line of its own
height, the version select keeps its place (disabled when there is none), and the two panes share one
grid row that grows with the longer text between 260 px and 70% of the window, then scrolls.

### Skins did not work

Two independent causes:

1. **Specificity of the app palette.** `compileThemeCss` writes every skin rule as
   `[data-theme="glass"]:where(…)`, specificity (0,1,0). The app's own palette was `:root` in the
   light scheme (0,1,0: the skin won by order only) and `:root:not([data-scheme='light'])` in the
   dark scheme (0,2,0: the app always won). So skins applied in the light scheme and not in the dark one
   (`before-glass-dark.png`). `experiments/issue-12-skin-specificity.mjs` reproduces it in Chromium:
   `before dark: #141a18` against `after dark: #0b1626`. The fix scopes the palette to
   `:root:not([data-theme]), [data-theme='app']`.
   Reported as link-foundation/ui#293 (document it, or let `compileThemeCss` write to a `@layer`).
2. **Shapes were not taken from the skin.** Even with the colours right, the panels kept their 8 px
   corners and an opaque card: the CSS used fixed values. They now come from the theme tokens
   (`--surface-radius`, `--ui-control-corner`, `--surface-opacity`, `--surface-blur`), with the
   app's values when a theme has none.

A third cause had been worked around before this issue, but it was never reported: in a Vite build,
`loadTheme` of ui-themes fetches `…/assets/undefined`. Vite compiles
``new URL(`../themes/${path}`, import.meta.url)`` into a one-level glob that is empty
(`experiments/issue-12-vite-theme-url.mjs` prints
``new URL(Object.assign({})[`../themes/${e}`], import.meta.url)``). Reported as link-foundation/ui#292.

### `body: block` in the meta language

The meta view wrote every child under its field name (`condition:`, `then:`, `value:`) and every block
as `main: block` / `statements`. In Links Notation `name:` names a link, which is meant to be unique, but
these field names repeat on every line. The meta program itself needs neither: the kind of a node says
what its children are (an `if` has a condition, then a block, then optionally another). Before and after,
for one Python `if`/`else`:

```
program                                   program
  main: block                               if
    statements                                binary greater (type boolean)
      if                                        name x
        condition: binary (operator greater)    number 1 (type integer)
          left: name (name x)                 print (newline true)
          right: number (value 1)               text big (type text)
        otherwise: block                      otherwise
          statements                            print (newline true)
            print (newline true)                  text small (type text)
              value: text (value small)
        then: block
          statements
            print (newline true)
              value: text (value big)
```

Blocks are not written; a second block is introduced by one plain word (`otherwise`). `--json` keeps the
full structure for programs that need the field names.

### JSON for rules, standards and settings

Rules were a JSON object (`--rules rules.json`, the server's `rules` field, the demo's text box);
saved standards and word standards were JSON in localStorage. Settings were already Links Notation
(ui-settings). Rules are now indented Links Notation:

```
output:
  (find console.log) (replace print)
names:
  (find total) (replace sum)
```

The readers still accept JSON when a text starts with `{` (or `[` for stored standards), so nothing
saved earlier is lost.

### Highlighting: problems found on the way

- The demo's `.field span` rule (specificity 0,1,1) overrode the `.hl-*` colour classes. It now
  applies only to the field's own label.
- Monaco's `setTheme` writes `<style>` into `<head>`; a MutationObserver on `<head>` that repainted
  the theme looped forever. It now reacts to the skin's own `#ui-theme` stylesheet only, and
  `applySkin` sets a theme only when its colours changed.
- `color-mix(in oklab, …)` computes to `oklab(…)`, which Monaco cannot read (it took it as black).
  The colours are converted to `#rrggbb` by painting one canvas pixel.
- Natural languages write names in their own words (`gcd-of` is `gcd-из` in Russian): the
  highlighter asks the writer (`writeName`) for the written form of every name of the meta program.
- Words with combining marks (Bengali `লেখো`) were split: the word pattern now includes `\p{M}`.
- A pane whose translation failed has no lexicon; Monaco's tokenizer crashed on it. Such a pane is now
  plain text.
- Python tuple assignment (`a, b = b, a % b`) is not read by the translator
  (`Unexpected "," after statement`). While such a text is typed, the highlighter keeps the names of
  the last text that it could read.

## Solutions And Alternatives

| Need                  | Chosen                                                                                                                                                                                                                                           | Alternatives considered                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code editor           | Monaco (`monaco-editor` 0.58, ESM, loaded only when chosen; only the features a pane uses are imported)                                                                                                                                          | CodeMirror 6 (smaller, already a dependency of ui-components; it would need its own tokenizer too); a plain textarea stays the default                               |
| Highlighting          | Our own: the words of the meta program the translator reads (names, functions, values) and the comment/quote marks of the language description; one highlighter for the plain panes and for Monaco (`highlightLine` is a Monaco tokens provider) | TextMate grammars (Shiki), Prism, highlight.js, Tree-sitter: a grammar per language (32 programming and 30 natural ones), and they know nothing of the meta language |
| Equal panes that grow | CSS grid row with `align-items: stretch`, `field-sizing: content` for the textarea, min/max heights; Monaco reports its content height                                                                                                           | JavaScript measuring both panes on every change                                                                                                                      |
| Skins                 | Scope the app palette to the app skin; shapes from the theme tokens                                                                                                                                                                              | Load the app palette in a lower `@layer` (needs the skin in a layer too, see ui#293)                                                                                 |
| Storage               | Indented Links Notation (`links-notation` already a dependency) with JSON still read                                                                                                                                                             | JSON (what the issue asks to move away from)                                                                                                                         |
| Debug output          | `?debug` in the demo; `--trace` in the CLIs                                                                                                                                                                                                      | —                                                                                                                                                                    |

Online references:

- Vite: `new URL(url, import.meta.url)` and how template literals become globs:
  https://vite.dev/guide/assets.html#new-url-url-import-meta-url
- CSS specificity of `:where()` (zero) and `:is()`/`:not()` (their argument):
  https://developer.mozilla.org/docs/Web/CSS/:where
- Cascade layers: https://developer.mozilla.org/docs/Web/CSS/@layer
- `field-sizing`: https://developer.mozilla.org/docs/Web/CSS/field-sizing
- Monaco tokens providers (`setTokensProvider`, `IState`):
  https://microsoft.github.io/monaco-editor/typedoc/functions/languages.setTokensProvider.html

## Audit Of Earlier Issues

The earlier issues (1, 6 and 8) and their pull requests were read again against the code, the
CLIs were run in shell pipes, and both CLIs were compared on the same inputs. Found and fixed here:

| #   | Finding                                                                                                                                                                                                                                             | Evidence                                                                                                             | Done                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | The JS CLI crashed in shell pipes: `readFileSync(0)` throws `EAGAIN` when the writer is not ready yet (`(sleep 1; echo 'print(1)') \| universal-translator ...`), and a reader that closes early (`\| true`, `\| head`) raised an unhandled `EPIPE` | Both reproduced with `sh -c`; Node's own child streams are sockets and never show it, so the earlier tests missed it | `5b7a512`: `readStandardInput` waits on `EAGAIN`; `EPIPE` ends the CLI quietly. `js/tests/cli-pipes.test.js` fails before, passes after  |
| P9  | `coverage` and `detect` printed JSON by default, against "no JSON by default" (requirement 8)                                                                                                                                                       | Both CLIs, `README.md`                                                                                               | `0221357`: indented Links Notation by default in JS and Rust (same bytes), `--json` for JSON; `issue-8.test.js`, `rust/tests/issue_8.rs` |

Checked and left as they are, because they are the design or outside this issue (each is a
translation-quality or porting task of its own, the kind issue 8 tracks):

| #   | Gap                                                                                                                                                                                                                                                                              | Evidence                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| B2  | The meta language has whole numbers only (`js/src/meta/types.js`: "integer, text, boolean, nothing, and array"), so Python 3 `7 / 2` becomes `Math.trunc(7 / 2)` and `1.5 + 2` is printed with `%d` in C. Real numbers would need a new meta type in every language, JS and Rust | `printf 'print(7 / 2)\n' \| universal-translator translate python javascript -` prints `console.log(Math.trunc(7 / 2));`          |
| B3  | `translate-program`, `encode-cst` and `decode-cst` of the JS CLI need `UNIVERSAL_TRANSLATOR_META_LANGUAGE` (the Meta Language 1.0 module); the CLI says so when it is missing                                                                                                    | `GRAMMAR_ENGINE` in `bin/universal-translator.js`                                                                                 |
| P1  | Wordings the natural languages do not read yet: "while … do this", "no more than"/"не более"/"не превышает", ASCII quotes, Chinese with ASCII `:` and without spaces, German verb-last word order                                                                                | `translate english python`, `translate russian python` on those sentences                                                         |
| P2  | Comments are translated word by word                                                                                                                                                                                                                                             | `--comment-language`                                                                                                              |
| P3  | The concrete syntax tree keeps whitespace between statements, not inside expressions                                                                                                                                                                                             | `encode-cst` / `decode-cst`                                                                                                       |
| P4  | Versions exist for Python (`python@2`) and British English only                                                                                                                                                                                                                  | `js/src/formal/versions.js`                                                                                                       |
| P5  | Wikidata words are used by the web demo only; Rust has none                                                                                                                                                                                                                      | `examples/universal-app`                                                                                                          |
| P6  | Ranking of alternatives, corpus probabilities and relative meta logic from issue 1 are not used in translation                                                                                                                                                                   | `js/src` has no ranking step                                                                                                      |
| P7  | Rosetta Code: 0 of 1782 tasks are read completely in every language; 39.4% of all lines are read                                                                                                                                                                                 | [`../issue-8/data/rosetta-code/README.md`](../issue-8/data/rosetta-code/README.md)                                                |
| P8  | Rules have four stages (source, templates, names, output)                                                                                                                                                                                                                        | `ruleStages`                                                                                                                      |
| P10 | The Rust CLI has no `serve` and no standards                                                                                                                                                                                                                                     | `universal-translator serve` prints the usage                                                                                     |
| P12 | No Hello World Collection corpus                                                                                                                                                                                                                                                 | `scripts/`                                                                                                                        |
| —   | JavaScript arrow functions and classes are not read (they stay as comments with their error); same-effect mode drops comments                                                                                                                                                    | `const f = (x) => x + 1;` gives `# untranslated (line 1): The fragment is not complete: Unexpected "=>" after statement (line 1)` |

`scripts/check-requirements.mjs` reports every requirement of issues 1, 6 and 8 as done or
blocked: it checks that the evidence each `requirements.lino` names exists and its check passes,
not how much of each language is read, so it does not show the gaps above.

## Debugging

- Demo: open it with `?debug` (or set localStorage `universal-translator.debug` to `1`). Every
  translation (with how long it took), the names and functions the highlighter took from the meta
  program, the settings applied, and Monaco's loading and skin colours are written to the console.
- CLIs: `translate … --trace` prints every pipeline stage; `meta <language> --json` prints the full
  meta program.
