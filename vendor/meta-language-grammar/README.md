# Meta Language grammar runtime

This directory contains the grammar and Node CLI dependency closures from
[Meta Language](https://github.com/link-foundation/meta-language) at the commit
recorded in `SOURCE.json`. That commit is also the source of the published Rust
`meta-language = 1.0.0` dependency. [Upstream issue 230](https://github.com/link-foundation/meta-language/issues/230)
tracks publishing the compatible JavaScript release to npm.

The source files retain their upstream license and formatting. The browser
grammar workspace uses the same grammar modules with a browser-compatible
SHA-256 implementation. The Node CLI loads the source syntax and portable
program modules on demand. It uses the pinned upstream grammar data, WebAssembly
parsers and matching runtime with their bundled licenses. The grammar notice
links to parser patches at the pinned upstream commit. [Parser notice](src/vendor/grammars/NOTICE.md)

The bundled JavaScript emitter encodes constructor tags and theorem messages
as complete string literals. A fixed BigInt clamping helper receives the source
expression as an argument.

Run `node scripts/update-meta-grammar.mjs --check` to verify every recorded file.
Run `node scripts/update-meta-grammar.mjs FULL_COMMIT_SHA` to retrieve a reviewed
upstream revision and reapply the recorded patches. Review new imports
and run the grammar/workspace regressions before committing an update. The
manifest records both original and patched SHA-256 digests.

Formatting, duplication and line-size rules exclude these external sources.
The digest gate detects local edits; our adapters, tests and update script
remain subject to normal repository rules.
