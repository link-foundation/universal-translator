# Issue 16 implementation and verification plan

Objective: implement every requirement of issue 16 and inherited unfinished requirements in PR 17, verify them, address feedback, and mark the PR ready. Keep incomplete criteria explicit.

## Current state

The issue and historical discussions are archived and have been read, including
conversation comments, inline review comments, reviews, and all eight issue
images. The historical inventory is preserved verbatim in
`data/inherited-requirements-readable.txt`; its old `done` labels are not a new
acceptance decision. All 22 referenced solver gists were downloaded using
authenticated `gh gist view`, compressed, and indexed with checksums in
`data/solver-logs/manifest.json`.

The later recovery run is archived separately in
[`data/solver-logs/recovery-manifest.json`](data/solver-logs/recovery-manifest.json).
Its complete 19,121-line log decompresses to the published SHA-256. Line 19101
records recovery commit `c66c3996`; its source changes were reviewed, repaired,
verified and pushed through `47bc918` and `bb51dcf`.

Completed changes have focused JavaScript and Rust regression coverage: explicit
meta fields, comment whitespace, complete interpolation parsing, const-container
mutation, isolated-name detection, Russian case agreement, missing comment
vocabulary, Java annotations/generics/fluent calls, C++ typed exceptions to Python
and JavaScript, source-selector preservation, footer links, default lossless
source records for all reader families and incomplete input, and semantic
mappings through formal/controlled-natural and all seven machine readers/writers.
Partial recovery composes fragment ownership, including custom prose that splits
into several output lines. The
exact Fibonacci Java-to-Bash case and its inverse are covered by automated tests
and a browser screenshot. These verified subsets do not complete the broader
all-language requirements.

CI at `f86d242` exposed a stale Rust machine trace assertion after adding the
concrete parsing stage. Commit `157ae86` updates that expectation and its focused
test passes. At `34cad04`, Rust CI exposed server responses suppressing natural/machine
line maps (`logs/ci-rust-34cad04.txt:1304–1307`). Commit `28bd803` fixes the
condition; JavaScript HTTP and Rust server parity regressions pass. The new
commit is pushed and its CI is pending. Source-record chunk separation repairs the circular web
build; the example-app workflow passes at both commits.

Grammar interoperability now has a reusable JS/Rust workspace: nine executable
import formats, update/dependency refresh, structurally justified merges with
stable identities, separate editions/sources, conversion-loss rejection, six
transform stages, bounded parsing/recovery, concrete records/provenance and
semantic readers installed into the ordinary translator. Focused JS, Deno,
Rust and browser checks pass; commit `ac07029` includes the workspace. The
broader complete-grammar and semantic-coverage criteria remain open.

CI at `ac07029` passes Rust, lint, native translation and the example app. Node,
Bun and Deno exposed an outdated package-file assertion, repaired by `41570a3`.
Docker omitted the vendored grammar runtime, repaired by `69638cf`; an installed
npm artifact now executes an imported grammar through its public subpath.

Comment headers now retain individual origins through collection, comment
translation and all 70 current writers and readers. The Fortran reorder case
has before/after browser evidence and an end-to-end colour assertion. Three
JS/Deno and three Rust regressions cover file, function and entry-point headers;
110 focused JS tests and 24 Rust mapping/concrete/layout tests pass.

Exact subline regions now accompany line maps in both libraries and HTTP APIs.
Parser spans retain UTF-8 byte ranges through wrappers, recovery and layout;
semantic matching distinguishes repeated names and same-line statements. Bash
expression restoration keeps call origins, and Rust expression parsing now
records leaf origins. The editor colours the narrowest visible regions and
maps selections to exact counterparts, including split constructs. Ten JS/UI
unit checks, five Rust region checks, HTTP byte parity, concrete-source tests
and a real Chromium selection check pass. Screenshots preserve the old whole-line
selection and the corrected single-name selection. All CI at `eee5930` passes.

Current work: continue broader region precision, language semantics, questions and
every historical gap below. Keep the PR draft
and the native goal active until the complete inventory is verified.

The production build at `c94b178` failed on four circular chunk warnings
(`logs/ci-example-c94b178.txt:221–224`). The new span helper was assigned to
the translator entry chunk while source records imported it. The shared source
chunk now includes it. A dependency graph regression fails before that change
and passes afterward; production verification runs in the existing CI workflow.

At `6b5893f`, production web and desktop builds pass. The checks workflow found
two JS regressions: the HTTP comment test omitted the new region field
(`logs/ci-node-6b5893f.txt:2923`), and internal mapping rereads entered the public
trace (`:2932`). The response assertion now covers the exact byte ranges;
mapping suppresses its internal trace in both runtimes and restores tracing for
subsequent public reads. Twenty-one focused JS checks and six Rust region checks
pass. Rust CI also found a needless origin clone (`logs/ci-rust-6b5893f.txt:767`),
replaced with a borrowed slice.

The C++ gutter investigation found a separate target-failure coverage bug.
JavaScript and Rust now count successfully written parts after emission,
including free prose; the UI retains zero-coverage error details. Baseline
failure logs, focused regression results, and WebKit before/after screenshots
are recorded. Current Chromium and WebKit do not reproduce the original full
gutter block, so that criterion remains open. All CI checks at `283f16a` pass.

## Work sequence

- [x] Archive and read issue 16, every comment, screenshots, PR 17 discussion/reviews, and earlier issues/PR requirements; preserve all referenced solver logs. Refresh feedback after each push.
- [x] Reproduce the concrete reported failures with bounded scripts in experiments and minimal regression tests. Extend this coverage as wider requirements are implemented.
- [x] Make meta notation explicit about expressions, statements, conditions, and bodies.
- [ ] Preserve whitespace during comment translation; complete comment vocabulary and alignment.
- [ ] Support semantic many-to-many regions/lines for every language family, including Bash, natural and assembly languages; remove spurious gutter highlighting.
- [ ] Support natural-language agreement and equivalent inflected referents, including Russian examples, throughout algorithms and comments.
- [ ] Audit and implement all operators and relevant language semantics (exponentiation, mutable containers, annotations/generics/chains, exceptions, introspection, SQL/LINQ/questions).
- [x] Improve isolated-name ambiguity ranking using parse success and popularity, preserve source when changing its language, and add contextual issue reporting/source links.
- [ ] Research prior grammar/NLP projects and sibling architecture; implement updateable grammar import/merge/transformation workflow with CST preservation.
- [ ] Implement and verify every inherited unfinished requirement across the codebase.
- [ ] Add opt-in tracing where evidence needs it; write case study with timeline, root causes, requirements, alternatives, and verification.
- [ ] Add a Changeset, commit atomic steps, merge latest main, push only issue-16-fb080613587e, and update PR 17 with reproduction/tests/screenshots and positive closing references.
- [ ] Review complete PR diff and current CI logs; address all failures and bot findings, verify clean tree and all acceptance criteria before marking ready.

## Validation policy

Prefer focused JS/Rust tests and existing CI. Run heavy commands sequentially with Rust jobs=1 and reduced debug info if needed; preserve logs under this case study. Use Playwright browser automation for UI screenshots, and await all commands before finalizing. Do not mark incomplete criteria complete because CI is green.

The meta-notation cross-family review now verifies shared exact fixtures and
the condition/action/value/effect roles through all 111 current reader families.
It found and fixed inconsistent child ordering and lost annotated-block
metadata. Both engines preserve extensions and pass the same fixtures. Before
and after evidence and the scope of this completed criterion are in
`META-ROLES.md`; the wider language requirements remain open.

Introspection draft: four compositional question aspects now round-trip Python,
JavaScript/TypeScript and every natural grammar. Runtime documentation is distinct
from comments and retains multiline values. A native regression exposed Python
3.13's compiler docstring cleaning; explicit 3.12/3.13 source editions and target
restoration preserve the runtime value. SQL/LINQ and other targets remain open.
See `QUESTIONS.md` for architecture, primary sources and focused evidence.
Rust CI at `a415de3` found an unnecessary test-helper lifetime, now elided.

Current verification repair: `2198d53` CI found inherited reflection words
outside restricted natural vocabularies, global reservation of new words that
changed old identifiers, a stale Python-edition assertion, and a browser
assertion that did not wait for Monaco to render its selection. JS/Rust now
compose restricted reflection forms from the profile's own evaluation syntax
and quoted technical operation names; vocabulary rules stay unchanged. New
questions use contextual words. Focused checks pass (30 JavaScript tests,
7 Rust tests, Clippy, golden examples and the real-browser suite). The existing
natural checks passed; their requirements gate caught a Rust natural-reader
dependency on the formal question constants. Those constants now belong to meta,
and the requirements gate passes. Multiline quoted documentation is also checked
as one logical sentence by both standards validators. Broader CI is pending.

At `6bf0e95`, Node, Bun, Deno and the web application pass. Rust CI found
one remaining stale Python-edition assertion at
`logs/ci-rust-6bf0e95.txt:1103–1107`: the public catalog correctly lists
`3`, `3.13`, `3.12`, `3.5`, `2`, while the test expected three editions.
The assertion now covers the full list; the focused Rust regression passes.

Selection queries now share scoped source, predicate and projection expressions
across SQL, C# LINQ, Python comprehensions and JS/TS filter/map chains in both
runtimes. Nine focused JavaScript checks and seven Rust checks cover formal
and all 71 natural grammar round trips, eager/deferred strategies, identifiers,
collection types and variable scopes. A native CI example agrees across SQLite,
Python, Node and C#, observes source mutation between eager/deferred evaluation,
and compiles complete C# bindings, typed returns and nested queries. The first
return round-trip exposed qualified-type lookahead confusing bare LINQ with a
declaration; the regression now checks both forms. SQL NULL semantics, broader
clauses, other target families and general question reasoning remain open.
See `QUERIES.md` for the implementation, evidence and remaining limits.

All CI checks at `e982e39` pass, including the prior native run. The query changes
require their own current-commit CI after the next push.

CI integration at `e9d44f3`: native queries and Rust tests passed, but the
workflow's native step budgets totaled 4,320 seconds against a 4,200-second
policy limit (`logs/ci-checks-e9d44f3.txt:12798`). The query execution now shares
the existing 540-second native translation budget, instead of adding another
two-minute step. All 13 timeout-policy regressions pass. CLI parity attempted a
nonexistent SQL Hello World extension (`:19927`); it now inventories query
languages explicitly and compares dedicated SQL cases across both CLIs and
seven target grammars. The complete parity experiment passes (seven CST
specimens, 27 ranked grammars, two native exchanged programs and 80 imperative
golden write/read pairs). These infrastructure repairs do not change the open
acceptance criteria.

All five CI workflows at `0a44abd` pass, including the repaired native budgets
and dedicated SQL CLI parity cases. Fresh issue comments, inline PR comments
and reviews remain empty; the historical PR conversation has no new findings.

Current draft: compositional Portable Object Compiler messages, process
arguments, numeric updates and Objpak string sets. The actual pinned compiler
now agrees with generated Python, JavaScript, Rust and Objective-C across six
argument sets and separate alias, live-iteration and update programs. Both
engines read all 34 original collection programs. Formal and all 71 natural
grammars round-trip the original algorithm; verified helper definitions retain
their concrete library production. A native exit-status failure exposed C89
main fallthrough; both writers now emit explicit success returns. Focused tests,
source provenance and existing-budget native CI integration are implemented.
Seventeen focused JS tests, fourteen Rust tests, lint and Clippy pass. CLI writes and semantic JSON reads agree across six target grammars.
Native comparison also passes through the public translation/layout path. Broader object/library/target coverage
remains open; see `OBJPAK.md` for evidence and explicit limits.

CI at `a3cee36` found boolean calls being normalized as numeric conditions before
type inference. Both engines now normalize only inferred numeric conditions
after inference; the existing JavaScript/Rust algorithm round trips pass.
Native conditions uncovered a C `(void)` marker bug and incompatible runtime
header selection, now covered by a shared fixture and independent POC/GNU
Objective-C execution. CodeQL also traced the verifier's Node executable path
through its argument wrapper; it now uses a fixed command. Both failed workflow
logs and the SARIF are archived. Focused checks pass; current-commit CI remains
required after pushing these fixes.

All five workflows at `eeb793d` pass, including the full native checks and
Security. The CodeQL review thread is resolved and has an evidence reply at
https://github.com/link-foundation/universal-translator/pull/17#discussion_r4715644694.

The comment-whitespace review fixes four concrete paths in both runtimes:
natural/machine in-place translation, comment-independent code alignment,
partial translation of mixed line endings, and machine lexical markers.
The 551-case audit across 111 imperative families fails 81 assertions with the
previous translation/layout stages and passes with the corrected stages.
SQL and complex machine/natural literals have additional regressions. Real
browser before/after screenshots show the R-to-Bash paragraph restored.
See `COMMENT-WHITESPACE.md` for the reproduction and explicit remaining review;
all broader open requirements remain active.

The next comment review found premature closing of nested formal comments and
Rocq's comment-string rule. Both runtimes now share iterative scanners with
per-language nesting/string metadata. Nine formal families plus WebAssembly
follow their primary manuals; non-nesting languages keep their native rule.
The finite old-lexer reproduction fails 29/34 assertions, and the current path
passes all 34. Full comment ranges and Unicode concrete records are checked in
26 JavaScript and 21 Rust tests; lint, Clippy and the chunk graph pass.
`COMMENT-WHITESPACE.md` records the reproduction and archived manuals. Continue
the open grammar, semantic, UI and inherited criteria; this is not a completion
claim for the inventory.

All five workflows at `bb3785c` pass, including Node/Bun/Deno, Rust, native
translation, Security and the web/desktop example builds. The next nested-comment
commit still requires its own current-SHA CI check after pushing.

The Perl arithmetic-output failure found during the layout audit is now repaired
in both writers. Parentheses enclose the complete print argument, preserving
arithmetic and trailing newline bytes. A finite native example agrees across
Python, generated Perl and restored Python; matching JS/Rust meaning regressions,
shared program/fragment goldens, lint and Clippy pass. The example is included
in the existing native CI step. See `PRINT-EXPRESSIONS.md` for the old-emitter
reproduction and primary manual. Continue the open operator/grammar inventory.

Rocq runtime recognition now compares native tokens instead of requiring exact
header bytes, retaining header comments and correct diagnostic line numbers.
The finite previous-lexer audit fails all six layout/line checks; current lexer,
JS/Rust semantic/concrete/partial regressions and six native Rocq/Python output
comparisons pass. Modified helper tokens and literal values are rejected.
`RUNTIME-HEADERS.md` records evidence. PHP leading text needs its own semantic
repair; the wider acceptance inventory remains active.

The PHP header investigation now preserves emitted whitespace before opening
and after closing tags, including PHP's consumed first newline. Native-tokenizer
probes also distinguish real opening separators from literal lookalike tags.
The previous reader fails seven of nine finite native cases; the corrected
reader and all native PHP/Python round trips pass. Matching semantic, concrete
and partial-comment regressions pass with existing dialect/comment checks
(24 JS and 26 Rust tests), lint and Clippy. Primary manuals and evidence are in
`RUNTIME-HEADERS.md`. General mixed-HTML/mode-switch grammar coverage remains
under the broader language inventory; continue all open acceptance work.

All five workflows at `08e200c` pass for that exact commit, including the full
Node/Bun/Deno, Rust and native translation checks, Security, and the web/desktop
example builds. The Rocq/PHP fixes have focused and native local verification;
their combined head still requires its own CI after pushing. The latest default
branch is an ancestor of the prepared branch. Continue the open inventory.

CI at `6790c7b` passes the web/desktop builds and Security. Node, Bun and Deno
found the same outdated Rocq vocabulary expectation: `blockComment` and
`operators.concatenate` now affect successful readings after the runtime-header
repair, instead of being hidden behind an existing parse failure. The existing
vocabulary-effect regression now expects both working features. The failing
job logs are preserved (`ci-node-6790c7b.txt:3050`, `ci-bun-6790c7b.txt:2855`,
`ci-deno-6790c7b.txt:2855`); ANSI-free readable logs and compressed original
responses are retained. The workflow was still running, so completed job logs
were downloaded through the Actions job-log API.

PHP markup/mode reading now composes literal output, repeated code sections,
short echoes and shared conditional/loop scope in both runtimes. The old reader
fails all 15 new finite native cases; the corrected reader matches all 15.
Native round trips also exposed generated line comments containing `?>` closing
code mode early; both writers now emit safe block comments. JS/Rust regressions
cover comments, snippets, CST, source lines and exact markup/code regions.
Evidence and explicit document/snippet and grammar limits are in
`RUNTIME-HEADERS.md`. Continue all open acceptance criteria.

The PHP mode extension passes 23 focused JavaScript tests and 23 Rust tests,
ESLint and Clippy. Native verification passes all 24 PHP documents, the separate
foreign-comment example and all six Rocq layouts.

SQL negation now uses native SQL precedence in both readers, with grouped NOT
in both SQL writers. Native comparisons found Python comparison chaining and
negated-operand emission faults; both shared Python writers preserve their
boolean operand boundaries. The old reader fails 16/23 finite cases, the old
writer fails four independently, and the current path passes all 23 across
SQLite, Python, Node and C#. Matching regressions, number regressions, lint and
Clippy pass. See `QUERIES.md`. Continue NULL semantics and all open inventory
rows; this atomic correction does not finish the query requirement.

Nullable SQL values now have explicit NULL, SQL unary/binary and WHERE-truth
contracts in both engines. The previous reader fails 65/81 finite cases; the
corrected path agrees across SQLite, Python, Node, C# and SQL restored after
JavaScript rereading. All nine AND/OR truth pairs, null-safe IS, IS TRUE/FALSE,
nullable arithmetic and zero divisors are covered. Token-verified helpers retain
CST productions, reject rebinding/unknown calls and respect TypeScript/JavaScript
return newlines. Rust now masks multiple libraries from original ranges,
preserving Unicode whitespace offsets. Thirty-six focused JS tests, 32 Rust
tests, lint, Clippy and native checks pass. `QUERIES.md` records the exact numeric
subset and remaining schema/affinity/type/dialect limits. Continue all open
inventory rows; current-SHA CI is required after pushing this atomic change.

All five workflows for `c739a05` pass, including Node/Bun/Deno, Rust, native
translation, Security and web/desktop builds. The review window elapsed and fresh
conversation, inline and review API responses have no new findings. The native
goal stays active and PR 17 stays draft until the full inventory is verified.

The integer-operator audit found a shared wrapper precedence bug: both emitters
recomputed numerator/denominator text without division precedence. Ten finite
quotients now preserve their trees through all seven wrapper grammars; compiled
C agrees with five generated native configurations. Eight JS and ten Rust
regressions, native execution, lint and Clippy pass. See `ARITHMETIC.md` for
before/after evidence. Negative rounding/remainder semantics and the wider
operator inventory remain open.

All five workflows at `e49d979` pass for the grouping correction. The fifteen-minute
review window elapsed with no new findings across conversation, inline and review
responses. The native goal remains active and the PR remains draft.

The signed arithmetic audit now separates floor division/modulo from truncating
division/remainder in both engines. Four shared operator algorithms lower missing
native operations; full-body recognition rejects changed or shadowed helpers.
A finite experiment previously failed 46/168 native results and now passes all 168. Two source contracts round-trip through all 111 imperative reader families.
Independent original Python/C examples agree with 23 available generated native
configurations (736 output lines). The examples also exposed two separate open
issues: observable JavaScript -0 and C helper-argument evaluation order. Both
remain explicit in `ARITHMETIC.md`; the broader operator criterion stays open.
The machine round trips exposed and repaired a dead-reload stack drop in both
LLVM readers. Matching JS/Rust regression suites and existing-budget native CI
integration cover this change. Continue all open inventory rows.
