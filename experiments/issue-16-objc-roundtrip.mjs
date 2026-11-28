import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslator } from '../js/src/index.js';
import { sameMeaning } from '../js/src/meta/tree.js';
const t = createTranslator();
const meta = t.toMeta(
  readFileSync(new URL('../examples/objpak/hello.m', import.meta.url), 'utf8'),
  'objc'
);
for (const target of ['javascript', 'python', 'rust', 'objc']) {
  const written = t.fromMeta(meta, target);
  try {
    const read = t.toMeta(written, target);
    assert.ok(
      sameMeaning(meta, read),
      `${target}: different meanings\n${JSON.stringify(read, null, 2)}`
    );
    console.log(`PASS Objpak ${target} semantic round-trip`);
  } catch (error) {
    console.log(`${target}: ${error.stack}\n${written}`);
    process.exitCode = 1;
  }
}
