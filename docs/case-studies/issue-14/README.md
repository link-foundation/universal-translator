# Issue 14 Case Study: CST by Default, Linked Editors and Deeper Grammars

Issue: <https://github.com/link-foundation/universal-translator/issues/14>
Pull request: <https://github.com/link-foundation/universal-translator/pull/15>

## Data Collected

- `data/`: the raw GitHub data of every issue (1, 2, 6, 8, 10, 12, 14) and
  pull request (3, 4, 5, 7, 9, 11, 13, 15): descriptions, conversation
  comments, inline review comments and reviews. `data/README.md` lists which
  files are empty and who wrote each comment. Issue 14 and pull request 15
  had no comments when this study was written.
- `screenshots/`: the four screenshots of the issue (`shot-1.png` to
  `shot-4.jpg`, downloaded from `github.com/user-attachments`). The folder
  also holds the screenshots of the result (`app-mapping.png`,
  `app-selectors.png`).
- `previous-requirements.md`: every requirement of the earlier issues and
  pull requests, with its status. Issue 14 asks for this inventory.
- `prior-art.md`: a survey of existing projects, with sources. It covers:
  - concrete syntax trees: Roslyn, rowan, swift-syntax, Tree-sitter, ANTLR,
    Lark, LibCST, recast;
  - grammar nesting: Tree-sitter injections, TextMate, Monarch;
  - natural language: GF, Apertium, Link Grammar, spaCy, Stanza, NLTK,
    UniMorph;
  - mapping user interfaces: Monaco diff editor, Compiler Explorer,
    Godbolt-style line colours;
  - assembly dialects and intermediate languages;
  - the related link-foundation and link-assistant projects.
- `architecture.md`: the layers of the translator, how they map to those
  projects, and how the related projects plug in.
- `experiments/issue-14/` (repository root): the inputs used to reproduce each
  problem and check each fix.

## Timeline

| Time (UTC)       | Event                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| 2026-11-25 18:45 | Issue #14 is opened, with four screenshots from the web app on `main`.                                    |
| 2026-11-25 23:22 | Draft pull request #15 is opened on `issue-14-213b02ae6953`.                                              |
| 2026-11-25 23:49 | The layout pass lands in JavaScript: translations keep the spacing and blank lines of the source.         |
| 2026-11-25 23:59 | The Rust port of the layout pass, `--layout` in both command lines, `layout` and `lineMap` in the server. |
| 2026-11-26 00:29 | The web app uses Monaco by default, with folding regions for every language.                              |
| 2026-11-26 00:30 | Linked editors: shared folding, selection, cursor and scrolling, line-mapping colours, side selectors.    |
| 2026-11-26 00:39 | A shared natural vocabulary, free prose translation and identifier languages, in both implementations.    |
| 2026-11-26 01:07 | Meta language standard library: `print` becomes a call to `print-line`.                                   |
| 2026-11-26 01:31 | Nested grammars: comments and strings are read with their own grammars; long texts are kept once, by id.  |
| 2026-11-26 01:42 | The web build splits the natural-language data, so every chunk stays under the 500 kB limit.              |
| 2026-11-26 01:50 | This case study: timeline, requirements, root causes and the architecture.                                |
| 2026-11-26 02:02 | Machine dialects: GNU as, ARM64, LLVM IR and WebAssembly text are written and read back in both runtimes. |
| 2026-11-26 02:04 | Everyday English wordings (`Let`, `Set`, `Print`, `Return`, `do this`) are read.                          |
| 2026-11-26 02:05 | Decorators: every stage of the pipeline can be wrapped, in JavaScript and Rust.                           |
| 2026-11-26 02:07 | Prose translation keeps verb forms, object cases and the genitive.                                        |
| 2026-11-26 02:34 | The Rust `serve` command, the Wikidata definition cache and standards in Rust.                            |
| 2026-11-26 02:42 | The formal-ai tryout on six repository tasks; upstream issues 1641 and 1642.                              |
| 2026-11-26 02:44 | The web app shows assembly and intermediate languages in a picker group of their own.                     |
| 2026-11-26 02:54 | Language versions (`javascript@es5`, `php@5`, `csharp@5`) and the Hello World Collection with coverage.   |
| 2026-11-26 02:58 | For-each loops in the meta language and four more Rosetta Code tasks in every language.                   |
| 2026-11-26 02:59 | `check-equivalence`: a translation does what its source does when both read into the same meta program.   |
| 2026-11-26 03:02 | Real numbers and true division in the JavaScript meta language (Rust at 04:06).                           |
| 2026-11-26 03:25 | Ranking and imprecision: candidates scored as relative-meta-logic truth values; losses recorded.          |
| 2026-11-26 03:38 | Detection: machine dialects are candidates, and words may start with an underscore (Perl's `@_`).         |
| 2026-11-26 03:46 | Every example program goes through Rust and back and is checked for equivalence.                          |
| 2026-11-26 03:52 | The requirements gate covers issue 14: every requirement done with evidence, or blocked with a reason.    |
| 2026-11-26 03:56 | Arrow functions and classes of static methods in JavaScript and TypeScript.                               |
| 2026-11-26 04:04 | Natural languages: arithmetic with symbols, and headings without a colon open a block.                    |
| 2026-11-26 04:15 | Comments read programming words: 74 more concepts and the imperative forms of verbs.                      |
| 2026-11-26 04:20 | Python type hints give meta types; the Hello World Collection extractor fix for CodeQL.                   |
| 2026-11-26 04:21 | GameMaker Language (TIOBE top 50) is written and read in both runtimes.                                   |
| 2026-11-26 04:43 | The Rust CLI tests tolerate a command that exits before it reads its input (a broken pipe race in CI).    |

## Requirements

The issue states its requirements in prose. Each sentence that asks for
something is one row. `requirements.lino` holds the same list in the format
of `scripts/check-requirements.mjs`, so CI fails while any row is still open.

| #   | Requirement                                                                                                        | Where it is done                                                                                                                                  | Verified by                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| R1  | Keep whitespace through a translation; a concrete syntax tree (CST) by default                                     | `js/src/translation/layout.js`, `rust/src/layout.rs`; the CLI, server and web app keep the layout unless `--layout target`                        | `js/tests/layout.test.js`, `rust/tests/layout.rs`                                                    |
| R2  | Monaco is the default editor, and folding regions display correctly                                                | `examples/universal-app/src/monaco.js`, `folding.js`                                                                                              | `js/tests/universal-app-editors.test.js`, e2e                                                        |
| R3  | Fold, select, place the cursor and scroll in both editors together; scrolling allows for blocks of different sizes | `examples/universal-app/src/editor-sync.js`, `line-map.js`                                                                                        | unit tests, e2e                                                                                      |
| R4  | Show what maps to what                                                                                             | `mapping.js`: matching colours on the lines of both editors, the Compiler Explorer approach (see `prior-art.md` section 4)                        | e2e, `screenshots/app-mapping.png`                                                                   |
| R5  | Comment and identifier language selectors on both sides                                                            | `Options.js`, `LanguagePicker.js`; `commentFrom`/`commentLanguage` and `identifierFrom`/`identifierLanguage` in the library and both CLIs         | `js/tests/identifiers.test.js`, `rust/tests/identifiers.rs`, `screenshots/app-selectors.png`         |
| R6  | Translate comments to the selected language                                                                        | `js/src/natural/comments.js` with the shared vocabulary `data/natural/vocabulary.lino`; the Rust twin                                             | `js/tests/comments.test.js`, `rust/tests/prose.rs`                                                   |
| R7  | Move the option checkboxes below the editors                                                                       | `examples/universal-app/src/Options.js`, `App.js`                                                                                                 | e2e                                                                                                  |
| R8  | A deeper, recursive grammar and dictionary: words, sentences, parts of speech                                      | `js/src/natural/prose-reading.js`, `rust/src/natural/prose_reading.rs`, `data/natural/vocabulary.lino`                                            | `js/tests/prose.test.js`, `js/tests/nesting.test.js`, Rust twins                                     |
| R9  | Translate free natural language too, choosing the most frequent words that survive a round trip                    | `js/src/natural/vocabulary.js` (`rank` order), `comments.js`; candidates ranked by frequency and round trip in `js/src/translation/candidates.js` | `js/tests/prose.test.js`, `js/tests/ranking.test.js`, `rust/tests/prose.rs`, `rust/tests/ranking.rs` |
| R10 | Detect «Привет» and similar short texts                                                                            | `js/src/translation/detect.js`, `rust/src/detect.rs`: the vocabulary counts as evidence                                                           | `js/tests/prose.test.js`                                                                             |
| R11 | Translate «Как хорошо покакать?»                                                                                   | free prose translation when no sentence template matches                                                                                          | `js/tests/prose.test.js`, `rust/tests/prose.rs`                                                      |
| R12 | Parse comments in the meta language deeply; refer to long ones by id                                               | `js/src/translation/nesting.js`, `rust/src/nesting.rs`; `meta` nests unless `--shallow`                                                           | `js/tests/nesting.test.js`, `rust/tests/nesting.rs`                                                  |
| R13 | Nest grammars: code in prose, prose in code, code in strings                                                       | the same modules: `Prose`, `Sentence`, `Word` and `Code` readings                                                                                 | the same tests                                                                                       |
| R14 | A more general meta language: `print` is a call to a function                                                      | `js/src/meta/library.js`, `rust/src/meta/library.rs`                                                                                              | `js/tests/meta-notation.test.js`, `rust/tests/meta_library.rs`                                       |
| R15 | Assembly dialects, Java bytecode, .NET CIL and other intermediate languages                                        | see "Status" below                                                                                                                                |                                                                                                      |
| R16 | More Rosetta Code tasks; more detailed and correct grammars, parsers and emitters                                  | see "Status" below                                                                                                                                |                                                                                                      |
| R17 | Collect and deliver every undelivered requirement of earlier issues and pull requests                              | `previous-requirements.md`                                                                                                                        | see "Status" below                                                                                   |
| R18 | Learn from ANTLR, Tree-sitter, spaCy, Stanza, NLTK, Lark, GF, Link Grammar; keep the CST by default                | `prior-art.md`, `architecture.md`                                                                                                                 | —                                                                                                    |
| R19 | Support the formal-ai, meta-language, router and relative-meta-logic projects without later rewrites               | `architecture.md`                                                                                                                                 | —                                                                                                    |
| R20 | Try link-assistant/formal-ai for some tasks; report its failures                                                   | see "Status" below                                                                                                                                |                                                                                                      |
| R21 | Collect the data and write this case study                                                                         | this folder                                                                                                                                       | `scripts/check-requirements.mjs`                                                                     |
| R22 | Add debug output and a verbose mode where root causes are unclear                                                  | `--trace` in both command lines prints every stage; `?debug` in the web app logs translations, settings and editor sync events                    | see "Debug output" below                                                                             |
| R23 | Report problems of other projects upstream                                                                         | see "Status" below                                                                                                                                |                                                                                                      |
| R24 | Apply each fix to the whole codebase                                                                               | each change has a JavaScript and a Rust twin; the two command lines print the same output                                                         | the Rust tests named in each row                                                                     |

### Status

Checked at commit `d09dc14` on 2026-11-26.

- **R15: done.** Seven machine targets are written and read back through the
  meta language: NASM, GNU as and ARM64 assembly, LLVM IR, WebAssembly text,
  CIL and JVM bytecode (`js/src/formal/machine*.js`,
  `rust/src/formal/machine_reader.rs`, `js/tests/machine-dialects.test.js`).
  `languages` lists them, and the web app shows them in a picker group of
  their own. A reader of binaries and versions of each dialect are open
  (`previous-requirements.md`, 1.14).
- **R16: partial.** 22 Rosetta Code tasks are translated into all 33
  programming languages and 7 machine targets, and each survives the round
  trip through Rust (`experiments/rust-round-trip.mjs`). The readers take
  for-each loops, arrow functions, classes of static methods, Python type
  hints, real numbers and GameMaker Language. The rest of the Rosetta set and
  classes of objects are open.
- **R17: done for the collection, partial for the delivery.**
  `previous-requirements.md` lists every earlier requirement with its status
  at `d09dc14`; the rows still open are listed at its end.
- **R20: done.** `formal-ai-tryout.md` reports six tasks; its failures are
  link-assistant/formal-ai issues 1641 and 1642.
- **R23: done.** Upstream reports: link-assistant/formal-ai 1641 and 1642,
  link-foundation/meta-language 230 (the npm release of Meta Language), and
  link-foundation/ui 292 and 293 from issue 12.

## Root Causes

Each problem was reproduced on `main` before the fix. The inputs are in
`experiments/issue-14/`.

1. **Whitespace is lost (screenshot 1).** The pipeline reads the source to a
   meta program and prints the target from the meta program alone. The lexer
   drops spaces, so the emitter can only print its own canonical spacing:

   ```text
   main:   console.log( "Hello World!");  ->  console.log("Hello World!");
   branch: console.log( "Hello World!");  ->  console.log( "Hello World!");
   ```

   This is the classic AST round-trip problem. Roslyn, rowan and LibCST solve
   it with trivia attached to tokens. Their approach works when source and
   target share one language and one token stream; a translation changes the
   tokens. The layout pass (`layout.js`) therefore matches the tokens of the
   output to those of the source (anchors and a longest common subsequence).
   Aligned neighbours take the source's spaces, and the outer blank lines
   of the source are kept. It
   also returns a `lineMap` (output line to source line) that the web app
   uses for the linked editors.

2. **Comments are not translated (screenshot 2).** Two faults together:
   - `detectCommentLanguage` scored languages only by the words of the
     programming templates. «Привет мир» scored 0 everywhere, so it fell back
     to `english`. With source and target both English, the comment stayed
     the same.
   - Even with `--comment-from russian`, the comment dictionary held only
     the programming vocabulary of each language (`привет` and `мир` are not
     in it), so no word was replaced:

   ```text
   main:   // Привет мир  --comment-language english  ->  // Привет мир
   branch: // Привет мир  --comment-language english  ->  // Hello world
   ```

   Fix: a shared multilingual vocabulary (`data/natural/vocabulary.lino`,
   concepts with words in every base language, ranked by frequency) feeds
   both the detection and the translation of comments.

3. **Auto-detection fails on «Привет» (screenshot 3).** `detectLanguage`
   counted a natural-language word as evidence only when the language's
   templates reserve it or its lexicon names it. A greeting is neither, and
   no template reads it, so every natural language scored 0 and was filtered
   out:

   ```text
   main:   detectLanguage('Привет')  ->  []
   branch: detectLanguage('Привет')  ->  russian (natural) first, score 110
   ```

4. **«Как хорошо покакать?» fails to translate (screenshot 4).** A natural
   source had to match a sentence template of an algorithm (`if ... then`,
   `repeat ...`). Anything else failed with `No sentence template matches`.
   The issue asks for free translation between natural languages, so a text
   no template reads is now translated word by word and phrase by phrase
   through the vocabulary:

   ```text
   main:   No sentence template matches
   branch: Detected language: russian / How good to poop?
   ```

5. **Plain editor by default, no linked view.** The web app defaulted to a
   textarea with highlight.js colours; Monaco was an option. The two editors
   shared no state, so there was nothing to keep in sync and no line map to
   show.

6. **Comments are opaque strings in the meta language.** The meta program
   kept comments and strings as plain text, so it could not express a code
   fragment inside a comment or prose inside a string.

7. **`print` is special in the meta language.** Each reader turned
   `console.log`, `print`, `println!` and the others into a `Print` node, and
   each emitter printed it. The meta language had no notion of a library
   function. `meta/library.js` now generalizes such statements to
   `Call print-line` and specializes them back for the target. The meta
   notation shows the general form.

## Solutions And Alternatives

- **CST by default.** Alternatives considered (see `prior-art.md` section 1):
  - a full lossless tree per language, Tree-sitter style. This needs a
    second grammar for each of more than 30 languages, and does not help
    across languages;
  - trivia on meta nodes. This is lost when one statement becomes several.

  The chosen layout pass works on token streams. It needs no grammar changes,
  and tokens it cannot align keep the emitter's own formatting.

- **Linked editors.** Monaco's `onDidScrollChange`, `onDidChangeHiddenAreas`,
  `onDidChangeCursorSelection` and the folding model keep the two editors
  together through the `lineMap`. Scrolling is mapped block by block, so a
  block of 3 lines that becomes 7 scrolls proportionally.
- **Deeper natural language.** The GF approach (an abstract syntax of
  concepts with one concrete grammar per language) matches the existing
  meta-language design best. The vocabulary is the abstract lexicon. The
  prose reader builds `Prose > Sentence > Word` with concept and part of
  speech; Link Grammar and UD-style dependencies are the next layer
  (`architecture.md`).
- **Nested grammars.** These follow Tree-sitter injections: a node of one
  grammar holds a reading in another. The reading sits next to the text, so
  emitters that do not know it can ignore it, and `unnest` restores the plain
  program.

## Lessons Learned

- **Two solver sessions on one branch.** A second solver session pushed to
  `issue-14-213b02ae6953` while the first one was working, so some features
  arrived twice (the `check-equivalence` work, for example) and the branch has
  merge commits of `origin/issue-14-213b02ae6953`. Fetching before each push
  and merging, never force-pushing, kept both sides' work; where both built
  the same feature, the merge keeps one implementation.
- **A shared Cargo target directory gives stale binaries.** Builds in several
  worktrees that shared one Cargo target directory overwrote each other's
  binaries, so a test could run a binary built from another checkout and
  report results that did not match the code under test. Each checkout needs
  its own target directory (`CARGO_TARGET_DIR` set to a private path, for
  example `target` inside the checkout).

## Debug Output

- `universal-translator translate ... --trace` (JavaScript and Rust) prints
  the tree after each stage (`[parsed]`, `[understood]`, `[typed]`, the rule
  layers) to standard error.
- `universal-translator meta <language> <file>` prints the nested meta
  program; `--shallow` prints the plain one, and `--json` prints it as JSON.
- The web app logs each translation, the settings and the editor sync
  (selection, scrolling, folding) events to the console when
  opened with `?debug` (`examples/universal-app/src/debug.js`).
