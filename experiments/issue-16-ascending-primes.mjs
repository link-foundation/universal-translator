import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractSolutions } from '../scripts/rosetta-code.mjs';

const [wikiResponse, rustTranslator] = process.argv.slice(2);
assert.ok(wikiResponse, 'Pass the MediaWiki response for revision 419038');
const { query } = JSON.parse(readFileSync(wikiResponse, 'utf8'));
const page = query.pages.find(({ title }) => title === 'Ascending primes');
const revision = page.revisions[0];
assert.equal(revision.revid, 419038);
const [source] = extractSolutions(revision.slots.main.content).cpp;
const digest = (text) => createHash('sha256').update(text).digest('hex');
const sourceSha256 = digest(source);
assert.equal(
  sourceSha256,
  'eaddf1ae100c4a5ed569a2b1eb4258e519d8e756d1d2c6a35873866ac4c31576'
);

const directory = mkdtempSync(join(tmpdir(), 'ascending-primes-'));
try {
  const file = join(directory, 'ascending-primes.cpp');
  const binary = join(directory, 'ascending-primes');
  const options = { encoding: 'utf8', maxBuffer: 32 * 1024 };
  const run = (program) => {
    writeFileSync(file, program);
    execFileSync(
      'g++',
      [
        '-std=c++17',
        '-include',
        'iterator',
        '-include',
        'algorithm',
        file,
        '-o',
        binary,
      ],
      options
    );
    return execFileSync(binary, [], options);
  };
  const original = run(source);
  const outputSha256 = digest(original);
  assert.equal(
    outputSha256,
    '0a7180e6a9ca8b03578d0d47b30d289f9b9020a086e3bec0982441fa15ef983f'
  );
  const cli = fileURLToPath(
    new URL('../bin/universal-translator.js', import.meta.url)
  );
  const translators = [['JavaScript', process.execPath, [cli]]];
  if (rustTranslator) {
    translators.push(['Rust', rustTranslator, []]);
  }
  for (const [engine, command, args] of translators) {
    const program = execFileSync(
      command,
      [...args, 'translate', 'cpp', 'cpp', '-', '--all-or-nothing'],
      {
        ...options,
        input: source,
      }
    );
    assert.equal(run(program), original, engine);
    console.log(
      JSON.stringify({
        engine,
        bytes: Buffer.byteLength(original),
        sourceSha256,
        outputSha256,
      })
    );
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
