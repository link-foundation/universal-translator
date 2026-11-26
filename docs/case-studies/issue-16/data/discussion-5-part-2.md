
### CLI, library, HTTP API and Docker

- `universal-translator serve` starts an HTTP API (`GET /languages`, `POST /translate`). It reads `--port`/`--host`, then `PORT`/`HOST`, then `.lenv`, through lino-arguments.
- `js/src/index.js` (with types) and the `rust/` crate are the libraries.
- The `Dockerfile` image runs the CLI and the server. The release workflow builds it and smoke tests the CLI and the HTTP API.

### Source layout and best practices

- Sources are split into `src/meta` (shared types and trees), `src/formal` (programming languages, Lean, Rocq and machine code) and `src/natural` (human languages, with a reader and a writer), in both `js/` and `rust/`. The `source-layout` check rejects imports that point outwards from the meta layer.
- [`docs/case-studies/issue-1/best-practices.md`](https://github.com/link-foundation/universal-translator/blob/issue-1-35d65b774bf6/docs/case-studies/issue-1/best-practices.md) maps the associative technology stack, the code architecture principles and all 17 CI/CD best practices to evidence, or gives a reason when one does not apply. `cargo clippy -D warnings` now runs in CI.
- **Test coverage is required by CI.** `npm run test:coverage` replaces `npm test` in the Node.js job. It fails below 94% line, 91% branch or 95% function coverage of `js/src` and `bin`; current coverage is 95.4%, 92.1% and 96.5%. The Rust crate runs the same goldens, but CI does not measure its coverage.

### Programming languages (32) and machine code

| | |
| --- | --- |
| Languages | JavaScript, TypeScript, Python, Ruby, Lua, PHP, C, C++, C#, Java, Go, Rust, Kotlin, Swift, Perl, Dart, Scala, Julia, R, Groovy, Objective-C, Nim, D, Pascal, Fortran, Ada, Visual Basic .NET, Bash, MATLAB/Octave, Zig, **Lean 4, Rocq** |
| Dialects | Pascal, Fortran, Ada, VB.NET, Bash, MATLAB/Octave and Zig have their own program layout. They are dialects of the shared parser and emitter (`js/src/formal/dialects/`, `rust/src/formal/dialects/`). Lean 4 programs use `partial def` and `IO`. Rocq programs are pure `Fixpoint`s over an output monad defined in a small runtime, and are evaluated with `Eval vm_compute`. |
| Machine targets | NASM, CIL and JVM are written through a named stack machine and read back by lifting, so machine code translates to every language and between targets. |
| Modes | context-dependent (default, adapts comments such as C "function call" → C# "method call"), literal, same-effect |
| Extensibility | Every stage and rule list is an option of `createGrammarTranslator`; custom meta → meta layers are supported. |
| Common library | `common-library/` (output operations only, one file per language), enabled with `--common-library` |

### Controlled natural languages

- Data lives in `data/natural/*.lino`; `js/src/natural/` and `rust/src/natural/` read and write the same texts byte for byte.
- Covers the 30 most spoken languages (English, Chinese, Hindi, Spanish, French, Arabic, Bengali, Portuguese, Russian, Urdu, Indonesian, German, Japanese, Marathi, Telugu, Turkish, Tamil, Vietnamese, Korean, Italian, Persian, Swahili, Tagalog, Thai, Polish, Ukrainian, Hausa, Gujarati, Punjabi, Dutch), each in a small controlled form (`cnl-default`).
- Profiles for the standards named in the issue:
  - ASD-STE100
  - Attempto Controlled English
  - Gellish (English and Dutch)
  - SBVR Structured English
  - Plain language (ISO 24495-1)
  - E-Prime
  - Basic English, VOA Special English and Globish
  - Minimal English, Minimal French and Minimal Polish, built on the **65 semantic primes** of NSM (`data/natural/semantic-primes.lino`)
- `checkText` and the `check-words` command enforce each standard's rules: sentence length, allowed first words, forbidden words such as "to be" in E-Prime or "shall" in plain language, vocabulary limits, and Gellish relation phrases.
- Translations run natural → meta → any programming or machine language, and back: `universal-translator translate russian python`, `translate python spanish`.
- Every example program is written in every natural language and profile under `examples/programs/natural/`. Each text is read back to the same meaning and checked against its standard.

### Rosetta Code and Hello World

18 tasks in `examples/programs/` are translated to all 32 languages, the 3 machine targets and every natural language, then run natively:

- hello world
- factorial
- greatest common divisor
- FizzBuzz
- sum of squares
- Fibonacci
- Ackermann
- Towers of Hanoi
- leap year
- sum of digits
- hailstone
- 99 bottles
- primality by trial division
- mutual recursion
- perfect numbers
- sieve of Eratosthenes
- bubble sort
- sum and product of an array

Algorithm types covered (from `rosetta-coverage.lino`): output, integer arithmetic, conditionals, iteration, functions, recursion (including mutual recursion), number theory, text concatenation, and **integer arrays** (new: array values in the meta language, all 32 languages, NASM/CIL/JVM and natural-language sentences).

**Blocked, with reasons recorded in `rosetta-coverage.lino`.** These are not presented as done. Rosetta Code has more than 1,300 tasks, and these types need values the meta language does not have yet:

| Type | Why it is blocked |
| --- | --- |
| floating-point | Machine targets and the meta language use 64-bit integers only |
| string manipulation | Text can be printed and concatenated, but not indexed or transformed |
| higher-order functions | Functions are top-level declarations only |
| data structures | Records, maps, stacks and queues need compound values |
| input/output | Programs only write to standard output, which is what the native checks compare |
| objects and concurrency | Not supported |

**Classes as fragments** are also **blocked** (`class-fragments` in the gate) for the same reason: the meta language has no objects or classes, so a class has no meaning to translate yet.

The gate reports `rosetta-algorithm-types` and `class-fragments` as **BLOCKED** with these reasons. Every other requirement is **DONE**.

## Verification

- **`npm test` (Node, Bun, Deno) and `cargo test`.** Every task is translated to every language, machine target and natural language and compared with the goldens in `examples/programs/translated` and `examples/programs/natural`.
- **`examples/programs/verify-native.mjs --require-all [--common-library]`.** The `native-translation` CI job compiles or runs each translation with its real toolchain and compares the output with the JavaScript original. The toolchains include Lean 4 (elan), Rocq (opam), fpc, gnat, gfortran, octave, zig, nim, ldc, Objective-C, Swift, Kotlin, Scala, .NET and Jasmin.
- **`experiments/verify-syntax-exchange.sh`.** The JS and Rust command lines list the same 32 languages and write identical output.
- **`node scripts/check-requirements.mjs`.** The requirements gate described above.
- **`npm run test:coverage`.** The coverage gate described above.
- **`web-e2e`.** The browser test of the demo.
- **`--trace`.** Logs each pipeline stage.

### CI reliability (native translation job)

- Toolchain archives are cached. Each download attempt is capped at 3 minutes and falls back to a mirror: Google's Maven Central mirror for Groovy and `zig.linus.dev` for Zig, all checked by SHA-256. This fixes a run where the step hung on a stalled download.
- `verify-native.mjs` runs its checks in parallel worker processes.
- `js/tests/ci-timeouts.test.js` keeps each job's step budgets within 70% of its backstop.
- Budgets are sized for slower runners. One run needed 330 s for all native translations and over 360 s for the common library translations, while a typical run needs about 220 s and 250 s. Every translation passed, but the 360 s budget ran out. The step budgets are now 540 s and 480 s, and the job backstop is 100 minutes so the budgets stay within 70% of it.

### CodeQL

- `js/incomplete-sanitization` flagged the Lean `s!"…"` brace escape, because it was chained after `escape()` where CodeQL cannot see that backslashes were already escaped. Brace escaping now happens inside `escape()` as the `escaped-braces` format. The output is unchanged, and a regression test in `js/tests/grammar.test.js` checks that `` `a\\b {c} ${name}` `` becomes `s!"a\\b \{c} {name}"`.
- CodeQL still lists an older alert on `docs/case-studies/issue-3/original-format-release-notes.mjs`. That file came with the initial commit and is not part of this PR, and the CodeQL check passes.

The data files use Links Notation (`.lino`). The PR contains exactly one changeset (`.changeset/sharp-programs-translate.md`). The case study is in `docs/case-studies/issue-1/`.



## https://github.com/link-foundation/universal-translator/pull/5#discussion_r4690609730 by github-advanced-security[bot]

## CodeQL / Incomplete string escaping or encoding

This does not escape backslash characters in the input.

[Show more details](https://github.com/link-foundation/universal-translator/security/code-scanning/2)

## https://github.com/link-foundation/universal-translator/pull/5#pullrequestreview-6052111846 by github-advanced-security[bot]


