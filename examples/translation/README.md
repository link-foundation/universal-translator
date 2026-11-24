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

The native harness can also run the published Hello World Collection console
snippets admitted by the profiles. It checks the page SHA-256 against the
corpus manifest before extracting or running any snippet. It compares both
the original and the emitted JavaScript or Rust program with the expected
output. Pass profile IDs to select the tools installed locally.

```sh
curl --fail --location http://helloworldcollection.de/ --output hello-world-collection.html
node examples/translation/verify-native.mjs --require-all \
  --hello-world=hello-world-collection.html javascript rust
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
where the original uses one. Two JavaScript listings return a single string
with spaces or newlines between results. The native harness compares each
unchanged listing's value with the translated Rust function and the oracle.
It checks for extra output and trailing separators. The first JavaScript
listing defines a function that prints only when called, which the harness
verifies in both languages. The verifier also compares
the legacy Rust FizzBuzz listing's exact 413 output bytes with the translated JavaScript
and the task oracle. On x86-64 Linux the archive driver downloads a
checksum-pinned Rust nightly from 2015-10-15 into a temporary directory.
Set `ROSETTA_LEGACY_RUSTC` to the extracted `rustc` executable to reuse it.
The native count on other platforms excludes this listing when that compiler
is unavailable.
For Empty Program they verify exit status 0 and both output streams.
Hello World Newbie has two console specimens and a JavaScript browser alert.
The alert check compiles the translated Rust source to WebAssembly and uses
the [browser import](browser-wasm.mjs) to decode the message and open
the dialog. Playwright intercepts and dismisses the actual alert in Google
Chrome. Both programs must produce one alert with the original greeting.
The JavaScript `document.write` listing and its Rust WebAssembly translation
both write the exact greeting to the browser document. The standalone
`print` listing runs in the QuickJS shell with the original source intact,
and its Rust translation must produce the same stdout bytes. The archive
driver downloads checksum-pinned QuickJS on x86-64 Linux. On other systems,
set `ROSETTA_QUICKJS` to the full path of a compatible QuickJS executable.
The original `WScript.Echo` listing runs under Wine CScript. The verifier
compares its output with the Rust translation byte for byte, including the CR
and LF terminator. On Ubuntu, install `wine64` and set `ROSETTA_WINE` to
`/usr/lib/wine/wine64` to include this listing in the corpus check.
The Ubuntu runner provides Chrome. For a local replay, install Chrome and
run `rustup target add wasm32-unknown-unknown` before running the driver.
[Published JavaScript listings](https://rosettagit.org/tasks/hello-world-text/#javascript) ·
[QuickJS binary releases](https://bellard.org/quickjs/binary_releases/)

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
prints counts for both source languages before the check exits. When PR #5
is ready for review, its **Full native Rosetta Code coverage** job requires
the same complete counts from that run's successful translation job.

To verify the three calls from the Rust GCD Tests section in context, pass
the pinned signed recursive implementation and the listing with its output
transcript. The probe runs the original call statements with the Rust
implementation and calls the translated JavaScript on the same arguments.

```sh
root=/path/to/pinned/RosettaCodeData/Task/Greatest-common-divisor/Rust
node experiments/rosetta-gcd-tests.mjs \
  "$root/greatest-common-divisor-3.rs" \
  "$root/greatest-common-divisor-5.rs"
```

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
eight modeled tasks, also pass a directory containing the pinned Git Trees
responses. This mode downloads the selected pinned files recorded in
`corpus-coverage.lino` from GitHub. It checks their blob hashes, exact round
trips, and effects in both runtimes. The Ackermann checks cover callable inputs,
command-line inputs, the standalone decimal result, and the compact JSON
array printed by the pinned JavaScript listing.
The FizzBuzz replay covers all eight JavaScript and four Rust listings. For
the JavaScript generator listing, it compares the 100 lowercase output lines
and final newline with the translated Rust program.
For A+B, the verifier feeds both the original and translated programs seven
stdin lines. These include positive and negative values, both endpoints, and
repeated spaces. The signed forms produce fixed decimal sums. The pinned
JavaScript variant using `process.openStdin()` and its translations emit
`usage: <number> <number>` when either input has an explicit sign. The HTML
listing and the emitted Rust WebAssembly open the same two Chrome prompts
with empty defaults. Six inputs check the prompt order, exact entered text,
and sum displayed in the DOM. The Windows Script Host listing uses
`WScript.StdIn`. Ubuntu 24.04's Wine 9.0 returns `E_NOTIMPL` from that getter,
and the unchanged Windows script produced empty output in the local probe.
[Wine source](https://github.com/wine-mirror/wine/blob/3e119694dc2c4d5b0773cbc38afb49ff031225bb/programs/wscript/host.c#L420-L423)

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
gh api "$rosetta_api/aec40331f71266270b317cabf5b13618c110380a?recursive=1" \
  > "$rosetta_trees/Hello-world-Newbie.json"
gh api "$rosetta_api/b40dd4bbab9ecf8e83dba4da84ecc01ba945c90e?recursive=1" \
  > "$rosetta_trees/Hello-world-Graphical.json"
gh api "$rosetta_api/e446b0d3607fb0eb63df03c4c097f58884dd2786?recursive=1" \
  > "$rosetta_trees/A+B.json"
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
