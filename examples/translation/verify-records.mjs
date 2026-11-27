// Compare the class fragment and both engines' translations in real runtimes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createTranslator } from '../../js/src/index.js';

const temporary = mkdtempSync(join(tmpdir(), 'translator-records-'));
const source = readFileSync(
  new URL('point-class.txt', import.meta.url),
  'utf8'
);
const jsHarness = `
const first = new Point(8, 6);
const second = new Point("west", true);
console.log(first.x, first.y, second.x, second.y);
`;
const rustHarness = `
fn main() {
    let first = Point::new(8, 6);
    let second = Point::new("west", true);
    println!("{} {} {} {}", first.x, first.y, second.x, second.y);
}
`;

function run(command, args, input) {
  const result = spawnSync(command, args, { input, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const translator = createTranslator();
const implementations = [
  [
    'JavaScript',
    (text, from, to) => translator.translateFragment(text, from, to),
  ],
];
if (process.argv[2]) {
  const binary = resolve(process.argv[2]);
  implementations.push([
    'Rust',
    (text, from, to) =>
      run(
        binary,
        ['translate', from, to, '-', '--fragment', '--all-or-nothing'],
        text
      ),
  ]);
}

try {
  const original = run(process.execPath, ['-'], source + jsHarness);
  assert.equal(original, '8 6 west true\n');
  for (const [implementation, translate] of implementations) {
    const rust = translate(source, 'javascript', 'rust');
    const binary = join(temporary, 'point');
    run('rustc', ['--edition=2021', '-o', binary, '-'], rust + rustHarness);
    assert.equal(run(binary, []), original, rust);

    const javascript = translate(rust, 'rust', 'javascript');
    assert.equal(
      run(process.execPath, ['-'], javascript + jsHarness),
      original,
      javascript
    );
    console.log(
      `${implementation}: JavaScript, Rust and recovered JavaScript agree`
    );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
