#!/usr/bin/env bash
# Compares the meta view of the JavaScript and Rust CLIs on every example
# program. The JSON is compared with sorted keys: the Rust CLI writes the
# fields in name order, the JavaScript CLI in the order they are made. The
# Rust parameters also say "kind": "Parameter", the JavaScript ones have no
# kind (a known difference, kept out of the comparison). Usage: experiments/issue-12-meta-parity.sh (after cargo build)
set -u
rust=${RUST_CLI:-target/debug/universal-translator}
sorted() {
  node -e 'const s=(x)=>Array.isArray(x)?x.map(s):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).filter((k)=>!(k==="kind"&&x[k]==="Parameter")).sort().map((k)=>[k,s(x[k])])):x;let d="";process.stdin.on("data",(c)=>(d+=c)).on("end",()=>console.log(JSON.stringify(s(JSON.parse(d)),null,2)))'
}
same=0; differ=0
for file in examples/programs/*/*.*; do
  ext=${file##*.}
  case $ext in
    py) lang=python;; js) lang=javascript;; go) lang=go;; rb) lang=ruby;;
    rs) lang=rust;; c) lang=c;; java) lang=java;; cs) lang=csharp;;
    *) continue;;
  esac
  for flag in "" --json; do
    norm='cat'
    [ -n "$flag" ] && norm=sorted
    a=$(node bin/universal-translator.js meta "$lang" "$file" $flag 2>&1 | $norm)
    b=$("$rust" meta "$lang" "$file" $flag 2>&1 | $norm)
    if [ "$a" == "$b" ]; then same=$((same+1)); else differ=$((differ+1)); echo "DIFFER $file $flag"; fi
  done
done
echo "same=$same differ=$differ"
