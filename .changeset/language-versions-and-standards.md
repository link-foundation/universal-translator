---
'@link-foundation/universal-translator': minor
---

Language versions, standards of one's own, a comment language and concrete syntax trees by default.

- `formatMeta` shows the meta program as Links Notation, so the meta language of any text can be seen.
- Every language has a single entry with versions:
  - programming languages have major versions (`python@2`);
  - natural languages have regional spellings (British English, chosen from the browser languages), smaller vocabularies down to the semantic primes, and controlled standards.
- The 65 semantic primes are given for every supported natural language, as a `minimal-<language>` version of each.
- Every word of a language's vocabulary can be changed and saved as a version of one's own (`languageVocabulary`, `vocabularyChanges`, `writeLanguageVersion`, `loadLanguageVersion`). Every changed word takes effect.
- Word standards hold up to 1024 words. New words are defined through the words a standard already has, recursively, with Wikidata lookups through a cache and an offline pre-cache (`createStandard`, `defineWord`, `wikidataLookup`).
- Comments can be translated into another natural language apart from the code (`commentLanguage`).
- Whitespace and comments are kept as written:
  - the spaces inside comments;
  - empty lines between statements and between functions, or the lack of them;
  - trailing comments;
  - comments that close an indented block.
- The web demo:
  - shows the meta language of both texts;
  - translates the right text into a newly chosen left language instead of failing;
  - generates random Program, Function and Statement examples;
  - has a Standards tab and a settings panel built on link-foundation/ui with themes, skins and seven interface languages.
- Comment languages and language versions work with partial translation, the source language `auto`, `--all-or-nothing` and rules as data. A comment language that does not exist is refused before reading, and reading a version such as `python@2` uses the rules of its language.
- The Rust crate has the same language versions, natural language versions, comment languages and `--comment-language`/`--comment-from` flags.
