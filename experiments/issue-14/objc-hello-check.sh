#!/bin/sh
# Checks the Objective-C program of the Hello World Collection with clang:
# it needs the Portable Object Compiler's objpak library (Set, String) and
# writes a block as { :each | ... }, which clang does not accept.
# Usage: sh experiments/issue-14/objc-hello-check.sh
dir=$(mktemp -d)
here=$(dirname "$0")
cp "$here/hello-objc.m" "$dir/hello-objc.m"
echo '== as written'
clang -x objective-c -fsyntax-only "$dir/hello-objc.m" 2>&1 | grep error
echo '== without the objpak include'
sed 's/#include <objpak.h>//' "$dir/hello-objc.m" > "$dir/no-objpak.m"
clang -x objective-c -fblocks -fsyntax-only "$dir/no-objpak.m" 2>&1 | grep error
rm -r "$dir"
