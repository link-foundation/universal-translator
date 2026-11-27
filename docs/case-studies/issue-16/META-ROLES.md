# Explicit child roles in readable meta notation

Issue 16 asks that the meta view distinguish conditions from actions and
expressions from statements. Both engines name every child field; an expression
used for its effect remains inside an `evaluate` statement. A field names a plain
block's role, while an annotated block keeps its own node and metadata.

The final cross-family audit found two remaining problems. JavaScript and Rust
ordered `object` and `documentation` children differently, and both flattened
annotated blocks as if their only field were `statements`. This lost block labels,
comments and extension fields from the readable view. Both formatters now share
35 ordered roles, retain annotated blocks and sort unknown fields by name.

Four language-neutral fixtures under `examples/translation/meta-roles/` pair
handwritten JSON with exact Links Notation. They cover nested control flow,
expression statements, return/throw, exception branches, parameters,
documentation, scoped queries, introspection, messages, block expressions,
collection updates, mixed prose/code and extension fields. Neither formatter
mutates the input.

`node experiments/issue-16-meta-roles.mjs` demonstrates both defects against
commit `a3cee36` and verifies the corrected output. The preserved result is
`logs/meta-roles-before-after.txt`.

`js/tests/meta-roles.test.js` and `rust/tests/meta_notation.rs` verify the same
four fixtures independently. They also write and read a nested condition/action
program through all 111 current imperative, natural and machine grammars, then
compare its visible roles. The standalone finite audit is
`experiments/issue-16-meta-families.mjs`; its result is
`logs/meta-roles-families.txt`. Focused formatter checks pass in both engines
(`logs/meta-roles-js.txt` and `logs/meta-roles-rust.txt`). This verifies the notation
criterion; it does not establish semantic coverage of unimplemented language
productions elsewhere in the inventory.
