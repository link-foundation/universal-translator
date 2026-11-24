---
'@link-foundation/universal-translator': minor
---

Add a grammar- and rule-based program translator in JavaScript and Rust.

- Source is parsed with language descriptions kept as data, turned into a typed meta language, rewritten by ordered rule layers and emitted for the target language.
- 20 languages: JavaScript, TypeScript, Python, Ruby, Lua, PHP, C, C++, C#, Java, Go, Rust, Kotlin, Swift, Perl, Dart, Scala, Julia, R and Groovy.
- Three modes: context-dependent (the default, which adapts comments), literal and same-effect.
- Every stage and rule list can be replaced, extended or decorated. Project-specific layers such as `commentGlossary` translate comments within the same language.
- NASM x86-64 assembly, CIL and JVM bytecode are written through a named stack machine and read back by lifting them to the meta language, so machine code translates to every language and to each other.
- A common library in `common-library/` (one implementation per language) smooths over output differences. `--common-library` translates prints into its calls, and such programs read back as plain prints.
- The command line adds `translate`, `meta`, `languages` and `--trace`.
- Ranking of natural-language referents and lossless Links Notation source documents are included.
