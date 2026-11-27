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

function javascriptEmitter(bytes) {
  const source = bytes.toString('utf8');
  const constructor = "'${ctor.name.replace(/'/gu, \"\\\\'\")}'";
  const clampedCast =
    "    if (e.flavor === 'clamp') return `((value) => (value < 0n ? 0n : value))(${arg})`;";
  const helperSlot =
    '  toNatChecked: `function ml_toNatChecked(value, message) {';
  const helperOrder = "'toNatChecked', 'abort'";
  const theoremError = "'theorem ${source} fails on a bounded input'";
  const theoremSuccess = "'theorem ${source}: holds on the bounded domain'";
  const domainHelper = `function ml_product(lists) {
  return lists.reduce((rows, list) => rows.flatMap((row) => list.map((value) => [...row, value])), [[]]);
}`;
  const domainConstructor = [
    '          const object = (args) => this.ctorObject(entry, ctor, args);',
    '          if (!fields.length) return [`[${object([])}]`];',
    "          return [`ml_product([${fields.join(', ')}]).map((args) => ${object(ctor.fields.map((_, index) => `args[${index}]`))})`];",
  ].join('\n');
  if (
    source.split(constructor).length !== 3 ||
    [
      clampedCast,
      helperSlot,
      helperOrder,
      theoremError,
      theoremSuccess,
      domainHelper,
      domainConstructor,
    ].some((part) => source.split(part).length !== 2)
  ) {
    throw new Error('Review the JavaScript generation patch against upstream');
  }
  return Buffer.from(
    source
      .replaceAll(constructor, '${JSON.stringify(ctor.name)}')
      .replace(
        theoremError,
        '${JSON.stringify(`theorem ${source} fails on a bounded input`)}'
      )
      .replace(
        theoremSuccess,
        '${JSON.stringify(`theorem ${source}: holds on the bounded domain`)}'
      )
      .replace(
        helperSlot,
        `  toNatClamped: \`function ml_toNatClamped(value) {\n  return value < 0n ? 0n : value;\n}\`,\n${helperSlot}`
      )
      .replace(helperOrder, "'toNatChecked', 'toNatClamped', 'abort'")
      .replace(
        clampedCast,
        "    if (e.flavor === 'clamp') {\n      this.helpers.add('toNatClamped');\n      return `ml_toNatClamped(${arg})`;\n    }"
      )
      .replace(
        domainHelper,
        () => `${domainHelper}
function ml_ctorDomain(tag, fields, domains) {
  return ml_product(domains).map((args) => Object.freeze(
    Object.fromEntries([['$', tag], ...fields.map((field, index) => [field, args[index]])]),
  ));
}`
      )
      .replace(
        domainConstructor,
        "          const keys = JSON.stringify(ctor.fields.map((field) => fieldKey(field.name)));\n          return [`ml_ctorDomain(${JSON.stringify(ctor.name)}, ${keys}, [${fields.join(', ')}])`];"
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
  } else if (path === 'src/translation/emit-javascript.js') {
    patched = javascriptEmitter(bytes);
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
