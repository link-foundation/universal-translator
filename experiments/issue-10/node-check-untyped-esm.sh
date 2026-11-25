#!/usr/bin/env bash
# Shows that `node --check` on Node 20 and 22 passes a .js file with a syntax
# error when the file uses import/export and no package.json sets "type".
# Node 24 reports the error. Usage: bash node-check-untyped-esm.sh [versions]
set -euo pipefail

dir="$(mktemp -d)"
trap 'rm -rf "${dir}"' EXIT
printf 'export const broken = ;\n' > "${dir}/untyped-esm.js"
printf 'const broken = ;\n' > "${dir}/untyped-cjs.js"
printf 'export const broken = ;\n' > "${dir}/explicit.mjs"

for version in "${@:-20 22 24}"; do
  for file in untyped-esm.js untyped-cjs.js explicit.mjs; do
    status=0
    npx -y -p "node@${version}" -- node --check "${dir}/${file}" \
      > /dev/null 2>&1 || status=$?
    echo "node ${version} --check ${file}: exit ${status}"
  done
done
