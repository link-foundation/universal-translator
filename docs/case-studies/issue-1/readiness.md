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

## What changed

The November 24 review found that the template-based drafts faked
translation. The corpus replay and the full-native coverage gate measured
those templates, so they were removed along with the templates. The
grammar translator described in the [case study](README.md) replaced them.

CI now checks what the translator actually does:

- Both test suites compare every translation with the shared goldens.
- The `native-translation` job compiles or runs every translated and
  hand-written program with its real toolchain, and fails if any toolchain
  is missing (`--require-all`).

PR 5 is marked ready only after every requirement in the
[inventory](requirements.md) has an implementation and a passing check.

## Requirements gate

The review of November 24 asked for CI that does not let the work stop
until everything is done. `docs/case-studies/issue-1/requirements.lino`
lists every requirement with its evidence and an automated check, and
`node scripts/check-requirements.mjs` runs in the `translation` job. A
requirement passes only when its evidence exists and its check passes, or
when it is marked `blocked` with a reason. Blocked items are printed in the
job log and in the PR description; `--strict` makes them fail too.
