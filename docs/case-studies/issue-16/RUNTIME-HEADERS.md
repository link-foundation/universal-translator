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

The following mode-switch extension replaces the earlier unsupported-text
diagnostic with semantic literal-output reading. Complete PHP grammar coverage
remains under the wider inventory.

## Vocabulary CI integration

The full Node/Bun/Deno run at `6790c7b` found an obsolete Rocq vocabulary
expectation, rather than a translator regression. The block-comment and
concatenation vocabulary previously appeared ineffective because the ordinary
fragment reader already failed on a comment before its runtime header. With
successful ordinary reading, changing either vocabulary concept affects the
result as intended. `vocabulary-effect.test.js` now expects those working
concepts; the targeted test passes. Failed CI job logs and original responses
are archived under `logs/ci-*-6790c7b*`.

## PHP markup, repeated modes and comment tags

The original close-tag reader stopped at the first `?>` and rejected following
text. Both lexers now alternate between code and literal output, recognize
`<?=` as an echo expression, and treat a closing tag as a statement terminator.
Mode changes retain the surrounding block scope, so markup inside a conditional
or a loop keeps its control flow. Strings and block comments retain literal
tag text. PHP `//` and `#` comments stop at a closing tag as the native tokenizer
does; tag-like text in markup is not a comment to translate.

Native round-trip verification found a separate writer error: emitting a PHP
block comment containing `?>` as a line comment makes PHP output the remaining
source text. Both writers now use a block comment when its contents include
`?>`. A foreign `*/` in that same comment becomes `* /`, following the existing
failure-note comment escaping convention. In-place comment translation still
keeps all source bytes outside translated words.

```sh
node experiments/issue-16-php-modes.mjs --before
node experiments/issue-16-php-modes.mjs
node experiments/issue-16-php-modes.mjs --regions
node experiments/issue-16-php-comment-tags.mjs --before
node experiments/issue-16-php-comment-tags.mjs
node examples/runtime-headers/verify-native.mjs
```

The old reader from `bb09ccd` fails all 15 finite mixed-markup/mode cases. The
current reader has exact native output for all 15. The native example compares
24 original PHP documents with generated Python, restored PHP and direct
PHP-to-PHP output, then checks the independent Python comment example through
PHP and back. It also retains all six Rocq checks. The old comment writer prints
source text instead of the expected three lines; the corrected writer has exact
output. Before/after JSON and the initial failed native round-trip log are
preserved in `logs/php-modes-*` and `logs/php-comment-tags-*`.

Matching JS/Rust regressions check semantic round trips, concrete reconstruction,
partial comment translation, actual token line numbers, tagless snippets, and
distinct UTF-8 regions for markup and code. The shared 15-case fixture is in
`examples/runtime-headers/php-modes.json` and included in the Rust package.
Tagless snippets retain implicit code mode, including strings containing tag
text. Markup-leading documents start in output mode. Arbitrary plaintext-leading
files need explicit document/snippet disambiguation; short `<?` tags depend on
PHP configuration and are not enabled by this reader. Alternative block syntax,
attributes and complete PHP expressions remain open grammar coverage.

The PHP mode extension passes 23 focused JavaScript tests and 23 Rust tests,
ESLint and Clippy. Native verification passes all 24 PHP documents, the separate
foreign-comment example and all six Rocq layouts.
