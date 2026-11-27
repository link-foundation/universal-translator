## Summary

Fixes #16
Fixes #1
Fixes #2
Fixes #10
Fixes #6
Fixes #8
Fixes #12
Fixes #14

This draft addresses translation correctness and the unfinished requirements inherited from earlier issues. **The full acceptance criteria are not yet met; keep this PR unmerged while implementation continues.**

Implemented and checked so far:

- Explicit meta fields distinguish conditions, bodies, expression statements, operands and arguments in JavaScript and Rust.
- Correcting the source language preserves the original source. The footer has Source code and Report issue links; the report includes source, result, detected language, options, rules and errors.
- Translated comments preserve the following blank line. Multiline comment tokens contribute every covered line to the map.
- Powers inside interpolation retain the entire expression, with right association and grouping. Unread interpolation tokens raise an error. Power support across every target remains unfinished.
- JavaScript const array bindings with mutating calls become mutable Rust containers.
- An isolated ambiguous name such as `c` parses as English and ranks first on a tie.
- Russian boolean objects and comparison referents share grammatical-case rules; sequence and iteration vocabulary is available in all 30 natural languages.
- Java method/parameter annotations, nested generic types, and continued fluent calls survive translation. The Spring example translates to Python and its small framework doubles verify the 201 response.
- C++ typed throw/catch values retain their meaning in Python and JavaScript, including nested rethrows. The exact issue example compiles and exits with status 8 in all three runtimes.
- Default formal, natural and machine readers retain lossless concrete source records, with UTF-8 byte offsets and exact reconstruction in JavaScript and Rust. Partial parsing also preserves malformed input, trivia-only input and CRLF; accepted fragments and unread ranges are separate.
- Source ownership follows semantic nodes through parsing, rewrites, all seven machine instruction formats and lifting. The complete Java Fibonacci interpolation maps to both the Bash call and echo, and both map back to the Java print without colouring the loop. All 30 controlled natural languages map statements in both directions. Partial recovery combines maps across valid fragments, failure notes and custom prose that splits into several output lines.
- JavaScript and Rust grammar workspaces import and execute nine formats, preserve concrete syntax/provenance, update sources and dependencies, merge equivalent rules with stable identities, retain separate editions, apply six transform stages and install semantic readers into translation. The browser-safe `/grammar` entry, public types, bounded recovery and runnable example are verified.
- The case study archives all issue/PR discussions, eight attachments, 22 compressed solver logs, local/CI evidence, root-cause analysis and primary-source architecture research. The Rust package includes the new regression fixtures.

Still being implemented: exact subline mapping and comment headers, the reported gutter artifact, agreement throughout all natural languages and comments, full operator coverage, remaining exception targets, questions/introspection/SQL/LINQ, complete upstream grammar production/semantic coverage and faithful feature lowering, and every inherited coverage gap. Passing CI for the completed pieces does not establish completion of those criteria.

## Reproduce and verify

- Source corruption: paste the C++ try/catch example from issue 16, then correct the source selector to C++. Before this change the source becomes error comments; afterward it stays byte-for-byte intact and translates to executable Python.
- `console.log(`${2 ** 10}`);` from JavaScript to Python must retain `2 ** 10`.
- Translate `// Привет`, a blank line, and `console.log( "Hello World!");` to Python with English comments: the blank line and the space before the string remain.
- Translate a const JavaScript array followed by `.push(3)` to Rust: its declaration uses `let mut`.

Automated checks include `js/tests/issue-16.test.js`, `annotations.test.js`, `exceptions.test.js`, `concrete-syntax.test.js`, `natural-wordings.test.js`, `issue-report.test.js`, `universal-app-editors.test.js`, the web end-to-end suite, `grammar-workspace.test.js`, and matching focused Rust targets. The grammar adapter has 13 JS/Deno tests and nine Rust tests; TypeScript and Deno check the public type example, the browser executes the adapter, and the production web build passes. Run `node examples/translation/verify-exceptions.mjs` for native C++/Python/JavaScript exit-status verification and `python3 examples/translation/spring/verify.py` for the Spring example. One Changeset prepares the next release.

At `34cad04`, Node, Bun, Deno, web, security and link checks pass. Rust failed because its server suppressed semantic maps for natural/machine requests (`ci-rust-34cad04.txt:1304–1307`). Commit `28bd803` repairs that condition and adds HTTP/parity regressions, which pass locally. The later archive commit `4cb1de8` failed lint because three preserved experiments had unformatted code (`ci-lint-4cb1de8.txt:282–311`); `1601592` formats them and splits an oversized test group, with focused lint and server tests passing. Current grammar CI will run after this push. The earlier Rust trace expectation failure after adding machine concrete records is repaired by `157ae86` and its focused regression passes. Focused semantic mapping, partial recovery, concrete syntax, lint, format and Clippy checks pass. The circular web chunk issue is repaired and the example-app workflow passes.

## Browser evidence

Before correcting the source language:

![before](https://github.com/link-foundation/universal-translator/blob/issue-16-fb080613587e/docs/screenshots/issue-16/source-correction-before.png?raw=true)

After correcting the source language; the footer also contains the reporting and source links:

![after](https://github.com/link-foundation/universal-translator/blob/issue-16-fb080613587e/docs/screenshots/issue-16/source-correction-after.png?raw=true)

The issue's C++ example translated to executable Python:

![typed exception translation](https://github.com/link-foundation/universal-translator/blob/issue-16-fb080613587e/docs/screenshots/issue-16/exceptions-after.png?raw=true)

The Java print statement and its two Bash lines share a colour group:

![semantic source mapping](https://github.com/link-foundation/universal-translator/blob/issue-16-fb080613587e/docs/screenshots/issue-16/semantic-mapping-after.png?raw=true)
