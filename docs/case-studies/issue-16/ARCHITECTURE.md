# Grammar and language architecture research

This is the comparison for [issue 16](https://github.com/link-foundation/universal-translator/issues/16).
Primary documentation was retrieved on 2026-11-26. Downloads, extracted text,
source URLs and sizes are retained in `data/prior-art/`. A downloaded document
is evidence about a component, not evidence that this translator implements it.

## Components and decisions

| Component                                                                                                                          | Relevant mechanism                                                                                                                                                  | Application here                                                                                                                                                         | Limits and required follow-up                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ANTLR](https://github.com/antlr/antlr4/blob/master/doc/grammars.md)                                                               | Separate lexer/parser or combined grammars; imports compose grammars with explicit rule precedence; token channels retain comments independently of parser rules    | Keep lexical preservation separate from understanding; grammar bundles need explicit import dependencies and override policy                                             | Target actions, predicates, lexer modes and channel behavior need executable handling; importing productions alone does not implement a language's semantics   |
| [ANTLR token rewriter](https://github.com/antlr/antlr4/blob/master/runtime/Java/src/org/antlr/v4/runtime/TokenStreamRewriter.java) | Rewrites address a buffered token stream without mutating its original token indices; named rewrite programs can coexist                                            | Concrete leaves retain the original text while semantic production views and transformations refer to ranges                                                             | Our semantic source maps currently retain lines; exact subline ownership through all transformations remains open                                              |
| [tree-sitter grammar DSL](https://tree-sitter.github.io/tree-sitter/creating-parsers/2-the-grammar-dsl.html)                       | Declarative sequences, alternatives, repetitions, fields, aliases, lexical/parse precedence, conflicts, extras and external scanners                                | Prefer importing generated `grammar.json` data to executing a third party's JavaScript grammar file; preserve feature metadata and field names                           | A JSON importer must also supply scanners and conflict resolution. Treating precedence wrappers as comments changes accepted syntax                            |
| [tree-sitter advanced parsing](https://tree-sitter.github.io/tree-sitter/using-parsers/3-advanced-parsing.html)                    | Byte ranges, edit records and included ranges support incremental and mixed-language parsing                                                                        | Shared UTF-8 ranges make nested concrete views possible; separate ranges describe discontiguous lifted instructions                                                      | The current source record is lossless but does not yet reuse an old parse tree incrementally                                                                   |
| [spaCy linguistic features](https://spacy.io/usage/linguistic-features)                                                            | Non-destructive tokenization; lemmas, part-of-speech, morphological features and dependency arcs are distinct annotations                                           | Preserve surface spelling and canonical referent identity independently. Represent case/number/gender on uses rather than renaming the underlying binding                | The two Russian case rules implemented here are a verified subset, not general agreement. Model-dependent analyses must remain optional and report uncertainty |
| [Stanza](https://stanfordnlp.github.io/stanza/)                                                                                    | A pipeline separates tokenization, multiword expansion, lemmas, morphology, dependency and constituency parsing, using Universal Dependencies                       | Natural readers need composable annotations and recursive clauses rather than a flat list of words                                                                       | Its PyTorch models are a possible external annotation adapter; downloading or loading them by default would violate the lightweight browser/runtime goal       |
| [NLTK, chapter 8](https://www.nltk.org/book/ch08.html)                                                                             | Recursive CFGs, dependency grammars, ambiguity and chart parsing; simple recursive descent loops on left recursion                                                  | An imported grammar must distinguish ordered choice from CFG alternatives and memoize competing readings. A parseable language can have several semantic interpretations | A first-success parser or whole-sentence template cannot establish the intended meaning of an ambiguous question                                               |
| [Lark grammar reference](https://github.com/lark-parser/lark/blob/master/docs/grammar.md)                                          | EBNF, priorities, templates, namespaced imports, `%override`, `%extend`, and explicit ignored terminals                                                             | Grammar packages need dependency resolution, explicit extension/override operations and separate trivia handling                                                         | `%ignore` is owned by the importing grammar; copying the directive out of a dependency changes behavior. Dynamic complete lexing can be expensive              |
| [GF resource grammar library](https://www.grammaticalframework.org/lib/doc/synopsis/)                                              | Abstract categories and typed constructors for noun/verb/adjective phrases, declarative/question/relative clauses and tense; language-specific concrete realization | Use structural clauses and grammatical features for both algorithms and questions. Canonical entities survive language-specific realization                              | GF's displayed examples include missing lexical entries for some languages; a library's language list is not complete vocabulary coverage                      |
| [Link Grammar](https://github.com/opencog/link-grammar)                                                                            | Typed links express subjects, objects, determiners and agreement; morphological alternatives and weighted disjuncts retain competing analyses                       | A graph view can complement phrase structure and retain uncertainty. Agreement constraints should be inspectable data                                                    | Dictionary coverage varies by language; the archived README labels several dictionaries prototypes. It cannot alone supply every requested natural language    |

## Sibling projects

The current [Formal AI technology map](https://github.com/link-assistant/formal-ai/blob/main/docs/associative-tech-stack.md)
distinguishes runtime dependencies, compatibility targets and development tools.
It uses meta-language for concrete syntax, a links store for durable knowledge,
and a separate reasoning/query/substitution layer. The translator should keep
those boundaries equally explicit: a syntax tree, an inferred meaning and an
evidence score are different products. An optional external solver can propose
an interpretation, while the translator still verifies syntax, reconstruction,
dependencies and behavior. Merely recording a sibling project's name does not
integrate its capabilities.

The current [meta-language grammar architecture](https://github.com/link-foundation/meta-language/blob/main/docs/grammar/architecture.md)
already defines a grammar expression algebra, links encoding, import/export,
runtime parsing, merging and concept alignment. The installed Rust 1.0.0 crate
exposes `import_antlr`, `import_lark`, `import_tree_sitter_json`, `GrammarParser`,
feature-runtime execution, merging and grammar interchange. Its lightweight
runtime explicitly rejects feature forms and delegates them to the feature
executor; callers must choose the correct executor rather than treating a
rejection as acceptance.

The [bulk grammar pipeline](https://github.com/link-foundation/meta-language/blob/main/docs/grammar/bulk-pipeline.md)
pins upstream revisions, imports tree-sitter and grammars-v4 separately,
compiles and parses samples, compares concrete trees, then merges. Its matrix
retains failures as failures. This provides a useful model for update tracking
and independent grammar verification. Its
[fidelity documentation](https://github.com/link-foundation/meta-language/blob/main/docs/grammar/fidelity.md)
also distinguishes a lossless conversion from an approximation.

There is a material distribution difference: the archived repository manifest
declares JavaScript 1.1.0, while `npm view meta-language version --json` returns
0.46.0. The installed JavaScript package has a small grammar builder and emitter
but lacks the portable-program translator and grammar-provenance methods that
our optional integration requires. This is current evidence, not the old
unverified Rust-build blocker. The Rust dependency builds locally. Integration
work must supply a working JavaScript path and test both runtimes; changing a
version number to an unpublished package is not a solution.

[Router PR 775](https://github.com/link-assistant/router/pull/775) is closed and
explicitly reports only 12 of 70 source bundles drafted. Its useful techniques
are reusable bidirectional CST translation, pinned complete-source archives,
separate JavaScript and Rust validation, and distinguishing a human-action
preflight from a passing implementation. It is evidence for architecture and
failure modes, not an available complete translator to adopt unquestioned.

[Relative Meta Logic](https://github.com/link-foundation/relative-meta-logic)
separates context-relative truth values, configurable operators, dependent
types, explicit dependencies and queries. This repository already uses its
probability core for ranking. A confidence score cannot prove a translation
correct, and unknown facts must not become true merely because a candidate is
the highest-ranked one. Question translation needs an inspectable query plan;
emitting a canned answer or a probability alone would miss the requirement.

## Implementation path

1. Keep concrete leaves immutable and lossless by default. The implementations
   now do this for formal, natural, machine and incomplete input; accepted
   production views and unread ranges remain separate.
2. Import external grammars into a common, inspectable expression model. Record
   source revision, entry point, dependencies, scanner requirements and every
   construct whose semantics affect recognition. Reuse the sibling grammar
   subsystem where its shipped capabilities suffice.
3. Give import/update/merge operations before/after transformation hooks. Keep
   separate language entry points as well as unified bundles. Test updates
   against both acceptance and rejection examples and retain source provenance.
4. Bind production concepts to existing understanding stages. A grammar proves
   syntax; reusable semantic rules still implement operators, effects, types,
   objects, exceptions, libraries, queries and lowering.
5. Add recursive phrase/clause and query representations with feature-based
   realization and canonical referents. Accept optional dependency/constituency
   annotations through replaceable readers, without requiring large neural
   models for ordinary controlled-language translation.
6. Verify imported grammars using independent upstream fixtures and native
   target behavior. Count original corpus programs actually read, not generated
   source or stored-source reconstruction. Preserve failures in the inventory.

The [grammar workspace](../../grammar-workspace.md) now implements the common
import/update/merge/execution path in steps 2–3 and a reusable semantic-reader
binding for step 4. Nine shared interchange fixtures execute in both runtimes,
including a complete import-to-translation example, failed updates, dependency
refreshes, separate editions, stable merge identities, byte-preserving concrete
records, bounded recovery and stage transforms. JavaScript uses the 41-file
grammar-only closure at `a79782093cae3b33606483ac9f3e1d05faf36de0`, matching the
published Rust 1.0.0 source. Digests, original source and the explicit portable
SHA-256 patch are recorded rather than depending on an unpublished npm release.

The adapter rejects conversion losses reported by the target emitter; it does
not claim that every feature has a lowering to every grammar notation. The
fixtures verify the implemented infrastructure, not full language grammars or
all their semantic readers. Steps 4–6 therefore still require implementation
and coverage across the complete issue inventory.
