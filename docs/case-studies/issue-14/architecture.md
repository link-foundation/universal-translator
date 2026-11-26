# Architecture of the translator (issue 14)

Issue 14 asks for an architecture that covers a wide range of cases without
being rewritten later. It should:

- keep a concrete syntax tree (CST) by default;
- learn from ANTLR, Tree-sitter, Lark, spaCy, Stanza, NLTK, GF and Link
  Grammar;
- support the related projects: formal-ai, meta-language, router and
  relative-meta-logic.

This document describes the layers as they are in the code and maps each one
to those projects. It also states which cases each layer already handles and
where new cases plug in. Sources for every external project are in
`prior-art.md`.

## The layers

```text
 source text
   │  reader (formal/lexer + table-driven parser, natural/reader)
   ▼
 source tree ─── tokens with spans (the CST side channel)
   │  understanding rules (formal/rules, lifting)
   ▼
 meta program (meta/tree) ◄── nesting (translation/nesting): readings of
   │                          comments and strings in their own grammars
   │  standard library (meta/library): generalize print/length/... to calls
   │  type inference (meta/types), meaning and context rules (mode)
   │  comment and identifier languages (natural/comments,
   │  translation/identifier-language)
   ▼
 meta program for the target
   │  specialize the library calls, lower (formal/lowering) for machine code
   │  emitter (formal/emitter, natural/writer)
   ▼
 target text
   │  layout pass (translation/layout): the spaces between aligned tokens
   │  and the outer blank lines of the source; lineMap for the editors
   ▼
 output + lineMap
```

Each arrow is a function with the same name and shape in both
implementations:

- JavaScript: `js/src/translator.js` (`createGrammarTranslator`);
- Rust: `rust/src/translator.rs` (`Translator`).

The meta language depends on no language family, and natural languages do
not depend on formal ones. The `source-layout` check of
`scripts/check-requirements.mjs` enforces this.

### Why the CST is a token side channel

`prior-art.md` section 1 compares two ways to keep every character:

- full lossless trees (Roslyn, rowan, swift-syntax, Tree-sitter);
- trivia attached to tokens (LibCST, recast).

Both are built for one language. A translation replaces the tokens, so trivia
attached to source tokens has nowhere to go in the target. The translator
therefore keeps two views:

- the **lossless view**: the token stream with byte spans, including spaces
  and comments. A source document (`translation/source-document.js`, built on
  `meta-language`'s `LinkType`) prints back byte for byte;
- the **meaning view**: the meta program. It is an AST, but every node can be
  traced back to tokens, and the layout pass uses that trace to carry the
  source's layout to the target.

The lossless view is the default everywhere:

- `--layout source` is the default in both command lines and the server;
- the web app keeps the layout;
- comment translation in place (`translateComments`) changes only the words
  inside comments.

The canonical target layout is an option: `--layout target`.

This matches the meta-language vision: "complete concrete syntax trees,
produced by default", with an AST that has provenance back to the CST.

### Nested grammars

This follows Tree-sitter injections (`prior-art.md` section 2). A node of one
grammar keeps its text and gains a `reading` in another grammar:

| Host       | Nested reading                    | Example                                   |
| ---------- | --------------------------------- | ----------------------------------------- |
| comment    | `Prose > Sentence > Word`         | `// Prints the sum`                       |
| prose      | `Code` (any programming language) | `` // Prints `x + 1` ``                   |
| string     | `Code` when it reads as code      | `code = "print(1 + 2)"`                   |
| string     | `Prose` otherwise                 | `"Привет мир"`                            |
| long texts | `Paragraph` under `texts`, by id  | a comment and a string with the same text |

Readings are additions. An emitter that does not know them ignores them, and
`unnest` returns the plain program. New host or nested languages therefore
need no change to the emitters. A new grammar becomes nestable as soon as
`parseFragment` reads it.

### Natural language

The design follows GF (`prior-art.md` section 3.1):

- **abstract syntax**: concepts. Words in `data/natural/vocabulary.lino` and
  sentence templates in `data/natural/<language>.lino` are keyed by concept
  ids such as `hello`, `print` and `if`;
- **concrete syntax**: one description per language. Templates read and
  write whole algorithm sentences. The prose reader
  (`natural/prose-reading`) reads any other text into words, each with its
  concept and part of speech;
- **lexical choice**: the first word of a concept is the most frequent one.
  Translation picks it unless the source used a word that survives the round
  trip (`prior-art.md` section 3.9).

New depth is added in the same tree, so nothing is rewritten:

- morphology (UniMorph features) goes on `Word`;
- dependencies (Universal Dependencies or Link Grammar links) are links
  between the `Word`s of a `Sentence`.

The spaCy, Stanza and NLTK pipelines (tokenize, tag, parse) correspond to the
reader stages. We do not use them at run time: their models are large and
written in Python, and the translator must run in a browser.

### Targets beyond source languages

Machine targets (NASM, CIL, JVM) use the same meta program, lowered first
(`formal/lowering`). They can be read back (`formal/machine-reader`, lifting).
Assembly dialects and other intermediate languages are a syntax table over a
shared instruction model, as `prior-art.md` section 5.3 recommends. A new
dialect is a new table, not a new pipeline.

## The related projects

| Project                             | What it needs from the translator                                                                       | Where it plugs in                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| link-foundation/meta-language       | a CST by default, an AST with provenance, every language, Links Notation as the format                  | the source document already uses `meta-language`; `meta` prints the meta program as Links Notation (`meta/notation`); node kinds keep the meta-language names  |
| link-foundation/links-notation      | one interchange format                                                                                  | every data file (`data/**/*.lino`), the meta notation, the requirements lists and `--rules` files are Links Notation                                           |
| link-foundation/relative-meta-logic | translation between its typed Links Notation fragments, Lean 4 and Rocq; statements in natural language | Lean and Rocq are readers and emitters already; truth values are in `meta/truth`; natural statements go through the prose reader                               |
| link-assistant/formal-ai            | natural-language instructions to code and back; comments and unrelated content kept                     | natural ↔ formal translation through the shared concepts; the CST default keeps comments; the library and the HTTP server (`serve`) are the integration points |
| link-assistant/router               | JavaScript → TypeScript and JavaScript ↔ Rust for a real code base; unknown constructs refused loudly   | partial translation marks every part it cannot read (`translatePartial`), and `--all-or-nothing` refuses; the layout pass keeps formatting                     |

The table also shows how the architecture extends to these cases. Each one
adds one of the following:

- a reader or emitter table;
- a vocabulary or template entry;
- a rule layer;
- a reading kind.

None of them changes the meta program's shape, the pipeline's stages or the
layout pass. That is how the architecture avoids later rewrites.

## What is not there yet

- The meta program does not store a CST node per token: the layout pass
  cuts both texts into tokens again and aligns them (common prefix and
  suffix, unique tokens as anchors, a longest common subsequence between
  them). Tokens without a partner keep the emitter's spacing, and
  indentation and line breaks stay as the target writes them, because they
  carry the block structure of languages such as Python.
- Dependency parsing of prose (Universal Dependencies or Link Grammar) is a
  planned layer on top of `Sentence`; today a sentence is a list of words.
- The router and formal-ai cases are covered by the API, but are not yet in
  CI as a corpus (`prior-art.md` section 6.5 recommends that).

## Ranking and imprecision

Where a source can be read more than one way, the translator lists the
candidate translations, scores each one and keeps the most probable. The
scores are truth values in the style of relative-meta-logic: numbers in
[0, 1] on a grid of six decimals, combined by their product
(`js/src/natural/probability.js`; the Rust twin uses the package's
`TruthValue` and `Aggregator::Product`).

- **Frequency.** A phrase's meanings are listed most frequent first. Each
  one gets a Zipf prior, 1 / rank normalized to sum 1 (two meanings:
  0.666667 and 0.333333). The frequency of a translation is the product of
  the priors of the readings it takes.
- **Round trip.** The meanings of the translation are read back in the
  target language and compared with the meanings of the source: the longest
  common subsequence of the two lists over the longer length.
- **Coverage.** The share of lines translated, 1 when the translation is
  complete.
- **Probability.** frequency × round trip × coverage.

The choices are in prose: comments, declared names, and the sentences of a
natural language that no template reads. Code is translated one way by its
rules. `rankProse` (`rank_prose`) searches the readings of one prose part
greedily. It starts from the most frequent reading of every phrase and
tries the other readings of one phrase at a time. A reading is kept only
when the probability gets strictly higher. At most 16 translations are
scored. So the default translation changes only when another reading
survives the round trip strictly better.

`translateCandidates` (`Translator::translate_candidates`) ranks every prose
part of a text. Its first candidate is the text `translatePartial` writes.
Each other candidate takes one other translation of one part. A translator
that has its own comment translator gives a single candidate. On the
command line, `translate <from> <to> --candidates` prints one candidate per
line:

```text
$ printf 'Привет мир. Как дела?' | universal-translator translate russian english - --candidates
(text 'Hello world. How do?
') (probability 0.296297) (frequency 0.296297) (roundTrip 1) (coverage 1)
(text 'Hello peace. How do?
') (probability 0.111111) (frequency 0.148148) (roundTrip 0.75) (coverage 1)
(text 'Hello world. Like do?
') (probability 0.111111) (frequency 0.148148) (roundTrip 0.75) (coverage 1)
(text 'Hello world. How to make?
') (probability 0.111111) (frequency 0.148148) (roundTrip 0.75) (coverage 1)
```

The meta program records what a reading loses (`js/src/meta/imprecision.js`
and `js/src/natural/prose-reading.js`) as attributes of the node:

| Kind                         | Where                                                              | Attributes                                                               |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `(imprecision ambiguous)`    | a word of prose with more than one meaning                         | `(alternatives n)`, and `(probability p)`, the prior of the reading kept |
| `(imprecision untranslated)` | a word of prose with no known meaning; a translation keeps it      |                                                                          |
| `(imprecision truncated)`    | a number with a fraction, typed as an integer                      |                                                                          |
| `(imprecision rounded)`      | an integer beyond 2^53 − 1, the largest one a double keeps exactly |                                                                          |

`meta` prints these attributes, in Links Notation and with `--json`.
Emitters ignore them: `imprecision` is one of the keys that the essence of
a node leaves out, and `alternatives` and `probability` are only set on
words of a prose reading, which no emitter writes.

Limits:

- In a long text with many ambiguous words, the frequency product falls
  towards 0. Every candidate is then close to 0, and the default is kept.
- Only prose is ranked. The structure of code, and the templates of the
  controlled languages, have one reading each.
- A run of letters inside one word of a language written without spaces
  shares one reading key with the same run elsewhere in that word.
- `truncated` is recorded only while type inference calls a number with a
  fraction an integer.
