# formal-ai tryout on universal-translator tasks

Requested in issue 14: try [formal-ai](https://github.com/link-assistant/formal-ai) on small real tasks of this repository and report failures upstream.

## Version tested

- formal-ai 0.357.2, release binary `formal-ai-cli-x86_64-unknown-linux-musl` (source commit b9b4a0a52), Linux x86_64.
- Chat tasks: `formal-ai chat --prompt ...`. Code and discovery tasks: `formal-ai serve --agent-mode` (with `FORMAL_AI_AGENT_MODE=1`) driven by a minimal OpenAI tool loop (`drive.py` in the gist) that advertises `shell`, `bash`, `read_file`, `list_dir`, `write_file`, `edit_file`, `grep`, `glob`. Edits were made on copies of the files, not in this repository.

## Results

| #   | Task                                                                | formal-ai result                                                                                                                                                                                                             | Result | Correct answer                                                                                                                                                           |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Which file implements the layout pass that keeps whitespace?        | Chat and agent: gap message "does not expose the required `shell` tool" (tool was advertised); with "Find the file ... in this repository" only `ls`; with "Search the repository" a grep for the whole sentence, no matches | fail   | `js/src/translation/layout.js` and `rust/src/layout.rs`                                                                                                                  |
| 2   | List the CLI commands of `bin/universal-translator.js`              | Gap message naming `read_file`/`shell` as missing although advertised; no tool call                                                                                                                                          | fail   | add, multiply, translate, translate-program, meta, coverage, detect, encode-source, decode-source, encode-cst, decode-cst, languages, check-words, serve (from `--help`) |
| 3   | Rename `foldChanges` to `foldingChanges` in `editor-sync.js` (copy) | `read_file`, then `perl -pi -e 's/\bfoldChanges\b/foldingChanges/g'`; lines 113 and 261 changed, `node --check` passes                                                                                                       | pass   | same diff                                                                                                                                                                |
| 4   | Add a JSDoc comment to `scrollToPosition` (copy)                    | Asks "What exact text should go into editor-sync.js"; variants: "Left unchanged"; nothing changed                                                                                                                            | fail   | `/** ... @param ... */` block above the function                                                                                                                         |
| 5   | JS function returning the sum of squares of an array                | `Which integer range should the program use?`; `sumOfSquares(arr)` form: "no synthesis route reaches task"                                                                                                                   | fail   | `values.reduce((t, v) => t + v * v, 0)`                                                                                                                                  |
| 6   | Translate `print(1 + 2)` from Python to JavaScript                  | `"print(1 + 2) from Python"`; `formal-ai translate` has no Python (rust/js/ts/meta only) and `js -> rust` echoes the input                                                                                                   | fail   | `console.log(1 + 2);` (the repository's own `node bin/universal-translator.js translate python javascript -` gives this)                                                 |

Passing control: "Read the file js/src/translation/layout.js and tell me what it does" works (correct `read_file` call and contents). Note: an early run of task 3 ended with a `SourcePreimageUnavailable` verification gap, but that came from the test driver truncating the file read, not from formal-ai.

My own solutions (commands and outputs, same tasks, all correct) are in the gist transcript: `grep`/`ls` for the layout files, `--help` for the commands, `sed -i` rename, a hand-written JSDoc block, a `reduce` function that prints 14 for `[1, 2, 3]`, and the repository translator for task 6.

## Filed

- Gist with all transcripts: https://gist.github.com/konard/0d942b7c1c3a9cdd96519eaf142e591e
- https://github.com/link-assistant/formal-ai/issues/1641 - agent mode: capability-gap answer claims an advertised tool is missing; file-discovery prompts do not reach `read_file`/`list_dir`/`grep` (tasks 1, 2).
- https://github.com/link-assistant/formal-ai/issues/1642 - plain coding requests not solved: sum of squares, Python to JavaScript translation, JSDoc addition (tasks 4, 5, 6).

Existing issues were searched first; none matched, so no comments were added to old issues.

## Conclusions

- formal-ai is usable for explicit operations ("Read the file X", a rename by `perl`), and its agent loop works over the OpenAI tools API once `FORMAL_AI_AGENT_MODE=1` is set.
- Open-ended discovery, doc-comment generation, simple function synthesis and cross-language translation of one statement failed; the failures are honest refusals or misroutings, not wrong code.
- Not fully investigated: with `--agent-mode` alone (without the environment variable) one run still refused tool calls; the cause was not isolated.
- formal-ai is not a replacement for the repository's own translator for task 6.
