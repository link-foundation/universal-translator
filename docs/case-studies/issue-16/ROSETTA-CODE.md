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

The same prototype heuristic removed declarations of other C++ objects when
their first initializer argument was a literal or a member call. Both readers
now distinguish these forms from parameter declarations. The writers retain
the original type and parentheses, and they keep standalone C++ string literal
escapes without decoding them as portable text. The native fixture uses
a file-scope `std::string_view` with a literal, a block-scope view constructed
from `substr`, a hexadecimal string escape, and a numeric initializer.
Both strict CLI outputs compile and print `eady)a 2`, matching the original.
[Native comparison fixture](../../../examples/programs/library/cpp-direct-initialization.cpp)

The first C++ solution for [Array length revision 419956](https://rosettacode.org/w/index.php?title=Array_length&oldid=419956)
declares a fixed-size array of strings. At `25a7da8`, strict parsing
stopped at the comma before the extent. Both readers now retain the type
and its numeric extent, nested brace groups, and the distinction between
direct and copy list initialization. The emitted `.size()` keeps its
native return type and follows renames of the receiver. Both CLI outputs
print the single byte `2`, matching the original. The native fixture
checks nested integer arrays, a partially initialized const string array,
and a zero-length array. Cross-language fixed-array lowering remains open.
[Native comparison fixture](../../../examples/programs/library/cpp-fixed-array.cpp)

The first C++ solution for [String length revision 420285](https://rosettacode.org/w/index.php?title=String_length&oldid=420285)
uses the string's `length()`, `size()` and `sizeof(string::value_type)`.
At `ceff682`, strict emission rejected `SizeOf`. Both engines now emit
native `sizeof` with its unevaluated operand and retain parenthesized
built-in types. The original and both translated programs compile and
exit successfully. A second native run observes their three internal
values, all `13`. The native CI fixture also checks a four-byte UTF-8
string and confirms that `sizeof(next())` leaves the call counter at zero.
[Native comparison fixture](../../../examples/programs/library/cpp-string-length.cpp)

The first C++ solution for [Character codes revision 419019](https://rosettacode.org/w/index.php?title=Character_codes&oldid=419019)
casts between an ordinary character literal and an integer. At `e51e76c`,
the reader stopped at the first single quote. Both engines now retain the
literal's spelling and the casts that determine its native type. Both strict
CLI outputs print `97` and `a` on separate lines, matching the original. The
native fixture also checks escaped characters, nested casts and `sizeof(char)`.
[Native comparison fixture](../../../examples/programs/library/cpp-characters.cpp)

A strict candidate scan compared `16f5217` and `88bb998` on the same full
corpus snapshot. It considered the first solution for each task in C, C++,
JavaScript, Python, Rust and TypeScript, capped at 140 lines and 10,000
characters per input. It found 32 language/task pairs where the baseline
failed and the newer CLI emitted a program. The experiment only translates
source. Each candidate needs a separate executable comparison.
[Scan results](logs/rosetta-candidates-88bb998.jsonl)

```sh
node --max-old-space-size=384 experiments/issue-16-rosetta-candidates.mjs \
  .cache/issue-16-rosetta-full/solutions.json /path/to/baseline/js/src/index.js
```

A second scan tested up to five solutions per task and language using the same
corpus snapshot and baseline. It found 55 candidates in 47 distinct tasks.
Results include a zero-based solution index when a later solution is selected.
These records guide native verification and carry the exact source digests.
[Five-solution scan](logs/rosetta-candidates-five.jsonl)

```sh
node --max-old-space-size=384 experiments/issue-16-rosetta-candidates.mjs \
  .cache/issue-16-rosetta-full/solutions.json /path/to/baseline/js/src/index.js \
  cpp c javascript python rust typescript --solutions=5
```

Six more pinned C++ originals passed native behavioral comparisons, including
source hash, strict emission and output checks through both CLIs.

| Task                          | Pinned revision                                                                                | Observable result                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Formatted numeric output      | [412804](https://rosettacode.org/w/index.php?title=Formatted_numeric_output&oldid=412804)      | `00007.125`                                                           |
| Hello world/Newbie            | [417360](https://rosettacode.org/w/index.php?title=Hello_world/Newbie&oldid=417360)            | `Hello, World!`                                                       |
| Copy stdin to stdout          | [417213](https://rosettacode.org/w/index.php?title=Copy_stdin_to_stdout&oldid=417213)          | All input bytes, including the leading space, tab, blank line and NUL |
| Reverse a string              | [420276](https://rosettacode.org/w/index.php?title=Reverse_a_string&oldid=420276)              | `  ba 210` for input `012 ab  `                                       |
| Shortest common supersequence | [418354](https://rosettacode.org/w/index.php?title=Shortest_common_supersequence&oldid=418354) | `abdcabdab`                                                           |
| Substring                     | [418506](https://rosettacode.org/w/index.php?title=Substring&oldid=418506)                     | Five lines from the original string and iterator slices               |

`Reverse a string` exposed translation of `std::string s;` to an initializer
from zero. The pinned original default-constructs an empty string. The updated
readers model a qualified `std::string` declaration without an initializer as
an empty string. The native string fixture now checks this initial state before
any assignments.

`Shortest common supersequence` exposed conversion of an indexed character
to a decimal code during text interpolation. The old translation printed
`9810099979897cbdab` for the original input. Both engines now retain the C++
string and character addition overload, including indexes into typed strings
and `const std::string&` parameters. The dedicated node uses C++ evaluation
and indexing semantics. Other writers need a semantic mapping for that node.
The native fixture also checks an appended character literal.
[Native comparison fixture](../../../examples/programs/library/cpp-characters.cpp)

Seven further C++ solutions from the strict candidate scan now match the
pinned originals through both CLIs, bringing the verified total to 22
distinct tasks before the library-dependent cases below. The same native caller checks the original `countabc`
function and both emitted fragments. The alphabet check inspects the local
string after `std::iota` in the original and both emitted programs.

| Task                                 | Pinned revision                                                                                       | Observable result                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| ABC correlation                      | [420238](https://rosettacode.org/w/index.php?title=ABC_correlation&oldid=420238)                      | Four results for equal, absent and unequal character counts |
| Approximate equality                 | [418405](https://rosettacode.org/w/index.php?title=Approximate_equality&oldid=418405)                 | Eight numeric comparisons, with byte-exact matching output  |
| Euler's identity                     | [418309](https://rosettacode.org/w/index.php?title=Euler%27s_identity&oldid=418309)                   | `(0,1.22465e-16)`                                           |
| List comprehensions                  | [415006](https://rosettacode.org/w/index.php?title=List_comprehensions&oldid=415006)                  | Six triples with their original ordering and spaces         |
| Generate lower case ASCII alphabet   | [418063](https://rosettacode.org/w/index.php?title=Generate_lower_case_ASCII_alphabet&oldid=418063)   | `abcdefghijklmnopqrstuvwxyz` in the constructed string      |
| Find if a point is within a triangle | [418364](https://rosettacode.org/w/index.php?title=Find_if_a_point_is_within_a_triangle&oldid=418364) | Five classifications, including near-edge cases             |
| Binary digits                        | [419726](https://rosettacode.org/w/index.php?title=Binary_digits&oldid=419726)                        | Four binary strings and the original `unsigned int` input   |

The previous emitter produced invalid C++ for the complex exponential. The
reader had grouped `std::cout << std::exp(...)` before `+ 1.0`. The left shift
and stream token binds more loosely than addition. Both engines now keep
the addition within the stream operand and can re-emit both C++ shift tokens.
[C++ shift expressions](https://eel.is/c++draft/expr.shift)

The alphabet source previously dropped `std::string lower(26, ' ')` as a
function declaration. Both readers now keep a literal or named count followed
by a character literal as a constructor call for `std::string`. The native
fixture verifies that construction with `\0` retains all three bytes.
[Native string fixture](../../../examples/programs/library/cpp-string-initialization.cpp)
[Pinned outputs](logs/rosetta-containers-native.txt)

The binary-digit source previously changed `print_bin(unsigned int)` into
`print_bin(int)`. The observer checks the function pointer's original type
because the four existing inputs fit in either type. Both C++ writers now
retain the explicit width and signedness of function parameters.

```sh
curl --fail --silent --show-error --get https://rosettacode.org/w/api.php \
  --data 'action=query' --data 'prop=revisions' \
  --data 'revids=420325|417505|419626|420026|419956|420285|419019|412804|417360|417213|420276|418354|418506|420238|418405|418309|415006|418063|418364|419726|419426|413803|418530|417616|419450|420008' \
  --data 'rvprop=ids|content' --data 'rvslots=main' --data 'format=json' \
  --data 'formatversion=2' > /tmp/rosetta-containers-revisions.json
node experiments/issue-16-rosetta-containers.mjs /tmp/rosetta-containers-revisions.json \
  ./target/debug/universal-translator
```

Three library-dependent C++ solutions bring the verified total to 25. The
older C++ parser dropped the two Boost integer constructions in Modular
exponentiation and both Qt byte-array constructions in URL encoding. The
original and both translated programs now agree under Boost 1.83.0 and
Qt Core 6.4.2. The factorial comparison gives each fragment the same native
caller and forces the same headers, including `<numeric>` for `std::accumulate`.

| Task                   | Pinned revision                                                                         | Observable result                          |
| ---------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| Modular exponentiation | [417465](https://rosettacode.org/w/index.php?title=Modular_exponentiation&oldid=417465) | `1527229998585248450016808958343740453059` |
| URL encoding           | [419986](https://rosettacode.org/w/index.php?title=URL_encoding&oldid=419986)           | `http%3A%2F%2Ffoo%20bar%2F`                |
| Factorial              | [420257](https://rosettacode.org/w/index.php?title=Factorial&oldid=420257)              | `1 1 720 479001600`                        |

With the Boost and Qt 6 Core development headers available, the same verifier
runs these three exact revisions. Use `LIBRARY_PATH` and `LD_LIBRARY_PATH` when
the Qt libraries are outside the compiler and dynamic linker's search paths.

```sh
curl --fail --silent --show-error --get https://rosettacode.org/w/api.php \
  --data 'action=query' --data 'prop=revisions' --data 'revids=417465|419986|420257' \
  --data 'rvprop=ids|content' --data 'rvslots=main' --data 'format=json' \
  --data 'formatversion=2' > /tmp/rosetta-library-revisions.json
qt_headers=$(pkg-config --variable=includedir Qt6Core)
CPLUS_INCLUDE_PATH="$qt_headers:$qt_headers/QtCore${CPLUS_INCLUDE_PATH:+:$CPLUS_INCLUDE_PATH}" \
  node experiments/issue-16-rosetta-containers.mjs /tmp/rosetta-library-revisions.json \
  ./target/debug/universal-translator 'Modular exponentiation' 'URL encoding' 'Factorial'
```

[Pinned native results](logs/rosetta-containers-native.txt)

The C++ solution for [Menu revision 419426](https://rosettacode.org/w/index.php?title=Menu&oldid=419426)
brings the verified total to 26. The declaration reader had consumed the
unmatched `>>` in `std::cin >> entry;` as a closing angle bracket, and prototype
detection had silently dropped the throw expression. Both emitted programs
now compile. The verifier supplies `0\n2\n` to exercise rejection and retry.
The original and both outputs print the same two menus and choose
`huff and puff`. Native CI also exercises stream extraction and catching an
exception whose message comes from the input.
[Native comparison fixture](../../../examples/programs/library/cpp-stream-extraction.cpp)
[Pinned native results](logs/rosetta-containers-native.txt)

Five further C++ tasks bring the verified total to 31. Before the fix, both
emitted programs for User input/Text and Kernighans large earthquake problem
aborted with `basic_string: construction from null is not valid`. The reader
left an unqualified `string` declaration without a value, and the writer
emitted `std::string value = 0;`. The readers now carry the empty initial
value for `string` and `std::string`. The native observer checks the two
extracted values immediately before `return 0;` in the original and both
emitted programs. The earthquake probe gives all three a four-row local file
with magnitudes below, equal to and above the cutoff of six.

| Task                                | Pinned revision                                                                                       | Observable result                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Non-decimal radices/Input           | [413803](https://rosettacode.org/w/index.php?title=Non-decimal_radices/Input&oldid=413803)            | Four converted integers in the original order        |
| Repeat a string                     | [418530](https://rosettacode.org/w/index.php?title=Repeat_a_string&oldid=418530), second C++ solution | Five asterisks and a newline                         |
| Set right-adjacent bits             | [417616](https://rosettacode.org/w/index.php?title=Set_right-adjacent_bits&oldid=417616)              | Eight exact outputs at widths 4 and 66               |
| User input/Text                     | [419450](https://rosettacode.org/w/index.php?title=User_input/Text&oldid=419450)                      | Both prompts and the extracted `75000` and `word`    |
| Kernighans large earthquake problem | [420008](https://rosettacode.org/w/index.php?title=Kernighans_large_earthquake_problem&oldid=420008)  | Two qualifying records and the reported count of two |

All three bit-program builds use `-include cstdint` because the pinned code
uses a fixed-width type without its header. The Copy stdin to stdout probe
now also checks an embedded NUL followed by more input.
[Baseline failures for these five inputs](logs/rosetta-io-baseline.txt)
[Pinned native results](logs/rosetta-containers-native.txt)

The C solution for [Copy stdin to stdout revision 417213](https://rosettacode.org/w/index.php?title=Copy_stdin_to_stdout&oldid=417213)
previously lost `<stdio.h>`. Strict C99 compilation reported implicit
declarations for `getchar` and `putchar`, and an undeclared `EOF`. Both
engines now retain literal headers in C output, including quoted local
headers and trailing comments. A matching source header supplies the
same dependency as an automatically generated header. The original C
program and both CLI outputs reproduce all 34 bytes, including a NUL,
`0x80` and `0xff`. This adds a second source language for the already
verified task.
[Strict C99 diagnostics and native results](logs/rosetta-c-stdio.txt)

```sh
curl --fail --silent --show-error --get https://rosettacode.org/w/api.php \
  --data 'action=query' --data 'prop=revisions' --data 'revids=417213' \
  --data 'rvprop=ids|content' --data 'rvslots=main' --data 'format=json' \
  --data 'formatversion=2' > /tmp/rosetta-c-stdio-revision.json
node experiments/issue-16-c-stdio.mjs --revision /tmp/rosetta-c-stdio-revision.json \
  --rust-translator ./target/debug/universal-translator
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

Portable format modifiers, containers and comparisons need broader native
verification.

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
