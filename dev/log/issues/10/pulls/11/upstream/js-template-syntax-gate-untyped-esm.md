## Problem

`scripts/check-javascript-syntax.mjs` runs `node --check <file>` for every tracked `.js`, `.mjs` and `.cjs` file. On Node.js 20 and 22, `node --check` exits 0 for a `.js` file that uses `import` or `export` and has no `"type"` in its nearest `package.json`, **even when the file has a syntax error**. Node.js 24 reports the error.

`package.json` declares `"engines": { "node": ">=20.0.0" }`, so the gate passes broken code on two supported Node.js versions. This happens wherever the gate runs on Node 20 or 22, including a local run or a CI job that does not pin Node 24.

This was found in a repository that follows the template: https://github.com/link-foundation/universal-translator/pull/11. Its Deno test leg did not run `setup-node`, so the gate ran on the runner's preinstalled Node. A fixture containing `export const broken = ;` was reported as clean on every run.

## Reproduction

```bash
dir=$(mktemp -d)
printf 'export const broken = ;\n' > "$dir/untyped-esm.js"
printf 'const broken = ;\n' > "$dir/untyped-cjs.js"
for v in 20 22 24; do
  for f in untyped-esm.js untyped-cjs.js; do
    npx -y -p node@$v -- node --check "$dir/$f" >/dev/null 2>&1; echo "node $v $f: exit $?"
  done
done
```

Result:

| Node.js | `untyped-esm.js` | `untyped-cjs.js` |
| --- | --- | --- |
| 20.20.2 | exit 0 (wrong) | exit 1 |
| 22.23.5 | exit 0 (wrong) | exit 1 |
| 24.22.3 | exit 1 | exit 1 |

A `.mjs` file, or a `.js` file under a `package.json` with `"type": "module"` or `"type": "commonjs"`, is checked correctly on every version. Only untyped `.js` files are affected.

## Workaround

Run the gate on Node 24, or give every package that holds `.js` files a `"type"`.

## Fix (implemented and tested in the PR above)

For a `.js` file whose nearest `package.json` has no `"type"`, pipe the source through stdin, first with `node --input-type=commonjs --check` and then with `node --input-type=module --check`. Accept the file if either succeeds, which is what Node 24's module detection does. Node 20, 22 and 24 all give the right answer for both input types. Keep `node --check <file>` for every other file. A fixture test that commits an untyped `.js` file with an ESM syntax error, plus one valid untyped CommonJS file and one valid untyped ES module file, covers both directions.
