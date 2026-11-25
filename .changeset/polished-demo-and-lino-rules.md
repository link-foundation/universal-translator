---
'@link-foundation/universal-translator': minor
---

Rules as indented Links Notation, a plainer meta view and a polished web demo.

- `formatMeta` (and `meta` in both CLIs) writes one line per node with its children nested under it: no field labels such as `condition:` or `value:`, no `block`/`statements` lines, and `otherwise` before the second branch. `--json` keeps the full structure.
- Rules are indented Links Notation (`readRules`, `formatRules`; `read_rules`, `format_rules` in Rust). The CLIs' `--rules` and the server take it; JSON is still read.
- The web demo:
  - keeps the title, the pickers and the inputs in place whatever the text, and gives both panes the same height;
  - has an optional Monaco editor, and colours both panes from the meta language of their text;
  - has a word wrap switch, a Rules tab with rules as Links Notation, and "How it works" below the translator;
  - stores rules, standards and word standards as Links Notation (JSON saved earlier is still read);
  - applies skins in the dark scheme too, with their corners, opacity and blur;
  - writes what it does to the console with `?debug`.
