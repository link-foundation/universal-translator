// Run both engines’ class fragments and complete instance programs.
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
const instanceProgram = readFileSync(
  new URL('point-instances.txt', import.meta.url),
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
    (text, from, to, fragment) =>
      fragment
        ? translator.translateFragment(text, from, to)
        : translator.translate(text, from, to, { allowPartial: false }),
  ],
];
if (process.argv[2]) {
  const binary = resolve(process.argv[2]);
  implementations.push([
    'Rust',
    (text, from, to, fragment) =>
      run(
        binary,
        [
          'translate',
          from,
          to,
          '-',
          '--all-or-nothing',
          ...(fragment ? ['--fragment'] : []),
        ],
        text
      ),
  ]);
}

try {
  const original = run(process.execPath, ['-'], source + jsHarness);
  assert.equal(original, '8 6 west true\n');
  const originalInstances = run(process.execPath, ['-'], instanceProgram);
  assert.equal(originalInstances, '-8 6 west true\n');
  for (const [implementation, translate] of implementations) {
    const rust = translate(source, 'javascript', 'rust', true);
    const binary = join(temporary, 'point');
    run('rustc', ['--edition=2021', '-o', binary, '-'], rust + rustHarness);
    assert.equal(run(binary, []), original, rust);

    const javascript = translate(rust, 'rust', 'javascript', true);
    assert.equal(
      run(process.execPath, ['-'], javascript + jsHarness),
      original,
      javascript
    );
    const rustProgram = translate(instanceProgram, 'javascript', 'rust');
    run('rustc', ['--edition=2021', '-o', binary, '-'], rustProgram);
    assert.equal(run(binary, []), originalInstances, rustProgram);
    const recovered = translate(rustProgram, 'rust', 'javascript');
    assert.equal(
      run(process.execPath, ['-'], recovered),
      originalInstances,
      recovered
    );
    console.log(
      `${implementation}: fragment and complete program agree in original JavaScript, Rust and recovered JavaScript`
    );
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
