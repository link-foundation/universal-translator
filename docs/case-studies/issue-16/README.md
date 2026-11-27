# Issue 16: translation correctness and inherited coverage

Issue: <https://github.com/link-foundation/universal-translator/issues/16>
Work branch and review: <https://github.com/link-foundation/universal-translator/pull/17>

This case study records the investigation and implementation in progress.
The PR remains a draft because its full scope includes all unfinished
requirements from earlier issues and pull requests. Passing focused tests or
CI for a subset does not close that scope.

## Requirements and evidence

- [Acceptance inventory](REQUIREMENTS.md): each current requirement, its verified
  subset and remaining work, including inherited criteria.
- [Work plan](PLAN.md): work order and verification policy.
- [Original inherited inventory](data/inherited-requirements-readable.txt):
  original quotes and source URLs. Historical `done` labels describe an older
  commit and require regression review.
- [Architecture comparison](ARCHITECTURE.md): primary-source research, reusable
  mechanisms, distribution limits and an implementation path.
- `data/issue-*.json`, `data/discussion-*.md` and `data/pulls-*`: complete issue
  and PR descriptions, conversation comments, inline comments and reviews.
  Long discussions are split into parts of at most 1,400 lines for review.
- `data/attachments/`: the eight issue images, downloaded with authentication
  and checked as images before visual inspection.
- `data/solver-logs/manifest.json`: 22 authenticated gist downloads, compressed
  for storage, with original-byte SHA-256 checksums and source discussions.
- `logs/`: bounded local experiments, focused checks, preserved CI failures and
  run/job metadata. Filenames identify the area and, where useful, the commit.

## Timeline

All times are UTC and refer to archived GitHub events or Git commits.

| Event                                                                      | Evidence and significance                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue 1 and later requests establish the translator architecture           | Shared meaning, source preservation, configurable/decoratable stages, JS/Rust parity, Hello World and Rosetta coverage; later requests expand versions, languages, UI behavior and full inherited scope |
| PR 15 records inherited gaps                                               | `data/inherited-requirements-readable.txt` explicitly reports 33/34 Hello World programs, 22 Rosetta tasks, text-only machine input and other partial features                                          |
| 2026-11-26 10:30:13: issue 16 opened                                       | `data/issue-16.json`; screenshots and code examples expose failures in meaning notation, layout, maps, grammar coverage, agreement, operators and questions                                             |
| Earlier PR 17 attempts stop without meeting all acceptance criteria        | `data/pr17-attempt-*.txt`, archived conversation and linked full solver logs; repeated restart messages do not establish completion                                                                     |
| 20:48:54: this work session begins                                         | PR conversation snapshot and native active goal; complete scope remains tracked                                                                                                                         |
| `dda22e5`–`ee6a2bc`: concrete examples and UI corrections                  | Explicit meta roles, comment/layout corrections, mutability, Russian cases, Java annotations/generics/fluent receivers and focused regressions                                                          |
| `3f0302e`–`1c4283c`: typed exception handling                              | C++ throw/catch meaning is retained in Python/JavaScript; exact example exits 8 natively                                                                                                                |
| `918144f`–`de677c7`: formal concrete records and web build                 | Token/trivia partition and UTF-8 production ranges; sharing source helpers required separating a circular Vite chunk                                                                                    |
| `316f703`–`4d81b90`: semantic source ownership                             | Full Java Fibonacci example maps to both Bash expansion lines; formal and all 30 controlled natural languages have semantic maps                                                                        |
| `1a82abf`–`d35c4b1`: machine writers and lifting                           | All seven text machine formats retain ownership through instruction expansions, erased stack patterns, labels and lifted expressions; 42 bounded cross-format probes pass                               |
| 23:24:26, `f86d242`: concrete records for every reader family and recovery | Natural/machine inputs and malformed fragments retain original Unicode, indentation and CRLF; accepted fragments and unread ranges are distinguished                                                    |
| `157ae86`: stale trace assertion repaired                                  | CI correctly adds a `parsed` event for machine input; `logs/ci-rust-f86d242.txt:1156` records the old expected stage list                                                                               |
| 23:30:18, `34cad04`: partial mapping aggregation                           | Successful fragments, failure notes and split prose output retain line ownership after recovery and layout                                                                                              |
| `28bd803`: server semantic mappings                                        | Rust API stops suppressing non-programming maps; HTTP cases for prose, controlled words, NASM and WAT pass in both server implementations                                                               |
| `9702226`: package fixture inclusion                                       | Rust's explicit release include list omitted two new `include_str!` fixtures; `cargo package --list` confirms both are now packaged                                                                     |

## Root causes and implemented repairs

| Failure                                                          | Root cause                                                                                                                        | Repair and regression evidence                                                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Conditions and actions look alike in meta notation               | Positional serialization hides child roles                                                                                        | Explicit expression/statement and condition/body fields; `meta-notation` tests in both implementations                                                             |
| Comment translation removes spacing                              | Re-emission loses layout anchors; multiline tokens previously describe only their first line                                      | Comment anchors and full covered-line spans; `issue-16`, `layout`, `comments` tests                                                                                |
| Java print does not map to Bash call plus echo                   | Lexical alignment cannot represent a semantic statement that expands; receiver/call rewrites discard ownership                    | Node origins survive parsing, rewrites and mapped emission; exact forward/inverse `semantic-mapping` regressions and browser screenshot                            |
| Machine maps omit instructions or attach a loop to its body      | Lowering expands one statement into instructions; lifting erases stack/label scaffolding and clones text without source positions | Per-instruction ownership, scoped emission capture, shared source-line positions and ownership unions during lifting; machine mapping tests and bounded experiment |
| Recovered translation maps only the last fragment                | Nested writes leave independent emissions while outer recovery concatenates their strings                                         | Capture each piece, offset its map and record the final composite; partial semantic-map tests include a malformed declaration and split prose                      |
| Russian output uses nominative where a use requires another case | Writer treats canonical entity spelling as its only surface form                                                                  | Separate use-site realization for return objects and comparison referents; Russian examples pass in JS/Rust; broader agreement is open                             |
| `sequence` and `iteratively` remain untranslated                 | Shared vocabulary lacks entries                                                                                                   | Added forms for all 30 natural languages and focused vocabulary/wording tests                                                                                      |
| Power interpolation loses part of an expression                  | Embedded parsing accepts a prefix and leaves tokens unread; power emission/grouping is incomplete                                 | Require full interpolation consumption and preserve precedence/association; `issue-16` tests; all-operator audit remains open                                      |
| Const array cannot mutate in Rust                                | Immutable binding and mutable container contents are conflated                                                                    | Independent content mutation inference, producing `let mut`; regression in both implementations                                                                    |
| Spring method fails or loses a continued receiver                | Annotations/nested generic types are absent from declaration grammar; newline-based boundaries split fluent calls                 | Explicit type/annotation metadata and retained computed receiver; exact fixture, parser tests and executable Python framework doubles                              |
| C++ throw 8 is detected as C and fails                           | Detector/parser lack typed throw/catch constructs; targets differ in throwable values                                             | C++ exception concepts, target wrappers and rethrow/finally handling; exact native example and tests; remaining targets are open                                   |
| Source changes when correcting its language                      | Editor state copies the failed reverse translation into the source model                                                          | Preserve source model during selector changes; UI unit/e2e coverage and before/after screenshots                                                                   |
| Blue gutter continues after real source lines                    | Decoration groups may contain out-of-bounds line indices                                                                          | Bounds filtering and browser inspection; exact issue-state before/after reproduction remains open                                                                  |
| Source syntax vanishes during reading                            | Reader returns only its semantic representation; recovery dedents/discards unread text                                            | Default concrete records with tokens/trivia, byte ranges, production views and errors; `concrete-syntax` tests cover every reader family and recovery              |

## Verification and practical limits

Verification favors focused checks and existing CI. Rust runs with one build
job and reduced debug information, within the container's 2.92 GiB shared memory
limit. Deliberate machine-mapping probes use six finite programs across seven
formats. The full suites and native toolchain matrix run on CI rather than
duplicating their resource cost locally.

The logs preserve failing as well as passing checks. For example,
`partial-semantic-js-before.txt` demonstrates the malformed-fragment mapping
failure, and `partial-semantic-js-verified.txt` records the focused repaired
behavior. `concrete-all-families-js-before.txt` demonstrates missing concrete
records before implementation. `ci-rust-f86d242.txt` records a genuine CI
expectation mismatch, repaired with a focused Rust trace test.

At `34cad04`, native translation, Node, Bun, Deno, web, security and link
checks pass. Rust fails at the HTTP parity assertion because its server
suppresses natural/machine line maps (`logs/ci-rust-34cad04.txt:1304–1307`).
Commit `28bd803` repairs that condition, and the expanded JavaScript HTTP and
Rust parity tests pass locally. The archive commit `4cb1de8` then exposed formatting errors in three preserved experiments (`logs/ci-lint-4cb1de8.txt:282–311`). Commit `1601592` formats them and splits an oversized server test group; focused lint and all nine server tests pass. Run snapshots retain
timestamps and head SHAs rather than relying on an older green badge.

Browser evidence is committed under `docs/screenshots/issue-16/` and embedded
in the PR. It covers source correction, the footer links, typed exception
translation and the exact many-to-many Fibonacci mapping. Screenshots establish
those states; they do not prove every language or the entire inherited corpus.

## Remaining solution work

The acceptance inventory remains authoritative. Major open areas include
complete upstream grammar production/semantic coverage and faithful conversion lowering, recursive natural
clauses and general agreement, questions/introspection/SQL/LINQ, complete
operators and exceptions across targets, exact subline maps, binary machine
readers and dialect versions, missing top-50 languages,
Portable Object Compiler Objective-C, library source translation, and reading
the actual full Rosetta corpus.

The old npm naming request is reconciled by the later scoped-ownership
directive; publication is handled through the existing release workflow, not
by publishing from this issue branch. The current JavaScript meta-language
distribution gap is documented in the architecture comparison, while the old
Rust-build blocker is no longer current. External reports should be filed only
for demonstrated defects with a finite reproducer, workaround and proposed
change; a missing local translator feature is not an upstream defect.

The existing trace callbacks, CLI `--trace` and UI debug option remain off by
default. Reusable experiments under `experiments/issue-16-*` capture targeted
evidence; additional unknown failures should add similarly scoped diagnostics.
The PR must remain unmerged and unready until every open criterion has actual
implementation and verification evidence.

## Executable grammar adapter, 2026-11-27

The new workspace uses the pinned grammar subsystem shared with Rust 1.0.0. It
imports and executes nine formats; updates only after a successful import;
resolves updated dependencies; retains separate language editions and source
entry points; merges structurally equivalent rules with stable identities; and
exposes six transform stages with opt-in tracing. Every parse retains UTF-8
concrete ranges, recovered/missing tokens, nested productions and provenance. A
semantic reader maps imported productions into the ordinary translator.

The JavaScript source closure is 41 files (680,224 original bytes), with a
manifest, upstream license and one explicit browser SHA-256 patch. The digest
gate verifies all 42 pinned source/license files. The runtime passes JS, Deno,
Rust, Node TypeScript and Deno type checks, real browser execution and the
production web build. The runnable example translates `say 7.` and updates to
accept `say 9.`. Conversion losses are rejected explicitly; this infrastructure
does not yet establish every requested complete grammar or semantic reader.

## Comment header ownership and package CI

`logs/comment-mapping-before.txt` reproduces missing header ownership before the
repair. The bounded header-reordering experiment additionally shows Fortran's
entry comment on source line 6 incorrectly mapped to Python's file header on
line 1. Collection formerly reduced comment nodes to strings, discarding their
positions. Translation changed the text, so lexical alignment could not repair
the loss reliably. Some keyword dialects also created comment nodes through a
helper outside the parser's source capture.

Comment-array metadata now keeps each position without changing public meaning
fields. Formal, natural and machine readers/writers preserve it through
collection, translation, lowering/lifting and formatting. Token locations also
cover helper-created comments. The JS and Rust tests check file/function/entry
headers in every current language, including the inverse translation with
different comment spelling. JS's 110 focused checks, Deno's three header tests,
and 24 Rust mapping/concrete/layout checks pass; lint, format and Clippy pass.
The browser verifies three distinct, corresponding colour groups after Fortran
reorders the headers. `comment-mapping-before.png` isolates the old collection
and helper behavior; `comment-mapping-after.png` uses the complete repair.
The existing end-to-end suite now asserts the same colour correspondence.

At `ac07029`, Rust, lint, native translation and the web app pass. Node/Bun/Deno
fail the old package-file expectation (`logs/ci-node-ac07029.txt:2891–2895`),
repaired by `41570a3`. Docker fails to import
`/app/vendor/meta-language-grammar/src/grammar.js`
(`logs/ci-checks-ac07029.txt:8062`), repaired by `69638cf`. Its Dockerfile now
copies the runtime, and the npm artifact test installs the package in an empty
project, imports `/grammar`, parses an EBNF grammar and reconstructs the input.
That regression passes locally in 12.39 seconds.
