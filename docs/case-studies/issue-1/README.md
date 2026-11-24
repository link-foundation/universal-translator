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

The [readiness investigation](readiness.md) tracks why the solver marked the
previous drafts ready and how the approach changed.

The [snapshot converter](../../../experiments/case-study-snapshot.mjs)
reads a JSON file or standard input. Use `--decode` to export the
equivalent JSON values for tools that consume them.

```sh
gh api repos/link-foundation/universal-translator/issues/1 |
  node experiments/case-study-snapshot.mjs > issue-1.lino
node experiments/case-study-snapshot.mjs --decode issue-1.lino
```

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

## Language selection

The issue asks for the "top 20–30 most used programming languages". The
selection follows the
[TIOBE index](https://www.tiobe.com/tiobe-index/), the
[Stack Overflow developer survey](https://survey.stackoverflow.co/) and
[GitHub's Octoverse](https://octoverse.github.com/). It is limited to
languages whose programs print text and can be run in CI on Ubuntu. Visual
languages (Scratch), product-bound dialects (ABAP, PL/SQL) and markup or
query languages (HTML, SQL) have no standard-output program to compare, so
they are not on the list.

`node bin/universal-translator.js languages` lists the supported languages.
Assembly (NASM x86-64), CIL (ILAsm) and JVM bytecode (Jasmin) are machine
targets, and they can be both translated from and translated to.

## Architecture

The first drafts of PR 5 matched whole programs against templates
("profiles"), and their common library contained the algorithms. The
review rejected that as faked translation. The translator now follows the
classic compiler structure: a grammar front end, a typed intermediate
language, ordered rewrite rules and a back end. Every part is plain data
or a plain function.

```text
source text ──lexer + parser (grammar tables)──▶ source tree
  ──understanding rules──▶ meta program ──type inference──▶ typed meta program
  ──meaning rules──▶ ──custom layers──▶ ──context rules──▶ adapted meta program
  ──emitter (grammar tables)──▶ target text
  ──lowering ─▶ stack machine ─▶ NASM / CIL / Jasmin
NASM / CIL / Jasmin ──machine reader──▶ stack machine ──lifting──▶ meta program
```

1. **Languages are data.** `js/src/grammar/languages.js` lists each
   language's comment markers, quotes, block style, declaration keywords,
   operators, print function, entry point, type names and naming
   convention. The lexer, parser and emitter read these tables. A project
   can describe a dialect the same way.
2. **The meta language** (`meta.js`) has a small set of node kinds:
   program, function, block, declaration, assignment, if, while, counting
   loop, return, print, evaluate, call, binary, unary, interpolation, name,
   number, text, boolean and comment. Type inference (`types.js`) assigns
   `integer`, `text`, `boolean` or `nothing` to every expression.
3. **Rules are functions from a meta program to a meta program.** Each of
   the three ordered lists does one kind of work:
   - Understanding rules turn source-specific forms into meaning. Examples:
     `printf("...\n")` becomes a print, `Math.trunc(a / b)` becomes integer
     division, and a C `main` becomes the entry point.
   - Meaning rules move between abstraction levels inside the meta
     language. For example, concatenation becomes interpolation.
   - Context rules adapt the program to the target. They adapt comments,
     copy parameters that are reassigned for languages where parameters
     cannot change, and spell names by convention.
     Callers can add more layers between the meaning and context rules,
     replace any list or stage, or wrap a rule to decorate it.
4. **Modes.** `context-dependent` (the default) adapts comments to the
   target. It replaces language names and terms, so "function call" in C
   becomes "method call" in C#. `literal` keeps comments word for word.
   `same-effect` keeps only the observable behaviour.
5. **Machine code is reached through a stack machine.** `lowering.js` turns
   the typed meta program into stack instructions with named slots.
   `machine.js` writes those as NASM, ILAsm or Jasmin, and keeps the
   variable names (`%define %$name`, named locals, `.var` directives). The
   reverse direction reads the instructions back (`machine-reader.js`).
   Then `lifting.js` rebuilds expressions with a symbolic stack, and
   rebuilds conditions, `if`/`else if`, `while`, counting loops and boolean
   values from their jump patterns. So machine code translates to every
   language, and assembly, CIL and JVM bytecode translate into each other.
6. **The common library** (`common-library/`, one file per language) only
   smooths over standard-library differences: `printLine`, `writeText`,
   `writeInteger` and `endLine`. With the `commonLibrary` option
   (`--common-library`) a meta layer replaces every print with these calls,
   so the output code is the same line for line in every language. Reading
   such a program recognizes the calls as prints again. The translated
   programs keep their own algorithms.
7. **Natural language.** `referents.js` ranks the readings of an ambiguous
   phrase. Each reading is a path in a type hierarchy (`person → white
person → person with white skin`), with probability ranges from corpus
   frequencies and context. Missing evidence is `[0, 1]`. Readings that
   survive a round trip rank first. The ranking is checked against
   [relative-meta-logic](https://github.com/link-foundation/relative-meta-logic).

### Alternatives considered

- **Tree-sitter grammars** cover more syntax and keep error nodes. However,
  they need a native binding in both runtimes and still give no meaning or
  types. The table-driven parser keeps the JavaScript and Rust ports small
  and identical.
  [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)
- **Lossless semantic trees** such as OpenRewrite's are a good fit for
  rewrites in one language. Here the lossless source document
  (`source-document.js`) covers CST survival separately.
  [OpenRewrite](https://docs.openrewrite.org/concepts-and-explanations/lossless-semantic-trees)
- **Decompilers** (Ghidra, ILSpy, Fernflower) lift arbitrary machine code
  with control-flow graph analysis. The lifting here only recognizes the
  patterns that lowering produces. It is enough for an exact round trip,
  and it rejects other code with a clear error.
  [ILSpy](https://github.com/icsharpcode/ILSpy) ·
  [Fernflower](https://github.com/JetBrains/fernflower)
- **Translation validation** in the style of
  [Alive2](https://github.com/AliveToolkit/alive2) would prove that two
  programs are equivalent. The issue lists proofs as future work. Here
  equivalence is checked by running both programs natively and comparing
  their output, and by comparing meta programs (`sameMeaning`).

The design takes the
[associative technology stack](https://github.com/link-assistant/formal-ai/blob/main/docs/associative-tech-stack.md)
principle of keeping every dependency inspectable. Rules, glossaries and
referents are data files in Links Notation under `data/translation`.

## Validation

- `npm test` runs the JavaScript tests, and `cargo test` runs the Rust
  tests. Both compare their output with the golden translations in
  `examples/programs/translated`. Every example program is translated into
  every language and machine target.
- `node examples/programs/write-translations.mjs --check` checks that the
  goldens are current.
- `node examples/programs/verify-native.mjs --require-all` compiles or
  interprets every golden and hand-written program and compares its output
  with the JavaScript original. The `native-translation` CI job installs
  all the toolchains and runs it.
- `js/tests/lifting.test.js` translates every machine golden into every
  machine target and checks for byte-identical output. It also runs the
  lifted JavaScript.
- `experiments/verify-syntax-exchange.sh` checks that the JavaScript and
  Rust command lines produce the same results.
