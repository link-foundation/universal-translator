#!/usr/bin/env node
// Reproduce the grammar and Node CLI sources shared with the Rust dependency.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(
  new URL('../vendor/meta-language-grammar/', import.meta.url)
);
const manifestPath = join(root, 'SOURCE.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function portableHash(source) {
  const from = "import { createHash } from 'node:crypto';";
  const expression =
    "return createHash('sha256').update(`${lines.join('\\n')}\\n`).digest('hex');";
  if (!source.includes(from) || !source.includes(expression)) {
    throw new Error(
      'The upstream hash implementation changed; review the portable patch'
    );
  }
  return source
    .replace(
      from,
      "import { sha256 } from '@noble/hashes/sha256';\nimport { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';"
    )
    .replace(
      expression,
      "return bytesToHex(sha256(utf8ToBytes(`${lines.join('\\n')}\\n`)));"
    );
}

function grammarNotice(bytes, revision) {
  return Buffer.from(
    bytes
      .toString('utf8')
      .replaceAll(
        /\]\(\.\.\/\.\.\/\.\.\/\.\.\/((?:rust|js)\/[^)]+)\)/gu,
        `](${manifest.repository}/blob/${revision}/$1)`
      )
  );
}

const check = process.argv[2] === '--check';
const revision = check
  ? manifest.revision
  : (process.argv[2] ?? manifest.revision);
if (!/^[a-f0-9]{40}$/u.test(revision)) {
  throw new Error('Supply a full upstream commit SHA or --check');
}
for (const [path, entry] of Object.entries(manifest.files)) {
  const destination = join(root, path);
  if (check) {
    if (digest(await readFile(destination)) !== entry.sha256) {
      throw new Error(
        `Vendored source differs from its recorded digest: ${path}`
      );
    }
    continue;
  }
  const upstream = path === 'LICENSE' ? path : `js/${path}`;
  const url = `${manifest.repository.replace('github.com', 'raw.githubusercontent.com')}/${revision}/${upstream}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not retrieve ${upstream}: HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1024 * 1024) {
    throw new Error(`Review unexpectedly large upstream source: ${path}`);
  }
  let patched = bytes;
  if (path === 'src/grammar-merge.js') {
    patched = Buffer.from(portableHash(bytes.toString('utf8')));
  } else if (path === 'src/vendor/grammars/NOTICE.md') {
    patched = grammarNotice(bytes, revision);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, patched);
  manifest.files[path] = {
    upstreamSha256: digest(bytes),
    sha256: digest(patched),
  };
}
if (!check) {
  manifest.revision = revision;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(
  `${check ? 'Verified' : 'Updated'} ${Object.keys(manifest.files).length} pinned grammar files at ${revision}`
);
