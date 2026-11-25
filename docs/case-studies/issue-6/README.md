# Issue 6 case study

[Issue 6](https://github.com/link-foundation/universal-translator/issues/6)
asks for a set of fixes and improvements on top of the issue 1 translator:
meta-language views, a forgiving language switch, random examples, language
versions and variants, semantic primes for every natural language, a UI
settings panel backed by [link-foundation/ui](https://github.com/link-foundation/ui),
concrete syntax tree (CST) fidelity for whitespace and comments, a separate
comment language, a standards editor with recursive word definitions and
Wikidata lookups, and a re-check of every issue 1 requirement.

The [requirements inventory](requirements.md) lists every requirement with
its solution and evidence; [requirements.lino](requirements.lino) is the
machine-readable copy that `scripts/check-requirements.mjs` checks in CI.

## Evidence collected

The [data directory](data/) holds Links Notation snapshots (made with
`experiments/case-study-snapshot.mjs`, round-trip checked against the
GitHub JSON) of:

- [issue 6](data/issue-6.lino) and its comments (none at the time of writing);
- [PR 7](data/pr-7.lino), the pull request for this issue;
- [issue 1](data/issue-1.lino), whose requirements are re-checked here.

## Observations before the change

A JavaScript program with an indented comment, blank lines, a two-line
block comment and a trailing comment was translated to Python with the 0.12
library:

- the leading spaces inside `//   indented comment` were trimmed;
- the second line of the block comment was emitted without `#`, which is
  not valid Python;
- blank lines between statements disappeared;
- the trailing comment moved to a line of its own.

The demo app listed 4 fixed samples (Statement, Function, Program,
Sentence), translated the left editor only, failed with an error whenever the
left language changed to one that could not read the current text, showed
every profile of English as its own language, and had no settings.

## Online research

- **Natural Semantic Metalanguage.** Goddard and Wierzbicka list 65 semantic
  primes with exponents documented for dozens of languages
  ([NSM homepage](https://intranet.secure.griffith.edu.au/schools-departments/natural-semantic-metalanguage),
  [Wikipedia](https://en.wikipedia.org/wiki/Natural_semantic_metalanguage)).
  Primes are a vocabulary _restriction_ (a "dictionary modifier"), so every
  natural language gets a `minimal` variant that only allows prime exponents
  plus a few grammatical words.
- **Small standard vocabularies.** Sizes of known controlled vocabularies,
  used to pick the default "biggest standard that is still small enough"
  (≤ 1024 words):

  | Standard                                | Size                        |
  | --------------------------------------- | --------------------------- |
  | NSM semantic primes                     | 65                          |
  | Toki Pona                               | about 120–137               |
  | Basic English (Ogden)                   | 850                         |
  | ASD-STE100 Simplified Technical English | about 900 approved words    |
  | Globish (Nerrière)                      | 1500 (over the limit)       |
  | VOA Special English                     | about 1500 (over the limit) |
  | Longman Defining Vocabulary             | about 2000 (over the limit) |

  Basic English (850) is the largest classical standard under 1024 words,
  so the size cap is 1024 and Basic English is the default "biggest
  small standard" for English. Other languages use their own descriptions,
  capped at the same size.

- **Wikidata.** The
  [`wbsearchentities`](https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities)
  and [`wbgetentities`](https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities)
  APIs return labels and short descriptions per language, with CORS through
  `origin=*`. A description is a short noun phrase ("domesticated animal"),
  which is exactly what a recursive definer needs. Lexemes
  (`L` entities) carry senses with glosses for many languages.
- **Concrete syntax trees.** [LibCST](https://github.com/Instagram/LibCST)
  (Python) and [tree-sitter](https://tree-sitter.github.io/) keep every token
  and its trivia (whitespace and comments). Roslyn calls them _leading_ and
  _trailing trivia_. The translator follows the same model: each statement
  carries the blank lines and comments before it and an optional trailing
  comment, and comment text is kept byte for byte.
- **English variants.** Browsers expose the preferred languages through
  `navigator.languages` (for example `en-GB`); the app maps `en-GB`, `en-AU`,
  `en-NZ`, `en-IE`, `en-IN` and `en-ZA` to British spelling and every other
  English locale to American spelling.
- **Python versions.** Python 2 used the `print` statement
  (`print "x"`) and `/` for integer division of integers; Python 3 uses
  `print(...)` and `//` ([PEP 3105](https://peps.python.org/pep-3105/),
  [PEP 238](https://peps.python.org/pep-0238/)).

## Existing components and libraries

| Need                             | Component                                                                                                                                                                                                                                                                                                           | Use                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| UI settings, themes, skins, i18n | [`@link-foundation/ui-settings`](https://www.npmjs.com/package/@link-foundation/ui-settings), [`ui-themes`](https://www.npmjs.com/package/@link-foundation/ui-themes), [`ui-tokens`](https://www.npmjs.com/package/@link-foundation/ui-tokens), [`ui-i18n`](https://www.npmjs.com/package/@link-foundation/ui-i18n) | Settings schema, theme/skin CSS, localized UI strings with RTL |
| CST and trivia                   | tree-sitter, LibCST, Roslyn trivia                                                                                                                                                                                                                                                                                  | Design reference; the translator's own parser keeps trivia     |
| Semantic primes                  | NSM tables                                                                                                                                                                                                                                                                                                          | `data/natural/semantic-primes.lino`                            |
| Vocabulary lookups               | Wikidata API                                                                                                                                                                                                                                                                                                        | `js/src/natural/wikidata.js` with a cache and a test pre-cache |
| Data format                      | [Links Notation](https://github.com/link-foundation/links-notation)                                                                                                                                                                                                                                                 | All standards and the requirement inventory                    |

## Solutions

See [requirements.md](requirements.md) for the per-requirement plan and
the evidence that each one is delivered.
