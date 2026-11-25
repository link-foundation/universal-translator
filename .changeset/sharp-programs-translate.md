---
'@link-foundation/universal-translator': minor
---

Add a grammar- and rule-based translator between programming, machine and controlled natural languages in JavaScript and Rust.

- Source is parsed with language descriptions kept as data, turned into a typed meta language, rewritten by ordered rule layers and emitted for the target language.
- 30 languages: JavaScript, TypeScript, Python, Ruby, Lua, PHP, C, C++, C#, Java, Go, Rust, Kotlin, Swift, Perl, Dart, Scala, Julia, R, Groovy, Objective-C, Nim, D, Pascal, Fortran, Ada, Visual Basic .NET, Bash, MATLAB/Octave and Zig. Languages with a program layout of their own (Pascal, Fortran, Ada, Visual Basic, Bash, MATLAB/Octave, Zig) are dialects of the shared parser and emitter. The JavaScript and Rust implementations both cover all 30.
- Three modes: context-dependent (the default, which adapts comments), literal and same-effect.
- Every stage and rule list can be replaced, extended or decorated. Project-specific layers such as `commentGlossary` translate comments within the same language.
- NASM x86-64 assembly, CIL and JVM bytecode are written through a named stack machine and read back by lifting them to the meta language, so machine code translates to every language and to each other.
- A common library in `common-library/` (one implementation per language) smooths over output differences. `--common-library` translates prints into its calls, and such programs read back as plain prints.
- Rosetta Code tasks (Fibonacci, Ackermann, Towers of Hanoi, leap year, digit sums, hailstone, 99 bottles, primality) are translated and run natively. Reserved words are renamed per language, C gets `stdbool.h`, `and` inside `or` is parenthesized, integer division is never folded into `/=`, R returns with `return(invisible())`, C-style loops that do not count upward become while loops, and functions that return 0/1 truth values (Perl, machine code) are read back as booleans.
- The command line adds `translate`, `meta`, `languages` and `--trace`.
- Ranking of natural-language referents and lossless Links Notation source documents are included.
- Controlled versions of the 30 most spoken natural languages, described as data in `data/natural/*.lino`, are read and written like programming languages: words → meta → any programming or machine language, and back.
- Profiles for ASD-STE100, Attempto Controlled English, Gellish (English and Dutch), SBVR Structured English, plain language (ISO 24495-1), E-Prime, Basic English, Special English, Globish and Minimal English, French and Polish built on the 65 semantic primes of Natural Semantic Metalanguage. `checkText` and the `check-words` command enforce each standard's rules.
- Every example program is written in every natural language and profile under `examples/programs/natural`, and both implementations check those texts.
- `parseFragment` and `translateFragment` (`parse_fragment` and `translate_fragment` in Rust, `--fragment` on the command line) read and write a single statement, function definitions or a whole program on its own. A fragment must be complete, and an incomplete one is rejected with the line where it ends.
- `scripts/check-requirements.mjs` fails CI while a requirement of issue 1 is neither done nor reported as blocked.
- `universal-translator serve` starts an HTTP API (`GET /languages`, `POST /translate`) configured through lino-arguments (`--port`, `PORT` or `.lenv`). `createTranslationServer` exposes the same server in the library, and a Docker image runs it.
- The example app is a translator demo for every programming and natural language, checked end to end in a browser.
- Sources are split into `meta`, `formal` and `natural` layers in both implementations.
