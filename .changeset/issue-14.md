---
'@link-foundation/universal-translator': minor
---

Issue 14: concrete syntax by default, nested grammars, a general meta language and deeper natural language.

### Source layout by default

Translations keep the layout of their source (issue 14).

- Partial translation between programming languages (the default of both CLIs, the server and the web demo) keeps the spaces inside lines, the indentation step, the blank lines, the blank lines around the code and the line ends of the source wherever the target has the same tokens, and returns `lineMap` (Rust: `line_map`), the `[source line, target line]` pairs of the translation. `--layout target` (`layout: 'target'`, `TextLayout::Target`) writes the emitter's layout instead.
- `POST /translate` takes `layout` and answers `lineMap`.

### Natural vocabulary, free prose translation and identifier languages

A shared natural vocabulary, free prose translation and identifier languages (issue 14).

- `data/natural/vocabulary.lino` lists 179 concepts with their part of speech and their forms in every natural language, most frequent first; `data/natural/grammar.lino` gives each language its word order and inflections. Comments and prose are translated through these meanings, and a word means first the concept it is the main word of (Russian "в" is "in" before "inside").
- Between two natural languages, a sentence that no controlled template reads is prose: it is translated freely, not marked, and listed in `prose` (`[{ line, endLine }]`; Rust: `(line, end_line)` pairs). «Как хорошо покакать?» gives "How good to poop?", «Привет мир» gives "Hello world", and `// Привет мир` gives `// Hello world`.
- Detection reads the known words of each natural language, so «Привет» and «Как хорошо покакать?» are detected as Russian.
- `--identifier-language <language>` and `--identifier-from <language>` (`identifierLanguage` and `identifierFrom`; Rust: `Options::with_identifier_language`) translate the names a program declares (functions, parameters, variables). Library names stay as they are. When the code language stays, the change is made in place, keeping every other character. Each name is spelled in the naming convention of the target (`суммаКвадратов`, `сумма_квадратов`) and transliterated for targets whose names are ASCII only (`summa_kvadratov` in C). Two names never become one.
- The lexers read names in any script (`let итог = 1;`).

### Nested grammars

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

### General meta language

The meta language has a standard library: printing a line, printing
without a newline and taking the length of an array are calls to the
library procedures `print-line`, `print` and `length`
(`Call { callee, library: 'standard', arguments }`). They are no longer
special parts of the language. The meta view (`formatMeta`, the `meta`
command of both CLIs) shows a program in this general form. It writes a
statement that only evaluates a call as the call itself
(`call print-line (library standard)`). `generalize` and `specialize`
(Rust: `meta::library`) move a program between the general form and the
concepts the emitters use. `fromMeta` / `from_meta` accept a program in
either form and fill in missing empty lists and types.

### Prose grammar: verb forms and cases

The free translation of comments and prose has better grammar. A verb form
keeps its slot: the languages that name their forms in
`data/natural/grammar.lino` (`verb-forms: lemma present`) write the present
form for a present form, so `Prints the sum` is `Печатает сумму` and no
longer `Печатать сумма`, and a finite form is never written as an
infinitive. The object of a verb takes the accusative in Russian,
Ukrainian and Polish (`object-endings`, `object-forms`), and in German and
Spanish for `someone` (`Greets someone` is `Приветствует кого-то`,
`Grüßt jemanden`, `Saluda a alguien`). In Russian, Ukrainian and Polish
`of` between two nouns is left out before a name the dictionary does not
know (`of-genitive`): `Returns the factorial of n` is
`Возвращает факториал n`. The vocabulary has many more everyday words
(greet, return, compute, calculate, count, add, sort, swap, move, increase,
decrease, divide, multiply, repeat, store, convert, compare, array,
element, digit, square, prime number) in twelve languages, and the rows of
a few verbs are put in the order lemma, present, past. The JavaScript and
Rust twins agree.

### Everyday English wordings

English reads everyday wordings of algorithm sentences (`Let n be 0`, `Set n to 1`, `Print n`, `Display n`, `Show n`, `Return n`, `While …, do this`, `For each … do this`) and still writes the canonical ones.

### Machine dialects

List the machine targets (NASM, CIL, JVM) in `languages()` with `machine: true`, and add GNU as (AT&T) x86-64, ARM64 assembly, LLVM IR and WebAssembly text as machine targets that are written and read back in both the JavaScript and Rust translators.

### Rust serve

The Rust command line has a `serve` command that answers the same JSON as the JavaScript server, and the Rust crate reads the Wikidata definition cache of the word standards in the same file format.

### Equivalence check

`check-equivalence <from> <to> [file|-] [translation]` (and `checkEquivalence` / `check_equivalence` in the libraries) reads a source and its translation into meta programs and compares them without comments, imports, blank lines, declared types and mutability. It lists the first lines where the two differ and exits with 1 when they do, in both the JavaScript and Rust command lines. The web app lists the machine targets (NASM, GNU as, ARM64, LLVM IR, WebAssembly text, CIL, JVM) in a "Machine code" group of their own.

### For-each loops and more Rosetta tasks

The meta language has a for-each loop, `ForEach { variable, array, body }`, read from `for…of`, `for x in a`, `foreach` and the like, and written natively in 21 languages; every other language (machine code and the natural languages without a for-each sentence included) writes it as a counting loop over a fresh index that reads back as the same for-each loop. Four more Rosetta Code tasks (`loops-foreach`, `greatest-element-of-a-list`, `sum-multiples-of-3-and-5`, `linear-search`) are translated into every language.

### Decorators, language versions and the Hello World Collection

Every stage of the translation pipeline (parser, readers and emitters) can be wrapped with decorators, in JavaScript with `createTranslator({ decorate })` and `translator.decorate`, and in Rust with `Translator::decorate_*`. Programming languages gain versions with real differences in the written program: `javascript@es5` (no `let`, `const`, template strings or `for…of`), `php@5` and `csharp@5`. The Hello World Collection can be downloaded with `scripts/hello-world-collection.mjs`, and every extracted program is read into the meta language and measured in a coverage file.

### More of the TIOBE top 50

GameMaker Language (`gml`, number 42 in the TIOBE index of November 2026) is written and read back in both the JavaScript and Rust translators, with its own common library (`common-library/common_library.gml`). GameMaker runs GML only inside its IDE and game runner, so `verify-native.mjs` reports GML as skipped with that reason, and its translations are checked by reading them back into the same meta program.

28 of the top 50 are now covered: Python, C, Java, C++, C#, JavaScript, R, Visual Basic (.NET), Go, Rust, PHP, Fortran, Perl, MATLAB, assembly language (the machine targets), Swift, Delphi/Object Pascal (through the Pascal profile), Dart, Julia, Ada, Objective-C, Ruby, Lua, Kotlin, D, Scala, TypeScript and GML. The other 22 are not supported yet:

- Scratch, Ladder Logic and LabVIEW are graphical: their programs are blocks, rungs and wired diagrams, not text a parser can read or an emitter can write.
- SQL and XSLT are declarative: standard SQL has no functions, loops or output statements, and XSLT has no assignable variables, so the examples would need an encoding of their own, like the Rocq runtime.
- Transact-SQL functions cannot print and it has no arrays; PL/SQL needs an Oracle database to run. PL/SQL could be written like Ada (`DBMS_OUTPUT.PUT_LINE`), but it is not done.
- ABAP, SAS, Xojo and (Visual) FoxPro run only in commercial or discontinued environments, so their translations could not be checked natively.
- VBScript and Classic Visual Basic run only on Windows. A classic Visual Basic dialect is possible (no `Return`, so `Name = value: Exit Function`; `And` and `Or` that do not short-circuit; no `+=`; one `Dim` per procedure; `ByVal` parameters), but it is not done.
- OCaml, Caml, ML, Lisp, Haskell, Clojure, Prolog, COBOL and Solidity each need a dialect module in both runtimes: functional and logic languages need a state encoding (as Lean and Rocq have), COBOL needs its division layout, and Solidity has no standard output outside a test framework. None of them is done yet.
