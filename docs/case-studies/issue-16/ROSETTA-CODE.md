# Rosetta Code coverage and behavior

The remaining coverage goal requires more than 100 distinct task types with
new evidence of correct behavior. The coverage script measures how many source
lines partial parsing consumes. A source line can be consumed while its
meaning is lost, so the figures below measure parser reach.

## Identical inputs

The [Rosetta Code task list](https://rosettacode.org/wiki/Category:Solutions_by_Programming_Task)
provided the first 160 titles alphabetically. The downloaded `solutions.json`
has SHA-256
`4efb9132103eddd4a033062c685059396e4c4cb7b2d2e27c9c62f047481a87bb`.
Both runs used the same file, the first solution per language and a 140-line
limit per solution. The download command fetches current revisions and may
produce a different checksum later.

```sh
node scripts/rosetta-code.mjs download --limit 160 --cache .cache/issue-16-rosetta
node scripts/rosetta-code.mjs coverage --limit 160 --max-lines 140 \
  --cache .cache/issue-16-rosetta --out .cache/issue-16-rosetta/report
```

| Translator                                                   | Source lines consumed | Tasks fully consumed in every represented language |
| ------------------------------------------------------------ | --------------------: | -------------------------------------------------: |
| `16f5217`, before the recovered arithmetic work              |      45,453 / 136,208 |                                                  0 |
| `dc96c29`, after the arithmetic and evaluation-order repairs |      45,485 / 136,208 |                                                  0 |

The second run consumes 32 more lines across 12 titles. That comparison
establishes parser progress. Verification of the solutions requires meaningful
readings, successful emission and executable comparisons with the originals.

## Full parser measurement

The JavaScript parser at `663b040` read 429,633 of 1,292,940 source lines
across 1,783 tasks (33.2%). The corpus contains 28,827 first solutions in
supported languages. The 140-line cap skipped 1,577 solutions, and zero tasks
were read completely in every represented language. The earlier Issue 8 total
uses a 400-line cap and a different live corpus. [Issue 8 report](../issue-8/data/rosetta-code/README.md)

```sh
node scripts/rosetta-code.mjs download --cache .cache/issue-16-rosetta-full
node --max-old-space-size=384 scripts/rosetta-code.mjs coverage \
  --cache .cache/issue-16-rosetta-full --out .cache/issue-16-rosetta-full/report \
  --max-lines 140 --verbose
```

The measured input `solutions.json` has SHA-256
`6d80508f501f130acc186a8aa1a3deec16c667d672afe63b5e46a63cd2efbf1d`.
The decompressed report has SHA-256
`550278fccbeb2ff3d4c9c950dedeee8641f4ee331093ef0caa86c10a7aec681c`.
The 1,784-line log has SHA-256
`78e2cd546364097a7b9ba9e16a5ac139a5003bb5736ac7ade26d72a6fc1ffa61`.
The download API serves live revisions and the generated report retains
counts by task and language. [Coverage report](data/rosetta-code/coverage-663b040.json.gz) · [Timing log](data/rosetta-code/coverage-663b040.log.gz)

## C++ standalone calls

The C++ solution for [Ascending primes](https://rosettacode.org/wiki/Ascending_primes)
illustrates the difference. Its 73 lines were all consumed at `dc96c29`.
Standalone calls to `suspected.push`, `suspected.pop` and `primes.push_back`
vanished because prototype detection counted pieces of a dotted name as a
return type. Both readers now require a return type before the full dotted or
namespace-qualified name. Their regression tests read the calls and emit them
beside an ordinary forward declaration.

```sh
node js/tests/member-calls.test.js
cargo test --test grammar standalone_cpp_member_and_namespace_calls_survive_beside_prototypes
node experiments/issue-16-cpp-member-calls.mjs
```

The original member-call experiment calls `push_back`, `pop_back` and
`push_back` on a vector. The original prints `2`. Output translated at
`16f5217` prints `1`, and the repaired output prints `2`. The current
experiment also prints `0 3 4` to check an empty vector and the two elements
of a list-initialized vector. It accepts an alternate checkout's
`js/src/index.js` as its first argument.

## C++ template calls and headers

The explicit type argument in `ostream_iterator<unsigned>(...)` was read as a
comparison operator. Both parsers now recognize explicit call arguments that
contain a C++ fundamental type, including a nested type such as
`std::vector<unsigned>`. A comparison such as `a < b > (c)` keeps its original
reading. C++ output emits the type arguments and carries the source's literal
headers and namespace declarations into the new program. Cross-language
writers require a semantic mapping for these template calls.

The compiled [`max<unsigned>` example](../../../examples/programs/library/cpp-template.cpp)
distinguishes unsigned arguments from signed ones. Both the original and the
emitted program print `1`. The preceding reader reported `Expected ")" but
found "," (line 7)` on the template call; its partial output had no enclosing
function, and the C++ compiler rejected it. The same experiment checks the two
cases during native CI.

## Verified Rosetta tasks beyond the baseline

Both engines retained `unsigned` inside the template call but stripped it from
the declared `queue<unsigned>` and `vector<unsigned>`. The C++ writer also
added `= 0` to these objects even though their default constructors establish
the initial state. Both readers now retain the class type and the absence of
an initializer. The C++ writer uses the original declaration form, and the
native C++ fixture verifies that a default-constructed optional is empty while
an explicitly initialized optional contains `7`.

The first C++ solution from [Ascending primes revision 419038](https://rosettacode.org/w/index.php?title=Ascending_primes&oldid=419038)
now passes a same-language behavioral round trip through both CLIs. The
original emits 100 primes in 512 bytes, which both translations match byte for
byte. The original lacks `<iterator>` and `<algorithm>`, so the experiment
adds both headers to all three GCC invocations. GCC also warns about the
original's unused, nonstandard `main` parameters. The experiment pins the
source and stdout digests. [Recorded output](logs/ascending-primes-native.txt)

```sh
curl --fail --silent --show-error --get https://rosettacode.org/w/api.php \
  --data 'action=query' --data 'prop=revisions' --data 'revids=419038' \
  --data 'rvprop=ids|content' --data 'rvslots=main' --data 'format=json' \
  --data 'formatversion=2' > /tmp/ascending-primes-revision.json
node experiments/issue-16-ascending-primes.mjs /tmp/ascending-primes-revision.json \
  ./target/debug/universal-translator
```

The first C++ solution for [Queue/Usage revision 420325](https://rosettacode.org/w/index.php?title=Queue/Usage&oldid=420325)
also compiles and runs through both CLIs. Each emitted program retains all
19 queue state assertions, which execute with assertions enabled. Both
programs exit successfully with empty stdout, matching the original.
Output from `16f5217` omitted `<queue>` and `<cassert>` and emitted
`std::queue<int> q = 0;`. GCC rejected that output.

The first C++ solution for [Order two numerical lists revision 417505](https://rosettacode.org/w/index.php?title=Order_two_numerical_lists&oldid=417505)
emits `false` followed by a newline in the original and both translated
programs. Previously, the special parser for integer vectors built a
declaration without a value for `std::vector<int> a;`. The JavaScript
writer tried to read the missing value's kind, and the Rust writer raised
`Declaration has no value`. Both readers now represent the default
integer vector as empty, and direct brace initialization retains the listed
elements. Other element types retain their C++ type and use the ordinary
template-declaration reader. The writers emit one `<vector>` header when
both the original code and the generated array syntax require it.

The first C++ solution for [Jewels and stones revision 419626](https://rosettacode.org/w/index.php?title=Jewels_and_stones&oldid=419626)
prints `3` and `0` through both CLIs. The prior writer rejected its
block-scoped `using namespace std;`. Preserving that declaration exposed a
second failure. GCC could no longer bind a string literal to the parameter
after the reader had removed `const` from `const std::string&`. Both engines
now preserve recognized using directives and declarations in the original
block, and they retain the original C++ type for const reference and pointer
parameters. Both CLI checks forbid partial output. Native CI also compares
the original and translated scoped-library fixture.
[C++ working draft](https://eel.is/c++draft/namespace.udir)
[Recorded results](logs/rosetta-containers-native.txt)

The first C++ solution for [String append revision 420026](https://rosettacode.org/w/index.php?title=String_append&oldid=420026)
uses a string literal in a parenthesized initializer. At `a82f53c`, the
reader dropped the declaration of `greeting` as a function prototype.
GCC then reported that `greeting` was undeclared in the `append` call.
The readers now recognize a `std::string` declaration with a single string
literal, including a literal on its own line. A named parameter or empty
parameter list retains the function-prototype reading. Both CLIs emit
standalone C++ that prints `Hello , world!` and a newline, matching the
original. The native CI fixture also covers the constructor's embedded-null
behavior. Other constructors and cross-language library mappings remain open.
[Native comparison fixture](../../../examples/programs/library/cpp-string-initialization.cpp)

```sh
curl --fail --silent --show-error --get https://rosettacode.org/w/api.php \
  --data 'action=query' --data 'prop=revisions' --data 'revids=420325|417505|419626|420026' \
  --data 'rvprop=ids|content' --data 'rvslots=main' --data 'format=json' \
  --data 'formatversion=2' > /tmp/rosetta-containers-revisions.json
node experiments/issue-16-rosetta-containers.mjs /tmp/rosetta-containers-revisions.json \
  ./target/debug/universal-translator
```

The first Rust solution for [String interpolation (included), revision 416065](<https://rosettacode.org/w/index.php?title=String_interpolation_(included)&oldid=416065>)
has three print calls. At `6b73060`, the JavaScript CLI emitted the indexed
and named placeholders as literal text. Both engines now resolve default
Display fields with automatic indices, explicit indices, named arguments and
direct captures. Escaped braces and the extra newline from `println!` retain
their native semantics. When a field order would move or repeat a call, Rust
output keeps the original macro and argument order. Formatting options such as
alignment also stay in native Rust output.
[Rust formatting rules](https://doc.rust-lang.org/std/fmt/index.html#usage)

Both CLIs preserve all three lines of `Mary had a little lamb` in native Rust
and Python, including the Rust outputs restored from Python. The regression
fixture also verifies captured names, native alignment and observable calls
through reordered and repeated fields. Native CI runs the fixture with the
JavaScript CLI. The experiment accepts the built Rust CLI and the pinned
MediaWiki revision for the full comparison.
[Native comparison fixture](../../../examples/printing/rust-format.rs)
[Recorded results](logs/rosetta-rust-print-native.txt)

```sh
curl --fail --silent --show-error --get https://rosettacode.org/w/api.php \
  --data 'action=query' --data 'prop=revisions' --data 'revids=416065' \
  --data 'rvprop=ids|content' --data 'rvslots=main' --data 'format=json' \
  --data 'formatversion=2' > /tmp/rosetta-rust-print-revision.json
node experiments/issue-16-rust-print.mjs --revision /tmp/rosetta-rust-print-revision.json \
  --rust-translator ./target/debug/universal-translator
```

These six pinned task round trips count toward the behavioral goal. Portable
format modifiers, containers and comparisons need broader native verification.

## C++ file-scope declarations

Previously, the readers placed file-scope declarations in the entry-point
body. The C++ emitter consequently printed them as local variables. In the
[shared state fixture](../../../examples/programs/library/cpp-file-scope.cpp),
the compiler rejected the output from `4d268d9` because `advance` could no
longer see `shared_value`. Both translators now retain the declaration's
file scope and its position relative to function definitions. The emitter
also recognizes calls from initializers when generating forward declarations.

The original fixture and the emitted C++ both print `10` and `11`. The
native regression runs alongside the three cases above. Focused JavaScript
and Rust tests check that the declaration and its comment remain between
the original function definitions. Cross-language library and declaration
mapping remains open.
