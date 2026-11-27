# Meta Language grammar runtime

This directory contains the grammar-only JavaScript dependency closure from
[Meta Language](https://github.com/link-foundation/meta-language) at the commit
recorded in `SOURCE.json`. That commit is also the source of the published Rust
`meta-language = 1.0.0` dependency. The installed JavaScript release, 0.46.0,
does not yet expose these grammar import/execution APIs.

The source files retain their upstream license and formatting. The only local
patch replaces Node's SHA-256 call with the browser-compatible `@noble/hashes`
implementation; merge fingerprints remain identical. No built-in corpus,
language model, native binary or generated concept database is included.

Run `node scripts/update-meta-grammar.mjs --check` to verify every recorded file.
Run `node scripts/update-meta-grammar.mjs FULL_COMMIT_SHA` to retrieve a reviewed
upstream revision and reapply the explicit portable patch. Review new imports
and run the grammar/workspace regressions before committing an update. The
manifest records both original and patched SHA-256 digests.

Formatting, duplication and line-size rules exclude these external sources.
The digest gate detects local edits; our adapters, tests and update script
remain subject to normal repository rules.
