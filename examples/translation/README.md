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
[profile catalog](../../data/07-natural-languages.lino).
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

Source spans use UTF-8 byte ranges and byte columns in both implementations.

## Preserve an original source file

```sh
node bin/universal-translator.js encode-source C examples/translation/hello.c > /tmp/hello-source.lino
cargo run --locked -- decode-source /tmp/hello-source.lino | cmp examples/translation/hello.c -
```

The source document stores the language label and an ordered link for each
UTF-8 line, including its ending. The two runtimes accept each other's
documents. A source document supports exact restoration for any language
label. The effect intermediate supports translation for admitted program
forms.

## Exchange a grammar tree

```sh
cargo run --locked -- encode-cst C examples/translation/hello.c > /tmp/hello-cst.lino
cargo run --locked -- decode-cst /tmp/hello-cst.lino | cmp examples/translation/hello.c -
```

The CST retains grammar nodes, parser provenance, UTF-8 byte spans and source
tokens. `SourceDocument::syntax_network()` exposes the Meta Language network in
Rust and `SourceDocument::from_syntax_notation()` restores its source. Languages
without a grammar can use the `encode-source` and `decode-source` commands.

JavaScript accepts the `LinkNetwork` class from Meta Language 1.0 through
`createSourceSyntaxCodec(LinkNetwork)`. The codec's `write(language, source)`
and `read(notation)` exchange serialized networks with Rust. The package's
locked npm Meta Language dependency is 0.46.0. For the 1.0 codec, use Node.js 22
or later and build the JavaScript subtree of the matching upstream tag.
[Matching npm release](https://github.com/link-foundation/meta-language/pull/251)

```sh
CARGO_BUILD_JOBS=1 CARGO_PROFILE_DEV_DEBUG=0 cargo build --locked --bin universal-translator
bash experiments/verify-syntax-exchange.sh
```

## JavaScript and Rust shared-library forms

Both implementations ship callable functions for line output, Euclidean GCD,
and FizzBuzz. The `common` forms use relative imports. Place
`js/src/common-library.mjs` alongside generated JavaScript and
`rust/src/common_library.rs` alongside generated Rust. Native forms are the
default and use the language's own control flow and output operations.

```sh
workspace=$(mktemp -d)
node bin/universal-translator.js translate c javascript examples/translation/hello.c \
  --mode same-effect > "$workspace/main.mjs"
node bin/universal-translator.js translate javascript meta "$workspace/main.mjs" \
  --mode same-effect > "$workspace/hello.lino"
cargo run --locked -- translate meta rust "$workspace/hello.lino" \
  --mode same-effect --form common > "$workspace/main.rs"
cp rust/src/common_library.rs "$workspace/"
rustc --edition=2021 "$workspace/main.rs" -o "$workspace/hello"
"$workspace/hello"
cargo run --locked -- translate rust meta "$workspace/main.rs" \
  --mode same-effect > "$workspace/return.lino"
node bin/universal-translator.js translate meta javascript "$workspace/return.lino" \
  --mode same-effect | cmp "$workspace/main.mjs" -
```

## Task contracts

| Task                    | Inputs in the authored source                                                                      | Standard output                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hello World             | A greeting of up to 96 UTF-8 bytes using letters, marks, numbers, spaces, and selected punctuation | The original text and a newline                                               |
| Greatest Common Divisor | Two nonnegative signed 32-bit integers                                                             | Their greatest common divisor as a line of decimal text, with `gcd(0, 0) = 0` |
| FizzBuzz                | A limit from 1 to 1,000                                                                            | The sequence defined by divisibility by 3 and 5, one item per line            |
| Empty Program           | No input                                                                                           | Empty output streams and exit status 0                                        |

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
node --test js/tests/translation.test.js js/tests/source-document.test.js
cargo test --locked --test translation
cargo build --locked --bin universal-translator
node examples/translation/verify-parity.mjs
node examples/translation/dependent-meanings.mjs
node examples/translation/verify-native.mjs
node examples/translation/report-coverage.mjs
```

To verify the complete pinned Rosetta Code archive, run the same source
round-trip check used in CI. The drivers stream the archive and compare
restored bytes in both implementations. They also validate the expected
effects and Meta Language output of selected original programs. For the
selected JavaScript and Rust files they execute both the original and the
translated program and compare stdout with the task oracle.
For callable GCD they invoke each function with signed integer inputs and
compare the returned values. The imported Rust GCD uses the pinned `num`
dependency in a dedicated fixture with a Cargo lockfile. For FizzBuzz they
preserve lowercase labels, quotes around each result, and the final blank line
where the original uses one.
For Empty Program they verify exit status 0 and both output streams.

```sh
archive=$(mktemp)
curl --fail --location \
  https://codeload.github.com/acmeism/RosettaCodeData/tar.gz/1d475861d7141ef2fafff293d9339f56e4b0f5db \
  --output "$archive"
python3 examples/translation/verify-corpus.py "$archive"
rm "$archive"
```

Add `--require-full-native` to require native execution and translation
evidence for every archived JavaScript and Rust example. The coverage report
prints counts for both source languages before the check exits. PR #5 runs
this form when GitHub marks it ready for review.

To round-trip all 591 text listings from the Hello World Collection, pass
the pinned HTML page. The remaining 12 programs are provided as images.

```sh
python3 examples/translation/verify-corpus.py --hello-world /path/to/hello-world-collection.html
```

Pass both inputs to verify that the archives round-trip in the same execution
and that the Rosetta Code native coverage uses only Rosetta Code files.

```sh
python3 examples/translation/verify-corpus.py /path/to/rosetta-code.tar.gz \
  --hello-world /path/to/hello-world-collection.html
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
five modeled tasks, also pass a directory containing the pinned Git Trees
responses. This mode downloads thirteen pinned Hello World Text files, ten
FizzBuzz files, five GCD files, one Empty Program, and seven Ackermann
sources from GitHub. It checks their blob hashes, exact round trips, and
effects in both runtimes. The Ackermann checks cover callable inputs,
command-line inputs, the standalone decimal result, and the compact JSON
array printed by the pinned JavaScript listing.

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
gh api "$rosetta_api/301be355b23d72e65bdea09ec463057b370502c8?recursive=1" \
  > "$rosetta_trees/Empty-program.json"
gh api "$rosetta_api/723cbc36ff1dac44417f312a4a594a6cffa2aadb?recursive=1" \
  > "$rosetta_trees/Ackermann-function.json"
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

Edit profile data in `data` and run
`node scripts/bundle-translation-profiles.mjs` to refresh the browser-compatible
JavaScript bundle. Rust reads the same Links Notation source at build time.
The [corpus coverage report](../../docs/case-studies/issue-1/README.md#coverage)
records which tasks and ranked languages the catalog supports.
