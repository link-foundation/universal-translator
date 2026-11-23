import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import {
  createSourceSyntaxCodec,
  writeSourceDocument,
} from '../js/src/index.js';

const [modulePath, executable = 'target/debug/universal-translator'] =
  process.argv.slice(2);
assert.ok(modulePath, 'Pass the Meta Language 1.0 JavaScript module path');
const { LinkNetwork, LinkType } = await import(
  pathToFileURL(resolve(modulePath))
);
const codec = createSourceSyntaxCodec(LinkNetwork);

function rust(arguments_, input) {
  const result = spawnSync(resolve(executable), arguments_, {
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const hello = (ext) =>
  readFileSync(
    new URL(`../examples/translation/hello.${ext}`, import.meta.url),
    'utf8'
  );
const samples = [
  [
    'JavaScript',
    '\ufeff// 🐍\r\nconst greeting = "Hello";',
    'lexical_declaration',
  ],
  ['Rust', '  fn main() { /* 🦀 */ }\n\r\n', 'function_item'],
  ['Python', 'def greet():\r\n    return "Hello"\r\n', 'function_definition'],
  ['C', hello('c'), 'function_definition'],
  ['C#', hello('cs'), 'class_declaration'],
  ['sql-sqlite', '  SELECT 1; -- comment\n', 'statement'],
  ['rust', '', 'source_file'],
];
for (const [language, source, term] of samples) {
  const javascriptNotation = codec.write(language, source);
  const rustNotation = rust(['encode-cst', language], source);
  for (const notation of [javascriptNotation, rustNotation]) {
    const network = LinkNetwork.fromLino(notation);
    assert.ok(
      network.links().some((link) => {
        const metadata = link.metadata();
        return metadata.linkType === LinkType.Syntax && metadata.term === term;
      }),
      `${language} CST lacks ${term}`
    );
    assert.deepEqual(codec.read(notation), { language, source });
    assert.equal(rust(['decode-cst'], notation), source);
  }
}
assert.throws(() => codec.write('Nonexistent grammar', 'text'), /provenance/);
assert.throws(() => codec.read(writeSourceDocument('Rust', 'fn main() {}')));
console.log(
  `Both implementations encoded and restored ${samples.length} grammar CST specimens`
);
