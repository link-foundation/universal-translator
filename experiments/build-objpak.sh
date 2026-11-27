#!/usr/bin/env bash
# Bootstrap the original POC/Objpak toolchain without system installations.
# Linux/GCC build; see docs/case-studies/issue-16/OBJPAK.md for provenance.
set -euo pipefail
ulimit -c 0
ulimit -v 1048576
ulimit -s 16384
revision=983114f60a69d77fc82759e5ceb43ee6a20ed69b
bootstrap_revision=5d2ffc1d67204a598037542b86582a7a2631dbdc
prefix=${1:-/tmp/universal-translator-objpak-$revision}
case "$prefix" in /*) ;; *) echo 'Use an absolute installation prefix' >&2; exit 1 ;; esac
stamp="$revision $bootstrap_revision gcc-gnu89-unfortified-o0-v1"
if test -x "$prefix/bin/objc" && test -f "$prefix/.universal-build" && test "$(cat "$prefix/.universal-build")" = "$stamp"; then
  printf '%s\n' "$prefix"
  exit 0
fi
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/bootstrap" "$work/source" "$prefix"
curl --fail --location --silent --show-error --retry 3 "https://codeload.github.com/fkhannouf/objc-bootstrap/tar.gz/$bootstrap_revision" |
  tar -xz --strip-components=1 -C "$work/bootstrap"
curl --fail --location --silent --show-error --retry 3 "https://codeload.github.com/fkhannouf/objc/tar.gz/$revision" |
  tar -xz --strip-components=1 -C "$work/source"
export PATH="$prefix/bin:$PATH"
(
  cd "$work/bootstrap"
  LEX=true YACC=true ./configure --prefix="$prefix" CC='cc -std=gnu89 -w -O0'
  make -j1
  make install
) > "$prefix/bootstrap-build.log" 2>&1
(
  cd "$work/source"
  LEX=true YACC=true ./configure --prefix="$prefix" CC='cc -std=gnu89 -w -O0'
  # Fortified modern glibc declarations exceed the historical compiler parser.
  # The experiment is deliberately unoptimized and finite; do not change host headers.
  make -j1 objcrt objpak MFLAGS='-DNDEBUG -O0 -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=0'
  make -C src/objcrt install
  make -C src/objpak install
  mkdir -p "$prefix/include/objcrt" "$prefix/include/objpak"
  cp include/objcrt/*.h "$prefix/include/objcrt/"
  cp include/objpak/*.h "$prefix/include/objpak/"
  make -C src/objc _prelink.o
  cp src/objc/_prelink.o "$prefix/lib64/"
) > "$prefix/runtime-build.log" 2>&1
printf '%s\n' "$stamp" > "$prefix/.universal-build"
printf '%s\n' "$prefix"
