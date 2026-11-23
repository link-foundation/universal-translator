# Issue 1 case study

Translation in an unrestricted grammar is the hypothesis in issue 1. A
reading binds a word or structure to a physical or abstract referent.
Additional type constraints narrow the possible values, while corpus
observations and context can support several competing readings. Exact
reverse translation is evidence in favor of an interpretation. Irony and
paradox can intentionally keep incompatible readings in play. The first
implementation applies a bounded version of this model to programs with
observable output and to authored readings of a phrase. The
[requirements inventory](requirements.md) tracks the issue and the later
review. [Issue 1](https://github.com/link-foundation/universal-translator/issues/1)

## Evidence collected

The [data directory](data/) contains Links Notation snapshots of the issue,
issue comments, sub-issues, PR discussion, inline comments, reviews, and
three related PRs. The issue had zero comments and zero sub-issues. The PR
had no inline comments or submitted reviews. The conversation contains the
follow-up request for Ubuntu-only CI, Links Notation, and a larger example
corpus. The capture script validates that each Links Notation snapshot
decodes to the same values as the original JSON. The same check covers 93
historical case-study snapshots, and the captured npm error transcript is
stored verbatim as a log. Package managers, tool configurations, and the
GitHub API use the formats those tools require.
[PR 5 feedback](https://github.com/link-foundation/universal-translator/pull/5#issuecomment-7092772656)

The [snapshot converter](../../../experiments/case-study-snapshot.mjs)
reads a JSON file or standard input. Use `--decode` to export the
equivalent JSON values for tools that consume them.

```sh
gh api repos/link-foundation/universal-translator/issues/1 |
  node experiments/case-study-snapshot.mjs > issue-1.lino
node experiments/case-study-snapshot.mjs --decode issue-1.lino
```

GitHub, RedMonk, and the Stack Overflow survey informed the original
28-language roster. The follow-up does not name a ranking. This audit
uses TIOBE's November 2026 table and records every ranked item and its
matching profile, if one exists. TIOBE tracks MATLAB and GNU Octave,
Caml and OCaml, as well as the broad Lisp and ML names separately from
specific implementations. The audit retains those distinctions.
[TIOBE Index](https://www.tiobe.com/tiobe-index/) ·
[TIOBE search definitions](https://www.tiobe.com/tiobe-index/programminglanguages_definition/)

## Corpus observations for the dependent-meaning example

The English 2019 and Russian 2019 Google Books corpora report higher
relative frequencies for `white person` and `белый человек` than for the
corresponding phrases that explicitly mention skin in 2018 and 2019.
Neither query returned a series for the exact phrase describing a person
painted white. The snapshot records those two observations as missing.
The queries use case-sensitive matching and zero smoothing.
[Captured observations](data/white-person-corpus.lino) ·
[Google Books Ngram documentation](https://books.google.com/ngrams/info)

These measurements describe exact phrases in published books. Sense
frequencies would require individually annotated occurrences of the
ambiguous phrase and corresponding bilingual evidence. The executable
ranker demonstration uses synthetic counts to test how the evidence
combines and how missing evidence propagates.

```sh
node experiments/white-person-corpus.mjs |
  diff -u docs/case-studies/issue-1/data/white-person-corpus.lino -
```

## Coverage

The pinned Rosetta Code source tree contains 1,758 task directories. The
published popularity file lists 1,753 tasks and a sum of 108,960 language
counts. Five tasks appear only in the source tree. Directly counting source
files within language directories gives 143,457 source files across 883
language directories. The CI archive check runs all of them through Links
Notation source documents and compares restored bytes in both runtimes.
The archive includes 750 Hello World Text samples,
675 FizzBuzz samples, and 355 GCD samples. The implementation covers three
task definitions with bounded contracts. The 1,755 other task definitions
still need adapters and verification. The report verifies twelve original
Rosetta Code Hello World Text programs, four original FizzBuzz programs, and
one original GCD program against their pinned Git blob hashes. It checks
exact round trips and the expected effects. The selected JavaScript and Rust
originals also translate in both directions through the Meta Language effect.
The remaining source variants still need effect verification.
The Hello World Collection homepage reports 603 programs and greetings in
78 human languages. Both implementations round-trip its 591 text listings
through Links Notation. Twelve programs are published as images.
The report extracts 24 original console snippets from
the pinned page and applies the same round-trip and greeting checks. It also
verifies the text of all 78 localized greetings against the page. Both unit
suites carry those greetings through Links Notation into all 20 plain-language
descriptions and eight UTF-8 programming profiles. The native runner executes
matching collection forms for each available toolchain and checks representative
localized greetings in the eight UTF-8 profiles. The other collection source
programs, including platform-specific forms, still need recognition and verification.
[Pinned Rosetta Code inventory](https://github.com/acmeism/RosettaCodeData/blob/1d475861d7141ef2fafff293d9339f56e4b0f5db/popular-tasks) ·
[Hello World Collection](http://helloworldcollection.de/)

The catalog includes 50 programming profiles and 20 plain-language profiles
for all three tasks. Of the ranked TIOBE 50, 33 have forms for all three
tasks and three have a related dialect profile. Assembly has five
instruction profiles for the fixed Hello World greeting. The NASM x86-64
profile also implements GCD and FizzBuzz. Fourteen
ranked items have no profile. The [Links Notation census](data/corpus-coverage.lino)
lists each mapping. Run `node examples/translation/report-coverage.mjs`
from the repository root to check the mapping against the current catalog.
Pass local copies of the linked Rosetta Code inventory and the Hello World
Collection page, in that order, to verify their checksums and reported counts
and check the selected original programs. Pass the compiled Rust CLI as the
third argument to compare exact round trips and Meta Language output in both
runtimes. A fourth argument accepts the pinned Git Trees responses to verify
the source counts and the 17 original Rosetta Code programs.
[Reproduction commands](../../../examples/translation/README.md#verification)

The absent ranked entries include graphical formats and targets with
non-console observations. Scratch and LabVIEW require project or diagram
representations. Ladder Logic requires time and controller state. Solidity
requires an EVM execution model and an observable event or return value.
ABAP, SAS, PL/SQL, Transact-SQL, and other product-bound languages require
dialect-specific output and execution verification. Executing the three
current contracts in an unrelated dialect would not establish coverage of
those targets.

## Architecture and alternatives

1. Use the released Meta Language packages in both runtimes to represent
   source tokens, their byte coordinates, syntax and trivia grouping, and
   relationships between an operation and its dependencies. Preserve a
   separate portable effect node and link the source operation to it.
   JavaScript uses release 0.46.0 and Rust uses 1.0.0 with default features
   disabled. Those releases have compatible link operations. The PR that
   develops broader parser and language support provides design context.
   [Meta Language PR 228](https://github.com/link-foundation/meta-language/pull/228)
2. Transform the effect and its context before formatting code. A target
   expression links the selected form and its output operation to the
   prerequisites and the portable effect. For C to C#, the binding changes
   from `printf` and `stdio.h` to `System.Console.WriteLine` with the
   `HelloWorld` class. Source parsing and target materialization are separate
   operations, so the same source can produce multiple styles. Ordered rule
   layers can be supplied by a project, repository, or organization. The
   router PR uses parallel engines and explicit parity data, which informed
   the shared profile catalog and executable parity check.
   [Router PR 775](https://github.com/link-assistant/router/pull/775)
3. Start with exact authored scaffolds. A general CST provider such as
   Tree-sitter would cover more syntax and preserve error nodes, but would
   still need name lookup, resolved imports, and an effect model. A lossless
   semantic tree such as OpenRewrite's combines type attribution and
   formatting data, which would help with project-scale rewrites. Evaluate
   such adapters on accepted and rejected corpus fixtures before changing the
   parser's guarantees. [Tree-sitter parsing](https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html) ·
   [OpenRewrite lossless semantic trees](https://docs.openrewrite.org/concepts-and-explanations/lossless-semantic-trees)
4. Record ambiguities as explicit candidates. Prefix matching narrows the
   candidate's type path. Source and target frequencies and contextual
   confidence bound the ranking. The composition is the minimum of the three
   dependencies. Missing evidence contributes `[0, 1]`. Rank exact reverse
   candidates first and retain ties. Rust uses the Relative Meta Logic
   minimum aggregator. The JavaScript example compares its ranker's result
   with the engine's evaluation of the checked-in `.lino` expression.
   The observations in the fixture are synthetic. The ranker accepts supplied
   readings and corpus counts. A general grammar, corpus or referent resolver
   would need separate acquisition and validation.
   [Relative Meta Logic PR 184](https://github.com/link-foundation/relative-meta-logic/pull/184)
5. Reparse an emitted program to compare its typed effect. Separately compile
   or interpret emitted programs and compare standard output with a reference
   independent of the catalog. Equivalence here concerns the admitted
   standard-output contract under the stated inputs. General translation
   validation also has to account for other effects, runtime behavior and
   undefined behavior. LLVM's Alive2 work illustrates how that validation can
   be bounded to a specific semantics and intermediate representation.
   [LLVM Alive2 technical talk](https://llvm.org/devmtg/2025-04/slides/technical_talk/bhat_peephole.pdf)

The shared profiles are data. The append-only source graph records syntax
and the effect graph records only the operations used for translation. The
runtime package declarations and lockfiles enumerate actual dependencies.
The reviewed PRs and alternative tooling are design references. This follows
the associative technology stack practice of making each dependency and its
relationship to the system inspectable. [Associative technology stack](https://github.com/link-assistant/formal-ai/blob/main/docs/associative-tech-stack.md)

## Validation

Each implementation checks 246 authored forms and 18,104 directed
translations with shared task parameters and 2,184 localized greeting round
trips. The parity runner checks every form, all 78 greetings, and all three
modes across both command lines. It checks the explicit
Links Notation intermediate in both directions. Two Ubuntu native jobs
compare executable profiles to an independent stdout oracle. JavaScript
runtime checks and the Rust job use locked dependency installs. Both the
automatic and instant release gates wait for the language and native jobs.
[Links Notation CI precedent](https://github.com/link-foundation/links-notation/tree/6f2be531c163d6359d8337d40014dc925e278089/.github/workflows) ·
[Verification commands](../../../examples/translation/README.md#verification)
