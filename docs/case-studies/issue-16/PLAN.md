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
