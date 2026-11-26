#!/usr/bin/env bash
# Compare the nested meta program of the JavaScript and Rust command lines
# for every example program (and the samples of nesting.mjs's languages).
set -u
root=$(cd "$(dirname "$0")/../.." && pwd)
rust="$root/target/debug/universal-translator"
out=${1:-/tmp/logs/nest}
mkdir -p "$out"
status=0
for file in "$root"/examples/programs/*.* "$root"/examples/programs/hand-written/*.*; do
  [ -f "$file" ] || continue
  case "$file" in
    *.js) language=javascript ;; *.py) language=python ;; *.rs) language=rust ;;
    *.c) language=c ;; *.go) language=go ;; *.rb) language=ruby ;; *) continue ;;
  esac
  name=$(basename "$file")
  for flags in "" "--json"; do
    node "$root/bin/universal-translator.js" meta "$language" "$file" $flags > "$out/$name.js$flags.txt" 2>&1
    "$rust" meta "$language" "$file" $flags > "$out/$name.rs$flags.txt" 2>&1
    if ! cmp -s "$out/$name.js$flags.txt" "$out/$name.rs$flags.txt"; then
      echo "differs: $name $flags"
      status=1
    fi
  done
done
exit $status
