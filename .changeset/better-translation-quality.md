---
'@link-foundation/universal-translator': minor
---

Better translation quality (issue #8):

- Natural languages read more comparison wordings, for example `меньше или равно`, `больше либо равно`, `at most`, `<=` and `≤`. Python `pass` reads as "do nothing".
- Translation is partial by default. Untranslated parts are marked with their errors, and `--all-or-nothing` (`allOrNothing` in the server) keeps the old behaviour. The new `parsePartial` and `coverage` count the lines a text reads.
- `detectLanguage` and the `auto` source language find the source language. The CLI also has a `detect` command.
- Translation rules can be given as data at every stage (`source`, `templates`, `names`, `output`), through `createTranslator({ rules })`, `--rules file.json` or the server.
- The web demo auto-detects the source language, lists untranslated parts and has a visual rules editor.
- `scripts/rosetta-code.mjs` measures coverage over every Rosetta Code task.
- A cut text no longer makes a dialect reader loop forever.
