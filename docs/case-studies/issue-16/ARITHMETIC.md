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

## Remaining semantic review

Grouping is independent of rounding mode. The current shared integer-division
concept claims truncation, while Python `//`, Ruby integer `/`, Lua `//` and R
`%/%` round downward. Their negative-operand behavior requires separate semantic
representation and native tests. Remainder/modulo signs, numeric widths,
overflow, zero divisors, floating-point rounding and additional operators also
remain in the acceptance inventory. The wrapper fix does not establish those
criteria; the Lua/MATLAB round trips above check grammar and operation grouping,
while native behavior is verified only for the listed executable targets.
