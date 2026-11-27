# Comment translation and concrete layout

Changing comment words used to change code layout through four paths. Natural
and machine sources missed the in-place translation path. Layout alignment
included comment words when choosing code anchors, so changing their spelling
could change the code matches even after comments were matched separately.
Partial translation reapplied layout to an already preserved source, changing
mixed LF/CRLF endings. Finally, machine comment scanning lacked native quote
and block-comment marks.

JavaScript and Rust now select code anchors independently of comments. Natural
notes use logical sentence boundaries, so a note-looking line inside quoted
multiline text remains literal. Machine comments use native markers, quoted
strings and nested WebAssembly comments. In-place replacement preserves markers,
indentation, trailing spaces, blank lines and line endings. Partial translation
still calculates mappings, without respacing an in-place comment replacement.
Unterminated machine block comments are rejected, including an unclosed outer
WebAssembly comment whose inner comment has closed.

## Reproduction and verification

Run the finite audit:

```sh
node --max-old-space-size=512 experiments/issue-16-comment-whitespace.mjs --before
node --max-old-space-size=512 experiments/issue-16-comment-whitespace.mjs
```

The `--before` mode loads translation/layout stages from `eeb793d`, retaining
their current dependencies. It avoids a checkout, dependency installation or
build. Across 111 imperative reader families and 551 same/cross-language cases,
the old stages fail 81 assertions: 79 same-language layout comparisons and two
comment-toggle comparisons (R to Python and Bash). The corrected stages pass
all 551 cases. Inputs contain paragraph gaps, leading/trailing blank lines and
CRLF; generated runtime headers retain their own concrete bytes. These finite
fixtures establish the named behavior, rather than complete grammar coverage.

Automated regressions are `js/tests/comment-whitespace.test.js`,
`rust/tests/comment_whitespace.rs`, and the R-to-Bash tests in both layout test
files. They check raw comment translation and partial translation through all
111 imperative families, an additional SQL query, multiline natural literals,
Unicode offsets, native machine quotes and nested/unterminated comments. The
focused checks pass: 66 JavaScript tests and 17 Rust tests, plus ESLint and
Clippy. Logs and audit JSON are archived in `logs/comment-whitespace-*`.

For browser reproduction, start the existing Vite development application,
generate MCP code with
`node experiments/issue-16-comment-whitespace-browser.mjs`, then pass that file
to Playwright MCP `browser_run_code_unsafe`. It serves only the previous two
stages for the before capture, restores the current stages for the after
capture, and asserts the actual translated text before each screenshot. In the
R-to-Bash example, the blank line after the first translated comment was lost
and is now retained. Source/target colour groups remain aligned. The browser
is closed after verification.

Before:

![missing blank line](../../screenshots/issue-16/comment-whitespace-before.png)

After:

![preserved blank line](../../screenshots/issue-16/comment-whitespace-after.png)

Broader grammar-production review remains open under requirement 16.2. The
audit also exposed separate reader questions requiring their own regressions:
generated PHP/Rocq headers with altered leading whitespace/line endings.
The separate Perl print failure is fixed and documented in `PRINT-EXPRESSIONS.md`. The finite audit
keeps valid generated headers intact and uses a simple variable print; it does
not count those unrelated failures as resolved.

## Native nested comments

The next grammar review found another shared root: the formal lexer stopped at
the first closing marker. In Rust, Kotlin, Swift, Dart, Scala, Julia, Nim, Lean
and Rocq, that marker can close an inner comment. Words after it were left
untranslated, concrete spans ended early, and an unclosed outer comment was
accepted. The semantic and layout scanners now share an iterative depth counter
and language-specific nesting metadata. WebAssembly uses the same scanner.
Languages whose comments do not nest retain their original rule.

Rocq additionally interprets string literals inside comments. Its scanner ignores
comment markers inside quoted strings, including doubled quotes, and rejects an
unclosed comment string. Other grammars continue to treat quotes inside comments
as ordinary text. The relevant primary manuals are archived with URLs and SHA-256
checksums in `data/prior-art/comment-grammars/manifest.json`. In particular,
[Rocq's lexical conventions](https://github.com/rocq-prover/rocq/blob/master/doc/sphinx/language/core/basic.rst)
describe both nesting and embedded strings; the other nine sources establish
their native nesting rules.

Reproduce without a checkout or source build:

```sh
node --max-old-space-size=512 experiments/issue-16-nested-comments.mjs --before
node --max-old-space-size=512 experiments/issue-16-nested-comments.mjs
```

The old lexer at `bb3785c` fails 29 of 34 finite checks; the corrected public
comment translator and lexer pass all 34. The before mode loads the old lexer
with current dependencies and applies the same deterministic word replacements
to its comment spans. This isolates lexical boundaries from natural-language
vocabulary. The shared JS/Rust regressions also assert full comment spans,
layout-token boundaries and correct rejection. Concrete-source tests parse a
complete Rust program with nested comments and Unicode, retaining every UTF-8
byte as one complete comment token. Focused verification passes 26 JavaScript
tests, 21 Rust tests, ESLint and Clippy. The chunk-dependency regression passes;
the shared scanner belongs to the existing source-processing chunk.

Evidence is in `logs/nested-comments-{audit-before,audit-after}.json`,
`logs/nested-comments-{js,rust}-final.txt`, and the matching lint/Clippy logs.
The broader grammar-production review and the separate reader questions above
remain open.
