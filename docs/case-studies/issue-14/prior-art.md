# Prior art for issue 14

Research date: 2026-11-25. This file surveys existing projects relevant to the
requirements of issue 14 (lossless concrete syntax trees, nested grammars, a
deeper natural-language grammar and dictionary, a synchronized two-editor web
UI, more assembly dialects and intermediate languages) and ends each section
with a concrete recommendation for this repository.

Facts below were read from the linked pages or repositories on the research
date. Where a fact could not be confirmed it is marked **(unverified)**.

Repository context used for the recommendations: the translator is a pipeline
`lexer/table-driven parser -> understanding rules -> meta program -> type
inference -> meaning/context rules -> emitter` (see `README.md`); sources live
in `js/src/{translation,natural,meta,formal}`; machine targets are NASM, CIL
(ILAsm) and JVM (Jasmin); CI already installs `nasm` and `jasmin-sable` with
`apt` and downloads ILAsm from NuGet (`.github/workflows/release.yml`); the web
app is `examples/universal-app` and already depends on `monaco-editor ^0.58.0`.

Contents:

1. [Concrete syntax trees and whitespace preservation](#1-concrete-syntax-trees-and-whitespace-preservation)
2. [Grammar nesting and language injection](#2-grammar-nesting-and-language-injection)
3. [Natural-language architecture, grammar and dictionary](#3-natural-language-architecture-grammar-and-dictionary)
4. [Side-by-side mapping UI and Monaco synchronization](#4-side-by-side-mapping-ui-and-monaco-synchronization)
5. [Assembly dialects and intermediate languages](#5-assembly-dialects-and-intermediate-languages)
6. [Related link-foundation and link-assistant projects](#6-related-link-foundation-and-link-assistant-projects)
7. [Consolidated recommendations](#7-consolidated-recommendations)

---

## 1. Concrete syntax trees and whitespace preservation

The recurring design question is **where whitespace and comments live**. There
are four answers in the wild, and they determine how reprinting works.

| Approach                                         | Used by                       | Idea                                                                  |
| ------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------- |
| Trivia attached to tokens (leading and trailing) | Roslyn, swift-syntax          | Whitespace, comments and directives belong to the neighbouring token  |
| Trivia as ordinary tree elements                 | rust-analyzer/rowan, IntelliJ | Whitespace and comment tokens are siblings of real tokens in the tree |
| Trivia on a hidden channel or in "extras"        | ANTLR, Tree-sitter            | The parser skips them, but they stay in the token stream or tree      |
| Trivia as typed fields of each node              | LibCST                        | Every node owns the exact spacing around it                           |
| Original text kept next to the AST               | recast                        | Reuse the original source for every node that did not change          |

### 1.1 Roslyn (C# and VB compiler)

- What it is: Microsoft's compiler platform. Syntax trees are immutable,
  "full fidelity" (every token, whitespace, comment and preprocessor directive)
  and can reproduce the exact text they were parsed from, even for
  malformed input. Source:
  [Work with syntax](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-syntax).
- Architecture: nodes, tokens and trivia. Trivia are not children of nodes;
  each is attached to one token as `LeadingTrivia` or `TrailingTrivia`. The
  attachment rule is simple and worth copying verbatim: "a token owns any
  trivia after it on the same line up to the next token. Any trivia after
  that line is associated with the following token", the first token owns the
  initial trivia and the end-of-file token owns the final trivia. Each node has
  `Span` (without trivia) and `FullSpan` (with trivia). Errors are kept in the
  tree as zero-width _missing_ tokens and `SkippedTokensTrivia`.
- Internals: a **green tree** (immutable, persistent, stores widths, no parent)
  and a **red tree** (a façade built on demand with parent links and absolute
  positions). Source:
  [Eric Lippert, Persistence, façades and Roslyn's red-green trees](https://ericlippert.com/2012/06/08/persistence-facades-and-roslyns-red-green-trees/).
  (Short summary form: [Red-green trees](https://ericlippert.com/2012/06/08/red-green-trees/).)
- Recommendation: adopt the **Roslyn trivia rule** as the single, documented
  attachment rule for all 32 languages (trailing trivia up to and including the
  end of line, everything else leading on the next token). It is language
  independent, so one `trivia` model serves every grammar table. Expose both a
  "span" and a "full span" per tree node; the UI mapping in section 4 needs
  them.

### 1.2 rust-analyzer and rowan

- What it is: `rowan` is "a library for lossless syntax trees, inspired in part
  by Swift's libsyntax"
  ([rust-analyzer/rowan](https://github.com/rust-analyzer/rowan)). The
  rust-analyzer syntax guide is
  [docs/book/src/contributing/syntax.md](https://github.com/rust-lang/rust-analyzer/blob/master/docs/book/src/contributing/syntax.md).
- Architecture: the parser never sees whitespace; a `TreeSink` layer inserts
  whitespace and comment tokens into the tree afterwards, and comments are
  attached to nodes heuristically. Every token stores its full text, so
  concatenating all token texts reproduces the file. Green tree = untyped,
  interned, text only at leaves; red tree = cursor with parents and offsets.
  Parse errors are stored beside the tree and wrapped in `ERROR` nodes, so the
  tree stays lossless for invalid input. A **typed AST layer** of thin
  checked-cast wrappers (all accessors optional so incomplete code is
  representable) sits on top of the untyped tree.
- Recommendation: keep an **untyped, lossless CST as the single source of
  truth** and generate typed views over it. This matches the issue's request
  "CST by default": the meta program should be derived from the CST, with an
  AST view that points back into it (node id plus text span). The parser should
  not need to know about whitespace; a sink step inserts trivia, which keeps
  the existing table-driven parsers unchanged.

### 1.3 Swift: libSyntax and swift-syntax

- What it is: swift-syntax provides a "source-accurate tree representation of
  Swift source code" and underpins Swift macros
  ([swiftlang/swift-syntax](https://github.com/swiftlang/swift-syntax)). The
  README does not describe trivia; the leading/trailing-trivia model is the
  same as Roslyn's. **(unverified on the fetched page; see the Swift
  documentation on `Trivia` at
  [swiftpackageindex.com](https://swiftpackageindex.com/swiftlang/swift-syntax/documentation/swiftsyntax).)**
- Relevant idea: the tree is **round-trippable and also the macro/rewrite
  substrate**: tools edit by building new nodes, then print. rowan cites
  libsyntax as inspiration.
- Recommendation: model rewriting as "build a new tree, then print"; do not
  patch strings. Provide factory helpers (`makeCall(name, args)`) that
  produce nodes with _default trivia_ (single space after comma, newline after
  statement) so generated code is readable even when no source trivia exists.

### 1.4 Tree-sitter

- What it is: an incremental parser generator that produces concrete syntax
  trees and re-parses only the edited region
  ([tree-sitter.github.io](https://tree-sitter.github.io/tree-sitter/)).
- `extras`: "an array of tokens that may appear anywhere in the language" -
  by default whitespace; comments are added here. Extras appear in the tree as
  ordinary nodes (`comment`), so the tree is lossless over _tokens_; whitespace
  itself is recovered from byte offsets between nodes
  ([grammar DSL](https://tree-sitter.github.io/tree-sitter/creating-parsers/2-the-grammar-dsl.html)).
  Other useful DSL fields: `inline`, `supertypes`, `word`.
- Recommendation: use the Tree-sitter trick for storage: **every node has
  `startByte`/`endByte` into the original text; whitespace is the gap between
  siblings.** That gives a lossless tree without a whitespace node for every
  space, and makes `print(parse(x)) === x` a cheap invariant. Also consider
  Tree-sitter grammars as a **grammar source** for languages that the repo's own
  tables do not yet cover; many exist and the node-types JSON is machine
  readable. **(Evaluate licensing per grammar.)**

### 1.5 ANTLR

- What it is: a parser generator. Whitespace and comments can be sent to a
  channel with `WS : [ \t\r\n\f]+ -> channel(HIDDEN) ;` instead of `-> skip`
  (which discards the text)
  ([lexer rules](https://github.com/antlr/antlr4/blob/master/doc/lexer-rules.md)).
  Hidden tokens stay in the `CommonTokenStream`, so they can be queried
  (`getHiddenTokensToLeft/Right`).
- `TokenStreamRewriter` queues `insertBefore`/`insertAfter`/`replace`/`delete`
  edits against the token stream without mutating it and applies them lazily on
  `getText()`; several independent "programs" may share one buffer
  ([API](https://www.antlr.org/api/Java/org/antlr/v4/runtime/TokenStreamRewriter.html)).
  Because the unchanged tokens (including hidden ones) are emitted verbatim,
  formatting survives.
- Lexer modes (`pushMode`/`popMode`) are ANTLR's built-in way to nest
  sub-languages such as string interpolation.
- Recommendation: the **lazy edit-list printer** is a good model for
  same-language edits (rename, replace) and for the UI's "edit translation and
  map back" scenario; implement it over the CST as a list of (span, new text)
  edits applied at print time.

### 1.6 Lark

- What it is: a Python parsing toolkit with Earley (default, dynamic lexer)
  and LALR engines. Relevant options:
  `keep_all_tokens` (default `False`, drops punctuation tokens from the tree),
  `propagate_positions` (adds line, column, `start_pos`, `end_pos` to node
  `meta`), `maybe_placeholders`
  ([parser classes](https://lark-parser.readthedocs.io/en/latest/classes.html)).
  `%ignore` drops matched terminals
  ([grammar reference](https://lark-parser.readthedocs.io/en/latest/grammar.html));
  to keep comments you must capture them with `lexer_callbacks` **(unverified
  on these pages; documented in the Lark FAQ)**. `lark.reconstruct.Reconstructor`
  rebuilds text from a tree and is documented as experimental; it does not
  restore ignored whitespace or comments **(unverified)**.
- Recommendation: Lark is a cautionary example. A parser that **discards**
  ignorable tokens must be paired with a side channel of positions, otherwise
  the printer can never be lossless. Do not derive the output printer from the
  grammar by reversal; keep an explicit emitter per language and feed it
  trivia.

### 1.7 LibCST (Python)

- What it is: a lossless Python CST whose node types follow Python semantics
  rather than the grammar, so semantic edits stay easy
  ([Why LibCST?](https://libcst.readthedocs.io/en/latest/why_libcst.html)).
- Whitespace: instead of `prefix` strings it parses whitespace into explicit
  nodes owned by the node they belong to: `leading_lines` (blank lines and
  comments above a statement), `trailing_whitespace` (spaces, comment and
  newline at line end), `whitespace_before_args`, `whitespace_after_arg`; the
  `Module` stores `default_indent`, `default_newline` and `has_trailing_newline`.
  Removing an argument therefore removes its own comma and spacing.
- Recommendation: copy two ideas. (a) Store document-level formatting
  defaults (indent unit, newline style, final newline) on the root so
  translated output can be re-indented to the **target** language's convention
  while keeping the source's _structure_ of blank lines. (b) Give comments and
  blank lines to the **statement** that follows them (`leading_lines`), so
  deleting or moving a statement moves its comment with it.

### 1.8 recast (JavaScript)

- What it is: parse JavaScript, modify the AST, print it back "while keeping
  the original formatting of untouched code". `parse` keeps a shadow copy with
  `.original` references; `print` finds changed nodes and **reuses the original
  source text for everything else**, falling back to a pretty printer for
  nodes it cannot reprint; `print(parse(src)).code === src` is guaranteed
  ([benjamn/recast](https://github.com/benjamn/recast)).
- Recommendation: for _same-language_ round trips (the property test the issue
  implies) implement recast's reuse strategy: each translated node remembers
  its source node; when the translator emits an unchanged node into the same
  language, copy the original text. For _cross-language_ output there is no
  original text to reuse, so carry only trivia (comments, blank lines,
  relative indentation) and pretty-print the rest.

### 1.9 How cross-language translation changes the problem

All the tools above reprint in the **same** language. Translation to another
language needs three extra decisions, which are the real design work:

1. **Comment re-delimiting.** `// x` -> `# x` -> `-- x` -> `(* x *)`. Store the
   comment _text_ and a `style` (line, block, doc) and let the target emitter
   choose delimiters. The repo already has `js/src/natural/comments.js` and
   `js/src/translation/comment-language.js`, which translate comment text.
2. **Blank-line and grouping fidelity.** Keep the _count_ of blank lines
   between statements (capped), not the exact whitespace.
3. **Indentation re-basing.** Store indentation as a depth number plus the
   document's indent unit, not as raw spaces; Python/Nim-style significant
   indentation then translates cleanly to brace languages.

Test oracle: `print(parse(x)) === x` byte for byte for every example in
`examples/programs/**` (including `experiments/issue-14/whitespace.js`, which
has odd spacing such as `( "Hello World!")` and `1+ 2`), and a second check that
the translated output keeps the comment count and blank-line structure.

---

## 2. Grammar nesting and language injection

### 2.1 Tree-sitter injections

- Idea: a second query file `injections.scm` selects nodes whose text is
  **re-parsed with another grammar**. Captures: `@injection.content` (the node
  to re-parse) and `@injection.language` (a node whose text names the
  language); properties `injection.language` (fixed language),
  `injection.combined` (parse all matches as one nested document, e.g. several
  heredoc or template pieces) and `injection.include-children`
  ([syntax highlighting](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html)).
- Result: the host tree contains a string node, and a **separate tree for the
  inner language covers a sub-range of the same buffer**. This is exactly the
  "SQL in a string" and "code in Markdown" case.
- Recommendation: represent nesting as a node `embedded(language, range,
innerTree)` **inside the host CST**, produced by declarative injection rules
  stored in the grammar tables, for example `string-literal whose argument
position of db.query/execute -> sql`, `tagged template sql\`...\` -> sql`,
`comment -> natural-language(en)`, `fenced block with info string -> that
  language`. Use `combined`semantics for template literals with`${expr}`:
  the inner language sees the text pieces joined by placeholders, the host
  keeps the expressions. This is the single mechanism that covers all nesting
  cases in the issue (code in NL, NL in comments, SQL in strings).

### 2.2 TextMate grammars (VS Code)

- Idea: regex-based rules with `begin`/`end`; `include` can pull in another
  grammar by scope name, e.g. `source.php`
  ([TextMate language grammars](https://macromates.com/manual/en/language_grammars)).
  VS Code adds `embeddedLanguages` (map a scope such as
  `meta.embedded.block.javascript` to a language id so comments, brackets and
  snippets work inside), **injection grammars** (`injectTo` in `package.json`,
  `injectionSelector` such as `L:comment.line.double-slash` in the grammar;
  `L:` means tried first), and injection grammars may themselves use
  `embeddedLanguages` to treat SQL inside JS strings as SQL
  ([Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)).
- Recommendation: injection by **scope selector**, not by editing the host
  grammar, is the right extension point: a "SQL in strings" rule should be a
  separate, optional rule that targets host nodes, so adding a new embedded
  language never touches 32 grammars.

### 2.3 Monaco / Monarch embedded languages

- Monaco's Monarch tokenizer supports switching languages inside a string
  with `nextEmbedded` and `@pop` in the tokenizer states (the HTML sample
  embeds JavaScript and CSS). **(unverified: the docs page at
  [monaco-editor/monarch.html](https://microsoft.github.io/monaco-editor/monarch.html)
  did not render in the fetch tool.)** Monaco has no notion of sub-trees; it
  only colours tokens.
- Recommendation: do **not** rely on Monarch for nested correctness. Colour
  nested regions in the UI from the CST's `embedded` nodes using decorations
  or semantic tokens (next item), and keep Monarch for the host language only.

### 2.4 LSP semantic tokens and VS Code semantic highlighting

- Idea: semantic highlighting is layered on top of TextMate colours. A
  provider returns tokens with a type, optional modifiers and optionally a
  language, declared in a `SemanticTokensLegend` and encoded as indexes
  ([Semantic Highlight Guide](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)).
  The wire format of LSP 3.16+ is a flat integer array (`deltaLine`,
  `deltaStart`, `length`, `tokenType`, `tokenModifiers` per token, positions
  relative to the previous token)
  ([LSP 3.17, Semantic Tokens](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_semanticTokens)).
  In Monaco, the equivalent API is
  `monaco.languages.registerDocumentSemanticTokensProvider`.
- Recommendation: emit **CST-derived semantic tokens** (type = CST node kind,
  modifiers = `embedded`, `comment`, `translated`) and register one provider
  per language id. This gives accurate colours for nested regions, for natural
  language parts of speech (section 3) and for "this token was translated"
  hints, with a compact delta encoding that is cheap to send from a worker.

---

## 3. Natural-language architecture, grammar and dictionary

The issue asks for a recursive grammar and dictionary with parts of speech,
morphology and phrase structure, so that free sentences can be translated
between natural languages using the most frequent choice that survives a round
trip. The prior art splits into **interlingua systems** (GF), **transfer
systems** (Apertium), **parsing pipelines** (spaCy, Stanza, Link Grammar) and
**data resources** (UD, UniMorph, Wiktionary, Wikidata, OMW).

### 3.1 Grammatical Framework (GF) - the closest architectural match

- What it is: a language for multilingual grammars. One grammar can parse,
  generate and translate
  ([GF tutorial](https://www.grammaticalframework.org/doc/tutorial/gf-tutorial.html)).
- Architecture: an **abstract syntax** (`cat` categories, `fun` constructors)
  describes meaning once; one **concrete syntax** per language (`lincat`,
  `lin`) says how trees are written as strings. Parsing = string -> abstract
  tree; linearization = tree -> string; translation = parse in A, linearize in
  B (`parse -lang=ShopEng "I want milk" | linearize -lang=ShopSpa`). Functors
  and interfaces let several related languages share one concrete syntax and
  differ only in a small lexicon instance.
- **Resource Grammar Library (RGL):** morphology and syntax for 38 languages
  on the synopsis page ([RGL synopsis](https://www.grammaticalframework.org/lib/doc/synopsis/index.html)):
  Afrikaans, Arabic, Bulgarian, Catalan, Chinese, Czech, Danish, Dutch,
  English, Estonian, Basque, Finnish, French, German, Greek, Hindi, Icelandic,
  Italian, Japanese, Latin, Latvian, Maltese, Mongolian, Nepali, Norwegian
  (two), Persian, Punjabi, Polish, Portuguese, Romanian, Russian, Slovak,
  Sindhi, Spanish, Swedish, Thai, Urdu. Core categories: `S`, `Cl`, `NP`, `VP`,
  `CN`, `AP`, `Det`, `N`, `V`, `V2`, `Adv`, with constructors `mkS`, `mkCl`,
  `mkNP`, `mkCN`, `mkAP`, `mkVP`, `mkUtt`. This is a worked answer to "recursive
  grammar with parts of speech, morphology and phrase structure".
- Fit with this repo: the repo's 30 controlled natural languages
  (`js/src/natural`, about 2,650 lines) are already a _controlled_ subset; the
  GF split (abstract + concrete) is the same shape as "meta language + per
  language table".
- Recommendation: **adopt GF's architecture, not necessarily GF itself.**
  1. Define a small _abstract syntax of natural language_ as meta links:
     categories `S, Cl, NP, VP, CN, AP, Det, N, V, V2, Adv, Prep, Conj` and
     recursive constructors (`PredVP NP VP`, `ModCN AP CN`, `AdvVP VP Adv`,
     `ConjS Conj S S`). Recursion in constructors gives the "deeper recursive"
     grammar.
  2. One **concrete table per language** (word order, agreement features,
     determiner use, clitics) in the same declarative style as the existing
     grammar tables; `linearize` = tree -> text, `parse` = text -> tree.
  3. A **lexicon** keyed by language-neutral concept ids (section 3.8) with a
     paradigm per entry (`regV "walk"`, GF's smart paradigms) so morphology is
     generated, not stored per form.
  4. Optionally **call GF itself** (it has a runtime and a JS-friendly
     PGF format) as a reference implementation in tests: translate a few
     hundred sentences with GF's RGL and compare. **(Evaluate GF's licence and
     the PGF web runtime before depending on it; GF is open source, not
     verified here.)**

### 3.2 Apertium - rule-based transfer MT

- What it is: a free/open-source, transfer-based rule MT platform under the
  GPL ([Wikipedia](https://en.wikipedia.org/wiki/Apertium);
  [apertium.org](https://apertium.org/);
  [documentation index](https://wiki.apertium.org/wiki/Documentation)).
- Pipeline: deformatter (strip markup) -> morphological analyser (lttoolbox
  finite-state transducers or HFST) -> POS tagger/disambiguator (mostly
  Constraint Grammar) -> **lexical transfer** with a bilingual dictionary
  (`bidix` XML) and lexical selection -> **structural transfer** (chunking and
  reordering/agreement rules) -> morphological generator -> post-generator ->
  reformatter. The Wikipedia article lists 108 pairs and 51 languages and
  varieties (its infobox says 35 languages; counts differ by source).
- Relevant idea: the **deformatter/reformatter** keeps markup out of the
  linguistic pipeline and puts it back, which is the same problem as keeping
  code and punctuation in prose, and a model for the issue's "code inside
  natural language".
- Recommendation: use Apertium's _vocabulary of stages_, not its code (GPL
  would constrain this Unlicense-style project; check
  [LICENSE](../../../LICENSE) policy before copying data). Concretely: a
  bilingual dictionary file per language pair is the unit of data, with entries
  `lemma + POS + features -> lemma + POS + features`, and structural transfer
  rules are the per-pair exceptions to the interlingua route. Use direct
  pairs only where the interlingua loses information.

### 3.3 Link Grammar (opencog)

- What it is: a parser where each word has typed **connectors** (a word
  definition is a set of "disjuncts"; `S- O+` is a transitive verb; `+`/`-`
  point right/left) and a sentence parse is a set of labelled links
  (linkage). It also produces a constituent view and can skip unparseable
  parts. The English dictionary covers about 60,000 word forms
  ([CMU Link Grammar](https://www.link.cs.cmu.edu/link/)). The
  [opencog/link-grammar](https://github.com/opencog/link-grammar) repo (LGPL)
  has full dictionaries for English, Russian, Thai, Arabic, Persian and
  smaller or experimental ones for about ten more languages, with bindings
  including Node.js and an Emscripten build.
- Recommendation: its **dictionary-as-connectors** format is a compact way to
  describe valency (verb argument frames) and could seed the `V`/`V2`/`V3`
  frames of the lexicon; it is not a good transfer substrate because it has no
  generation side. Treat as a **parsing aid for English input only**.

### 3.4 spaCy

- What it is: an industrial NLP library. The **tokenizer runs first** and
  produces a `Doc`; trained pipelines then run components `tok2vec`, `tagger`,
  `parser`, `ner`, `attribute_ruler`, `lemmatizer`; `Token` and `Span` are
  views into the `Doc`; custom components are functions `Doc -> Doc`
  registered with `@Language.component`/`@Language.factory` and extra data
  lives in `Doc._`, `Token._`, `Span._`
  ([Processing pipelines](https://spacy.io/usage/processing-pipelines)).
- Recommendation: copy the **data model**: one document object holding token
  annotations (`text`, `lemma`, `pos`, `morph`, `head`, `dep`, `start`, `end`)
  and **views** (tokens, spans) that never copy text. It is the same shape
  as the CST plan in section 1 and lets natural-language annotations be added
  as pipeline stages that can be turned on and off.

### 3.5 Stanza and Universal Dependencies

- Stanza (Stanford NLP) offers neural pipelines for 70 languages with
  tokenization, multi-word-token expansion, lemmatization, POS and
  morphological features, dependency parsing and NER, built on the Universal
  Dependencies formalism, Apache-2.0
  ([stanfordnlp.github.io/stanza](https://stanfordnlp.github.io/stanza/)).
- Universal Dependencies (UD): treebanks and guidelines for "nearly 200 human
  languages", annotated with lemma, universal POS (UPOS), morphological
  features and dependency relations, stored as **CoNLL-U**; open licences,
  mostly Creative Commons ([UD introduction](https://universaldependencies.org/introduction.html)).
- Recommendation: use **UD as the shared tag set**: UPOS (`NOUN`, `VERB`,
  `ADJ`, `ADV`, `ADP`, `DET`, `PRON`, `AUX`, `CCONJ`, `SCONJ`, `NUM`,
  `PART`, `PUNCT`, ...), UD features (`Number=Sing`, `Tense=Past`,
  `Case=Nom`) and dependency labels (`nsubj`, `obj`, `obl`, `amod`, `advmod`,
  `case`, `mark`). Read and write **CoNLL-U** so UD treebanks can serve as test
  data for the parser side and so the node ids are interoperable. Stanza or
  spaCy are not runtime dependencies (they are Python and large); they are
  useful offline to bootstrap tables and generate gold test files.

### 3.6 NLTK feature grammars

- What it is: chapter 9 of the NLTK book builds **feature-based CFGs**:
  categories carry feature structures, agreement is expressed with variables
  (`S -> NP[NUM=?n] VP[NUM=?n]`) instead of duplicating rules, `unify()` merges
  structures and fails on conflict, grammars are loaded from `.fcfg` files
  and run by a chart parser; slash categories (`S/NP`) handle gaps
  ([NLTK book, chapter 9](https://www.nltk.org/book/ch09.html)).
- Recommendation: express agreement (person, number, gender, case, definiteness)
  as **feature bundles with unification** in the concrete syntax tables, not as
  extra categories. It is small enough to implement in the repo's JavaScript
  and Rust and is what makes morphology (3.7) and word-order rules short.

### 3.7 UniMorph and morphology

- UniMorph annotates morphology in a universal schema over 169 languages: each
  entry is a lemma, an inflected form and a **feature bundle**; most data is
  CC BY-SA 3.0, a few sets are LGPLLR ([unimorph.github.io](https://unimorph.github.io/)).
- Recommendation: store morphology as **paradigm functions plus exceptions**
  (GF-style), and verify them against UniMorph tables in tests (generate the
  inflected form from lemma + features and compare). Keep UniMorph data out of
  the repository tree unless the CC BY-SA obligations are accepted; fetch it in
  a test step instead.

### 3.8 Dictionary data sources and licences

| Source                                                                          | Content                                                                                                   | Licence (as stated)                                                                                                                | Use here                                                                                                 |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [Wikidata lexemes](https://www.wikidata.org/wiki/Wikidata:Lexicographical_data) | Lexemes, Forms (with grammatical features), Senses (can link to Wikidata items via P5137)                 | Wikidata data is CC0 (see [licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)); the fetched page itself did not state it | Best source of **concept-linked** entries; free to bundle                                                |
| [Wiktionary](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)              | Entries, inflection tables, translations                                                                  | CC BY-SA 4.0 and GFDL                                                                                                              | Requires attribution and share-alike; do not copy into an Unlicense tree without a separate data package |
| [kaikki.org / Wiktextract](https://kaikki.org/)                                 | Wiktionary dumps as JSON for many languages                                                               | No licence on the page; derived from Wiktionary, so presumed CC BY-SA **(unverified)**                                             | Convenient machine-readable extraction for building tables offline                                       |
| [Open Multilingual Wordnet](https://omwn.org/)                                  | 60 wordnets for 49 languages, linked to Princeton WordNet and the Collaborative Interlingual Index (CILI) | "Open"; licences differ per wordnet, cite each                                                                                     | Sense inventory and **interlingual sense ids** for the abstract lexicon                                  |
| [UniMorph](https://unimorph.github.io/)                                         | Paradigms for 169 languages                                                                               | CC BY-SA 3.0 mostly                                                                                                                | Morphology tests                                                                                         |
| [Universal Dependencies](https://universaldependencies.org/introduction.html)   | Treebanks for nearly 200 languages                                                                        | Mostly Creative Commons                                                                                                            | Parser tests, frequency of constructions                                                                 |

- Recommendation: **separate code and data.** Keep the generated lexicon as a
  versioned data package with a per-entry `source` and `license` field, and
  keep the core tables small and hand-written. Build entries as
  `concept id (CILI/Wikidata Q-id or L-id) -> per language lemma + POS +
paradigm + frequency rank`.

### 3.9 Choosing "the most frequent, round-trip-surviving" word

None of the above gives this selection rule directly; it is a design for this
repository assembled from them:

1. Candidates for a source lemma = all target lemmas sharing a concept id
   (OMW/Wikidata sense) with the same UPOS.
2. Filter by **round trip**: translate each candidate back; keep candidates
   whose back-translation set contains the original lemma.
3. Rank survivors by corpus frequency in the target language; tie-break by
   fewer senses (less ambiguous). Frequency data source is a choice to make
   (open subtitle corpora, Wikipedia counts, or the `wordfreq` package;
   **licences unverified**).
4. Store the choice in the dictionary as `preferred` so output is
   deterministic, and record rejected candidates for the UI (hover shows
   alternatives).

---

## 4. Side-by-side mapping UI and Monaco synchronization

### 4.1 Reference UIs

- **Compiler Explorer (godbolt):** source on the left, assembly on the right;
  each source line gets its own colour and the assembly it produced is shaded
  to match; hovering a line in either pane briefly highlights the matching
  lines in the other
  ([WhatIsCompilerExplorer](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/WhatIsCompilerExplorer.md)).
  The server API returns for each assembly line a `source` field with file and
  line (or null)
  ([API](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/API.md)).
  So the contract is a **per-output-line pointer to input line**; the UI is a
  pure function of that table.
- **Monaco diff editor:** two editors (`getOriginalEditor()`,
  `getModifiedEditor()`) with line changes (`getLineChanges()`), inline change
  decorations, and a connecting margin; created with
  `monaco.editor.createDiffEditor`. It aligns by _text difference_, which does
  not apply to translation (the texts are in different languages), so it is a
  layout reference only.
- **Meld / Beyond Compare:** panes joined by curved **connector ribbons**
  between corresponding chunks, synchronized scrolling that keeps chunks
  aligned ([meldmerge.org](https://meldmerge.org/)). Ribbons are drawn on a
  canvas/SVG between the panes using each chunk's pixel position.
- **Translation sites (Google Translate, DeepL, and similar):** hover a
  word and the aligned word in the other column is highlighted; the data comes
  from word alignment (see fast_align, awesome-align) **(feature details of
  specific commercial sites unverified)**. Here the CST gives exact alignment
  for free: each target token was produced from a known source node.
- **Markdown preview scroll sync:** VS Code stamps each block token with a
  `data-line` attribute and a `code-line` class; the controller builds a scroll
  map from element offsets to source lines and sends `revealLine` back
  ([vscode issue 133376](https://github.com/microsoft/vscode/issues/133376),
  [example controller gist](https://gist.github.com/mrienstra/bbd9c68a8686643465e3efc3856906d8)).
  Lesson from the Joplin discussion: a **line map only** drifts on long blocks,
  so use a character-offset map where possible
  ([Joplin forum](https://discourse.joplinapp.org/t/feature-request-better-synchronized-scrolling-in-desktop-app/3609)).

### 4.2 Data model for the mapping

Produce, per translation, a list of **mapping records**:

```
{ id, srcStart, srcEnd, dstStart, dstEnd, kind, sourceNodeId }
```

with offsets (not lines) as primary data and lines derived from them; `kind`
is `token | node | comment | embedded`. Build it in the emitters: the printer
already knows the text range it wrote for each CST node, so record
`(node.span, outputRange)` while printing (Roslyn `Span`/`FullSpan` and recast
`.original` are the same idea). Many-to-many is normal (one statement -> many
assembly instructions), so the UI must treat each record as a group id.

### 4.3 Monaco APIs to use

All signatures below were checked against `monaco-editor@0.58.0`
`editor.api.d.ts` (the version in `examples/universal-app/package.json`):

| Need                    | API                                                                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mapped region highlight | `editor.createDecorationsCollection(decorations?)` returning `IEditorDecorationsCollection` (`set`, `clear`); `IModelDeltaDecoration.options` accepts `className`, `inlineClassName`, `glyphMarginClassName`, `linesDecorationsClassName`. `deltaDecorations` is deprecated in favour of this. |
| Scroll sync             | `editor.onDidScrollChange(e)` (event has `scrollTop`, `scrollHeight`, `scrollTopChanged`), `editor.setScrollTop(top, scrollType?)`, `editor.setScrollPosition({scrollTop})`, `getScrollHeight()`, `getVisibleRanges()`                                                                         |
| Line to pixel           | `editor.getTopForLineNumber(line, includeViewZones?)`, `getBottomForLineNumber(line)`, `getScrolledVisiblePosition(pos)`                                                                                                                                                                       |
| Reveal                  | `revealLineNearTop(line, scrollType)` and `revealRangeInCenter`                                                                                                                                                                                                                                |
| Cursor and selection    | `editor.onDidChangeCursorSelection(e)` with `e.selection`, `e.secondarySelections`, `e.source` and `e.reason`; `editor.setSelections([...])`                                                                                                                                                   |
| Fold state              | `editor.onDidChangeHiddenAreas` ("emitted when hidden areas change in the editor (e.g. due to folding)"); `editor.getContribution('editor.contrib.folding')`; commands `editor.fold`, `editor.unfold`, `editor.toggleFold`, `editor.foldRecursively`, `editor.foldAll`, `editor.unfoldAll`     |
| Folding ranges          | `monaco.languages.registerFoldingRangeProvider(selector, { provideFoldingRanges(model, ctx, token) })` returning `{start, end, kind}` with one-based lines; optional `onDidChange` event                                                                                                       |
| Layout/size             | `onDidContentSizeChange`, `onDidLayoutChange`                                                                                                                                                                                                                                                  |

Folding details from the VS Code source
([folding.ts](https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/folding/browser/folding.ts),
[foldingModel.ts](https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/folding/browser/foldingModel.ts)):

- `FoldingController.ID === 'editor.contrib.folding'`;
  `getFoldingModel()` returns `Promise<FoldingModel | null> | null`.
- `editor.fold` and `editor.unfold` accept `{ levels?, direction?: 'up'|'down',
selectionLines?: number[] }`; **`selectionLines` are 0-based start lines**
  (the code maps `l + 1` to line numbers), so passing 1-based Monaco line
  numbers folds the wrong region. Without `levels`/`direction`, `editor.fold`
  folds the region at the given lines or, if already collapsed, the first
  uncollapsed parent.
- `FoldingModel` exposes `onDidChange`, `regions` (`FoldingRegions`) and
  `toggleCollapseState(regions)`. The controller class and its model are
  **not public API**: a Monaco issue describes the commands as usable
  programmatically but the internals as unstable
  ([monaco-editor#4024](https://github.com/microsoft/monaco-editor/issues/4024))
  and older versions ignored arguments to `editor.trigger('...', 'editor.unfold', args)`
  (Stack Overflow thread found via search, not opened). Plan to pin the
  Monaco version and cover this with an e2e test.

### 4.4 Synchronization algorithms

1. **Anchor-based scroll sync** (Meld, markdown preview): build a sorted list
   of anchors `(srcTop, dstTop)` where `srcTop = left.getTopForLineNumber(l)`
   and `dstTop = right.getTopForLineNumber(m)` for each mapping record's start
   line. On `onDidScrollChange` of the pane the user moved, find the two
   anchors bracketing `scrollTop`, **linearly interpolate** to a target
   `scrollTop` on the other pane, then `setScrollTop`. Rebuild the anchors on
   `onDidContentSizeChange`, `onDidChangeHiddenAreas` and after every
   translation.
2. **Loop guard**: set a `syncing` flag (or ignore events where
   `scrollTopChanged` is false / the value equals what you just set) so one
   pane's programmatic scroll does not re-trigger the other. Use
   `ScrollType.Immediate` for the follower to avoid animation feedback.
3. **Selection and cursor sync**: on `onDidChangeCursorSelection`, convert the
   selection's offsets to mapping records, highlight the destination ranges
   with a decoration collection (class `mapped-active`), and optionally
   `setSelections` on the other editor only when the user has enabled "sync
   selection" (otherwise highlighting is less intrusive). Ignore events whose
   `reason` is programmatic.
4. **Fold sync**: subscribe to `onDidChangeHiddenAreas`; read the collapsed
   regions from the folding model (or from `getVisibleRanges()` gaps) and
   apply `editor.fold`/`editor.unfold` with `selectionLines` on the other pane
   for the **mapped** start lines. Folding is region-based, so register the
   same CST-derived `FoldingRangeProvider` in both editors (ranges from CST
   nodes of the host and the target) so that corresponding regions exist on
   both sides; if a source region has no destination region, fold the nearest
   enclosing mapped region and skip silently.
5. **Visual ribbons** between panes: a transparent SVG/canvas layer between the
   two editor DOM nodes; for each visible mapping record draw a cubic Bezier
   from `(0, leftTop - leftScroll)`/`(0, leftBottom - leftScroll)` to
   `(W, rightTop - rightScroll)`/`(W, rightBottom - rightScroll)`, coloured by
   record id, redrawn on scroll/layout events with `requestAnimationFrame`,
   and clipped to the visible range from `getVisibleRanges()`.
6. **Colour per group** as in godbolt: use a fixed palette indexed by
   `recordId % N`, apply through decoration `className` (CSS variables) so
   themes can change it; add hover highlighting via `onMouseMove` ->
   `getTargetAtClientPoint`/`e.target.position` -> record lookup.

Recommendation summary: build one `MappingModel` (records, query by offset on
either side, anchors for scroll) and one `PaneSync` class per pair of editors
that owns all listeners and loop guards; keep it independent of Monaco-specific
types behind a small interface so it can be unit-tested in Node and driven by
the Playwright e2e tests that already exist under `examples/universal-app/e2e`.

---

## 5. Assembly dialects and intermediate languages

### 5.1 Popularity

- Language-level popularity of "Assembly" as a whole: TIOBE places assembly
  language around positions 16-19 (No. 17 in the November 2026 report; 1.02%
  in May 2026; 1.07% and No. 19 in January 2026), see
  [TechRepublic, TIOBE November 2026](https://www.techrepublic.com/article/news-tiobe-november-2026-java-overtakes-cpp/)
  and [HelloGitHub TIOBE mirror](https://hellogithub.com/en/report/tiobe?month=5).
  Sources disagree on exact September values.
- **No reliable public ranking of individual assembly dialects was found.**
  The ordering below is therefore a judgement from tooling reach (free
  assemblers on Linux CI, Compiler Explorer output, ecosystem size), not a
  measured popularity: treat it as a prioritisation proposal.

### 5.2 Candidates

| Target                              | Kind     | Assembler / tool                                                                                          | Ubuntu 24.04 (noble) package                                                                                                             | CI cost                                                                                                                                                    |
| ----------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| x86-64 NASM (Intel syntax)          | assembly | `nasm` + `ld`                                                                                             | `nasm` (universe, 2.16.01 locally); `binutils` for `ld`                                                                                  | already in `release.yml`                                                                                                                                   |
| x86-64 GAS AT&T                     | assembly | GNU `as`                                                                                                  | `binutils` (2.42)                                                                                                                        | trivial; same linker                                                                                                                                       |
| x86-64 GAS `.intel_syntax noprefix` | assembly | GNU `as`                                                                                                  | `binutils`                                                                                                                               | trivial                                                                                                                                                    |
| MASM                                | assembly | MASM is Windows-only; `uasm` (JWasm successor) is a compatible assembler                                  | no noble package found **(unverified: not confirmed in apt)**; build from source ([Terraspace/UASM](https://github.com/Terraspace/UASM)) | medium; low priority                                                                                                                                       |
| ARM64 (AArch64) GNU                 | assembly | GNU `as` cross                                                                                            | `binutils-aarch64-linux-gnu`, `gcc-aarch64-linux-gnu`, run with `qemu-user`                                                              | `qemu-user` needed to execute; assembling alone is cheap                                                                                                   |
| RISC-V 64 GNU                       | assembly | GNU `as` cross                                                                                            | `binutils-riscv64-linux-gnu`, `gcc-riscv64-linux-gnu`, run with `qemu-user`                                                              | same as ARM64                                                                                                                                              |
| JVM bytecode, Jasmin syntax         | IR       | Jasmin                                                                                                    | `jasmin-sable` (universe; found by a packages.ubuntu.com search)                                                                         | already in `release.yml`                                                                                                                                   |
| JVM bytecode, Krakatau syntax       | IR       | Krakatau (`krak2`, Rust)                                                                                  | no apt package; MIT/Apache-2.0, "mostly a superset of Jasmin's syntax" ([repo](https://github.com/Storyyeller/Krakatau))                 | medium; supports current class-file versions                                                                                                               |
| .NET CIL                            | IR       | ILAsm                                                                                                     | NuGet `runtime.linux-x64.Microsoft.NETCore.ILAsm` (already used); `mono-devel` (universe 6.8) ships Mono's `ilasm` **(unverified)**      | already in `release.yml`                                                                                                                                   |
| LLVM IR                             | IR       | `llvm-as`, `llc`, `lli`, `clang`                                                                          | `llvm`, `clang` (18 on noble)                                                                                                            | cheap; huge ecosystem, textual `.ll`                                                                                                                       |
| WebAssembly text (WAT)              | IR       | `wat2wasm`, `wasm2wat`, `wasm-interp` from WABT, Apache-2.0 ([repo](https://github.com/WebAssembly/wabt)) | `wabt` (`sudo apt install wabt` per the repo page; apt version not checked)                                                              | cheap; also runs in Node (`WebAssembly.instantiate`)                                                                                                       |
| Python bytecode                     | IR       | stdlib `dis`                                                                                              | none                                                                                                                                     | `dis` is explicitly "an implementation detail" that changes between versions ([docs](https://docs.python.org/3/library/dis.html)); target one version only |
| Lua bytecode                        | IR       | `luac -l` listing                                                                                         | `lua5.4`                                                                                                                                 | listing only; low reuse value                                                                                                                              |
| Dalvik smali                        | IR       | smali/baksmali                                                                                            | `libsmali-java` (universe, "assembler/disassembler for Android's dex format")                                                            | medium; Android audience                                                                                                                                   |

### 5.3 Prioritisation proposal

1. **GAS AT&T x86-64** (and its `.intel_syntax noprefix` variant): zero new
   packages, the default output of `gcc -S` and the output seen on Compiler
   Explorer for GCC/Clang, so most users recognise it.
2. **LLVM IR**: one textual IR reachable from C, C++, Rust, Swift, Zig, Julia
   and others; `llvm`/`clang` install via apt; SSA form is a good second
   lowering target that exercises the type information from type inference.
3. **WebAssembly text (WAT)**: cheap, deterministic, runs in the browser and in
   Node, so the web UI could execute the translation. It is a structured
   stack machine, close to the existing "lower to stack machine" stage.
4. **ARM64 GNU** and **RISC-V GNU**: cross-assemblers from apt, executable
   under `qemu-user`; they test that the lowering is not x86-specific.
5. **Python bytecode**, **Lua bytecode**, **smali**, **Krakatau**, **MASM**:
   later; each has a narrow audience or version instability.

Recommendation: model a **dialect as data** on top of one _machine-level IR_
(instructions, registers, calling convention, directives, sections): an
instruction table per ISA (`x86-64`, `aarch64`, `riscv64`) and a syntax table
per assembler (`nasm`, `gas-att`, `gas-intel`, `masm`) that only controls
operand order, size suffixes, register prefixes, comments (`;` vs `#` vs
`//`), directives and labels. This keeps NASM -> GAS a **syntax-only
translation** and makes the "assembly -> natural language" path (already in the
README: `translate nasm minimal-english`) work for every dialect. Add a CI test
per target that assembles the output and runs it (like the existing jasmin,
nasm and ilasm checks).

---

## 6. Related link-foundation and link-assistant projects

Found with `gh repo view` and `gh search repos --owner link-foundation|link-assistant`
(queries "relative-meta-logic" and "router"). All five are under The
Unlicense, which matches this repository's open stance.

### 6.1 link-foundation/meta-language

- What it is: "A language about languages." A universal, self-describing meta
  language backed by a links network, implemented in JavaScript and Rust with a
  feature-parity manifest. The vision document states: one common language of
  links that covers grammars, **"complete concrete syntax trees, produced by
  default"**, optional ASTs with explicit provenance back to the CST, semantic
  representations (bindings, types, effects, ownership, macros, proofs) and
  transformations, all in Links Notation; goal is coverage of "all existing
  languages", with native merged grammars and translation among JavaScript,
  Rust, Lean and Rocq
  ([README](https://github.com/link-foundation/meta-language),
  [vision.md](https://github.com/link-foundation/meta-language/blob/main/docs/vision.md)).
  The universal translator already imports from the `meta-language` package
  (`js/src/translation/source-document.js`).
- Why it matters: it is the **upstream of the issue's CST and nesting
  requirements**. "CST by default, AST optional with provenance" is exactly
  issue 14's first request.
- Translation cases to support: (a) every one of the 32 languages parsed to
  the meta-language CST and printed back byte-identical; (b) JavaScript <->
  Rust and JavaScript <-> Lean/Rocq with comments preserved; (c) grammar
  definitions themselves (EBNF, ANTLR, Tree-sitter grammar JSON) as input for
  new language tables; (d) the translation-rule files of
  `docs/translation-rules.md` in that repository as **shared rule format**.
  Recommendation: align node kinds, trivia names and the span model with
  meta-language rather than inventing a second CST; contribute missing
  features upstream.

### 6.2 link-foundation/links-notation

- What it is: "A way to describe data using references and links."
  Notation based on references and links with any number of references per
  link (doublets, triplets, N-tuples, nesting by parentheses); hand-written
  parsers in at least JavaScript, Rust, C#, Python, Go, Java, PHP, C++, Swift
  and Kotlin, with a comparison against JSON and XML
  ([README](https://github.com/link-foundation/links-notation)).
- Translation cases: **Links Notation <-> JSON / YAML / XML**; links as the
  serialization of CSTs and mapping records (section 4.2) so the UI and CLI
  can export `--format lino`; natural-language statements such as
  `papa has car` map directly to triplets, which is a ready-made target for
  the NL abstract syntax in section 3.
- Recommendation: use Links Notation as the **interchange format** for CST,
  mapping table and lexicon entries; do not invent a new JSON schema.

### 6.3 link-foundation/relative-meta-logic (RML)

- What it is: a prototype logic framework "that can reason about anything
  relative to given probability of input statements", formerly
  "Associative-Dependent Logic". JavaScript and Rust implementations built on
  Links Notation; many-valued and probabilistic logic with redefinable
  operators, typed LiNo (`Pi`, `lambda`, `apply`, universes), a metatheorem
  checker, an LSP server, and **exports to Lean 4, Rocq and Isabelle/HOL**
  ([README](https://github.com/link-foundation/relative-meta-logic)).
- Translation cases: (a) `.lino` typed fragment <-> Lean 4 and Rocq (the
  translator already reads and writes both languages, so RML becomes a third
  proof-language neighbour); (b) natural-language statements ("probably
  `A` implies `B`") <-> RML expressions via the NL abstract syntax; (c) RML
  source comments and truth annotations preserved (needs the CST rule).

### 6.4 link-assistant/formal-ai

- What it is: "Don't know everything, know just enough to get to know
  anything." A Rust implementation of a **symbolic, deterministic assistant**
  exposing OpenAI-shaped APIs without neural inference; knowledge is a
  readable semantic network in Links Notation; has a CLI, HTTP server,
  Telegram bot, web demo via WebAssembly, Electron shell and VS Code
  extension ([README](https://github.com/link-assistant/formal-ai),
  [VISION.md](https://github.com/link-assistant/formal-ai/blob/main/VISION.md)).
  VISION.md requires to "preserve the complete readable CST, comments and
  unrelated content, and verify JavaScript, TypeScript and Rust parity", and
  describes development performed through natural-language instructions.
- Translation cases: **natural language -> code** and **code -> natural
  language** (instructions such as "rename X" resolved against the CST),
  JavaScript -> TypeScript -> Rust parity, and the Links Notation knowledge
  base in several natural languages (which needs section 3).
- Recommendation: treat formal-ai as the main consumer of the NL grammar:
  a controlled natural-language instruction must parse to the same abstract
  syntax the translator uses.

### 6.5 link-assistant/router

- What it is: a self-hosted gateway giving each task an expiring, revocable,
  rate-limited token while keeping vendor credentials inside the router; a
  transparent proxy for Anthropic and OpenAI-compatible APIs. It ships Rust,
  JavaScript and Python packages and clients generated from OpenAPI. The
  language layout document says native JavaScript lives in `js/src`, **TypeScript
  is generated from JavaScript, Rust is the translated crate**, and the
  forward and reverse commands (`scripts/translate-router.mjs`,
  `scripts/regenerate-js-first.mjs`) must cross "the checked, serialized and
  reparsed CST/meta boundary" with unknown constructs kept as explicit
  refusals
  ([README](https://github.com/link-assistant/router),
  [language-layout.md](https://github.com/link-assistant/router/blob/main/docs/development/language-layout.md)).
- Translation cases: **JavaScript -> TypeScript** (type annotations from type
  inference), **JavaScript <-> Rust** for a real server codebase, repository
  formatting and binding substitutions as a separate ordered rule layer,
  configuration formats (OpenAPI YAML, JSON Schema, TOML manifests), and
  generated clients in PHP, Go, Java. This is a large real-world regression
  corpus for CST preservation: unchanged files must round trip, and unknown
  constructs must fail loudly rather than being dropped.
- Recommendation: use the router's JavaScript sources as a **soak test** in
  CI (parse, print, compare bytes; translate to TypeScript and type check),
  and copy its rule of "explicit refusal for unknown constructs".

---

## 7. Consolidated recommendations

CST and whitespace

1. Make the **lossless CST the default parse result**; derive the meta program
   (AST view) from it with node ids and spans (rust-analyzer, meta-language
   vision).
2. Attach trivia with **Roslyn's rule** (trailing trivia to end of line, rest
   leading on the next token); store byte spans and keep `print(parse(x)) === x`
   as a repository-wide test on every example program and on router sources.
3. Give comments and blank lines to the **following statement** (LibCST
   `leading_lines`), store indent as depth plus a document indent unit, and
   store comments as text plus a style so each emitter chooses delimiters.
4. For same-language edits reuse original text for unchanged nodes (recast);
   for cross-language output carry only trivia and pretty-print the rest.
5. Never use a discarding parser stage without a side channel (Lark
   `%ignore`, ANTLR `skip`): use hidden channels or Tree-sitter-style extras.

Nesting

6. One mechanism: **`embedded(language, range, innerTree)` nodes created by
   declarative injection rules** (Tree-sitter `injections.scm` semantics, with
   `combined` for template literals), selected by node kind or call context,
   separate from the 32 host grammars.
7. Colour nested regions with **CST-derived semantic tokens** rather than
   Monarch.

Natural language

8. Adopt **GF's split**: abstract syntax of NL as meta links with recursive
   constructors, one concrete table per language, lexicon keyed by concept id
   with paradigms; test against GF's RGL output for a sample set.
9. Use **UD tags and CoNLL-U** for parts of speech, features and dependencies;
   express agreement as **feature unification** (NLTK style).
10. Dictionary: Wikidata lexemes (CC0) and OMW/CILI for concept ids; Wiktionary
    and UniMorph only as separate data packages because of CC BY-SA; every entry
    carries `source` and `license`.
11. Word choice rule: concept match, then **round-trip filter**, then
    **frequency rank**, then fewer senses; store as `preferred`.

UI

12. Build a `MappingModel` of `{srcStart, srcEnd, dstStart, dstEnd, kind,
nodeId}` records recorded by the emitters; derive lines from offsets.
13. `PaneSync`: anchor-interpolated scroll sync with a loop guard,
    `createDecorationsCollection` highlights, selection mapping via records,
    fold sync through `onDidChangeHiddenAreas` plus `editor.fold`/`unfold` with
    **0-based `selectionLines`**, the same CST-derived `FoldingRangeProvider`
    registered in both editors, and an SVG ribbon layer. Pin Monaco and cover
    the fold internals with a Playwright test.

Targets

14. Add **GAS AT&T/Intel**, **LLVM IR** and **WAT** first (apt packages: `binutils`,
    `llvm`/`clang`, `wabt`), then **ARM64** and **RISC-V** (`binutils-*-linux-gnu`,
    `qemu-user`); model dialect as syntax table over an ISA table.

Ecosystem

15. Align node kinds and trivia with `meta-language`; serialise CST, mappings
    and lexicon entries as Links Notation; use `link-assistant/router` sources
    and `formal-ai` instructions as real-world test inputs.

## Sources

Primary pages used (all fetched on 2026-11-25 unless marked unverified above):
[Roslyn syntax](https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/work-with-syntax),
[Red-green trees](https://ericlippert.com/2012/06/08/red-green-trees/),
[rowan](https://github.com/rust-analyzer/rowan),
[rust-analyzer syntax](https://github.com/rust-lang/rust-analyzer/blob/master/docs/book/src/contributing/syntax.md),
[swift-syntax](https://github.com/swiftlang/swift-syntax),
[Tree-sitter highlighting and injections](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html),
[Tree-sitter grammar DSL](https://tree-sitter.github.io/tree-sitter/creating-parsers/2-the-grammar-dsl.html),
[ANTLR lexer rules](https://github.com/antlr/antlr4/blob/master/doc/lexer-rules.md),
[TokenStreamRewriter](https://www.antlr.org/api/Java/org/antlr/v4/runtime/TokenStreamRewriter.html),
[Lark classes](https://lark-parser.readthedocs.io/en/latest/classes.html),
[Lark grammar](https://lark-parser.readthedocs.io/en/latest/grammar.html),
[LibCST](https://libcst.readthedocs.io/en/latest/why_libcst.html),
[recast](https://github.com/benjamn/recast),
[TextMate grammars](https://macromates.com/manual/en/language_grammars),
[VS Code syntax highlight guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide),
[VS Code semantic highlighting](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide),
[GF tutorial](https://www.grammaticalframework.org/doc/tutorial/gf-tutorial.html),
[GF RGL synopsis](https://www.grammaticalframework.org/lib/doc/synopsis/index.html),
[Apertium (Wikipedia)](https://en.wikipedia.org/wiki/Apertium),
[Link Grammar](https://www.link.cs.cmu.edu/link/),
[opencog/link-grammar](https://github.com/opencog/link-grammar),
[spaCy pipelines](https://spacy.io/usage/processing-pipelines),
[Stanza](https://stanfordnlp.github.io/stanza/),
[Universal Dependencies](https://universaldependencies.org/introduction.html),
[UniMorph](https://unimorph.github.io/),
[NLTK chapter 9](https://www.nltk.org/book/ch09.html),
[Wikidata lexicographical data](https://www.wikidata.org/wiki/Wikidata:Lexicographical_data),
[Wiktionary copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights),
[kaikki.org](https://kaikki.org/),
[Open Multilingual Wordnet](https://omwn.org/),
[Compiler Explorer](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/WhatIsCompilerExplorer.md),
Monaco `editor.api.d.ts` 0.58.0 (from `unpkg.com/monaco-editor`),
[VS Code folding.ts](https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/folding/browser/folding.ts),
[Krakatau](https://github.com/Storyyeller/Krakatau),
[WABT](https://github.com/WebAssembly/wabt),
[Python dis](https://docs.python.org/3/library/dis.html),
[meta-language](https://github.com/link-foundation/meta-language),
[links-notation](https://github.com/link-foundation/links-notation),
[relative-meta-logic](https://github.com/link-foundation/relative-meta-logic),
[formal-ai](https://github.com/link-assistant/formal-ai),
[router](https://github.com/link-assistant/router).
