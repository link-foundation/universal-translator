---
'@link-foundation/universal-translator': minor
---

Translations keep the layout of their source (issue 14).

- Partial translation between programming languages (the default of both CLIs, the server and the web demo) keeps the spaces inside lines, the indentation step, the blank lines, the blank lines around the code and the line ends of the source wherever the target has the same tokens, and returns `lineMap` (Rust: `line_map`), the `[source line, target line]` pairs of the translation. `--layout target` (`layout: 'target'`, `TextLayout::Target`) writes the emitter's layout instead.
- `POST /translate` takes `layout` and answers `lineMap`.
