#!/usr/bin/env node

/**
 * Syntax-check every tracked JavaScript file (.js, .mjs, .cjs) recursively.
 *
 * Git discovery covers nested sources, tests, shipped examples and local
 * action adapters while skipping dependencies and ignored build output.
 * Historical investigation data is explicitly excluded: it mirrors external
 * sources verbatim and is not executed by this repository.
 *
 * An empty inventory is an error, so a broken discovery cannot pass as green.
 *
 * A .js file with no "type" in its nearest package.json is checked through
 * stdin as CommonJS and then as an ES module: on Node 20 and 22,
 * `node --check` passes such a file whenever it uses import or export, even
 * when it has a syntax error (experiments/issue-10/node-check-untyped-esm.sh).
 *
 * Usage: node scripts/check-javascript-syntax.mjs
 * Exit code 0 = every discovered file passed; 1 = a failure or no evidence.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const EXCLUDED = /^(?:docs\/case-studies|dev\/log)\//;

let tracked;
try {
  tracked = execFileSync(
    'git',
    ['ls-files', '-z', '--', '*.js', '*.mjs', '*.cjs'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
} catch (error) {
  console.error(`::error::Syntax gate could not list files: ${error.message}`);
  process.exit(1);
}

const files = tracked
  .split('\0')
  .filter((file) => file && !EXCLUDED.test(file));

if (!files.length) {
  console.error('::error::Syntax gate found no tracked JavaScript files');
  process.exit(1);
}

const packageTypes = new Map();

// The "type" of the nearest package.json, or undefined when it has none.
function moduleTypeOf(file) {
  let directory = dirname(resolve(file));
  for (;;) {
    if (!packageTypes.has(directory)) {
      const manifest = join(directory, 'package.json');
      packageTypes.set(
        directory,
        existsSync(manifest)
          ? (JSON.parse(readFileSync(manifest, 'utf8')).type ?? null)
          : undefined
      );
    }
    const type = packageTypes.get(directory);
    if (type !== undefined) {
      return type ?? undefined;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
}

// Accepts the file when it compiles as either kind, as Node's detection does.
function checkUntyped(file) {
  const input = readFileSync(file);
  let result;
  const errors = [];
  for (const inputType of ['commonjs', 'module']) {
    result = spawnSync(
      process.execPath,
      [`--input-type=${inputType}`, '--check'],
      { input, encoding: 'utf8', timeout: 10000 }
    );
    if (!result.error && result.status === 0) {
      return result;
    }
    errors.push(`As ${inputType}: ${result.stderr}`);
  }
  process.stderr.write(errors.join('\n'));
  return result;
}

let failures = 0;
for (const file of files) {
  console.log(`Checking ${file}...`);
  const result =
    extname(file) === '.js' && !moduleTypeOf(file)
      ? checkUntyped(file)
      : spawnSync(process.execPath, ['--check', file], {
          stdio: 'inherit',
          timeout: 10000,
        });
  if (result.error || result.status !== 0) {
    const reason = result.error ? `: ${result.error.message}` : '';
    console.error(
      `::error file=${file}::JavaScript syntax check failed${reason}`
    );
    failures++;
  }
}
console.log(
  `Syntax check (Node ${process.version}): ${files.length} file(s), ${failures} failure(s)`
);
process.exitCode = failures ? 1 : 0;
