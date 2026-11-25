## Problem

`scripts/check-codeql-results.mjs` fails the Security run on every SARIF result. That is the right default, but it has two gaps.

1. **A reviewed and dismissed alert fails every run forever.** Dismissal ("won't fix", "false positive", "used in tests") is stored by code scanning on GitHub, not in the SARIF that `codeql-action/analyze` writes. The gate cannot see it. A maintainer who reviews and dismisses an alert in the Security tab still gets a red Security run on every push. The only options left are to disable the query, which hides new findings of that rule everywhere, or to remove the gate.
2. **A rejected finding does not say where it is.** The message is `run 0: js/incomplete-url-substring-sanitization [unspecified severity] '…' can be anywhere in the URL…`, with no file or line. You have to download the SARIF artifact to find the code.

Both happened in a repository that follows the template: https://github.com/link-foundation/universal-translator/pull/11. Alert #5 there (`js/regex-injection`) was dismissed as won't fix, and the gate still failed the run.

## Reproduction

Run the gate on any SARIF with one result. It fails and names no file or line. Then dismiss the alert in the Security tab and re-run the workflow: the gate fails exactly as before.

## Fix (implemented and tested in the PR above)

- Add `.github/codeql/accepted-findings.json`, a reviewed list of `{ ruleId, path, primaryLocationLineHash, alert, reason }`. `alert` must be a `https://github.com/<owner>/<repo>/security/code-scanning/<n>` URL, so every entry points at a dismissal someone made.
- A result passes only on an exact match of rule, path (`locations[0]`) and `partialFingerprints.primaryLocationLineHash`, and is printed as a `::notice title=Accepted CodeQL finding::`. Another file, an edited line, or a new finding of the same rule still fails.
- An entry whose rule ran but matched nothing fails as **stale**, so the list cannot rot. Reports that did not run the rule (for example the `actions` language) do not mark entries stale.
- Malformed lists fail closed: not an array, a blank field, a non-code-scanning `alert`, or a duplicate.
- Rejected findings print `at path:line (primaryLocationLineHash …)`, which is also what a new entry needs.

See `scripts/check-codeql-results.mjs` and the `CodeQL accepted findings` tests in `js/tests/codeql-results.test.js` (commits ca695ee and 9e800cf).
