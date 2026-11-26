---
'@link-foundation/universal-translator': minor
---

Nested grammars in the meta language. `nestGrammars` / `nest_grammars`
read every comment and string of a meta program with the grammar it is
written in. Prose becomes `Prose { language, sentences: [Sentence { words,
question? }] }`. Each `Word` carries the vocabulary concept, semantic
prime or program word it stands for and its part of speech. Code quoted
between backticks, and strings that a programming language reads whole,
become `Code { language, program }`. Comment lists (`comments`,
`mainComments`) become comment nodes. A text longer than twelve words is
kept once in the program's `texts` (`Paragraph { id, text, reading }`)
and referenced by id from each comment and string holding it. `unnest`
restores the plain program, and `fromMeta` / `from_meta` accept the
nested form. The `meta` command of both CLIs prints the nested program;
`--shallow` prints the plain one. `readProse` / `read_prose` read a
single text.
