# Program translation examples

Run these commands from the repository root after `npm ci`.

```sh
node bin/universal-translator.js translate c csharp examples/translation/hello.c
node bin/universal-translator.js translate c csharp examples/translation/hello.c --mode literal
node bin/universal-translator.js translate c csharp examples/translation/hello.c --form common
node bin/universal-translator.js roundtrip c examples/translation/hello.c
```

The default C# output matches `hello.cs`. The C program uses `stdio.h` and
`printf`. The default C# form uses a class with a static `Main` method and
`System.Console.WriteLine`. The `common` form routes both programs through a
small wrapper implemented in each language. The target program prints the
same line, including the punctuation from the source.

## Translate through a Links Notation document

```sh
node bin/universal-translator.js translate c meta examples/translation/hello.c --mode same-effect > /tmp/hello.lino
cargo run --locked -- translate meta es /tmp/hello.lino --mode same-effect > /tmp/hello.es.txt
node bin/universal-translator.js translate es rust /tmp/hello.es.txt --mode same-effect
```

The intermediate document contains `(hello: (message: 'Hello, World!'))`.
It is editable and accepted by both CLIs. `readEffects` and `writeEffect`
in JavaScript and `Effect::read_links_notation` and `Effect::to_links_notation`
in Rust expose the same format. Whole-line Links Notation comments before
and after the effect survive `literal` translation when the destination can
safely express them. `same-effect` omits comments.

Natural-language profiles recognize the precise wordings checked into the
[profile catalog](../../src/translation/data/07-natural-languages.lino).
The parameter values remain translatable even when the description is in a
non-Latin script. The profiles preserve the printed string and the output
tokens `Fizz`, `Buzz`, and `FizzBuzz` across all languages.

The library exposes the two stages of translation.

```js
import { createTranslator } from '@link-foundation/universal-translator';

const translator = createTranslator();
const document = translator.parse('print("Hello, World!")\n', 'python');
const expression = translator.transform(document, 'rust', {
  mode: 'same-effect',
});
const program = translator.materialize(expression);
```

In JavaScript, pass `profiles`, `decorateAdapter`, `layers`, and `verify` to
`createTranslator` to customize the implementation. In Rust, use
`Translator::with_profiles`, `decorate_adapter`, `add_layer`, and
`set_verifier`. The first rule in the first layer runs first. Rules can
select a form or rewrite comment text even when both languages are the same.

Source spans use UTF-8 byte ranges in both implementations. Column numbers
follow the Meta Language runtime and count UTF-16 code units in JavaScript
and UTF-8 bytes in Rust.

## Task contracts

| Task                    | Inputs in the authored source                                                                      | Standard output                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hello World             | A greeting of up to 96 UTF-8 bytes using letters, marks, numbers, spaces, and selected punctuation | The original text and a newline                                               |
| Greatest Common Divisor | Two nonnegative signed 32-bit integers                                                             | Their greatest common divisor as a line of decimal text, with `gcd(0, 0) = 0` |
| FizzBuzz                | A limit from 1 to 1,000                                                                            | The sequence defined by divisibility by 3 and 5, one item per line            |

All 20 plain-language profiles and the C, C++, C#, Go, Java, JavaScript,
Python, and Rust profiles can represent the 78 greetings preserved from the
Hello World Collection. The executable profiles use UTF-8 source and output.
The single-quote forms decline messages with an apostrophe. The other
variable-greeting executable profiles use the portable ASCII subset.

NASM x86-64 Linux, GNU AArch64 Linux, LLVM IR, CIL ILAsm, and JVM Jasmin
accept the fixed greeting `Hello, World!`. Their profiles contain assembly
or instruction listings. NASM also has GCD and FizzBuzz forms. The native
runner assembles these, including the zero and maximum GCD inputs and the
maximum FizzBuzz limit, and compares their standard output with the oracle.

## Verification

```sh
node --test tests/translation.test.js
cargo test --locked --test translation
cargo build --locked --bin universal-translator
node examples/translation/verify-parity.mjs
node examples/translation/dependent-meanings.mjs
node examples/translation/verify-native.mjs
node examples/translation/report-coverage.mjs
```

To check the original console programs and all 78 localized greetings,
download the two snapshots linked in the case study and run the coverage
report with the files and Rust CLI.

```sh
node examples/translation/report-coverage.mjs \
  /path/to/popular-tasks /path/to/hello-world-collection.html \
  ./target/debug/universal-translator
```

To check the Rosetta Code task directories and the sample counts for the
three implemented tasks, also pass a directory containing the pinned Git
Trees responses. This mode downloads ten pinned Hello World Text files,
three pinned FizzBuzz files, and one pinned GCD file from GitHub. It checks
their blob hashes, exact round trips, and effects in both runtimes.

```sh
rosetta_trees=$(mktemp -d)
rosetta_api=repos/acmeism/RosettaCodeData/git/trees
gh api "$rosetta_api/c6cbdf28628322ccbfddc21556c061a9dc4a56b1" \
  > "$rosetta_trees/tasks.json"
gh api "$rosetta_api/9e55da45ac46c3aba4f34d449f865c001289e529?recursive=1" \
  > "$rosetta_trees/Hello-world-Text.json"
gh api "$rosetta_api/751622a645e6f7c20c15145b45eed8d57b9811db?recursive=1" \
  > "$rosetta_trees/Greatest-common-divisor.json"
gh api "$rosetta_api/f0d6e89cef62f34a13bb64cd149459c97b9d9c7d?recursive=1" \
  > "$rosetta_trees/FizzBuzz.json"
node examples/translation/report-coverage.mjs \
  /path/to/popular-tasks /path/to/hello-world-collection.html \
  ./target/debug/universal-translator "$rosetta_trees"
```

The native runner uses a temporary directory per program. It accepts profile
IDs or `--group=baseline` and `--group=extended` to focus a run. Both Ubuntu
CI jobs use `--require-all` so missing tools fail the job. The separately
evaluated referent example uses
synthetic observations to show how a narrower description and exact reverse
translation affect rankings.

Edit profile data in `src/translation/data` and run
`node scripts/bundle-translation-profiles.mjs` to refresh the browser-compatible
JavaScript bundle. Rust reads the same Links Notation source at build time.
The [corpus coverage report](../../docs/case-studies/issue-1/README.md#coverage)
records which tasks and ranked languages the catalog supports.
