# JVM class file reading

The inherited machine-translation requirement asks for binary Java bytecode
and support for multiple class file editions. The `jvm` source and target
use Jasmin text. Both CLIs now also accept `.class` bytes from a file or
standard input with the `jvm-class` source name.

The two readers handle class versions 52.0 through 65.0, which Java 8 through
21 introduced. They read the big-endian class framing, relevant constant-pool
types, Java modified UTF-8, and method `Code` attributes with source and debug
tables. The class extends `Object` and has a public static `main`, optionally
with the default constructor. The recognized instructions are integer and
string literals, `int` and `long` locals, five signed arithmetic operations,
negation, `int` widening, and `System.out.print` and `println` for integers and
constant strings. [JVMS class file structure](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-4.html) · [JVMS instruction set](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-6.html)

The readers validate typed operand-stack and local-slot use. They track known
integer values in this straight-line, input-independent subset. Every numeric
value stays in the range from −2,147,483,647 to 2,147,483,647, which allows the
generated C and JavaScript to preserve those values. Division by zero,
unsupported opcodes, and declared sizes beyond the input are rejected with a
byte offset. The ordinary machine instructions flow through lifting and the
same type, meaning and target rules as the text dialect. A load or arithmetic
operation is materialized at its bytecode position, preserving its value
across later local writes. Printed strings support tab, newline and carriage
return among the C0 control characters. The readers reject other C0 characters
at the print instruction. A NUL in a C format string would truncate the output.

## Verification

```sh
javac --release 8 -encoding UTF-8 -g -d examples/programs/binary examples/programs/binary/StackArithmetic.java
node bin/universal-translator.js translate jvm-class python examples/programs/binary/StackArithmetic.class
cargo build --bin universal-translator
JVM_RUST_TRANSLATOR=./target/debug/universal-translator node experiments/issue-16-jvm-class.mjs 8 17 21
```

The verifier compares Java output with the generated JavaScript, Python, C
and WebAssembly text. It checks the committed Java 8 class and separately
compiled Java 8, 17 and 21 classes. Every target is read once from a file and
once from standard input. The fixture exercises signed division, remainder,
zero, local writes, a two-slot `long`, and a modified UTF-8 string containing
both `é` and a surrogate pair for `😀`. Both unit suites test truncated input,
unsupported versions and opcodes, mismatched stack types, overflow and an
embedded modified UTF-8 NUL. CI runs the JavaScript native comparisons for
Java 8 and 17, and both engines' unit suites read the same committed class.
[Native execution transcript](logs/jvm-class-native.txt)

Control flow, runtime inputs, exceptions, full-width wrapping and traps,
other class members and newer class versions remain open. Successful binary
readings still lack instruction-level source regions.
