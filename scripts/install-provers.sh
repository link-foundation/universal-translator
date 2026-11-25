#!/usr/bin/env bash
# Installs Lean and Rocq for the native translation job, or reuses the
# restored cache, then puts both on the PATH of later steps.
#
# A cached install takes seconds; a cold one builds Rocq and its standard
# library from source in about ten minutes.
#
# Usage: CACHE_HIT=true|false bash scripts/install-provers.sh
# Needs RUNNER_TEMP and GITHUB_PATH, as set by GitHub Actions.
set -euo pipefail

if [ "${CACHE_HIT:-}" != 'true' ]; then
  curl --fail --location --silent --show-error --retry 3 --retry-all-errors \
    --retry-delay 5 --connect-timeout 20 --max-time 180 \
    https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
    --output "$RUNNER_TEMP/elan-init.sh"
  sh "$RUNNER_TEMP/elan-init.sh" -y --no-modify-path \
    --default-toolchain leanprover/lean4:v4.35.0
  opam init --bare --disable-sandboxing --no-setup
  opam switch create rocq ocaml-system
  opam install --switch rocq --jobs "$(nproc)" rocq-core.9.3.0 rocq-stdlib.9.2.0
  opam clean --all-switches --download-cache --logs
fi
{
  echo "$HOME/.elan/bin"
  echo "$HOME/.opam/rocq/bin"
} >> "$GITHUB_PATH"
"$HOME/.elan/bin/lean" --version
"$HOME/.opam/rocq/bin/rocq" --version
