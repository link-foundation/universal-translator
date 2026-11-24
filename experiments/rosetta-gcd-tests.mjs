import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslator } from '../js/src/index.js';

const [implementationFile, testsFile] = process.argv.slice(2);
if (!implementationFile || !testsFile) {
  throw new Error(
    'Supply the pinned Rust GCD implementation and Tests listing'
  );
}

const implementation = readFileSync(implementationFile, 'utf8');
const listing = readFileSync(testsFile, 'utf8');
const [statements, displayedOutput] = listing.split('\n\n');
const expected = '3\n3999\n13\n';
assert.equal(displayedOutput, expected, 'Published GCD results');

const calls = statements.split('\n').map((statement) => {
  const match =
    /^\s*println!\("\{\}",gcd\((-?\d+(?:\*\d+)?),(-?\d+(?:\*\d+)?)\)\);$/.exec(
      statement
    );
  assert.ok(match, `Expected an integer GCD call: ${statement}`);
  return [match[1], match[2]];
});
assert.equal(calls.length, 3);

const translator = createTranslator();
const options = { mode: 'same-effect' };
const document = translator.parse(implementation, 'rust');
assert.equal(translator.restore(document), implementation);
assert.deepEqual(document.interpretation.effect, {
  task: 'gcd-function',
  max: 2147483647,
});
const effect = translator.translate(implementation, 'rust', 'meta', options);
const javascript = translator.translate(effect, 'meta', 'javascript', options);

const workspace = mkdtempSync(join(tmpdir(), 'translator-rosetta-gcd-'));
try {
  const run = { cwd: workspace, encoding: 'utf8', timeout: 15000 };
  writeFileSync(
    join(workspace, 'fixture.rs'),
    `${implementation}\nfn main() {\n${statements}\n}\n`
  );
  const javascriptTests = calls.map(
    ([left, right]) => `console.log(gcd(${left}, ${right}));`
  );
  writeFileSync(
    join(workspace, 'fixture.cjs'),
    `${javascript}\n${javascriptTests.join('\n')}\n`
  );
  execFileSync('rustc', ['--edition=2021', 'fixture.rs', '-o', 'fixture'], run);
  assert.equal(execFileSync(join(workspace, 'fixture'), [], run), expected);
  assert.equal(execFileSync(process.execPath, ['fixture.cjs'], run), expected);
  console.log(
    'The three published GCD calls match the transcript in Rust and JavaScript.'
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
