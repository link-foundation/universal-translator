# Raw data for the issue 14 inventory

Raw GitHub API data for every issue (1, 2, 6, 8, 10, 12, 14) and pull request (3, 4, 5, 7, 9, 11, 13, 15) of
`link-foundation/universal-translator` as of 2026-11-25, pretty-printed with `jq`.
Email addresses were stripped. Nothing was skipped; some files are legitimately empty.

| Pattern | Content |
| --- | --- |
| `issue-N.json` | Issue title, description and metadata |
| `issue-N-comments.json` | Issue comments |
| `pr-N.json` | Pull request title, description and metadata |
| `pr-N-comments.json` | Conversation comments of the pull request |
| `pr-N-review-comments.json` | Inline review comments |
| `pr-N-reviews.json` | Review submissions |

## Files that are empty (`[]`)

Empty means GitHub returned no items, not that the download failed.

- All issue comment files: `issue-1-comments.json`, `issue-2-comments.json`, `issue-6-comments.json`,
  `issue-8-comments.json`, `issue-10-comments.json`, `issue-12-comments.json`, `issue-14-comments.json`.
  The owner wrote every issue requirement in the issue description. Every follow-up was written in pull request 5 or 7.
- `pr-3-review-comments.json`, `pr-3-reviews.json`
- `pr-4-comments.json`, `pr-4-review-comments.json`, `pr-4-reviews.json`
- `pr-13-review-comments.json`, `pr-13-reviews.json`
- `pr-15-comments.json`, `pr-15-review-comments.json`, `pr-15-reviews.json`

## Authors

The 90 comments of the pull requests come from `konard` (the owner, plus the hive-mind bot posting under that account)
and 5 from `github-advanced-security[bot]` (code scanning; no requirements). Of the `konard` comments only the
following are written by the owner as requirements; the rest are bot output (working session summaries,
solution draft logs, "ready to merge" notes, auto-restart and usage limit notices):

- PR 5: 7092772656, 7106301969, 7111124596, 7128628018, 7131215220, 7137697837, 7142240472, 7144027760, 7145130071, 7146732093
- PR 7: 7161725341

Pull request 7's, 9's, 11's and 13's descriptions are also kept: they are bot-written, but carry the "blocked"
and "not done" lists that the inventory tracks.

All review submissions and inline review comments (PR 5, 7, 9, 11) come from `github-advanced-security[bot]`, so the
owner left no requirement in a review.
