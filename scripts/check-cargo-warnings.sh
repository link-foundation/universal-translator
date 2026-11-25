#!/usr/bin/env bash
# Runs a Cargo command and fails when it prints any warning. `-D warnings`
# covers rustc and Clippy lints, but Cargo's own warnings (for example an
# unused manifest key) still exit 0. The output is kept for the log.
# Usage: bash scripts/check-cargo-warnings.sh cargo clippy --locked ...
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: $0 cargo <subcommand> [arguments...]" >&2
  exit 2
fi

log_file="$(mktemp "${TMPDIR:-/tmp}/cargo-warnings.XXXXXX")"
trap 'rm -f "$log_file"' EXIT
CARGO_TERM_COLOR=never "$@" 2>&1 | tee "$log_file"
if grep -E '^warning(:|\[)' "$log_file" > /dev/null; then
  echo "::error::Cargo reported warnings; see the output above." >&2
  exit 1
fi
