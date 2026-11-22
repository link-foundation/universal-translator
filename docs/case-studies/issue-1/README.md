# Issue 1 case study

[Issue 1](https://github.com/link-foundation/universal-translator/issues/1)
asks whether translation can be expressed as dependency resolution over
source, candidate meanings, and context. It asks for a first manual
implementation in JavaScript and Rust, with source preservation, a
configurable transformation stage, and readable examples in the most used
programming languages. The [requirements inventory](requirements.md) tracks
the delivered evidence and distinguishes the scope of each claim.

## Evidence collected

The [data directory](data/) contains the issue, issue comment and sub-issue
responses, the initial PR and all three review channels, and snapshots of
three related PRs. The issue had zero comments and zero linked sub-issues
when collected. This PR had no review or discussion feedback at that point.
Coverage counts come from the corpus mirror's published inventory. The
inventory records entries per task with variants. It does not count
independently verified translations. Direct access to the Rosetta Code wiki
and Hello World Collection was unavailable when checking the issue links.
[PR 5](https://github.com/link-foundation/universal-translator/pull/5) ·
[Rosetta Code Data inventory at the reviewed revision](https://github.com/acmeism/RosettaCodeData/blob/1d475861d7141ef2fafff293d9339f56e4b0f5db/popular-tasks)

GitHub activity indicates adoption in repositories and RedMonk combines
GitHub and Stack Overflow signals. The developer survey also captures SQL
and shell use. These rankings measure different populations, so the roster
uses their overlap and includes representative imperative, functional,
query and scripting environments. The profiles use SQLite for SQL and a
POSIX shell for shell. HTML and CSS describe presentation and fall outside
the three executable tasks. The 28 source profiles are C, C++, Rust, Go,
Swift, Fortran, Pascal, Objective-C, JavaScript, TypeScript, Java, C#, Kotlin,
VB.NET, OCaml, Scala, Dart, Python, Ruby, PHP, POSIX shell, Perl, R, Lua,
SQLite, Tcl, AWK, and PowerShell.
[GitHub Octoverse 2026](https://github.blog/news-insights/octoverse/octoverse-commits-pushes-reach-new-highs-in-2026-as-developers-build-with-agents/) ·
[RedMonk rankings](https://redmonk.com/sogrady/2026/04/14/language-rankings-1-26/) ·
[Stack Overflow Developer Survey](https://survey.stackoverflow.co/2026)

The corpus inventory records 595 Hello World text entries, 344 FizzBuzz
entries, and 233 GCD entries. The selected tasks add distinct behaviors with
compact examples. Hello World exercises literal data, dependencies, and
program entry points. GCD tests mutable state and arithmetic. FizzBuzz tests
branch order and output sequences. The examples here are authored for the
stated contracts. In particular, the FizzBuzz limit varies and the GCD
program prints one value. The recognizers accept the catalogued forms.
[Captured task counts](data/rosetta-task-counts.txt)

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

Each implementation checks 96 authored forms and 2,888 directed translations
with shared task parameters. The parity runner checks every form and all
three modes across both command lines. The native runner adds a separate
oracle for all standard targets and the two common-wrapper forms. The two
stages detect different failures. A port may produce structurally recognized
code whose actual runtime output differs from the requested effect. See the
[example verification commands](../../../examples/translation/README.md#verification).
