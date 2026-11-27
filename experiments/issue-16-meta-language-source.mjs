import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [directory] = process.argv.slice(2);
assert.ok(
  directory,
  'Pass a directory for the pinned Meta Language JavaScript source'
);
const revision = 'a79782093cae3b33606483ac9f3e1d05faf36de0';
const repository = 'link-foundation/meta-language';
const tree = await fetch(
  `https://api.github.com/repos/${repository}/git/trees/${revision}?recursive=1`
);
assert.ok(tree.ok, `GitHub source tree returned ${tree.status}`);
const { truncated, tree: entries } = await tree.json();
assert.equal(truncated, false);
const needed = entries.filter(
  ({ path, type }) =>
    type === 'blob' &&
    (path === 'js/package.json' || path.startsWith('js/src/'))
);
assert.ok(needed.length > 0);

async function copy({ path, sha, size }) {
  const response = await fetch(
    `https://raw.githubusercontent.com/${repository}/${revision}/${path}`
  );
  assert.ok(response.ok, `${path} returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, size, path);
  assert.equal(
    createHash('sha1').update(`blob ${size}\0`).update(bytes).digest('hex'),
    sha,
    path
  );
  const output = resolve(directory, path.slice('js/'.length));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
}

for (let start = 0; start < needed.length; start += 6) {
  await Promise.all(needed.slice(start, start + 6).map(copy));
}
console.log(`Verified and copied ${needed.length} files at ${revision}`);
