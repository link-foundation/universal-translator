#!/usr/bin/env bash
set -euo pipefail

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
revision=a79782093cae3b33606483ac9f3e1d05faf36de0
curl --fail --location --silent --show-error --retry 3 \
  "https://codeload.github.com/link-foundation/meta-language/tar.gz/$revision" |
  tar -xz --strip-components=2 -C "$work" --wildcards \
    '*/js/package.json' '*/js/package-lock.json' '*/js/src'
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --prefix "$work"
if [[ ${1:-} == --corpus ]]; then
  shift
  node experiments/verify-syntax-exchange.mjs "$work/src/index.js"
  UNIVERSAL_TRANSLATOR_META_LANGUAGE="$work/src/index.js" +    python3 examples/translation/verify-corpus.py "$@"
else
  node experiments/verify-syntax-exchange.mjs "$work/src/index.js" "$@"
fi
