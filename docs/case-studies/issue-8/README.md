# Issue 8 Case Study: Better Translation Quality

## Data Collected

Raw snapshots are stored in `data/`:

- `issue.json`: the issue body and metadata
  (`gh issue view 8 --json ...`).
- `issue-comments.json`, `pr-comments.json`, `pr-review-comments.json`: the
  discussion on the issue and on pull request #9. They were empty when this
  study was written.
- `rosetta-code/` (in `data/`): the coverage report over every Rosetta Code task,
  regenerated with `node scripts/rosetta-code.mjs all` (see below).

Online sources reviewed on 2026-11-25:

- Rosetta Code task categories, read through the MediaWiki API:
  <https://rosettacode.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Programming_Tasks>
  and `Category:Draft_Programming_Tasks`. The issue links
  <https://rosettacode.org/wiki/Category:Solutions_by_Programming_Task>.
- Language detection:
  - GitHub Linguist: <https://github.com/github-linguist/linguist>
    (heuristics, then a Bayesian classifier over tokens);
  - guesslang: <https://github.com/yoeo/guesslang> (a TensorFlow model);
  - highlight.js `highlightAuto`:
    <https://highlightjs.readthedocs.io/en/latest/api.html#highlightauto>
    (scores the relevance of every grammar);
  - franc and cld3 for natural languages: <https://github.com/wooorm/franc>,
    <https://github.com/google/cld3>.
- Partial parsing and error recovery:
  - tree-sitter: <https://tree-sitter.github.io/tree-sitter/> (`ERROR`
    nodes, incremental parsing);
  - panic-mode recovery in ANTLR:
    <https://www.antlr.org/papers/erro.pdf>.
- Rule editors driven by data: Blockly <https://developers.google.com/blockly>
  and JSON-schema form editors such as
  <https://github.com/rjsf-team/react-jsonschema-form>.

## Timeline

| Time (UTC)       | Event                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-11-25 07:14 | Release 0.12.0 is on `main`.                                                                             |
| 2026-11-25 08:42 | Issue #8 is opened.                                                                                      |
| 2026-11-25 08:56 | Draft pull request #9 is opened on `issue-8-a666e1cbe6e5`.                                               |
| 2026-11-25 09:07 | Comparison wordings, Python `pass`, partial translation and language detection land.                     |
| 2026-11-25 09:12 | Translation rules as data at every stage; the server translates partially and detects.                   |
| 2026-11-25 09:15 | The web demo gets auto-detection, a list of untranslated parts and a visual rules editor.                |
| 2026-11-25 09:32 | The Rosetta Code coverage script lands. Its first run hung, and that led to a parser bug (root cause 5). |
| 2026-11-25 09:38 | All 1772 Rosetta Code tasks (programming and draft) are downloaded.                                      |
| 2026-11-25 10:02 | The first full coverage run finishes: 39.4% of 1,292,095 solution lines read.                            |
| 2026-11-25 10:10 | Rust gets partial translation, detection, rules as data and the CLI flags.                               |

## Requirements

| #   | Requirement                                                                                                    | Where it is done                                                                                           | Verified by                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| R1  | Read `Если n меньше или равно 1, сделать это:` / `больше или равно`                                            | `data/natural/russian.lino` and every other language's variants                                            | `js/tests/issue-8.test.js` "reads the Russian examples"                          |
| R2  | Read the "other obvious variations" (`либо`, `не больше`, `<=`, `≤`, `at most`, ...) in every natural language | `data/natural/*.lino`, `experiments/issue-8-add-variants.mjs`                                              | "reads other obvious variations", `checkDescription` for every language          |
| R3  | Load every Rosetta Code task automatically                                                                     | `scripts/rosetta-code.mjs download`                                                                        | `js/tests/rosetta-code.test.js` (offline fixture), `data/rosetta-code/README.md` |
| R4  | Sort the tasks by simplest meaning                                                                             | `sortBySimplicity` (median solution length, then how many languages solve it)                              | `js/tests/rosetta-code.test.js`                                                  |
| R5  | A parsing mode that reads all it can and counts the missing parts                                              | `parsePartial` in JS and Rust, `coverage` CLI command                                                      | `js/tests/issue-8.test.js`, Rust `issue_8` tests, the report                     |
| R6  | Translate partially by default and mark untranslated parts with their errors                                   | `translatePartial`; the CLI, server and web demo default to it                                             | tests, `docs/screenshots/issue-8/partial-translation.png`                        |
| R7  | Keep all-or-nothing as an option                                                                               | `--all-or-nothing`, `allOrNothing` in the server, a checkbox in the demo                                   | tests, e2e                                                                       |
| R8  | Configurable rules at each stage                                                                               | `rules` setting (`source`, `templates`, `names`, `output`), `--rules file.json`, `withRules`               | "rules as data" tests                                                            |
| R9  | A visual rules editor in the web demo                                                                          | `examples/universal-app/src/RulesEditor.js`                                                                | `e2e/translate.e2e.mjs`, `docs/screenshots/issue-8/rules-editor.png`             |
| R10 | Auto-detect the source language by default in the UI                                                           | `detectLanguage`; "Auto-detect" is the demo's default source; `auto` in the CLI and server                 | detection tests, e2e                                                             |
| R11 | Collect the data and write this case study                                                                     | this folder                                                                                                | —                                                                                |
| R12 | Add debug output where root causes are unclear                                                                 | `coverage --verbose` prints per-task timing; `experiments/issue-8-rosetta-timing.mjs` times every solution | used to find root cause 5                                                        |
| R13 | Report problems in other projects                                                                              | none found: every root cause was in this repository                                                        | —                                                                                |
| R14 | Apply every fix to the whole codebase (JS and Rust)                                                            | Rust ports of partial reading, detection, rules and CLI flags                                              | Rust tests                                                                       |

## Root Causes

1. **Comparison wordings.** Each natural language listed one template per
   comparison (`{left} меньше или равен {right}`). The neuter form the issue
   uses (`равно`), `либо` for `или`, `не больше` and the symbols were missing.
   Template words also had to be letters, so `<=` and `≤` could not be added
   as variants.
2. **`pass` as a statement.** Python's `pass` was translated as a call
   named "проход" instead of the "do nothing" meaning, so going back from
   Python produced an unknown sentence.
3. **All-or-nothing by design.** `translate` threw on the first error, so a
   text with one unknown line translated to nothing. There was no way to
   count what was read, so no way to measure Rosetta Code coverage.
4. **Rules lived only in code.** Understanding, meaning and context rules
   were JavaScript functions. The CLI, the server and the web demo could not
   accept rules as data, and there was nowhere to edit them.
5. **Reading past the end of the text (found by the Rosetta run).** The JS
   `Parser.next()` returned `undefined` past the end token while `peek()`
   stayed on the end token. A dialect loop such as Ada's
   `while (!this.accept(';')) this.next();` therefore never ended on a cut
   text like `procedure P is`. Partial reading cuts texts into parts, so it
   hung on the first Rosetta Code task (2048, Ada). The Rust parser already
   returned "Unexpected end of program", so this was also a parity gap.
   `next()` now throws the same error in JS. A regression test is in
   `js/tests/issue-8.test.js` ("cut texts").

## Rosetta Code Results

The first full run (`data/rosetta-code/README.md`) reads 1782 tasks: every
programming and draft task with a solution in one of our languages. It
counts the first solution in each language, 1,292,095 written lines in all.
Partial reading covers 508,806 of them (39.4%). Coverage per language ranges
from about 55% (Java, Dart, TypeScript, Lua, Go) down to 20–24% (Perl, Fortran, Bash, Ada, Pascal), 18% for Objective-C, and
under 11% for Lean and Rocq, which have only 7 and 14 solutions. Hundreds of single-language
solutions already read completely. No task reads completely in _every_
language yet. The report lists the simplest tasks first with their missing
lines, so grammar work can follow it in order.

The issue's long-term goal is to translate _every_ Rosetta Code
solution, and this pull request does not reach it. What it delivers is
what the issue asks for on the way there:

- loading every task;
- the simplest-first order;
- the partial mode that counts the missing parts;
- the first measurements.

The remaining 60% of lines need grammar and meaning work, language by
language, guided by this report. `coverage.json` keeps
per-task, per-language counts of read lines and missing parts.

The run also found root cause 5. Before the fix, partial reading never
finished on the very first task.

## Solutions And Alternatives

- **Detection.** Machine-learned classifiers (guesslang, Linguist's Bayesian
  step, cld3) need a model and training data and know nothing about our
  grammars. Like highlight.js, we score every grammar instead, but the score
  comes from _how much of the text the grammar actually reads_. It is
  `100 × coverage`, plus evidence from each language's own syntax tables:
  its print call, function keyword and comment marker. For controlled
  natural languages, the evidence is the share of words that belong to the
  language's templates. No extra dependency or model is needed, and new
  languages are detected as soon as they are added.
- **Partial reading.** Tree-sitter-style error nodes would need an
  error-recovering grammar for each of the 35 languages. Panic-mode
  recovery inside each parser has the same problem. Instead, `parsePartial`
  cuts the text along its own layout (indentation and closing lines). It
  reads each part as a fragment and grows parts while they still read. A
  part that fails is reported with its error, and its indented body is
  still read. The method works for every language without grammar changes.
- **Rules as data.** A JSON rule set has four stages: `source` text
  replacements, extra natural-language `templates`, `names` renames applied
  as a meta → meta layer, and `output` replacements. It is checked
  up front, with clear errors. The same JSON works in the library, `--rules`,
  the server and the web editor. Visual block editors (Blockly) or
  schema-generated forms were heavier than one table per stage, so the
  editor is plain React with a JSON import/export view.
- **Rosetta Code.** Each task's wikitext is fetched with the MediaWiki API,
  ten titles per request. The solutions of the 32 languages we read are kept
  in `.cache/` (they stay under the GNU FDL, outside this repository). Tasks
  are sorted from the simplest. Only counts are committed (`data/rosetta-code/`).
  The report is the to-do list for future grammar work: the simplest tasks
  that still miss lines come first.
