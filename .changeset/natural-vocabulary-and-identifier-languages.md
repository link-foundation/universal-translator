---
'@link-foundation/universal-translator': minor
---

A shared natural vocabulary, free prose translation and identifier languages (issue 14).

- `data/natural/vocabulary.lino` lists 179 concepts with their part of speech and their forms in every natural language, most frequent first; `data/natural/grammar.lino` gives each language its word order and inflections. Comments and prose are translated through these meanings, and a word means first the concept it is the main word of (Russian "в" is "in" before "inside").
- Between two natural languages, a sentence that no controlled template reads is prose: it is translated freely, not marked, and listed in `prose` (`[{ line, endLine }]`; Rust: `(line, end_line)` pairs). «Как хорошо покакать?» gives "How good to poop?", «Привет мир» gives "Hello world", and `// Привет мир` gives `// Hello world`.
- Detection reads the known words of each natural language, so «Привет» and «Как хорошо покакать?» are detected as Russian.
- `--identifier-language <language>` and `--identifier-from <language>` (`identifierLanguage` and `identifierFrom`; Rust: `Options::with_identifier_language`) translate the names a program declares (functions, parameters, variables). Library names stay as they are. When the code language stays, the change is made in place, keeping every other character. Each name is spelled in the naming convention of the target (`суммаКвадратов`, `сумма_квадратов`) and transliterated for targets whose names are ASCII only (`summa_kvadratov` in C). Two names never become one.
- The lexers read names in any script (`let итог = 1;`).
