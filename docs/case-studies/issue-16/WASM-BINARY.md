# WebAssembly binary reading

The inherited machine coverage criterion asks for real binary inputs.
Previously the machine lifting path began with text patterns. For example,
`translate wasm javascript examples/programs/binary/wasm-stack.wasm` had no
binary reader to select. Both CLIs now pass bytes directly to the new reader,
which uses the existing stack-machine lifting and translation pipeline.

The reader checks the version 1 header, section order, bounded LEB128
integers, UTF-8 names, supported function signatures, local indexes and
instruction stack effects. It reads `i64` literals, locals, calls, signed
arithmetic and returns. A module exports a void `main` with no parameters and
can import the existing integer and newline print ABI from `env`. Custom
section payloads are opaque after the checked section name. Oversized modules,
unsupported sections and opcodes, and inconsistent bodies fail with byte
offsets. [WebAssembly 1.0 core specification](https://www.w3.org/TR/wasm-core-1/#binary-format)

The machine lifter ordinarily composes deferred expressions. Binary
instructions can retain a local value across a later write, or retain a
function result across another call. The reader materializes those values at
their original evaluation points. The fixture reads an initially zero local,
updates it to seven, prints the earlier zero, and uses the new value when
calling its difference function. It keeps that result across another print.
Signed division, signed remainder and integer zero also appear in its output.

```sh
wat2wasm --debug-names examples/programs/binary/wasm-stack.wat -o examples/programs/binary/wasm-stack.wasm
node experiments/issue-16-wasm-binary.mjs
cargo build --bin universal-translator
WASM_RUST_TRANSLATOR=./target/debug/universal-translator node experiments/issue-16-wasm-binary.mjs
```

The native verifier compares seven lines from the committed module and
an independently assembled WAT program. It then compares output from
the generated JavaScript and Python and checks that both filename input and
binary standard input produce identical translations. The JavaScript and Rust
tests check lowering, call order, signed zero and binary validation.

Full-width `i64` wraparound, traps in target runtimes, branching, memory,
data, tables, floating point, the external export ABI, source offsets on
successful instructions and other bytecode formats remain open.
