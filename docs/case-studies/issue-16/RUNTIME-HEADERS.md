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

## PHP outside whitespace

PHP whitespace before an opening tag is output, rather than ordinary source
layout. The previous reader either failed on the tag or silently dropped
whitespace after a closing tag. Both readers now represent that whitespace as
literal print statements, preserving LF/CRLF, tabs and exact output bytes.
The first newline immediately after `?>` is consumed according to PHP's grammar;
remaining whitespace is output. Opening tags are case-insensitive and require
PHP's native separator characters. A lookalike such as `<?phpecho` is literal
output, as is a tag followed by formfeed or a nonbreaking space.

The primary [PHP tags](https://www.php.net/manual/en/language.basic-syntax.phptags.php)
and [escaping from HTML](https://www.php.net/manual/en/language.basic-syntax.phpmode.php)
manual pages are archived with URLs/checksums in `data/prior-art/php-tags/`.
The finite `experiments/issue-16-php-tags.mjs` probe asks native PHP's tokenizer
which separators open code; it is bounded to eight strings and 32 MiB.

```sh
node experiments/issue-16-php-output.mjs --before
node experiments/issue-16-php-output.mjs
node examples/runtime-headers/verify-native.mjs
```

The old-reader audit loads three reader modules from `69a91ce` with current
dependencies. Seven of nine native cases fail: lost output whitespace, failed
leading tags and misread lookalike tags. The current reader passes all nine.
The native example also compares direct PHP-to-PHP output and PHP-to-Python-to-PHP
round trips. It runs under the existing native CI step. The JS regression checks
semantic rereading, concrete reconstruction and partial comment translation;
Rust has matching coverage in `runtime_headers.rs`. Focused checks pass:
24 JavaScript tests, 26 Rust tests, ESLint and Clippy. Evidence is in
`logs/php-output-*`. This also formats the newly registered Rocq test target.

This change handles the known outside-whitespace failure. General mixed HTML,
repeated PHP mode changes and short echo tags remain part of the broader
language-grammar inventory; existing unsupported-text diagnostics are retained.
