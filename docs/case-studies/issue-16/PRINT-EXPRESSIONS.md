# Perl print expressions

The comment/layout audit exposed a separate executable-semantic failure. Given
`print((2 + 3) * 4)` in Python, the old Perl writer emitted
`print (2 + 3) * 4 . "\n";`. Perl treats the first parentheses as the complete
argument list of `print`: it prints `5`, then multiplies the return value of
`print`. The newline is also outside the arguments. Even `print(1 + 2)` lost its
newline. The generated source reread as an evaluation rather than a print node.

Both writers now enclose the complete argument expression:
`print((2 + 3) * 4 . "\n");`. This preserves arithmetic grouping, concatenation,
and the optional trailing newline. The official [Perl print reference](https://perldoc.perl.org/functions/print)
documents this argument-list rule; its page and the operator reference are
archived with URLs and checksums in `data/prior-art/perl-print/manifest.json`.

## Reproduction and verification

```sh
node experiments/issue-16-perl-print.mjs --before
node experiments/issue-16-perl-print.mjs
node examples/printing/verify-native.mjs
```

The finite audit loads only the old emitter from `951c620`, retaining current
dependencies. Eight prints exercise addition, grouped multiplication, powers,
function calls, a negative number, text interpolation and `end=""`. The old
program exits successfully but produces incorrect output, emits warnings and
fails semantic rereading at `/main/statements/0/kind`. The corrected program
has exact expected output bytes, no warnings and no semantic difference.

The reusable example executes original Python, generated Perl and restored
Python with a bounded 64 KiB output buffer. It runs in the existing native CI
translation step without increasing that step's time budget. Matching regressions
are `js/tests/print-expressions.test.js` and the focused Perl test in
`rust/tests/translation.rs`. The shared program and fragment golden checks pass;
22 generated Perl programs and four generated fragments have updated spelling.
ESLint and targeted Clippy pass. Evidence is in `logs/print-expressions-*`.

This fixes this print argument failure. The wider operator and language-semantic
inventory in requirement 16.7 remains open.
