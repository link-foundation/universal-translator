#!/usr/bin/env bash
# Prepare the compiler used by the pinned Rosetta Code Rust FizzBuzz entry.
set -euo pipefail

directory=${1:?usage: prepare-legacy-rust.sh DIRECTORY}
archive=rustc-nightly-x86_64-unknown-linux-gnu.tar.gz
digest=972216d72c1efc2fdc49be447b51d371ed512a15e37aa84e26e7d11846ce786c
mkdir -p "$directory"
directory=$(cd "$directory" && pwd)
download=$(mktemp)
trap 'rm -f "$download"' EXIT
curl --fail --location --silent --show-error --retry 3 \
  "https://static.rust-lang.org/dist/2015-10-15/$archive" --output "$download"
printf '%s  %s\n' "$digest" "$download" | sha256sum --check >&2
tar -xzf "$download" -C "$directory"
printf '%s\n' "$directory/rustc-nightly-x86_64-unknown-linux-gnu/rustc/bin/rustc"
