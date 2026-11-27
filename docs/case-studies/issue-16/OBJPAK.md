# Portable Object Compiler and the original collection example

The Objective-C entry in the cached Hello World Collection is a Portable Object
Compiler (POC) program. It uses `objpak.h`, `Set`, `String`, message sends and
the POC block notation `{ :each | ... }`. Clang rejecting that dialect was not
evidence that the program could not be translated. The old reader interpreted
`[Set new]` as an array expression and failed at `new`.

The unchanged original is [examples/objpak/hello.m](../../../examples/objpak/hello.m).
`node experiments/issue-16-objc-regression.mjs` runs it against the pre-feature
commit `0a44abd` and the current reader. The preserved result is
`logs/objc-original-regression.txt`: the old reader reports
`Expected "]" but found "new" (line 11)`; the current reader produces a program.
Both engines now read all 34 original collection programs, rather than the
previous 33. The generated coverage record and both collection tests check this.

## Semantic model

Messages retain independent receiver, selector and argument expressions. Blocks
retain parameter names and statements. A scoped understanding rule recognizes
documented operations on known library values, rather than matching a whole
program or substituting a saved translation. Unknown messages remain explicit.
Parameters and local bindings shadow library class names.

The argument entry point becomes an array of process arguments, an integer
argument count and an integer cursor. Pointer dereferences become ordinary
array indexing. Prefix and postfix unit updates retain their distinct values.
Unsupported pointer uses raise a diagnostic. Generated argument adapters are
recognized only with a verified library definition and the actual entry-point
parameters.

Objpak string sets carry an explicit ordering policy. The implementation models
16 initial slots, the original signed-byte 32-bit string hash on the verified
Linux/GCC platform, linear probing, growth before insertion above half occupancy
and iteration by occupied slot. Growth is checked even for a duplicate value.
Set aliases share identity, `add:` returns that same set and additions during
iteration can become visible. Rust uses shared interior mutability and borrows
only while obtaining the next item, so an iteration body can add values.
String literals constructed through `String str:` stop at their first NUL.

Python, JavaScript and Rust receive independently implemented helpers for that
policy. Objective-C uses the original native classes and a small argument
adapter. Helper names avoid identifiers in the input. A reader binds a helper's
contract only when its complete lexical definition matches and its declaration
is at the top level, outside comments and strings. Matching retains Python
block structure, complete operators, joined numeric spellings and JavaScript
return/update line-break semantics while allowing supported layout styles. Changing its implementation does
not retain the old contract. Concrete records preserve the complete definition
as a library token and production, with UTF-8 ranges, rather than labelling its
bytes as whitespace. This is an explicit library adapter, not a general reader
for arbitrary class implementations.

All 71 controlled natural grammars compose the new expressions using their own
evaluation syntax and quoted operation names. The empty-set operation has an
explicit empty argument list, distinguishing it from a quoted text value.
Restricted profile vocabularies are unchanged. Python editions without assignment
expressions and ECMAScript 5 reject constructs they cannot emit faithfully.

## Original compiler and primary evidence

The finite native verifier builds the original toolchain without system
installation:

```sh
bash experiments/build-objpak.sh
node examples/objpak/verify-native.mjs
```

The source mirror is pinned to
[`fkhannouf/objc` at 983114f](https://github.com/fkhannouf/objc/tree/983114f60a69d77fc82759e5ceb43ee6a20ed69b),
and its generated-C bootstrap to
[`fkhannouf/objc-bootstrap` at 5d2ffc1](https://github.com/fkhannouf/objc-bootstrap/tree/5d2ffc1d67204a598037542b86582a7a2631dbdc).
The build runs one job with a 1 GiB address-space limit and 16 MiB stack.
It uses GNU C89 and unoptimized, unfortified headers because the historical
parser does not accept modern fortified glibc declarations. Existing host
headers are not modified. Build logs and the exact revision/options stamp stay
in the reusable temporary installation prefix.

The original
[`set.m`](https://github.com/fkhannouf/objc/blob/983114f60a69d77fc82759e5ceb43ee6a20ed69b/src/objpak/set.m),
[`ocstring.m`](https://github.com/fkhannouf/objc/blob/983114f60a69d77fc82759e5ceb43ee6a20ed69b/src/objpak/ocstring.m)
and [`setseq.m`](https://github.com/fkhannouf/objc/blob/983114f60a69d77fc82759e5ceb43ee6a20ed69b/src/objpak/setseq.m)
establish the hash, insertion and live-iterator behavior. Eight unchanged primary
documents, including both upstream license files and the block documentation,
are compressed under `data/prior-art/objpak/`; the manifest records their pinned
URLs, byte counts and SHA-256 digests. Their original library licenses remain
with those research copies. The emitted helpers implement the observed policy
independently; upstream library source is not included in distributed helpers.

## Verification and limits

The native verifier compares stdout and successful process exit against real
POC execution for four independently parsed programs. The original has six
finite argument sets: empty input, one name, duplicates, Unicode and an empty
string, 40 names requiring growth and a duplicate at the growth boundary.
Additional programs check aliases and insertion return values, mutation during
iteration and all four prefix/postfix update forms. Every generated caller also
reads back to the same meta program. `logs/objc-native-comparison.txt` records
the passing comparisons.

This verifier found a second defect: generated Objective-C `main` fell through
without a return, producing status 240 under the C89 toolchain. Both writers now
emit an explicit `return 0;`; a dedicated regression and the native comparison
cover it. The previous failure is preserved in
`logs/objc-native-comparison-implicit-return.txt`. Existing Objective-C goldens
have been regenerated for that behavior.

`js/tests/objpak.test.js` and `rust/tests/objpak.rs` cover parsing, scopes,
collection identity, argument lowering, edition rejection and formal/natural
round trips. CLI verification exposed source-layout reindentation making a
byte-identical helper check reject an unchanged implementation. Both readers
now verify lexical structure, with regressions for default source layout,
explicit brace styles and tabs. Whitespace that changes JavaScript return
semantics or splits an operator/hexadecimal literal loses the contract.
Concrete records still retain the exact original bytes. `experiments/verify-syntax-exchange.mjs` compares both CLIs' writes
and reads across four formal and two natural grammars. CI runs the native
verifier within the existing native-translation budget.

The remaining wider criteria are still open: other object libraries and class
definitions, arbitrary pointer operations, every target's set/argument lowering,
other Objpak element types and methods, non-UTF-8 process arguments and platform
policies with unsigned `char`. The program-name argument is the executing
program's own name in each runtime. This feature does not complete the full
Rosetta corpus or every all-language requirement.
