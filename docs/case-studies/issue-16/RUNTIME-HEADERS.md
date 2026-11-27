# Runtime headers and native layout

The Rocq lexer skipped generated helper definitions only when their complete
source text matched the runtime header byte-for-byte at offset zero. Leading
blank lines, CRLF, tabs or a comment made it read the helper definitions as user
functions and fail. The fast path also omitted the header's newlines from token
line numbers. Source offsets were retained, but diagnostic line numbers were wrong.

Both engines now recognize the known runtime by its complete token sequence.
Layout and comments may vary; identifiers, operators, quotes, interpolation
style and literal values must match. Changed definitions are not silently
trusted. Header comments retain their tokens and source ranges, including for
in-place comment translation. The exact-text fast path now counts the header's
newlines. This continues the known-runtime contract; arbitrary Rocq helper
libraries still require semantic reading under the broader inventory.

Rocq's [lexical conventions](https://github.com/rocq-prover/rocq/blob/master/doc/sphinx/language/core/basic.rst)
establish its whitespace and comment rules. The primary source is archived
under `data/prior-art/comment-grammars/`.

## Reproduction and verification

```sh
node experiments/issue-16-runtime-headers.mjs --before
node experiments/issue-16-runtime-headers.mjs
node examples/runtime-headers/verify-native.mjs
```

The finite audit loads the old lexer from `08e200c` with current dependencies.
All six cases fail either token-content or actual-line-number checks; the current
lexer passes. The full translator regression fails before the change on the
leading-CRLF case with `Expected ":" but found "State" (line 12)`.

The native example compiles six layouts sequentially with Rocq and compares exact
output against original Python and restored Python. Temporary compiler artifacts
are removed. The same example runs within the existing native CI budget.
`js/tests/runtime-headers.test.js` and `rust/tests/runtime_headers.rs` check semantic
identity, lossless UTF-8 reconstruction, actual line numbers, partial comment
translation and rejection of modified helper values. The focused JavaScript
header/comment/concrete checks pass (14 tests), as do the matching Rust targets,
ESLint and Clippy. Evidence is preserved in `logs/runtime-headers-*`.

The separate PHP opening-tag failure remains under investigation. Whitespace
before a PHP tag is emitted text and must retain its runtime effect.
