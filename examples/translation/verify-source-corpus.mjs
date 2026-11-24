import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { appendFileSync, readSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createProgramTranslator,
  createTranslator,
  readSourceDocument,
  writeSourceDocument,
} from '../../js/src/index.js';
import {
  formatRecord,
  linkFields,
  reference,
} from '../../js/src/translation/links.js';
import {
  readCorpusCoverage,
  rosettaPrograms,
  rosettaTasks,
  verifyProgram,
} from './corpus-fixtures.mjs';
import {
  readPortablePrograms,
  verifyPortableProgram,
} from './portable-programs.mjs';

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
const flags = process.argv.slice(3);
const helloWorldOnly = flags.includes('--hello-world-only');
const requireFullNative = flags.includes('--require-full-native');
const enginePath = process.env.UNIVERSAL_TRANSLATOR_META_LANGUAGE;
const programTranslator =
  !helloWorldOnly && enginePath
    ? createProgramTranslator(await import(pathToFileURL(resolve(enginePath))))
    : undefined;
const portable = programTranslator ? readPortablePrograms() : new Map();
const fixtures = new Map();
const native = new Map();
if (!helloWorldOnly) {
  const rosetta = linkFields(readCorpusCoverage().get('rosetta-code'));
  for (const [name, id] of [
    ['JavaScript', 'javascript'],
    ['Rust', 'rust'],
  ]) {
    native.set(name, {
      available: 0,
      checked: 0,
      expected: Number(reference(rosetta.get(`archive-${id}-count`))),
    });
  }
  for (const task of [
    ...rosettaTasks(rosetta),
    ...rosettaTasks(rosetta, 'partial-tasks'),
  ]) {
    for (const program of rosettaPrograms(rosetta, task)) {
      fixtures.set(`${task.name}/${program.path}`, program);
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
  const coverage = path.startsWith('Hello World Collection/')
    ? undefined
    : native.get(language);
  if (coverage) {
    coverage.available += 1;
  }
  const fixture = fixtures.get(path);
  const stdout = portable.get(path);
  if (stdout !== undefined) {
    assert.ok(coverage && !fixture, path);
    verifyPortableProgram(programTranslator, rust, {
      path,
      language,
      source: document.source,
      stdout,
    });
    coverage.checked += 1;
    portable.delete(path);
    verifiedEffects += 1;
  } else if (fixture) {
    if (await verifyProgram(translator, document.source, fixture, rust, true)) {
      assert.ok(coverage, path);
      coverage.checked += 1;
    }
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
assert.equal(
  portable.size,
  0,
  `Missing pinned specimens: ${[...portable.keys()]}`
);
assert.ok(verified > 0, 'Expected a stream of pinned corpus source files');
console.log(`JavaScript verified ${verified} source documents`);
if (verifiedEffects) {
  console.log(
    `Both runtimes verified ${verifiedEffects} selected original program effects`
  );
}
if (!helloWorldOnly) {
  let summary = '### Native Rosetta Code translation\n\n';
  summary +=
    '| Source language | Native translation verified | Archived examples |\n';
  summary += '| --- | ---: | ---: |\n';
  let complete = true;
  for (const [language, { checked, available, expected }] of native) {
    assert.equal(available, expected, `Pinned file count for ${language}`);
    assert.ok(checked > 0, `Expected native checks for ${language}`);
    console.log(
      formatRecord('rosetta-native-coverage', {
        language,
        verified: checked,
        archived: available,
        remaining: available - checked,
      })
    );
    summary += `| ${language} | ${checked} | ${available} |\n`;
    complete &&= checked === available;
  }
  if (!complete) {
    summary += '\nThe full native corpus requirement remains open.\n';
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `full-native=${complete}\n`);
  }
  assert.ok(
    !requireFullNative || complete,
    'Full native Rosetta Code translation is required'
  );
}
