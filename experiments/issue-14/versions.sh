#!/usr/bin/env bash
# The built-in language versions written by both command lines: every
# version of every committed task, compared byte for byte, and Lua's ".."
# read back. Usage: experiments/issue-14/versions.sh [rust-binary]
set -u
rust=${1:-/tmp/ut-target/debug/universal-translator}
differences=0
for target in python@2 lua@5.1 php@5 csharp@5; do
  for source in examples/programs/*.js; do
    js=$(node bin/universal-translator.js translate javascript "$target" "$source" 2>&1)
    rs=$("$rust" translate javascript "$target" "$source" 2>&1)
    if [ "$js" != "$rs" ]; then
      echo "differs: $target $source"
      differences=$((differences + 1))
    fi
  done
done
lua='print(half(4) .. half(2) .. " items")
local s = "a" .. 1 + 2
print(s)'
for cli in "node bin/universal-translator.js" "$rust"; do
  echo "$lua" | $cli translate lua javascript -
done
echo "differences: $differences"
