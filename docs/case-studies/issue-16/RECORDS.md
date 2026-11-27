# Class and constructor fragments

The historical class case in [PR 5](https://github.com/link-foundation/universal-translator/pull/5#issuecomment-7106301969)
asks for JavaScript to pass through the meta language into Rust and back.
[Later feedback](https://github.com/link-foundation/universal-translator/pull/5#issuecomment-7146732093)
requires parsing complete class fragments independently.

## Reproduction

```sh
node bin/universal-translator.js translate javascript rust examples/translation/point-class.txt --fragment --all-or-nothing
target/debug/universal-translator translate javascript rust examples/translation/point-class.txt --fragment --all-or-nothing
```

Both commands previously failed at the opening brace of the constructor on line 2. The class reader handled class wrappers containing static functions. It
passed an instance constructor through as a statement, where the parser
treated the constructor name and parentheses as a function call.

Both engines now represent the class as a record definition with ordered
constructor parameters and explicit field bindings. JavaScript emits a
constructor and instance assignments. Rust emits a struct and a generic
associated constructor, with an independent generic type for each parameter.
The Rust reader resolves the implementation's generic arguments against the
struct declaration, including different generic names and argument order.
The `definitions` fragment kind keeps the result independent of a main
function. Existing static class wrappers retain their prior behavior.

## Verification

```sh
node --test js/tests/records.test.js js/tests/fragments.test.js
cargo test --locked --test records --test fragments
node examples/translation/verify-records.mjs target/debug/universal-translator
```

The regression checks equivalent meta after each read, field names that differ
from their parameter names, multiple records, an empty constructor and a
constructor comment. The native check constructs two objects with different
argument types in Node.js, compiles and executes each engine's Rust output, then
runs the recovered JavaScript. Each prints `8 6 west true`. CI runs the native
check in its JavaScript–Rust lane.

## Complete programs

`examples/translation/point-instances.txt` constructs two different instances,
reads one field into a named scalar and prints four values. Both engines
represent construction and field reads explicitly. The Rust writer uses
inferred record types at the bindings and `i64` for integer constructor
arguments. The native verifier also translates and runs this complete program
without an added harness. The three executions agree on `-8 6 west true`.

This program path supports linear local bindings, independent constructors
with signed 32-bit integer, boolean or text literals, and read-only access to
known fields. It retains source order and refuses uses that require shared
identity, mutation, dynamic dispatch, coercion, custom formatting, or an
unresolved class or property. Regressions cover forward references, aliases,
writes, unknown fields, unsupported values and lossy Rust casts.

Open scope also includes methods, inheritance, constructor effects,
cross-scope object lifetimes, further numeric and text contracts, and
additional targets.
