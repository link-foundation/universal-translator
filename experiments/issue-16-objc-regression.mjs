// Reproduce the original collection failure against the pre-feature commit.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createTranslator } from '../js/src/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const folder = mkdtempSync(join(tmpdir(), 'objpak-before-'));
const source = readFileSync(
  new URL('../examples/objpak/hello.m', import.meta.url),
  'utf8'
);
try {
  const archive = execFileSync(
    'git',
    ['archive', '0a44abd', 'js/src', 'package.json'],
    { maxBuffer: 8 * 1024 * 1024 }
  );
  execFileSync('tar', ['-x', '-C', folder], { input: archive });
  for (const name of ['node_modules', 'data', 'common-library', 'vendor']) {
    symlinkSync(join(root, name), join(folder, name));
  }
  const baseline = await import(pathToFileURL(join(folder, 'js/src/index.js')));
  assert.throws(
    () => baseline.createTranslator().toMeta(source, 'objc'),
    (error) => {
      console.log(`BEFORE 0a44abd: ${error.message}`);
      return true;
    }
  );
  assert.equal(createTranslator().toMeta(source, 'objc').kind, 'Program');
  console.log(
    'AFTER: the unchanged original Objective-C collection source reads into meta'
  );
} finally {
  rmSync(folder, { recursive: true, force: true });
}
