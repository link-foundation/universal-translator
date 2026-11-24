import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  linkFields,
  parseLinks,
  references,
} from '../../js/src/translation/links.js';
import { translationData } from './fixtures.mjs';

export function readPortablePrograms() {
  const programs = linkFields(
    parseLinks(translationData('portable-programs.lino'))
  );
  return new Map(
    [...programs].map(([path, fields]) => [
      path,
      `${references(linkFields(fields).get('stdout')).join('\n')}\n`,
    ])
  );
}

function run(command, args, label, input) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input,
    timeout: 45000,
    maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${label}: ${result.stderr || result.signal}`);
  return result;
}

export function verifyPortableOutput(programs, stdout, label) {
  const work = mkdtempSync(join(tmpdir(), 'translator-programs-'));
  try {
    for (const [index, { language, source }] of programs.entries()) {
      const name = join(work, `program_${index}`);
      const ext = language === 'javascript' ? 'cjs' : 'rs';
      const file = `${name}.${ext}`;
      writeFileSync(file, source);
      const description = `${label} (${language}, specimen ${index + 1})`;
      let result;
      if (language === 'javascript') {
        result = run(process.execPath, [file], description);
      } else {
        run('rustc', ['--edition=2021', file, '-o', name], description);
        result = run(name, [], description);
      }
      assert.equal(result.stdout, stdout, description);
      assert.equal(result.stderr, '', description);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export function verifyPortableProgram(
  translator,
  rustBinary,
  { path, language, source, stdout }
) {
  const from = language.toLowerCase();
  const to = from === 'javascript' ? 'rust' : 'javascript';
  const javascript = translator.translate({ language, source }, to);
  const rust = run(
    rustBinary,
    ['translate-program', from, to],
    path,
    source
  ).stdout;
  verifyPortableOutput(
    [
      { language: from, source },
      ...[...new Set([javascript, rust])].map((source) => ({
        language: to,
        source,
      })),
    ],
    stdout,
    path
  );
}
