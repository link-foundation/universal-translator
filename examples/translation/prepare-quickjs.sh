#!/usr/bin/env bash
# Prepare the command-line host for the pinned Rosetta Code print() entry.
set -euo pipefail

directory=${1:?usage: prepare-quickjs.sh DIRECTORY}
archive=quickjs-linux-x86_64-2026-06-04.zip
digest=d98289c8ec9580eb206575c52c76693bc0fd6ce04ffac2dbd4f518b62a774938
mkdir -p "$directory"
directory=$(cd "$directory" && pwd)
download=$(mktemp)
trap 'rm -f "$download"' EXIT
curl --fail --location --silent --show-error --retry 3 \
  "https://bellard.org/quickjs/binary_releases/$archive" --output "$download"
printf '%s  %s\n' "$digest" "$download" | sha256sum --check >&2
unzip -p "$download" qjs > "$directory/qjs"
chmod +x "$directory/qjs"
printf '%s\n' "$directory/qjs"
