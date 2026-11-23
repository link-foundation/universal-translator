# PR 5 readiness investigation

The last working session at 18:14:43 UTC on November 23 explicitly reported
that executable translation for 1,755 Rosetta Code tasks and the remaining
grammar, top-50, and natural-language requirements were open. Codex returned
a normal `turn.completed` event and the container reported zero OOM kills.
Lines 16,325–16,348 of the log record those observations. Hive Mind attached
the session summary, then ran the draft-to-ready transition at 18:14:56 UTC.
Lines 16,388–16,399 capture the transition. An earlier session follows the
same sequence at lines 34,336–34,415 of its log. GitHub still shows PR 5
unmerged. [Latest log](https://gist.github.com/konard/0753e7bfe5acd01290eac050ffa685c8) ·
[Earlier log](https://gist.github.com/konard/becc353073232a67d5d62da60c7271cf) ·
[Initial log](https://gist.github.com/konard/81730a0363c6c828f04216fcb6ae031b) ·
[Readiness message](https://github.com/link-foundation/universal-translator/pull/5#issuecomment-7109976519)

The solver's finalizer used the presence of a branch diff to justify
`solution draft verified`. Its readiness check did not consume the
completion disposition in the session summary. The monitor then found
passing checks on that head. Those checks covered UTF-8 preservation for
the complete archive and native execution for three authored contracts.
They had no assertion for full executable corpus coverage. The automatic
completion restart and merge guard in that solver release were opt-in via
`--requirements-report`, and that run omitted the option.
[Installed finalizer at v2.39.10](https://github.com/link-assistant/hive-mind/blob/v2.39.10/src/solve.results.lib.mjs#L812-L835) ·
[Completion restart implementation](https://github.com/link-assistant/hive-mind/blob/v2.39.10/src/solve.issue-completion.lib.mjs) ·
[Upstream disposition issue](https://github.com/link-assistant/hive-mind/issues/3924)

The archive check now runs the pinned JavaScript and Rust examples it
recognizes in their own runtimes and executes their translated output.
It verifies stdout against an independent oracle, verifies both CLIs
against the same Meta Language effect, and counts the evidence by source
language. The same step enforces the full count on PR 5 whenever GitHub
marks it ready. A draft run exposes the current counts in the CI summary.
This assertion covers native JavaScript and Rust corpus acceptance. The
[requirements inventory](requirements.md) tracks the remaining issue scope.

The automatic ready transition at 20:43 UTC triggered the strict check at
`62820a3`. Both runtimes restored all 143,457 archive files and passed the
seven cross-runtime CST checks. The strict check failed at log lines
8043–8074 with 6 of 1,985 JavaScript sources and 9 of 1,481 Rust sources
verified. Pipeline Status propagated the translation failure at lines
12653–12656. [Translation job](https://github.com/link-foundation/universal-translator/actions/runs/45262333852/job/138052415703)

The ready event also cancelled individual jobs in the earlier draft run.
That run's Pipeline Status compared only commit SHAs and saw the same SHA
on the branch, so it reported the two job cancellations as failures at
lines 261–267. Checks and release now replaces the whole PR run on a new
PR event. Push and manual release runs each use their own workflow group.
[Earlier Pipeline Status job](https://github.com/link-foundation/universal-translator/actions/runs/45260759361/job/138025513054)

The launcher still owns the ready transition and automatic restarts.
The PR description carries the Hive Mind requirements report at the
current head so a launcher with `--requirements-report` can detect the
open criteria. The upstream issue tracks preserving an explicit hold
across launch and recovery paths. The new repository check can report
incomplete coverage when the ready event arrives. GitHub permissions and
the running launcher's options are outside this branch.
