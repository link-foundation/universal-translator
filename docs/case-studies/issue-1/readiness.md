# PR 5 readiness investigation

## Repeated failure on the same commit

The November 24 restart verified passing draft checks on `55f3a2d` and
reported 13 open acceptance criteria. The Hive Mind restart finalizer then
marked the same commit ready at 03:01:01 UTC. The transition is recorded at
lines 85,977–85,981 of the restart log. The new run restored 144,048 text
documents in both runtimes and verified 52 selected effects. Its strict
assertion failed because only 23 of 1,985 JavaScript originals and 15 of
1,481 Rust originals had native evidence. Pipeline Status propagated the
translation job failure. GitHub recorded another conversion to draft at
04:20:59 UTC.
[Restart log](https://gist.github.com/konard/0b29090c8aac11c62b4b51f91e4bad5f) ·
[Failing translation job](https://github.com/link-foundation/universal-translator/actions/runs/45316504560/job/138187684723) ·
[Failing Pipeline Status](https://github.com/link-foundation/universal-translator/actions/runs/45316504560/job/138204827278)

GitHub recorded another ready transition at 07:11:57 UTC on November 24.
The resulting run at `6bf2e00` restored all 144,048 documents in both
runtimes and verified 23 JavaScript and 15 Rust originals. The failed-jobs
log records a successful translation job at line 15, `FULL_NATIVE: false`
at line 16, the coverage failure at line 18, and its propagation through
Pipeline Status at line 116. The PR returned to draft at 09:19:31 UTC.
[Translation job](https://github.com/link-foundation/universal-translator/actions/runs/45346147687/job/138317997778) ·
[Coverage gate](https://github.com/link-foundation/universal-translator/actions/runs/45346147687/job/138327436537) ·
[Pipeline Status](https://github.com/link-foundation/universal-translator/actions/runs/45346147687/job/138335208221)

The translation job publishes the coverage result after the pinned corpus
replay. A separate **Full native Rosetta Code coverage** job requires
complete evidence from that same run whenever PR 5 is ready. Pipeline
Status still propagates a failure from either job. Draft runs report the
same counts and continue to fail on source restoration errors and selected
native regressions. The local verifier also supports `--require-full-native`.

The solve launcher operator can stop the repeated ready transitions by
disabling automatic readiness for this incomplete PR. The launcher needs
the upstream disposition fix to preserve the hold across restart
iterations. Keep the requirements report enabled when launching a version
that enforces it in those iterations. The repository's check still guards
readiness if a launcher or reviewer marks the PR ready.
[Launcher disposition issue](https://github.com/link-assistant/hive-mind/issues/3924) ·
[Upstream PR](https://github.com/link-assistant/hive-mind/pull/3929)

## Earlier readiness transitions

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
language. The initial version enforced the full count in the same step
whenever GitHub marked PR 5 ready.
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
