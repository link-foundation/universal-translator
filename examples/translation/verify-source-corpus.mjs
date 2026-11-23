import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createTranslator,
  readSourceDocument,
  writeSourceDocument,
} from '../../js/src/index.js';
import {
  linkFields,
  namedLinks,
  references,
} from '../../js/src/translation/links.js';
import {
  readCorpusCoverage,
  rosettaPrograms,
  verifyProgram,
} from './corpus-fixtures.mjs';

// The archive driver sends two little-endian lengths followed by the UTF-8
// path and contents. A clean EOF is only legal between records.
function readBytes(length, allowEof = false) {
  const bytes = Buffer.allocUnsafe(length);
  let offset = 0;
  while (offset < length) {
    const count = readSync(0, bytes, offset, length - offset, null);
    if (count === 0) {
      if (allowEof && offset === 0) {
        return undefined;
      }
      throw new Error('Truncated corpus record');
    }
    offset += count;
  }
  return bytes;
}

const utf8 = new globalThis.TextDecoder('utf-8', {
  fatal: true,
  ignoreBOM: true,
});
const translator = createTranslator();
const rust = resolve(process.argv[2] ?? 'target/debug/universal-translator');
const fixtures = new Map();
if (process.argv[3] !== '--hello-world-only') {
  const rosetta = linkFields(readCorpusCoverage().get('rosetta-code'));
  for (const entry of namedLinks(rosetta.get('authored-tasks'), 'task')) {
    const [task, name] = references(entry);
    for (const program of rosettaPrograms(rosetta, task)) {
      fixtures.set(`${name}/${program.path}`, program);
    }
  }
}
let verified = 0;
let verifiedEffects = 0;
for (let header; (header = readBytes(8, true)); ) {
  const path = utf8.decode(readBytes(header.readUInt32LE(0)));
  const bytes = readBytes(header.readUInt32LE(4));
  const language = path.slice(path.indexOf('/') + 1, path.lastIndexOf('/'));
  const notation = writeSourceDocument(language, utf8.decode(bytes));
  const document = readSourceDocument(notation);
  assert.equal(document.language, language, path);
  assert.deepEqual(Buffer.from(document.source), bytes, path);
  const fixture = fixtures.get(path);
  if (fixture) {
    verifyProgram(translator, document.source, fixture, rust);
    fixtures.delete(path);
    verifiedEffects += 1;
  }
  verified += 1;
}
assert.equal(
  fixtures.size,
  0,
  `Missing pinned specimens: ${[...fixtures.keys()]}`
);
assert.ok(verified > 0, 'Expected a stream of pinned corpus source files');
console.log(`JavaScript verified ${verified} source documents`);
if (verifiedEffects) {
  console.log(
    `Both runtimes verified ${verifiedEffects} selected original program effects`
  );
}
