---
'@link-foundation/universal-translator': minor
---

The meta language has a standard library: printing a line, printing
without a newline and taking the length of an array are calls to the
library procedures `print-line`, `print` and `length`
(`Call { callee, library: 'standard', arguments }`). They are no longer
special parts of the language. The meta view (`formatMeta`, the `meta`
command of both CLIs) shows a program in this general form. It writes a
statement that only evaluates a call as the call itself
(`call print-line (library standard)`). `generalize` and `specialize`
(Rust: `meta::library`) move a program between the general form and the
concepts the emitters use. `fromMeta` / `from_meta` accept a program in
either form and fill in missing empty lists and types.
