# 7: Meta view, language versions, semantic primes everywhere, standards editor, CST by default and comment language

Fixes #6

## Summary

This PR builds on the issue 1 translator. It adds the meta language view, a language switch that does not fail, random examples, one entry per language with versions, semantic primes for every natural language, settings based on link-foundation/ui, concrete syntax trees by default, a separate comment language, a Standards editor, word standards of at most 1024 words with recursive Wikidata definitions, and a re-check of every issue 1 requirement.

The case study is in [`docs/case-studies/issue-6`](https://github.com/link-foundation/universal-translator/tree/issue-6-c597ff1041d9/docs/case-studies/issue-6). It has the issue data, research, existing libraries and the [requirements inventory](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/case-studies/issue-6/requirements.md). `requirements.lino` is checked in CI by `scripts/check-requirements.mjs`, together with the issue 1 and issue 8 inventories.

## Requirements

| Issue requirement | What was done | Verified by |
| --- | --- | --- |
| Meta language version of the left and right expressions | `formatMeta` (JS and Rust) writes the meta program as Links Notation. The demo has a "Show the meta language" switch | `meta-notation.test.js`, `rust/tests/grammar.rs`, e2e |
| Changing the left language does not fail | The right text is translated into the newly chosen left language | e2e |
| Buttons generate random examples | Program, Function, Statement (Sentence is removed). Each picks a random supported algorithm and two random languages | `examples.js`, e2e |
| Semantic primes for exactly all human languages | The 65 primes for every natural language in `data/natural/semantic-primes.lino`. Every language has a `minimal-<language>` version | Gate check `primes-everywhere`, natural goldens |
| Versions per language, one Python and one English, American or British from the browser | Python 3 by default and Python 2.7 as a version. Natural languages have a region, vocabulary downgrades and standards. Pickers list base languages only, and `en-GB`/`en-AU`/… pick British English | Gate check `one-entry-per-language`, `versions.test.js`, e2e |
| link-foundation/ui settings behind a small link | Themes, skins and seven interface languages through `@link-foundation/ui-*`, saved for the next visit | e2e, screenshots |
| CST by default (whitespace and comments on both sides) | Blank lines, comments and the spaces inside them are kept, and so are trailing comments and comments closing indented blocks. Also kept: a comment directly above a function, and the empty line between functions (or the lack of one), in every language | `comments.test.js`, `rust/tests/grammar.rs`, round trips through every language |
| Comment language apart from the code language | `commentLanguage` option, CLI flag and demo picker. The same code can be kept with only its comments translated | `comments.test.js`, e2e |
| Edge cases and symmetry across all languages | Every vocabulary word of every language takes effect when changed. Empty-line fidelity is checked for every language in both directions. Fixed: Perl and Bash read `return 1` back as `true`; a comment above `#include` was dropped; a CodeQL prototype-pollution alert; the server test hung under Deno because Deno's `server.close()` waits for kept-alive fetch connections (`experiments/deno-server-close.mjs`) | `vocabulary-effect.test.js`, `comments.test.js`, `rust/tests/grammar.rs` |
| Edit every standard in a separate tab and save one's own | Standards tab: every word and the meta language concept it stands for. It saves a version of one's own (`python@spoken-python`), also from another own version, and saves natural standards | `standards.test.js`, e2e |
| Standards of at most 1024 words with recursive definitions (Wikidata, cache and pre-cache) | `createStandard`, `defineWord`, `wikidataLookup`. The offline pre-cache is `data/definitions/wikidata-english.lino`, grown by `scripts/precache-definitions.mjs` | Gate check `small-standards`, `standards.test.js`, e2e |
| Re-check issue 1 and do what is left | All issue 1 requirements pass the gate except two that stay **blocked** (see below) | `node scripts/check-requirements.mjs --strict` |
| Works with issue 8 (partial translation by default, `auto`, rules as data), raised in the PR 7 review | Main merged in. Comment languages and versions go through partial translation, `--all-or-nothing`, detection, the server with `rules`, and the rules editor in all 7 interface languages and both themes. The issue 8 requirements are now checked by the same gate | `issue-6-with-8.test.js`, `rust/tests/issue_6.rs`, `universal-app.test.js`, e2e, gate entries `with-partial-translation` and `docs/case-studies/issue-8/requirements.lino` |
| Same features in the Rust crate | Language versions (`python@2`), natural language versions, comment languages, comment language detection and `--comment-language`/`--comment-from` in `rust/`, with the same outputs as JS. Porting found two JS bugs, now fixed: reading `python@2` missed Python's array constructors, and an unknown comment language became an untranslated part instead of an error | `rust/tests/issue_6.rs`, `issue-6-with-8.test.js` |
| Case study with data, online research and libraries | `docs/case-studies/issue-6` | Gate entry `issue-6-case-study` |

The README documents versions, comment languages and the meta view, and the changeset lists everything above.

## Still blocked (not done)

These issue 1 requirements are still **not done**. They are listed as blocked in the inventories with their reasons, not as done:

- **Every Rosetta Code algorithm type.** Floating point, strings as values, higher-order functions, data structures, I/O, objects and concurrency need values and statements that the meta language does not have yet (`docs/case-studies/issue-1/rosetta-coverage.lino`).
- **Classes as fragments.** The meta language has no objects, so a class has nothing to translate to.

Each one is a meta language extension. It would have to go through all 32 programming languages, the machine targets and the natural languages, so it needs its own issue.

## Screenshots

Translation that keeps comments, the spaces inside them, trailing comments and blank lines:

![Translate](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/translate.png?raw=true)

The meta language of both sides:

![Meta language](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/meta-language.png?raw=true)

Versions and the comment language:

![Versions and comment language](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/versions-and-comment-language.png?raw=true)

The Standards tab (a Python version of one's own, words defined through words):

![Standards](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/standards.png?raw=true)

Partial translation and the rules editor after the issue 8 merge, also in Russian with the dark scheme:

![Partial translation](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/partial-translation.png?raw=true)
![Rules editor](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/rules-editor.png?raw=true)
![Russian, dark, rules](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/russian-dark-rules.png?raw=true)

Settings (link-foundation/ui), and the interface in Russian with the dark scheme:

![Settings](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/settings.png?raw=true)
![Russian, dark](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/russian-dark.png?raw=true)

## Tests

- `npm test`: 1116 tests pass locally. CI runs the tests under Node, Bun and Deno.
- `cargo test` (112 tests) and `cargo clippy --all-targets -- -D warnings` pass locally.
- `node scripts/check-requirements.mjs` reports every requirement as done or blocked.
- `examples/universal-app/e2e/translate.e2e.mjs` passes against the built demo.

To reproduce the CST fixes: `node experiments/blank-between-functions.mjs` prints `kept` for every language in both the spaced and the tight case, and `node experiments/cst-regressions.mjs` shows the outputs the regression tests pin.




## https://github.com/link-foundation/universal-translator/pull/7#issuecomment-7160697443 by konard

<!-- hive-mind:working-session-summary -->
## Working session summary

PR #7 is ready for review: https://github.com/link-foundation/universal-translator/pull/7. Every requirement from issue 6 is done except one item, the re-check of issue 1, which is reported as **blocked**. All CI workflows pass on the latest commit (86939cc), and `main` has no newer commits to merge.

**Still blocked (not done).** The issue 6 re-check found everything from issue 1 done except two things:
- **Every Rosetta Code algorithm type.** Floating point, strings as values, higher-order functions, data structures, input/output, objects and concurrency all need things the meta language doesn't have yet.
- **Classes as fragments.** The meta language has no objects, so a class has nothing to translate to.

Each needs a meta language extension that would have to work in all 32 programming languages, the machine targets and the natural languages, so it needs its own issue. Both inventories and the PR description list them as blocked, with the reasons. The requirements check script accepts "blocked" only when a reason is given.

**Fixed in this last stretch:**
- **Formatting:** CI's format check failed on `examples/universal-app/src/styles.css`, so I ran Prettier on it.
- **Deno test hang:** with lint passing, CI reached the Deno tests for the first time on this branch, and the server test hung there for over a minute. Under Deno, `server.close()` waits for the connections that `fetch` keeps open. Node closes in a few milliseconds; Deno was still open after 10 seconds. `experiments/deno-server-close.mjs` reproduces this. The test helper now drops those connections before closing, and the test passes under Node, Bun and Deno.

**Verification:**
- **Locally:** all 1078 JS tests pass, the Rust tests and the Rust lint (`cargo clippy -D warnings`) pass, the requirements check reports every requirement as done or blocked, and the end-to-end test passes against the built demo.
- **PR description:** it has a requirements table, the blocked items, embedded screenshots and how to reproduce the fixes, and it closes #6.
- **Comments:** the only comment on the issue or PR is the CodeQL alert, which was already fixed.

---
*This summary was automatically extracted from the AI working session output.*

## https://github.com/link-foundation/universal-translator/pull/7#issuecomment-7160862744 by konard

## 🤖 Solution Draft Log
This log file contains the complete execution trace of the AI solution draft process.

### 💰 Cost: **$42.877842**

### 📊 **Context and tokens usage:**

**Claude Opus 5.5:** (14 sub-sessions)
1. 115.5K / 1M (12%) input tokens, 12.2K / 128K (10%) output tokens
2. 116.6K / 1M (12%) input tokens, 30.6K / 128K (24%) output tokens
3. 115.8K / 1M (12%) input tokens, 37.5K / 128K (29%) output tokens
4. 113.6K / 1M (11%) input tokens, 35.2K / 128K (27%) output tokens
5. 114.3K / 1M (11%) input tokens, 38.5K / 128K (30%) output tokens
6. 116.5K / 1M (12%) input tokens, 25.8K / 128K (20%) output tokens
7. 116.3K / 1M (12%) input tokens, 34.1K / 128K (27%) output tokens
8. 116.7K / 1M (12%) input tokens, 31.2K / 128K (24%) output tokens
9. 115.9K / 1M (12%) input tokens, 35.4K / 128K (28%) output tokens
10. 115.4K / 1M (12%) input tokens, 26.7K / 128K (21%) output tokens
11. 116.7K / 1M (12%) input tokens, 35.0K / 128K (27%) output tokens
12. 114.9K / 1M (11%) input tokens, 30.1K / 128K (24%) output tokens
13. 115.8K / 1M (12%) input tokens, 31.7K / 128K (25%) output tokens
14. 65.7K / 1M (7%) input tokens, 8.4K / 128K (7%) output tokens

Total: (51.7K new + 1.8M cache writes + 75.0M cache reads) input tokens, 721.6K output tokens, $42.877842 cost

### 🤖 **Models used:**
- Tool: Anthropic Claude Code
- Requested: `opus` (`claude-opus-5-5`)
- Thinking level: medium (~15999 tokens)
- **Model: Claude Opus 5.5** (`claude-opus-5-5`)

### 📎 **Log file uploaded as Repository** (32501KB)
- [View complete solution draft log](https://raw.githubusercontent.com/konard/public-logs/main/tmp-hive-mind-log-upload-tWEtcz/18c1b2b251eec44b/sanitized.log.txt)

---
*Now working session is ended, feel free to review and add any feedback on the solution draft.*

## https://github.com/link-foundation/universal-translator/pull/7#issuecomment-7160974123 by konard

## ✅ Ready to merge

This pull request is now ready to be merged:
- All CI checks have passed
- No merge conflicts
- No uncommitted changes

## https://github.com/link-foundation/universal-translator/pull/7#issuecomment-7161725341 by konard

We need to resolve conflicts, and double check that all requirements from all our issues, and all registered requirements all requirements are fully delivered and we have no undelivered requirements across the entire codebase, issues, pull requests and so on.

We need to ensure all changes are correct, consistent, validated, tested, documented, logged and fully meet each and all discussed requirements in deepest and widest possible sense (check issue description and all comments in issue and in pull request, make sure each and every requirement listed before actually checking if they were addressed). Nothing should be defered or delayed. The scope is the entire repository, every change in one place should also be applied in all places in the codebase and docs. Ensure all CI/CD checks pass.

Please plan and execute everything in this single pull request, you have unlimited time and context, as context auto-compacts and you can continue indefinitely, until each and every requirement fully addressed, and everything is totally done.



## https://github.com/link-foundation/universal-translator/pull/7#issuecomment-7161772860 by konard

🤖 **AI Work Session Started**

Started at 2026-11-25T11:59:24.822Z. Please wait for it to finish before giving feedback.

_Runtime: solve `v2.39.10` · tool `claude` · model `opus` · task image `konard/hive-mind-dind:2.39.10@sha256:3be89e0510e606204a332e64547ebcfb4c8e527476abbbbbcdc7dac124476a86`_

## https://github.com/link-foundation/universal-translator/pull/7#issuecomment-7163405200 by konard

<!-- hive-mind:working-session-summary -->
## Working session summary

PR #7 is updated and marked ready for review: https://github.com/link-foundation/universal-translator/pull/7. The merge conflicts are resolved, all CI checks pass on the latest commit (`fd34547`), the working tree is clean, and the description still contains "Fixes #6".

**Merge with `main` (issue 8 and release 0.13.0)**
- Comment languages and language versions now work with each issue 8 feature:
```text
  - partial translation by default and `--all-or-nothing`;
  - the source language `auto`;
  - rules as data, including through `POST /translate`.
- The rules editor works in all 7 interface languages and both themes; new screenshots are in the PR.
- Committing the merge required fixing lint warnings that came from `main`.
```

**Requirements across all issues**
- The requirements check now covers issues 1, 6 and 8. A new list for issue 8 is at `docs/case-studies/issue-8/requirements.lino`.
- Issue 6 has a new requirement for working with issue 8, plus a saved copy of the PR 7 comments and reviews.
- Every requirement is marked done except two from issue 1, which stay blocked:
```text
  - **Every Rosetta Code algorithm type:** needs values and statements the meta language doesn't have yet.
  - **Classes as fragments:** the meta language has no objects.
```
  
  Both are listed as not done in the PR, because each needs its own issue.

**Rust**
- The Rust crate was missing the issue 6 features. It now has:
```text
  - `python@2` and the versions of each natural language;
  - comment languages, with detection of the comment language;
  - `--comment-language` and `--comment-from`.
- `rust/tests/issue_6.rs` uses the outputs of the JS version, and I checked by hand that both CLIs give the same output on sample inputs.
- One thing doesn't carry over: JS can add language versions while running (`registerLanguageVersion`), but Rust's versions are fixed when it's compiled. Rust also has no HTTP server.
```

**Two JS bugs found during the Rust port, now fixed with tests that fail before the fix:**
- Reading `python@2` didn't recognise Python's array constructors, so `[1] * n` wasn't read as an array.
- An unknown comment language such as `klingon` was recorded as an untranslated part, and the command still exited with code 0. It is now an error before anything is read.

The first fix showed that one test (`vocabulary-effect.test.js`) had been passing by accident for Kotlin. I added Kotlin to its list of words the test programs don't show, next to Go, Rust and Swift.

**Docs:** the README has a new section on language versions, comment languages and the meta view. The issue 6 case study and the changeset describe the issue 8 merge and the Rust support.

**Local checks:** 1116 JS tests, 112 Rust tests, `cargo fmt`, clippy and lint all pass.

---
*This summary was automatically extracted from the AI working session output.*

## https://github.com/link-foundation/universal-translator/pull/7#issuecomment-7163469580 by konard

## 🤖 Solution Draft Log
This log file contains the complete execution trace of the AI solution draft process.

### 💰 Cost: **$10.895575**

### 📊 **Context and tokens usage:**

**Claude Opus 5.5:** (3 sub-sessions)
1. 115.4K / 1M (12%) input tokens, 33.7K / 128K (26%) output tokens
2. 116.6K / 1M (12%) input tokens, 32.6K / 128K (25%) output tokens
3. 91.2K / 1M (9%) input tokens, 23.5K / 128K (18%) output tokens

Total: (11.4K new + 461.3K cache writes + 22.3M cache reads) input tokens, 163.1K output tokens, $10.895575 cost

### 🤖 **Models used:**
- Tool: Anthropic Claude Code
- Requested: `opus` (`claude-opus-5-5`)
- Thinking level: medium (~15999 tokens)
- **Model: Claude Opus 5.5** (`claude-opus-5-5`)

### 📎 **Log file uploaded as Gist** (10825KB)
- [View complete solution draft log](https://gist.githubusercontent.com/konard/e9d784510ebebc6270f2f445ff87504e/raw/ec4d2eb3b5deae0476e3672744980e5b5b39bdde/tmp-hive-mind-log-upload-d8aH7v-sanitized.log.txt)

---
*Now working session is ended, feel free to review and add any feedback on the solution draft.*

## https://github.com/link-foundation/universal-translator/pull/7#issuecomment-7163703758 by konard

## 🎉 Auto-merged

This pull request has been automatically merged by hive-mind.
- All CI checks have passed

### Linked issues

- 🔒 Closed by GitHub: link-foundation/universal-translator#6

## Pull request description

Fixes #6

## Summary

This PR builds on the issue 1 translator. It adds the meta language view, a language switch that does not fail, random examples, one entry per language with versions, semantic primes for every natural language, settings based on link-foundation/ui, concrete syntax trees by default, a separate comment language, a Standards editor, word standards of at most 1024 words with recursive Wikidata definitions, and a re-check of every issue 1 requirement.

The case study is in [`docs/case-studies/issue-6`](https://github.com/link-foundation/universal-translator/tree/issue-6-c597ff1041d9/docs/case-studies/issue-6). It has the issue data, research, existing libraries and the [requirements inventory](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/case-studies/issue-6/requirements.md). `requirements.lino` is checked in CI by `scripts/check-requirements.mjs`, together with the issue 1 and issue 8 inventories.

## Requirements

| Issue requirement | What was done | Verified by |
| --- | --- | --- |
| Meta language version of the left and right expressions | `formatMeta` (JS and Rust) writes the meta program as Links Notation. The demo has a "Show the meta language" switch | `meta-notation.test.js`, `rust/tests/grammar.rs`, e2e |
| Changing the left language does not fail | The right text is translated into the newly chosen left language | e2e |
| Buttons generate random examples | Program, Function, Statement (Sentence is removed). Each picks a random supported algorithm and two random languages | `examples.js`, e2e |
| Semantic primes for exactly all human languages | The 65 primes for every natural language in `data/natural/semantic-primes.lino`. Every language has a `minimal-<language>` version | Gate check `primes-everywhere`, natural goldens |
| Versions per language, one Python and one English, American or British from the browser | Python 3 by default and Python 2.7 as a version. Natural languages have a region, vocabulary downgrades and standards. Pickers list base languages only, and `en-GB`/`en-AU`/… pick British English | Gate check `one-entry-per-language`, `versions.test.js`, e2e |
| link-foundation/ui settings behind a small link | Themes, skins and seven interface languages through `@link-foundation/ui-*`, saved for the next visit | e2e, screenshots |
| CST by default (whitespace and comments on both sides) | Blank lines, comments and the spaces inside them are kept, and so are trailing comments and comments closing indented blocks. Also kept: a comment directly above a function, and the empty line between functions (or the lack of one), in every language | `comments.test.js`, `rust/tests/grammar.rs`, round trips through every language |
| Comment language apart from the code language | `commentLanguage` option, CLI flag and demo picker. The same code can be kept with only its comments translated | `comments.test.js`, e2e |
| Edge cases and symmetry across all languages | Every vocabulary word of every language takes effect when changed. Empty-line fidelity is checked for every language in both directions. Fixed: Perl and Bash read `return 1` back as `true`; a comment above `#include` was dropped; a CodeQL prototype-pollution alert; the server test hung under Deno because Deno's `server.close()` waits for kept-alive fetch connections (`experiments/deno-server-close.mjs`) | `vocabulary-effect.test.js`, `comments.test.js`, `rust/tests/grammar.rs` |
| Edit every standard in a separate tab and save one's own | Standards tab: every word and the meta language concept it stands for. It saves a version of one's own (`python@spoken-python`), also from another own version, and saves natural standards | `standards.test.js`, e2e |
| Standards of at most 1024 words with recursive definitions (Wikidata, cache and pre-cache) | `createStandard`, `defineWord`, `wikidataLookup`. The offline pre-cache is `data/definitions/wikidata-english.lino`, grown by `scripts/precache-definitions.mjs` | Gate check `small-standards`, `standards.test.js`, e2e |
| Re-check issue 1 and do what is left | All issue 1 requirements pass the gate except two that stay **blocked** (see below) | `node scripts/check-requirements.mjs --strict` |
| Works with issue 8 (partial translation by default, `auto`, rules as data), raised in the PR 7 review | Main merged in. Comment languages and versions go through partial translation, `--all-or-nothing`, detection, the server with `rules`, and the rules editor in all 7 interface languages and both themes. The issue 8 requirements are now checked by the same gate | `issue-6-with-8.test.js`, `rust/tests/issue_6.rs`, `universal-app.test.js`, e2e, gate entries `with-partial-translation` and `docs/case-studies/issue-8/requirements.lino` |
| Same features in the Rust crate | Language versions (`python@2`), natural language versions, comment languages, comment language detection and `--comment-language`/`--comment-from` in `rust/`, with the same outputs as JS. Porting found two JS bugs, now fixed: reading `python@2` missed Python's array constructors, and an unknown comment language became an untranslated part instead of an error | `rust/tests/issue_6.rs`, `issue-6-with-8.test.js` |
| Case study with data, online research and libraries | `docs/case-studies/issue-6` | Gate entry `issue-6-case-study` |

The README documents versions, comment languages and the meta view, and the changeset lists everything above.

## Still blocked (not done)

These issue 1 requirements are still **not done**. They are listed as blocked in the inventories with their reasons, not as done:

- **Every Rosetta Code algorithm type.** Floating point, strings as values, higher-order functions, data structures, I/O, objects and concurrency need values and statements that the meta language does not have yet (`docs/case-studies/issue-1/rosetta-coverage.lino`).
- **Classes as fragments.** The meta language has no objects, so a class has nothing to translate to.

Each one is a meta language extension. It would have to go through all 32 programming languages, the machine targets and the natural languages, so it needs its own issue.

## Screenshots

Translation that keeps comments, the spaces inside them, trailing comments and blank lines:

![Translate](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/translate.png?raw=true)

The meta language of both sides:

![Meta language](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/meta-language.png?raw=true)

Versions and the comment language:

![Versions and comment language](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/versions-and-comment-language.png?raw=true)

The Standards tab (a Python version of one's own, words defined through words):

![Standards](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/standards.png?raw=true)

Partial translation and the rules editor after the issue 8 merge, also in Russian with the dark scheme:

![Partial translation](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/partial-translation.png?raw=true)
![Rules editor](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/rules-editor.png?raw=true)
![Russian, dark, rules](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/russian-dark-rules.png?raw=true)

Settings (link-foundation/ui), and the interface in Russian with the dark scheme:

![Settings](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/settings.png?raw=true)
![Russian, dark](https://github.com/link-foundation/universal-translator/blob/issue-6-c597ff1041d9/docs/screenshots/issue-6/russian-dark.png?raw=true)

## Tests

- `npm test`: 1116 tests pass locally. CI runs the tests under Node, Bun and Deno.
- `cargo test` (112 tests) and `cargo clippy --all-targets -- -D warnings` pass locally.
- `node scripts/check-requirements.mjs` reports every requirement as done or blocked.
- `examples/universal-app/e2e/translate.e2e.mjs` passes against the built demo.

To reproduce the CST fixes: `node experiments/blank-between-functions.mjs` prints `kept` for every language in both the spaced and the tight case, and `node experiments/cst-regressions.mjs` shows the outputs the regression tests pin.



## https://github.com/link-foundation/universal-translator/pull/7#discussion_r4692567416 by github-advanced-security[bot]

## CodeQL / Prototype-polluting assignment

This assignment may alter Object.prototype if a malicious '__proto__' string is injected from [library input](1).

[Show more details](https://github.com/link-foundation/universal-translator/security/code-scanning/3)

## https://github.com/link-foundation/universal-translator/pull/7#pullrequestreview-6054580678 by github-advanced-security[bot]


