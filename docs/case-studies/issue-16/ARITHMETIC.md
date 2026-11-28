# Integer arithmetic audit

This work in [PR 17](https://github.com/link-foundation/universal-translator/pull/17)
continues requirement 16.7. Complete operator and numeric semantics across the
requested languages remain open.

## Grouped operands inside division wrappers

C's `(7 + 5) / (1 + 3)` previously translated to
`Math.trunc(7 + 5 / 1 + 3)`, printing 15 rather than 3. Perl `int(...)`, PHP 5's
integer cast and other wrapper writers shared the same fault. The shared
JavaScript and Rust emitters calculated correctly grouped operand strings, then
recomputed both operands at the lowest precedence when adding the wrapper.

Both engines now reuse the division's grouped operands inside its wrapper.
Additive numerators/denominators, multiplicative denominators, nested quotients
and negation keep their operation trees. Function-call and method division
spellings retain their existing argument boundaries.

The [ECMAScript multiplicative grammar](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-multiplicative-operators)
places multiplication/division above additive expressions;
[Math.trunc](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.trunc)
then truncates the resulting quotient toward zero. Perl's
[int reference](https://perldoc.perl.org/functions/int) specifies truncation toward
zero and documents floating-point limitations. Primary pages are compressed
and checksummed in `data/prior-art/arithmetic/manifest.json`.

`examples/arithmetic/division.c` contains ten finite quotients. Its expected
output is independent in `division.txt`. To reproduce:

```sh
node experiments/issue-16-division-wrappers.mjs --before
node experiments/issue-16-division-wrappers.mjs
node examples/arithmetic/verify-native.mjs
```

The experiment substitutes only the shared JavaScript writer from `e1d4cfb`:
all five native target configurations produce incorrect output. The corrected
writer has zero failures. The native example compiles original C and compares
exact output with Node, ES5, TypeScript, Perl and PHP's emitted integer-cast
syntax. It runs in the existing native CI budget.

Matching JS/Rust tests also round-trip all ten quotients through every current
wrapper grammar: JavaScript, ES5, TypeScript, Perl, PHP 5, Lua 5.1 and MATLAB.
The focused real-number suites pass (eight JS tests, ten Rust tests), as do
lint and Clippy. Evidence is in `logs/division-wrappers-{before,after}.json`
and `logs/division-wrappers-{js,rust,native,lint,clippy}.txt`.

## Floor division and signed remainders

The old shared `divide` and `remainder` concepts erased native rounding rules.
For example Python's `-7 // 3` is -3 and `-7 % 3` is 2, while C's integer `/`
and `%` give -2 and -1. The wrong shared representation round-tripped through
our own readers even when executing the output changed the answer.

Both engines now distinguish truncating `divide`, downward `floorDivide`,
dividend-signed `remainder` and divisor-signed `modulo`. Python, Ruby, Lua and R
have floor division; those four and Perl have divisor-signed modulo. The
[Python expression reference](https://docs.python.org/3/reference/expressions.html#binary-arithmetic-operations),
[Ruby Integer reference](https://docs.ruby-lang.org/en/master/Integer.html),
[Lua arithmetic reference](https://www.lua.org/manual/5.4/manual.html#3.4.1),
[R arithmetic reference](https://stat.ethz.ch/R-manual/R-devel/library/base/html/Arithmetic.html)
and [Perl operator reference](https://perldoc.perl.org/perlop#Multiplicative-Operators)
document these distinctions. Their complete archived pages and checksums are in
the arithmetic manifest. Perl's integer pragma is outside this verified profile.

Four small shared meta algorithms lower only operations a target lacks. Their
arguments are evaluated once. Readers recognize the complete algorithm after
type inference, with fresh names and guards against changed bodies, duplicate
definitions, rebinding, escaping and invalid arities. Helper definitions retain
their concrete source records. These are compositional operator algorithms;
they do not match whole example programs. Real `/` in Ruby and Python 2 remains
true division; unsupported real floor/modulo lowering reports an explicit error.

The bounded reproduction covers 28 signed operand pairs and 168 independently
executed results. At `e49d979`, 46 results differ from native Python or C; the
new implementation has zero differences. Run:

```sh
node experiments/issue-16-integer-rounding.mjs
node experiments/issue-16-rounding-grammars.mjs
node examples/arithmetic/verify-rounding.mjs
```

Evidence is in `logs/integer-rounding-{before,after}.json`. The grammar inventory
passes 222 source/target pairs: two source contracts through all 111 imperative
reader families, including all 71 natural grammars and seven machine formats.
SQL rejects these imperative programs explicitly and is reported separately.
These structural round trips do not establish native behavior for every target.

The independent native examples contain 32 output lines each, covering signed
quotients and residues, exact divisibility, zero numerators, compound updates
and single evaluation of effectful arguments. Original Python and compiled C
agree with 23 available generated configurations (736 output lines). Lua is
unavailable locally and is required in the existing native CI step. Three
C-to-JavaScript/ES5/TypeScript configurations expose the separate signed-zero
gap below and are not counted as passing. The verifier requires every configured
executable in CI; its explicit signed-zero exclusion remains visible until fixed.

All seven machine formats now preserve the helper algorithms. The LLVM test
found that a dead structural stack reload was incorrectly treated as an unused
ordinary load: its emitted drop consumed a preserved stack value. Both LLVM
readers now retain the stack marker without adding that drop. The targeted trace
is `experiments/issue-16-rounding-llvm.mjs`; the cross-machine regression lives
in both `integer-arithmetic` test suites.

Old Python/Ruby/Perl example expectations also conflated signed modulo with C/JS
remainder. Their golden translations now include the required arithmetic
helpers. Tests of hand-written positive-input examples compare their actual
native arithmetic contracts rather than falsely declaring full signed equivalence.

## Effectful operand order

Python evaluates expressions from left to right. C11 permits either order for
call arguments and most binary operands. Its comma operator sequences its left
operand before its right operand. [Python expression reference](https://docs.python.org/3/reference/expressions.html#evaluation-order) · [C11 draft §§6.5.2.2, 6.5.17](data/prior-art/arithmetic/c11-n1570.pdf)

Both engines now sequence typed scalar operands of Python calls and binary
operators translated to C, C++ or Objective-C when more than one operand is
nonliteral and an operand may have effects. Assignments to fresh temporaries
run within the original expression. In a loop test or a short-circuited branch,
the assignments therefore run only when the expression is evaluated. A C-family
reader retains explicit sequences in meta, so translating through another
C-family target retains the order. Writers with left-to-right operand evaluation
recover the compact form from the generated sequence when each temporary is
private to that sequence and its assignment preserves its type.

```sh
node experiments/issue-16-evaluation-order.mjs --without-source-order
node experiments/issue-16-evaluation-order.mjs
node --test js/tests/evaluation-order.test.js
cargo test --locked --test evaluation_order
```

The comparison without the sequencing pass reverses observable markers in
both GCC and G++ at `-O0` and `-O2`. With the pass, both optimizations match all
19 CPython output lines for C, C++, Objective-C, and the Python→C→C++ chain.
The native CI job uses the same example under `examples/arithmetic/`.
[Native results](logs/evaluation-order-native.txt) · [Comparison output](logs/evaluation-order-without-source-order.jsonl)

## Signed zero in JavaScript targets

JavaScript truncation and exact negative remainders can produce observable
`-0` where a C integer result is `0`. The C-family adaptation adds positive
zero after these integer operations when they can produce negative zero. This
evaluates each operand once and leaves divisions such as `7 / 2` uncluttered.
The real literal writers preserve `-0.0` so a real division continues to yield
negative zero. JavaScript-origin operations retain their source behavior.

`node examples/arithmetic/verify-rounding.mjs` now includes JavaScript, ES5
and TypeScript for the 32-line C integer comparison and checks real negative
zero in the original C program and all three targets. Before the repair, the
first target printed observable `-0` in the integer comparison. The shared
arithmetic tests verify the source-specific rule in both engines.

## Remaining semantic review

Evaluation order for additional source and target families, addressable values,
and arbitrary comma expressions outside the C family remains open.

Numeric widths, overflow, zero divisors, real floor/modulo, floating-point
rounding, Perl integer mode and additional operators remain in the acceptance
inventory. The finite tests above do not establish those criteria.
